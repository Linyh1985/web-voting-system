// 用户认证服务
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { verifyCode } from './notifyService.js';

export function register(username, password, nickname, phone, email) {
  if (!username || !password) throw new Error('用户名和密码不能为空');
  if (username.length < 3 || username.length > 32) throw new Error('用户名长度需3-32位');
  if (password.length < 6) throw new Error('密码长度需至少6位');
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) throw new Error('手机号格式不正确');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式不正确');
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) throw new Error('用户名已被注册');
  if (phone) {
    const phoneExists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (phoneExists) throw new Error('手机号已被注册');
  }
  if (email) {
    const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (emailExists) throw new Error('邮箱已被注册');
  }
  const hash = bcryptjs.hashSync(password, 10);
  const info = db.prepare(`INSERT INTO users (username, password_hash, nickname, phone, email, role, status, bind_phone, bind_email)
    VALUES (?,?,?,?,?,0,1,?,?)`).run(username, hash, nickname || username, phone || null, email || null, phone ? 1 : 0, email ? 1 : 0);
  return { id: info.lastInsertRowid, username };
}

// 用户名+密码登录
export function login(username, password, ip) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) throw new Error('用户名或密码错误');
  if (user.status === 0) throw new Error('账号已被禁用');
  if (user.is_blacklist === 1) throw new Error('账号已被加入黑名单');
  const ok = bcryptjs.compareSync(password, user.password_hash);
  if (!ok) throw new Error('用户名或密码错误');
  db.prepare('UPDATE users SET last_login_ip=?, last_login_at=datetime(\'now\',\'localtime\') WHERE id=?').run(ip, user.id);
  const token = jwt.sign({ uid: user.id, username: user.username, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpire });
  return {
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar, role: user.role }
  };
}

// 手机号+验证码登录（首次登录自动注册账号）
export function loginByPhone(phone, code, ip) {
  verifyCode('sms', phone, code, 'login');
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    // 首次手机登录自动注册
    const username = `user_${phone.slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
    const randomPwd = Math.random().toString(36).slice(2, 18);
    const hash = bcryptjs.hashSync(randomPwd, 10);
    const info = db.prepare(`INSERT INTO users (username, password_hash, nickname, phone, role, status, bind_phone)
      VALUES (?,?,?,?,0,1,1)`).run(username, hash, `用户${phone.slice(-4)}`, phone);
    user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  } else {
    if (user.status === 0) throw new Error('账号已被禁用');
    if (user.is_blacklist === 1) throw new Error('账号已被加入黑名单');
    db.prepare('UPDATE users SET bind_phone=1, last_login_ip=?, last_login_at=datetime(\'now\',\'localtime\') WHERE id=?').run(ip, user.id);
  }
  const token = jwt.sign({ uid: user.id, username: user.username, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpire });
  return {
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar, role: user.role }
  };
}

// 邮箱+验证码登录（首次登录自动注册账号）
export function loginByEmail(email, code, ip) {
  verifyCode('mail', email, code, 'login');
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const username = `user_${email.split('@')[0].slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
    const randomPwd = Math.random().toString(36).slice(2, 18);
    const hash = bcryptjs.hashSync(randomPwd, 10);
    const info = db.prepare(`INSERT INTO users (username, password_hash, nickname, email, role, status, bind_email)
      VALUES (?,?,?,?,0,1,1)`).run(username, hash, email.split('@')[0], email);
    user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  } else {
    if (user.status === 0) throw new Error('账号已被禁用');
    if (user.is_blacklist === 1) throw new Error('账号已被加入黑名单');
    db.prepare('UPDATE users SET bind_email=1, last_login_ip=?, last_login_at=datetime(\'now\',\'localtime\') WHERE id=?').run(ip, user.id);
  }
  const token = jwt.sign({ uid: user.id, username: user.username, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpire });
  return {
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar, role: user.role }
  };
}

export function getUserProfile(userId) {
  const u = db.prepare('SELECT id, username, nickname, avatar, phone, email, role, wechat_openid, qq_openid, bind_phone, bind_email, created_at FROM users WHERE id=?').get(userId);
  return u;
}
