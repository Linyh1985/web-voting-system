// SQLite 数据库（sql.js 纯WASM实现，无需编译，开箱即用）
// 提供 better-sqlite3 兼容 API，所有服务代码无需改动
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcryptjs from 'bcryptjs';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.resolve(dataDir, 'vote.db');

// ============ better-sqlite3 兼容包装层 ============
class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
    this._stmt = db.prepare(sql);
  }
  run(...params) {
    this._stmt.bind(params);
    this._stmt.step();
    this._stmt.reset();
    // 获取最后一次插入的rowid（sql.js需查询）
    const r = this._db.exec('SELECT last_insert_rowid() AS id, changes() AS c');
    const lastId = (r[0] && r[0].values[0][0]) || 0;
    const changes = (r[0] && r[0].values[0][1]) || 0;
    saveDb(); // 写操作后持久化
    return { lastInsertRowid: lastId, changes };
  }
  get(...params) {
    this._stmt.bind(params);
    const row = this._stmt.step() ? this._stmt.getAsObject() : undefined;
    this._stmt.reset();
    return row;
  }
  all(...params) {
    this._stmt.bind(params);
    const rows = [];
    while (this._stmt.step()) rows.push(this._stmt.getAsObject());
    this._stmt.reset();
    return rows;
  }
}

class DBWrapper {
  constructor(sqliteDb) { this._db = sqliteDb; }
  exec(sql) { this._db.exec(sql); saveDb(); }
  prepare(sql) { return new Statement(this._db, sql); }
  pragma() { /* no-op: sql.js 不支持WAL，忽略 */ }
  transaction(fn) {
    const self = this;
    return function (...args) {
      self._db.run('BEGIN');
      try {
        const result = fn.apply(this, args);
        self._db.run('COMMIT');
        saveDb();
        return result;
      } catch (e) {
        self._db.run('ROLLBACK');
        throw e;
      }
    };
  }
}

// 持久化（防抖：合并短时间内的多次写入）
let saveTimer = null;
function saveDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const data = rawDb.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (e) { console.error('[DB] save error', e.message); }
  }, 200);
}

// ============ 初始化 ============
const SQL = await initSqlJs({ locateFile: f => path.resolve(__dirname, '../node_modules/sql.js/dist/' + f) });
let rawDb;
if (fs.existsSync(dbPath)) {
  rawDb = new SQL.Database(fs.readFileSync(dbPath));
} else {
  rawDb = new SQL.Database();
}
export const db = new DBWrapper(rawDb);

// 退出时确保落盘
process.on('exit', () => { try { fs.writeFileSync(dbPath, Buffer.from(rawDb.export())); } catch {} });
process.on('SIGINT', () => { try { fs.writeFileSync(dbPath, Buffer.from(rawDb.export())); } catch {} process.exit(); });

