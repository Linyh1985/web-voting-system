// 后台管理服务
import { db } from '../db.js';

export function adminLog(adminId, adminName, action, targetType, targetId, detail, ip) {
  db.prepare(`INSERT INTO admin_logs (admin_id, admin_name, action, target_type, target_id, detail, ip)
    VALUES (?,?,?,?,?,?,?)`).run(adminId, adminName, action, targetType, targetId, detail, ip);
}

// 用户管理
export function listUsers({ page = 1, size = 20, keyword, role, status }) {
  const where = ['1=1'];
  const params = [];
  if (keyword) { where.push('(username LIKE ? OR nickname LIKE ? OR phone LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (role !== undefined && role !== '') { where.push('role = ?'); params.push(role); }
  if (status !== undefined && status !== '') { where.push('status = ?'); params.push(status); }
  const total = db.prepare(`SELECT COUNT(*) c FROM users WHERE ${where.join(' AND ')}`).get(...params).c;
  const list = db.prepare(`SELECT id, username, nickname, avatar, phone, email, role, status, is_blacklist,
    last_login_ip, last_login_at, created_at FROM users WHERE ${where.join(' AND ')}
    ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, size, (page - 1) * size);
  return { total, list };
}

export function updateUserStatus(userId, field, value, adminId, adminName, ip) {
  const allowed = ['status', 'is_blacklist', 'role'];
  if (!allowed.includes(field)) throw new Error('非法字段');
  db.prepare(`UPDATE users SET ${field}=? WHERE id=?`).run(value, userId);
  adminLog(adminId, adminName, `set_${field}`, 'user', userId, `${field}=${value}`, ip);
  return true;
}

// 投票审核
export function adminVoteAction(adminId, adminName, voteId, action, ip) {
  const vote = db.prepare('SELECT * FROM votes WHERE id=?').get(voteId);
  if (!vote) throw new Error('投票不存在');
  switch (action) {
    case 'offline': db.prepare('UPDATE votes SET status=2 WHERE id=?').run(voteId); break;
    case 'online': db.prepare('UPDATE votes SET status=1 WHERE id=?').run(voteId); break;
    case 'end': db.prepare('UPDATE votes SET status=3 WHERE id=?').run(voteId); break;
    case 'delete':
      db.prepare('DELETE FROM vote_options WHERE vote_id=?').run(voteId);
      db.prepare('DELETE FROM vote_questions WHERE vote_id=?').run(voteId);
      db.prepare('DELETE FROM votes WHERE id=?').run(voteId);
      break;
    default: throw new Error('未知操作');
  }
  adminLog(adminId, adminName, `vote_${action}`, 'vote', voteId, vote.title, ip);
  return true;
}

// 日志查询
export function listLogs({ page = 1, size = 20, action, adminId }) {
  const where = ['1=1'];
  const params = [];
  if (action) { where.push('action LIKE ?'); params.push(`%${action}%`); }
  if (adminId) { where.push('admin_id = ?'); params.push(adminId); }
  const total = db.prepare(`SELECT COUNT(*) c FROM admin_logs WHERE ${where.join(' AND ')}`).get(...params).c;
  const list = db.prepare(`SELECT * FROM admin_logs WHERE ${where.join(' AND ')}
    ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, size, (page - 1) * size);
  return { total, list };
}

// 黑名单管理
export function listBlacklist() {
  const devices = db.prepare('SELECT * FROM device_blacklist ORDER BY id DESC').all();
  const ips = db.prepare('SELECT * FROM ip_blacklist ORDER BY id DESC').all();
  return { devices, ips };
}

export function addToBlacklist(type, value, reason, adminId, adminName, ip) {
  if (type === 'device') {
    db.prepare('INSERT OR IGNORE INTO device_blacklist (device_fp, reason) VALUES (?,?)').run(value, reason);
  } else {
    db.prepare('INSERT OR IGNORE INTO ip_blacklist (ip, reason) VALUES (?,?)').run(value, reason);
  }
  adminLog(adminId, adminName, `add_blacklist_${type}`, type, null, value, ip);
  return true;
}

export function removeFromBlacklist(type, id, adminId, adminName, ip) {
  if (type === 'device') db.prepare('DELETE FROM device_blacklist WHERE id=?').run(id);
  else db.prepare('DELETE FROM ip_blacklist WHERE id=?').run(id);
  adminLog(adminId, adminName, `remove_blacklist_${type}`, type, id, '', ip);
  return true;
}

// 系统配置
export function getSystemConfig() {
  const rows = db.prepare('SELECT key, value FROM system_config').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  return obj;
}

export function updateSystemConfig(configObj, adminId, adminName, ip) {
  const stmt = db.prepare(`INSERT INTO system_config (key, value, updated_at) VALUES (?,?,datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now','localtime')`);
  for (const [k, v] of Object.entries(configObj)) stmt.run(k, String(v));
  adminLog(adminId, adminName, 'update_config', 'system', null, JSON.stringify(configObj), ip);
  return true;
}

// 模板管理
export function listTemplates(category) {
  if (category) return db.prepare('SELECT * FROM vote_templates WHERE category=? ORDER BY id DESC').all(category);
  return db.prepare('SELECT * FROM vote_templates ORDER BY id DESC').all();
}

export function addTemplate(name, category, coverUrl, configJson) {
  return db.prepare('INSERT INTO vote_templates (name, category, cover_url, config) VALUES (?,?,?,?)')
    .run(name, category, coverUrl, configJson).lastInsertRowid;
}
