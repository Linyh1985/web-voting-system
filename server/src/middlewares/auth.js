// 鉴权中间件：JWT 校验，支持必选与可选模式
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

export function authRequired(ctx, next) {
  return doAuth(ctx, next, true);
}
export function authOptional(ctx, next) {
  return doAuth(ctx, next, false);
}

function doAuth(ctx, next, required) {
  const header = ctx.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    if (required) { ctx.throw(401, '请先登录'); return; }
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT id, username, nickname, avatar, role, status, is_blacklist FROM users WHERE id = ?').get(payload.uid);
    if (!user) { ctx.throw(401, '用户不存在'); return; }
    if (user.status === 0) { ctx.throw(403, '账号已被禁用'); return; }
    if (user.is_blacklist === 1) { ctx.throw(403, '账号已被加入黑名单'); return; }
    ctx.state.user = user;
    return next();
  } catch (e) {
    if (required) { ctx.throw(401, '登录已过期，请重新登录'); return; }
    return next();
  }
}

export function adminRequired(ctx, next) {
  return authRequired(ctx, () => {
    if (!ctx.state.user || ctx.state.user.role !== 1) { ctx.throw(403, '需要管理员权限'); return; }
    return next();
  });
}