// ============ 建表 ============
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      phone TEXT,
      email TEXT,
      role INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 1,
      is_blacklist INTEGER NOT NULL DEFAULT 0,
      last_login_ip TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_url TEXT,
      category TEXT,
      creator_id INTEGER NOT NULL,
      vote_type INTEGER NOT NULL DEFAULT 1,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_votes_per_user INTEGER NOT NULL DEFAULT 0,
      daily_limit INTEGER NOT NULL DEFAULT 0,
      result_visible INTEGER NOT NULL DEFAULT 0,
      password TEXT,
      status INTEGER NOT NULL DEFAULT 1,
      end_message TEXT,
      redirect_url TEXT,
      is_template INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_votes_creator ON votes(creator_id);
    CREATE INDEX IF NOT EXISTS idx_votes_status ON votes(status);
    CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category);

    CREATE TABLE IF NOT EXISTS vote_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      question_type INTEGER NOT NULL,
      min_select INTEGER DEFAULT 1,
      max_select INTEGER DEFAULT 1,
      min_score INTEGER DEFAULT 1,
      max_score INTEGER DEFAULT 10,
      required INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_questions_vote ON vote_questions(vote_id);

    CREATE TABLE IF NOT EXISTS vote_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      vote_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      vote_count INTEGER NOT NULL DEFAULT 0,
      score_sum REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_options_vote ON vote_options(vote_id);
    CREATE INDEX IF NOT EXISTS idx_options_count ON vote_options(vote_id, vote_count DESC);

    CREATE TABLE IF NOT EXISTS vote_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      option_id INTEGER,
      user_id INTEGER,
      answer_text TEXT,
      score INTEGER,
      rank_value TEXT,
      device_fp TEXT,
      ip TEXT NOT NULL,
      user_agent TEXT,
      is_valid INTEGER NOT NULL DEFAULT 1,
      invalid_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_records_vote_user ON vote_records(vote_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_records_vote_fp ON vote_records(vote_id, device_fp);
    CREATE INDEX IF NOT EXISTS idx_records_vote_ip ON vote_records(vote_id, ip, created_at);
    CREATE INDEX IF NOT EXISTS idx_records_time ON vote_records(created_at);

    CREATE TABLE IF NOT EXISTS device_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_fp TEXT NOT NULL UNIQUE,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS ip_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL UNIQUE,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vote_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(vote_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS option_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER NOT NULL,
      user_id INTEGER,
      username TEXT,
      content TEXT NOT NULL,
      like_count INTEGER NOT NULL DEFAULT 0,
      is_reported INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_comments_option ON option_comments(option_id, created_at);

    CREATE TABLE IF NOT EXISTS option_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER NOT NULL,
      user_id INTEGER,
      device_fp TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(option_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      vote_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(user_id, vote_id)
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      admin_name TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_admin ON admin_logs(admin_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_action ON admin_logs(action);

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vote_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      cover_url TEXT,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 验证码表（短信/邮箱）
    CREATE TABLE IF NOT EXISTS verify_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,             -- 'sms' 或 'mail'
      target TEXT NOT NULL,              -- 手机号或邮箱
      code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'login', -- login/bind/reset
      consumed INTEGER NOT NULL DEFAULT 0,
      expire_at TEXT NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_verify_target ON verify_codes(target, consumed, expire_at);

    -- OAuth 流程票据表（微信/QQ 扫码临时 state/ticket → openid）
    CREATE TABLE IF NOT EXISTS oauth_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,            -- 'wechat' 或 'qq'
      ticket TEXT NOT NULL UNIQUE,       -- 前端持有的票据(state)
      openid TEXT,                       -- 扫码后写入
      nickname TEXT,
      avatar TEXT,
      consumed INTEGER NOT NULL DEFAULT 0,
      expire_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_ticket ON oauth_tickets(ticket, consumed);
  `);

  // 兼容已存在的 users 表：补充新字段（SQLite 不支持 ADD COLUMN IF NOT EXISTS，用 PRAGMA 检查）
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  const addCol = (name, def) => {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
      console.log(`[DB] users 表新增字段: ${name}`);
    }
  };
  addCol('wechat_openid', 'TEXT');
  addCol('qq_openid', 'TEXT');
  addCol('unionid', 'TEXT');
  addCol('bind_phone', 'INTEGER NOT NULL DEFAULT 0'); // 是否已验证手机
  addCol('bind_email', 'INTEGER NOT NULL DEFAULT 0'); // 是否已验证邮箱

  console.log('[DB] SQLite (sql.js) initialized at', dbPath);
}

// 初始化种子数据
export function seedData() {
  const exists = db.prepare('SELECT id, role FROM users WHERE username = ?').get('admin');
  if (!exists) {
    const hash = bcryptjs.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (username, password_hash, nickname, role, status)
      VALUES (?, ?, '系统管理员', 1, 1)`).run('admin', hash);
    console.log('[DB] Default admin: admin / admin123');
  } else if (exists.role !== 1) {
    // 修复历史数据：确保 admin 账号拥有管理员权限
    db.prepare('UPDATE users SET role=1, nickname=COALESCE(nickname,\'系统管理员\') WHERE username=?').run('admin');
    console.log('[DB] Fixed admin role to 1');
  }

  const tplExists = db.prepare('SELECT id FROM vote_templates LIMIT 1').get();
  if (!tplExists) {
    const templates = [
      { name: '活动评选', category: '评选', config: JSON.stringify({ title: '最佳员工评选', description: '请为您支持的候选人投票', vote_type: 1, questions: [{ title: '您支持的候选人是？', question_type: 1, options: [{ content: '候选人A' }, { content: '候选人B' }, { content: '候选人C' }] }] }) },
      { name: '满意度调研', category: '问卷', config: JSON.stringify({ title: '产品满意度调研', description: '感谢您参与调研', vote_type: 7, questions: [{ title: '整体满意度打分', question_type: 3, min_score: 1, max_score: 10 }, { title: '最满意的方面(多选)', question_type: 2, min_select: 1, max_select: 3, options: [{ content: '功能' }, { content: '性能' }, { content: '界面' }, { content: '服务' }] }] }) },
      { name: '问卷测评', category: '问卷', config: JSON.stringify({ title: '用户体验测评', description: '请您如实填写', vote_type: 7, questions: [{ title: '您的年龄段', question_type: 1, options: [{ content: '18-25' }, { content: '26-35' }, { content: '36-50' }] }, { title: '建议与反馈', question_type: 5 }] }) },
      { name: '主题投票', category: '评选', config: JSON.stringify({ title: '最佳团建活动主题', description: '选出你最期待的团建活动', vote_type: 2, max_votes_per_user: 0, questions: [{ title: '选择你喜欢的活动(可多选)', question_type: 2, min_select: 1, max_select: 2, options: [{ content: '户外拓展' }, { content: '聚餐' }, { content: '桌游' }, { content: '旅行' }] }] }) }
    ];
    const stmt = db.prepare('INSERT INTO vote_templates (name, category, config) VALUES (?,?,?)');
    for (const t of templates) stmt.run(t.name, t.category, t.config);
    console.log('[DB] Default templates seeded');
  }

  const cfgExists = db.prepare("SELECT key FROM system_config WHERE key='site_name'").get();
  if (!cfgExists) {
    db.prepare("INSERT INTO system_config (key, value) VALUES ('site_name','投票系统'), ('anti_cheat_enabled','1'), ('captcha_enabled','1'), ('ip_limit_enabled','1'), ('device_limit_enabled','1')").run();
  }
}

initDatabase();
seedData();
// 立即落盘一次
fs.writeFileSync(dbPath, Buffer.from(rawDb.export()));
