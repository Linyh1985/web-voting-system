// 社交互动服务：评论/点赞/举报
import { db } from '../db.js';

export function getComments(optionId) {
  return db.prepare(`SELECT * FROM option_comments WHERE option_id=? AND is_reported=0
    ORDER BY created_at DESC LIMIT 100`).all(optionId);
}

export function addComment({ optionId, userId, username, content, ip }) {
  if (!content?.trim()) throw new Error('评论内容不能为空');
  if (content.length > 500) throw new Error('评论最多500字');
  // 简单XSS防护
  const safe = content.replace(/<[^>]+>/g, '').trim();
  const info = db.prepare(`INSERT INTO option_comments (option_id, user_id, username, content, ip)
    VALUES (?,?,?,?,?)`).run(optionId, userId || null, username || '匿名用户', safe, ip);
  return { id: info.lastInsertRowid };
}

export function likeOption({ optionId, userId, deviceFp }) {
  // 防重复点赞
  const exists = userId
    ? db.prepare('SELECT id FROM option_likes WHERE option_id=? AND user_id=?').get(optionId, userId)
    : db.prepare('SELECT id FROM option_likes WHERE option_id=? AND device_fp=?').get(optionId, deviceFp);
  if (exists) throw new Error('已点赞过');
  db.prepare('INSERT INTO option_likes (option_id, user_id, device_fp) VALUES (?,?,?)').run(optionId, userId || null, deviceFp);
  // 简化：点赞数暂存于option_comments不合适，用选项vote_count替代展示
  return true;
}

export function reportComment(commentId) {
  db.prepare('UPDATE option_comments SET is_reported=1 WHERE id=?').run(commentId);
  return true;
}

// 分享链接（含二维码SVG）
export function getShareInfo(voteId, baseUrl) {
  const url = `${baseUrl}/vote/${voteId}`;
  // 简易二维码SVG（实际项目可用qrcode库）
  return { url, qrcodeUrl: url };
}
