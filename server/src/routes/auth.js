// 认证路由
import Router from 'koa-router';
import * as authService from '../services/authService.js';
import * as notifyService from '../services/notifyService.js';
import * as oauthService from '../services/oauthService.js';
import { deviceFingerprintMiddleware } from '../middlewares/antiCheat.js';
import { authRequired } from '../middlewares/auth.js';
import { config } from '../config.js';

const router = new Router({ prefix: '/api/auth' });

// 用户名+密码
router.post('/register', deviceFingerprintMiddleware, async ctx => {
  const { username, password, nickname, phone, email } = ctx.request.body;
  try {
    const result = authService.register(username, password, nickname, phone, email);
    ctx.body = { code: 0, data: result, msg: '注册成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

router.post('/login', async ctx => {
  const { username, password } = ctx.request.body;
  try {
    const result = authService.login(username, password, ctx.ip);
    ctx.body = { code: 0, data: result, msg: '登录成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

// 短信验证码
router.post('/sms/send', deviceFingerprintMiddleware, async ctx => {
  const { phone, purpose } = ctx.request.body;
  try {
    const res = await notifyService.sendSmsCode(phone, ctx.ip, purpose || 'login');
    ctx.body = { code: 0, data: res, msg: '验证码已发送' };
  } catch (e) { ctx.throw(400, e.message); }
});

router.post('/sms/login', deviceFingerprintMiddleware, async ctx => {
  const { phone, code } = ctx.request.body;
  try {
    const result = authService.loginByPhone(phone, code, ctx.ip);
    ctx.body = { code: 0, data: result, msg: '登录成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

// 邮箱验证码
router.post('/mail/send', deviceFingerprintMiddleware, async ctx => {
  const { email, purpose } = ctx.request.body;
  try {
    const res = await notifyService.sendMailCode(email, ctx.ip, purpose || 'login');
    ctx.body = { code: 0, data: res, msg: '验证码已发送' };
  } catch (e) { ctx.throw(400, e.message); }
});

router.post('/mail/login', deviceFingerprintMiddleware, async ctx => {
  const { email, code } = ctx.request.body;
  try {
    const result = authService.loginByEmail(email, code, ctx.ip);
    ctx.body = { code: 0, data: result, msg: '登录成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

// 微信扫码
router.get('/wechat/qrcode', async ctx => {
  const res = oauthService.getWechatQrcode();
  ctx.body = { code: 0, data: res };
});

// 开发模式：模拟扫码确认
router.post('/wechat/mock-scan', async ctx => {
  const { ticket } = ctx.request.body;
  try {
    const res = oauthService.mockWechatScan(ticket);
    ctx.body = { code: 0, data: res, msg: '扫码成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

// 轮询扫码状态
router.get('/wechat/poll', async ctx => {
  const ticket = ctx.query.ticket;
  const res = oauthService.pollWechatScan(ticket);
  ctx.body = { code: 0, data: res };
});

// 微信生产模式回调
router.get('/wechat/callback', async ctx => {
  const { code, state } = ctx.query;
  try {
    await oauthService.wechatCallback(code, state);
    // 通过 ticket 完成登录并跳转回前端
    const ticket = state;
    const result = oauthService.loginByOauth('wechat', ticket, ctx.ip);
    ctx.redirect(`${config.wechat.redirectUri}?token=${result.token}&uid=${result.user.id}`);
  } catch (e) { ctx.throw(400, e.message); }
});

// 用 ticket 完成微信登录
router.post('/wechat/login', async ctx => {
  const { ticket } = ctx.request.body;
  try {
    const result = oauthService.loginByOauth('wechat', ticket, ctx.ip);
    ctx.body = { code: 0, data: result, msg: '登录成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

// QQ
router.get('/qq/authorize', async ctx => {
  const res = oauthService.getQqAuthorizeUrl();
  ctx.body = { code: 0, data: res };
});

// QQ 开发模式模拟回调
router.get('/qq/mock-callback', async ctx => {
  const ticket = ctx.query.ticket;
  try {
    oauthService.mockQqCallback(ticket);
    ctx.redirect(`/api/auth/qq/login?ticket=${ticket}`);
  } catch (e) { ctx.throw(400, e.message); }
});

// QQ 生产模式回调
router.get('/qq/callback', async ctx => {
  const { code, state } = ctx.query;
  try {
    await oauthService.qqCallback(code, state);
    ctx.redirect(`/api/auth/qq/login?ticket=${state}`);
  } catch (e) { ctx.throw(400, e.message); }
});

// 用 ticket 完成 QQ 登录
router.post('/qq/login', async ctx => {
  const { ticket } = ctx.request.body;
  try {
    const result = oauthService.loginByOauth('qq', ticket, ctx.ip);
    ctx.body = { code: 0, data: result, msg: '登录成功' };
  } catch (e) { ctx.throw(400, e.message); }
});

// 当前用户信息
router.get('/profile', authRequired, async ctx => {
  const profile = authService.getUserProfile(ctx.state.user.id);
  ctx.body = { code: 0, data: profile };
});

export default router;
