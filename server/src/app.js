// 投票系统后端入口
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import helmet from 'koa-helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import './db.js'; // 初始化数据库

import authRouter from './routes/auth.js';
import voteRouter from './routes/vote.js';
import statsRouter from './routes/stats.js';
import adminRouter from './routes/admin.js';
import userRouter from './routes/user.js';
import captchaRouter from './routes/captcha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = new Koa();

// 安全头
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

// CORS
app.use(cors({
  origin: ctx => ctx.headers.origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Device-FP', 'X-Captcha-Passed'],
  credentials: true
}));

app.use(bodyParser({ jsonLimit: '5mb', formLimit: '5mb' }));

// 静态文件（上传的文件等）
const uploadDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
import serve from 'koa-static';
app.use(serve(uploadDir, { maxage: 86400000 }));

// 全局错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    ctx.status = e.status || e.statusCode || 500;
    ctx.body = { code: ctx.status, msg: e.message || '服务器内部错误' };
    if (ctx.status >= 500) console.error('[ERROR]', e);
  }
});

// 注册路由
app.use(authRouter.routes()).use(authRouter.allowedMethods());
app.use(voteRouter.routes()).use(voteRouter.allowedMethods());
app.use(statsRouter.routes()).use(statsRouter.allowedMethods());
app.use(adminRouter.routes()).use(adminRouter.allowedMethods());
app.use(userRouter.routes()).use(userRouter.allowedMethods());
app.use(captchaRouter.routes()).use(captchaRouter.allowedMethods());

app.listen(config.port, () => {
  console.log(`\n========================================`);
  console.log(`  投票系统后端已启动: http://localhost:${config.port}`);
  console.log(`  管理员账号: admin / admin123`);
  console.log(`  API文档: 见 README`);
  console.log(`========================================\n`);
});
