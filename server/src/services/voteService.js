// 投票核心服务：创建/查询/提交（支持全题型）
import { db } from '../db.js';
import { cacheSet, cacheGet, cacheIncrTTL } from '../middlewares/antiCheat.js';

// 创建投票（事务保证一致性）
export function createVote(creatorId, payload) {
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO votes
      (title, description, cover_url, category, creator_id, vote_type, is_anonymous,
       start_time, end_time, max_votes_per_user, daily_limit, result_visible, password,
       status, end_message, redirect_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      payload.title, payload.description || '', payload.cover_url || null,
      payload.category || null, creatorId, payload.vote_type || 1, payload.is_anonymous ? 1 : 0,
      payload.start_time, payload.end_time, payload.max_votes_per_user ?? 0,
      payload.daily_limit ?? 0, payload.result_visible ?? 0, payload.password || null,
      payload.status ?? 1, payload.end_message || null, payload.redirect_url || null
    );
    const voteId = info.lastInsertRowid;
    (payload.questions || []).forEach((q, qi) => {
      const qInfo = db.prepare(`INSERT INTO vote_questions
        (vote_id, title, question_type, min_select, max_select, min_score, max_score, required, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        voteId, q.title, q.question_type, q.min_select ?? 1, q.max_select ?? 1,
        q.min_score ?? 1, q.max_score ?? 10, q.required ? 1 : 0, qi
      );
      const qId = qInfo.lastInsertRowid;
      (q.options || []).forEach((o, oi) => {
        db.prepare(`INSERT INTO vote_options (question_id, vote_id, content, image_url, sort_order)
          VALUES (?,?,?,?,?)`).run(qId, voteId, o.content, o.image_url || null, oi);
      });
    });
    return voteId;
  });
  const id = tx();
  // 清统计缓存
  cacheSet(`stats:${id}`, null, 1);
  return id;
}

// 复制投票
export function duplicateVote(userId, voteId) {
  const vote = db.prepare('SELECT * FROM votes WHERE id=?').get(voteId);
  if (!vote) throw new Error('投票不存在');
  const questions = db.prepare('SELECT * FROM vote_questions WHERE vote_id=? ORDER BY sort_order').all(voteId);
  const payload = {
    title: vote.title + ' (副本)', description: vote.description, cover_url: vote.cover_url,
    category: vote.category, vote_type: vote.vote_type, is_anonymous: vote.is_anonymous,
    start_time: vote.start_time, end_time: vote.end_time, max_votes_per_user: vote.max_votes_per_user,
    daily_limit: vote.daily_limit, result_visible: vote.result_visible, password: vote.password,
    status: 0, end_message: vote.end_message, redirect_url: vote.redirect_url,
    questions: questions.map(q => ({
      title: q.title, question_type: q.question_type, min_select: q.min_select, max_select: q.max_select,
      min_score: q.min_score, max_score: q.max_score, required: q.required,
      options: db.prepare('SELECT content, image_url FROM vote_options WHERE question_id=? ORDER BY sort_order').all(q.id)
    }))
  };
  return createVote(userId, payload);
}

// 获取投票详情（含题目选项 + 检查密码）
export function getVoteDetail(voteId, opts = {}) {
  const vote = db.prepare(`SELECT v.*, u.username AS creator_name
    FROM votes v LEFT JOIN users u ON u.id = v.creator_id WHERE v.id = ?`).get(voteId);
  if (!vote) return null;

  // 访问量+1（仅详情接口，避免重复）
  if (opts.incView) {
    db.prepare('UPDATE votes SET view_count = view_count + 1 WHERE id = ?').run(voteId);
    vote.view_count += 1;
  }

  const questions = db.prepare('SELECT * FROM vote_questions WHERE vote_id = ? ORDER BY sort_order').all(voteId);
  for (const q of questions) {
    q.options = db.prepare('SELECT id, content, image_url, sort_order, vote_count, score_sum FROM vote_options WHERE question_id = ? ORDER BY sort_order').all(q.id);
  }
  vote.questions = questions;

  // 检查是否已投票（基于user或device）
  if (opts.userId || opts.deviceFp) {
    const cond = opts.userId ? 'user_id = ?' : 'device_fp = ?';
    const val = opts.userId || opts.deviceFp;
    const cnt = db.prepare(`SELECT COUNT(DISTINCT substr(created_at,1,10)) c FROM vote_records
      WHERE vote_id=? AND ${cond} AND is_valid=1`).get(voteId, val);
    vote.has_voted = (cnt?.c || 0) > 0;
    vote.voted_days = cnt?.c || 0;
  }
  return vote;
}

// 投票列表（分页 + 筛选）
export function listVotes({ page = 1, size = 10, status, category, keyword, creatorId, sort = 'hot' }) {
  const where = ['v.status != 0']; // 不显示草稿(除非自己)
  const params = [];
  if (status !== undefined && status !== '') { where.push('v.status = ?'); params.push(status); }
  if (category) { where.push('v.category = ?'); params.push(category); }
  if (keyword) { where.push('v.title LIKE ?'); params.push(`%${keyword}%`); }
  if (creatorId) { where.push('v.creator_id = ?'); params.push(creatorId); }

  const orderBy = sort === 'new' ? 'v.id DESC'
    : sort === 'hot' ? 'v.view_count DESC'
    : 'v.id DESC';
  const offset = (page - 1) * size;
  const total = db.prepare(`SELECT COUNT(*) c FROM votes v WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(`SELECT v.*, u.username AS creator_name,
    (SELECT COUNT(*) FROM vote_records r WHERE r.vote_id=v.id AND r.is_valid=1) AS vote_count
    FROM votes v LEFT JOIN users u ON u.id = v.creator_id
    WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, size, offset);
  return { total, page, size, list: rows };
}

// 提交投票（核心流程：校验→写记录→更新冗余字段）
export function submitVote({ voteId, answers, userId, deviceFp, ip, userAgent }) {
  const vote = db.prepare('SELECT * FROM votes WHERE id=?').get(voteId);
  if (!vote) throw new Error('投票不存在');
  if (vote.status !== 1) throw new Error('投票当前不可用');
  const now = new Date();
  const start = new Date(vote.start_time.replace(' ', 'T'));
  const end = new Date(vote.end_time.replace(' ', 'T'));
  if (now < start) throw new Error('投票尚未开始');
  if (now > end) throw new Error('投票已结束');

  // 白名单校验
  if (userId) {
    const wl = db.prepare('SELECT COUNT(*) c FROM vote_whitelist WHERE vote_id=?').get(voteId);
    if (wl.c > 0) {
      const inWl = db.prepare('SELECT 1 FROM vote_whitelist WHERE vote_id=? AND user_id=?').get(voteId, userId);
      if (!inWl) throw new Error('您不在该投票的白名单中');
    }
  }

  // 次数校验：基于用户或设备指纹
  const key = userId ? userId : deviceFp;
  const keyField = userId ? 'user_id' : 'device_fp';
  const totalCnt = db.prepare(`SELECT COUNT(DISTINCT substr(created_at,1,16)) c FROM vote_records
    WHERE vote_id=? AND ${keyField}=? AND is_valid=1`).get(voteId, key).c;
  if (vote.max_votes_per_user > 0 && totalCnt >= vote.max_votes_per_user)
    throw new Error('您已超过该投票的总次数限制');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
  const todayStr = now.toISOString().slice(0, 10);
  const dailyCnt = db.prepare(`SELECT COUNT(DISTINCT substr(created_at,1,16)) c FROM vote_records
    WHERE vote_id=? AND ${keyField}=? AND is_valid=1 AND date(created_at)=date(?)`).get(voteId, key, todayStr).c;
  if (vote.daily_limit > 0 && dailyCnt >= vote.daily_limit)
    throw new Error('今日投票次数已达上限');

  // 校验答案完整性
  const questions = db.prepare('SELECT * FROM vote_questions WHERE vote_id=? ORDER BY sort_order').all(voteId);
  for (const q of questions) {
    if (q.required) {
      const a = answers.find(x => x.questionId === q.id);
      if (!a) throw new Error(`请完成必答题：${q.title}`);
      if (q.question_type === 5 && !a.answerText?.trim()) throw new Error(`请填写：${q.title}`);
      if ([1, 2, 6].includes(q.question_type)) {
        const oids = Array.isArray(a.optionId) ? a.optionId : (a.optionId ? [a.optionId] : []);
        if (!oids.length) throw new Error(`请选择：${q.title}`);
      }
    }
    // 多选项数限制
    const a = answers.find(x => x.questionId === q.id);
    if (a && q.question_type === 2) {
      const oids = Array.isArray(a.optionId) ? a.optionId : [a.optionId];
      if (oids.length < q.min_select) throw new Error(`${q.title}：至少选择${q.min_select}项`);
      if (oids.length > q.max_select) throw new Error(`${q.title}：最多选择${q.max_select}项`);
    }
    // 打分范围校验
    if (a && q.question_type === 3 && a.score != null) {
      if (a.score < q.min_score || a.score > q.max_score)
        throw new Error(`${q.title}：分数需在${q.min_score}-${q.max_score}之间`);
    }
  }

  // 事务写入记录 + 更新冗余
  const tx = db.transaction(() => {
    for (const a of answers) {
      const q = questions.find(x => x.id === a.questionId);
      if (!q) continue;
      const oids = Array.isArray(a.optionId) ? a.optionId : (a.optionId ? [a.optionId] : []);
      if (q.question_type === 5) {
        // 填空题
        db.prepare(`INSERT INTO vote_records (vote_id, question_id, option_id, user_id, answer_text, device_fp, ip, user_agent, is_valid)
          VALUES (?,?,?,?,?,?,?,?,1)`).run(voteId, q.id, null, userId || null, a.answerText || null, deviceFp, ip, userAgent);
      } else if (q.question_type === 3) {
        // 打分题
        db.prepare(`INSERT INTO vote_records (vote_id, question_id, option_id, user_id, score, device_fp, ip, user_agent, is_valid)
          VALUES (?,?,?,?,?,?,?,?,?,1)`).run(voteId, q.id, a.optionId || null, userId || null, a.score ?? null, deviceFp, ip, userAgent);
        if (a.optionId) db.prepare('UPDATE vote_options SET vote_count=vote_count+1, score_sum=score_sum+? WHERE id=?').run(a.score ?? 0, a.optionId);
      } else if (q.question_type === 4) {
        // 排序题：rank_value 存排序序号
        db.prepare(`INSERT INTO vote_records (vote_id, question_id, option_id, user_id, rank_value, device_fp, ip, user_agent, is_valid)
          VALUES (?,?,?,?,?,?,?,?,?,1)`).run(voteId, q.id, a.optionId || null, userId || null, String(a.rank ?? ''), deviceFp, ip, userAgent);
        if (a.optionId) db.prepare('UPDATE vote_options SET vote_count=vote_count+1 WHERE id=?').run(a.optionId);
      } else {
        // 单选/多选/图文
        for (const oid of oids) {
          db.prepare(`INSERT INTO vote_records (vote_id, question_id, option_id, user_id, device_fp, ip, user_agent, is_valid)
            VALUES (?,?,?,?,?,?,?,1)`).run(voteId, q.id, oid, userId || null, deviceFp, ip, userAgent);
          db.prepare('UPDATE vote_options SET vote_count=vote_count+1 WHERE id=?').run(oid);
        }
      }
    }
  });
  tx();
  // 清统计缓存
  cacheSet(`stats:${voteId}`, null, 1);
  return true;
}

// 投票管理操作（创建者）
export function manageVote(userId, voteId, action) {
  const vote = db.prepare('SELECT * FROM votes WHERE id=?').get(voteId);
  if (!vote) throw new Error('投票不存在');
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(userId);
  if (vote.creator_id !== userId && user?.role !== 1) throw new Error('无权限');
  switch (action) {
    case 'pause': db.prepare('UPDATE votes SET status=2 WHERE id=?').run(voteId); break;
    case 'resume': db.prepare('UPDATE votes SET status=1 WHERE id=?').run(voteId); break;
    case 'end': db.prepare('UPDATE votes SET status=3 WHERE id=?').run(voteId); break;
    case 'clear':
      db.prepare('DELETE FROM vote_records WHERE vote_id=?').run(voteId);
      db.prepare('UPDATE vote_options SET vote_count=0, score_sum=0 WHERE vote_id=?').run(voteId);
      break;
    case 'delete':
      db.prepare('DELETE FROM vote_options WHERE vote_id=?').run(voteId);
      db.prepare('DELETE FROM vote_questions WHERE vote_id=?').run(voteId);
      db.prepare('DELETE FROM votes WHERE id=?').run(voteId);
      break;
    default: throw new Error('未知操作');
  }
  cacheSet(`stats:${voteId}`, null, 1);
  return true;
}

// 更新投票
export function updateVote(userId, voteId, payload) {
  const vote = db.prepare('SELECT * FROM votes WHERE id=?').get(voteId);
  if (!vote) throw new Error('投票不存在');
  if (vote.creator_id !== userId) throw new Error('无权限');
  db.prepare(`UPDATE votes SET title=?, description=?, cover_url=?, category=?,
    is_anonymous=?, start_time=?, end_time=?, max_votes_per_user=?, daily_limit=?,
    result_visible=?, password=?, status=?, end_message=?, redirect_url=?, updated_at=datetime('now','localtime')
    WHERE id=?`).run(
    payload.title ?? vote.title, payload.description ?? vote.description,
    payload.cover_url ?? vote.cover_url, payload.category ?? vote.category,
    payload.is_anonymous ?? vote.is_anonymous, payload.start_time ?? vote.start_time,
    payload.end_time ?? vote.end_time, payload.max_votes_per_user ?? vote.max_votes_per_user,
    payload.daily_limit ?? vote.daily_limit, payload.result_visible ?? vote.result_visible,
    payload.password ?? vote.password, payload.status ?? vote.status,
    payload.end_message ?? vote.end_message,
    payload.redirect_url ?? vote.redirect_url, voteId
  );
  return true;
}

// 收藏/取消收藏
export function toggleFavorite(userId, voteId) {
  const exists = db.prepare('SELECT id FROM user_favorites WHERE user_id=? AND vote_id=?').get(userId, voteId);
  if (exists) { db.prepare('DELETE FROM user_favorites WHERE id=?').run(exists.id); return false; }
  db.prepare('INSERT INTO user_favorites (user_id, vote_id) VALUES (?,?)').run(userId, voteId);
  return true;
}
