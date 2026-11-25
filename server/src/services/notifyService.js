// 通知服务：发送验证码（短信/邮箱）
// 开发模式：验证码写入数据库 verify_codes 表 + 打印到控制台
// 生产模式：配置 SMS_API_KEY 或 SMTP 后自动切换为真实发送
import { db } from '../db.js';
import { config } from '../config.js';

// 生成6位数字验证码
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 计算过期时间（10分钟后），用本地时间字符串与 sqlite datetime('now','localtime') 一致
function expireAt() {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 发送频率限制：同一target 60秒内只能发1次
function checkRateLimit(target) {
  const last = db.prepare(`SELECT created_at FROM verify_codes WHERE target=? ORDER BY id DESC LIMIT 1`).get(target);
  if (last) {
    const diff = Date.now() - new Date(last.created_at.replace(' ', 'T')).getTime();
    if (diff < 60000) throw new Error(`发送过于频繁，请${Math.ceil((60000 - diff) / 1000)}秒后重试`);
  }
}

// 发送短信验证码
export async function sendSmsCode(phone, ip, purpose = 'login') {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('手机号格式不正确');
  checkRateLimit(phone);

  const code = genCode();
  const sql = 'INSERT INTO verify_codes (channel, target, code, purpose, expire_at, ip) VALUES (?, ?, ?, ?, ?, ?)';
  db.prepare(sql).run('sms', phone, code, purpose, expireAt(), ip);

  if (config.sms?.apiKey && config.sms?.apiUrl) {
    // 生产模式：调用真实短信网关
    try {
      const res = await fetch(config.sms.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.sms.apiKey}` },
        body: JSON.stringify({ phone, code, sign: config.sms.sign || '投票系统' })
      });
      if (!res.ok) throw new Error('短信网关返回 ' + res.status);
      return { sent: true, channel: 'sms' };
    } catch (e) {
      throw new Error('短信发送失败：' + e.message);
    }
  } else {
    // 开发模式：打印到控制台（前端会通过 dev_preview 字段返回，便于测试）
    console.log(`\n[SMS-DEV] 手机号 ${phone} 的验证码: ${code}（10分钟内有效）\n`);
    return { sent: true, channel: 'sms', dev_preview: code };
  }
}

// 发送邮箱验证码
export async function sendMailCode(email, ip, purpose = 'login') {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式不正确');
  checkRateLimit(email);

  const code = genCode();
  const sql = 'INSERT INTO verify_codes (channel, target, code, purpose, expire_at, ip) VALUES (?, ?, ?, ?, ?, ?)';
  db.prepare(sql).run('mail', email, code, purpose, expireAt(), ip);

  if (config.mail?.smtp && config.mail?.user && config.mail?.pass) {
    // 生产模式：用 nodemailer 发送真实邮件
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.mail.smtp, port: config.mail.port || 465, secure: true,
        auth: { user: config.mail.user, pass: config.mail.pass }
      });
      await transporter.sendMail({
        from: config.mail.from || config.mail.user,
        to: email,
        subject: '【投票系统】登录验证码',
        html: `<p>您的登录验证码是：</p><h2 style="color:#409eff;letter-spacing:4px">${code}</h2><p>验证码10分钟内有效，请勿告知他人。</p>`
      });
      return { sent: true, channel: 'mail' };
    } catch (e) {
      throw new Error('邮件发送失败：' + e.message);
    }
  } else {
    // 开发模式
    console.log(`\n[MAIL-DEV] 邮箱 ${email} 的验证码: ${code}（10分钟内有效）\n`);
    return { sent: true, channel: 'mail', dev_preview: code };
  }
}

// 校验验证码（一次性消费）
export function verifyCode(channel, target, code, purpose = 'login') {
  if (!code) throw new Error('请输入验证码');
  const rec = db.prepare(`SELECT id, expire_at, consumed FROM verify_codes
    WHERE channel=? AND target=? AND code=? AND purpose=?
    ORDER BY id DESC LIMIT 1`).get(channel, target, code, purpose);
  if (!rec) throw new Error('验证码错误');
  if (rec.consumed === 1) throw new Error('验证码已被使用');
  if (new Date() > new Date(rec.expire_at.replace(' ', 'T'))) throw new Error('验证码已过期');
  db.prepare('UPDATE verify_codes SET consumed=1 WHERE id=?').run(rec.id);
  return true;
}
