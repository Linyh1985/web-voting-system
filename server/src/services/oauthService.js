// OAuth 服务：微信扫码登录 + QQ 互联登录
// 开发模式：生成模拟二维码 SVG，提供"模拟扫码"接口自动写入 openid
// 生产模式：配置 wechat.appId / qq.appId 后会走真实 OAuth 流程
import { db } from '../db.js';
import { config } from '../config.js';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 生成 OAuth 流程票据 ticket（前端持有，用于轮询扫码结果）
function newTicket(provider) {
  const ticket = crypto.randomBytes(16).toString('hex');
  // 用本地时间字符串与 sqlite datetime('now','localtime') 一致
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const expireAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  db.prepare(`INSERT INTO oauth_tickets (provider, ticket, consumed, expire_at) VALUES (?,?,0,?)`)
    .run(provider, ticket, expireAt);
  return ticket;
}

// ============ 微信扫码登录 ============

// 生成二维码（开发模式返回 SVG 二维码占位图 + ticket；生产模式返回微信开放平台二维码URL）
export function getWechatQrcode() {
  const ticket = newTicket('wechat');
  if (config.wechat.appId) {
    // 生产模式：返回微信开放平台 OAuth 二维码 URL
    const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${config.wechat.appId}` +
      `&redirect_uri=${encodeURIComponent(config.wechat.redirectUri)}` +
      `&response_type=code&scope=snsapi_login&state=${ticket}#wechat_redirect`;
    return { ticket, qrcodeUrl: url, dev: false };
  } else {
    // 开发模式：返回 SVG 模拟二维码
    return { ticket, qrcodeSvg: buildMockQrcode(ticket), dev: true };
  }
}

// 开发模式：模拟扫码确认（前端显示一个"我已扫码"按钮，调用此接口）
export function mockWechatScan(ticket) {
  const rec = db.prepare('SELECT id, consumed, expire_at FROM oauth_tickets WHERE ticket=? AND provider=?').get(ticket, 'wechat');
  if (!rec) throw new Error('ticket 无效');
  if (rec.consumed === 1) throw new Error('ticket 已被消费');
  if (new Date() > new Date(rec.expire_at.replace(' ', 'T'))) throw new Error('ticket 已过期');
  const openid = config.wechat.devMockOpenid;
  const mockNickname = '微信用户_' + openid.slice(-4);
  db.prepare(`UPDATE oauth_tickets SET openid=?, nickname=?, avatar=? WHERE id=?`)
    .run(openid, mockNickname, null, rec.id);
  return { scanned: true, openid, nickname: mockNickname };
}

// 轮询扫码结果
export function pollWechatScan(ticket) {
  const rec = db.prepare('SELECT openid, nickname, avatar, consumed, expire_at FROM oauth_tickets WHERE ticket=? AND provider=?').get(ticket, 'wechat');
  if (!rec) return { status: 'invalid' };
  if (new Date() > new Date(rec.expire_at.replace(' ', 'T'))) return { status: 'expired' };
  if (rec.openid) return { status: 'scanned', openid: rec.openid, nickname: rec.nickname, avatar: rec.avatar };
  return { status: 'waiting' };
}

// 生产模式：微信回调接口，用 code 换 access_token + openid
export async function wechatCallback(code, state) {
  const ticket = state;
  if (!config.wechat.appId) {
    // 开发模式：直接走 mock 流程
    mockWechatScan(ticket);
  } else {
    const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wechat.appId}&secret=${config.wechat.appSecret}&code=${code}&grant_type=authorization_code`);
    const tokenData = await tokenRes.json();
    if (!tokenData.openid) throw new Error('微信登录失败：' + (tokenData.errmsg || '未知错误'));
    const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`);
    const userData = await userRes.json();
    db.prepare(`UPDATE oauth_tickets SET openid=?, nickname=?, avatar=? WHERE ticket=?`)
      .run(tokenData.openid, userData.nickname || '微信用户', userData.headimgurl || null, ticket);
  }
  return ticket;
}

// ============ QQ 互联登录 ============

// QQ 跳转授权URL
export function getQqAuthorizeUrl() {
  const ticket = newTicket('qq');
  if (config.qq.appId) {
    const url = `https://graph.qq.com/oauth2.0/authorize?response_type=code` +
      `&client_id=${config.qq.appId}&redirect_uri=${encodeURIComponent(config.qq.redirectUri)}` +
      `&state=${ticket}&scope=get_user_info`;
    return { ticket, authorizeUrl: url, dev: false };
  } else {
    // 开发模式：直接返回模拟扫码URL（前端跳转后自动模拟授权）
    return { ticket, authorizeUrl: `/api/auth/qq/mock-callback?ticket=${ticket}`, dev: true };
  }
}

