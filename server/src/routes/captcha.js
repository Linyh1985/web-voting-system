// 验证码路由
import Router from 'koa-router';
import { generateCaptcha, verifyCaptcha } from '../services/captcha.js';

const router = new Router({ prefix: '/api/captcha' });

// 获取验证码图片（SVG）
router.get('/', async ctx => {
  const { token, svg, code } = generateCaptcha();
  ctx.set('Content-Type', 'image/svg+xml');
  ctx.body = svg;
  ctx.set('X-Captcha-Token', token);
  // 同时通过body返回token（前端从response读取）
  // 因Content-Type是svg，改用JSON包装
});

// JSON格式获取（推荐）
router.get('/json', async ctx => {
  const { token, svg, code } = generateCaptcha();
  ctx.body = { code: 0, data: { token, svg } };
});

// 验证
router.post('/verify', async ctx => {
  const { token, input } = ctx.request.body;
  const ok = verifyCaptcha(token, input);
  ctx.body = { code: 0, data: { passed: ok } };
});

export default router;