// QQ 模拟回调（开发模式）
export function mockQqCallback(ticket) {
  const rec = db.prepare('SELECT id, consumed, expire_at FROM oauth_tickets WHERE ticket=? AND provider=?').get(ticket, 'qq');
  if (!rec) throw new Error('ticket 无效');
  if (rec.consumed === 1) throw new Error('ticket 已被消费');
  if (new Date() > new Date(rec.expire_at.replace(' ', 'T'))) throw new Error('ticket 已过期');
  const openid = config.qq.devMockOpenid;
  const mockNickname = 'QQ用户_' + openid.slice(-4);
  db.prepare(`UPDATE oauth_tickets SET openid=?, nickname=?, avatar=? WHERE id=?`)
    .run(openid, mockNickname, null, rec.id);
  return { scanned: true, openid, nickname: mockNickname };
}

// QQ 生产模式回调
export async function qqCallback(code, state) {
  const ticket = state;
  if (!config.qq.appId) {
    mockQqCallback(ticket);
  } else {
    const tokenRes = await fetch(`https://graph.qq.com/oauth2.0/token?grant_type=authorization_code` +
      `&client_id=${config.qq.appId}&client_secret=${config.qq.appKey}&code=${code}` +
      `&redirect_uri=${encodeURIComponent(config.qq.redirectUri)}`);
    const tokenText = await tokenRes.text();
    const tokenData = Object.fromEntries(new URLSearchParams(tokenText));
    if (!tokenData.access_token) throw new Error('QQ登录失败：未获取到access_token');
    const openidRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${tokenData.access_token}`);
    const openidText = await openidRes.text();
    const openidData = JSON.parse(openidText.replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
    const userRes = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${tokenData.access_token}` +
      `&oauth_consumer_key=${config.qq.appId}&openid=${openidData.openid}`);
    const userData = await userRes.json();
    db.prepare(`UPDATE oauth_tickets SET openid=?, nickname=?, avatar=? WHERE ticket=?`)
      .run(openidData.openid, userData.nickname || 'QQ用户', userData.figureurl_qq_2 || userData.figureurl_qq_1 || null, ticket);
  }
  return ticket;
}

// ============ 通用：用 OAuth 完成登录 ============
// 根据 ticket 找到 openid，再根据 openid 查找/创建用户，签发 JWT
export function loginByOauth(provider, ticket, ip) {
  const rec = db.prepare('SELECT openid, nickname, avatar, consumed, expire_at FROM oauth_tickets WHERE ticket=? AND provider=?').get(ticket, provider);
  if (!rec) throw new Error('ticket 无效');
  if (!rec.openid) throw new Error('请先完成扫码授权');
  if (new Date() > new Date(rec.expire_at.replace(' ', 'T'))) throw new Error('ticket 已过期');
  // 标记消费
  db.prepare('UPDATE oauth_tickets SET consumed=1 WHERE id=(SELECT id FROM oauth_tickets WHERE ticket=?)').run(ticket);

  // 根据 openid 查找用户
  const col = provider === 'wechat' ? 'wechat_openid' : 'qq_openid';
  let user = db.prepare(`SELECT * FROM users WHERE ${col} = ?`).get(rec.openid);

  if (!user) {
    // 自动创建账号（OAuth 首次登录自动注册）
    const username = `${provider}_${rec.openid.slice(-8)}`;
    // 生成随机密码（OAuth 用户也可后续绑定密码）
    const randomPwd = crypto.randomBytes(16).toString('hex');
    const hash = bcryptjs.hashSync(randomPwd, 10);
    const info = db.prepare(`INSERT INTO users (username, password_hash, nickname, avatar, ${col}, role, status)
      VALUES (?,?,?,?,?,?,1)`).run(username, hash, rec.nickname || username, rec.avatar, rec.openid, 0);
    user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  } else {
    // 更新昵称/头像
    if (rec.nickname || rec.avatar) {
      db.prepare(`UPDATE users SET nickname=COALESCE(?, nickname), avatar=COALESCE(?, avatar),
        last_login_ip=?, last_login_at=datetime('now','localtime') WHERE id=?`)
        .run(rec.nickname, rec.avatar, ip, user.id);
    }
    if (user.status === 0) throw new Error('账号已被禁用');
    if (user.is_blacklist === 1) throw new Error('账号已被加入黑名单');
  }

  const token = jwt.sign({ uid: user.id, username: user.username, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpire });
  return {
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar, role: user.role }
  };
}

// 简易模拟二维码 SVG（开发模式占位图）
function buildMockQrcode(ticket) {
  // 用 ticket 生成一个伪二维码 SVG（25x25 格子，仅用于占位显示）
  const grid = 25;
  const cell = 8;
  const size = grid * cell;
  let cells = '';
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      // 用 ticket 哈希做伪随机
      const idx = (x + y * grid) % ticket.length;
      const bit = ticket.charCodeAt(idx) % 2;
      if (bit) cells += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#000"/>`;
    }
  }
  // 三个定位角
  const corners = [[0, 0], [grid - 7, 0], [0, grid - 7]];
  for (const [cx, cy] of corners) {
    cells += `<rect x="${cx * cell}" y="${cy * cell}" width="${7 * cell}" height="${7 * cell}" fill="#000"/>`;
    cells += `<rect x="${(cx + 1) * cell}" y="${(cy + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/>`;
    cells += `<rect x="${(cx + 2) * cell}" y="${(cy + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="#000"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="background:#fff">${cells}</svg>`;
}
