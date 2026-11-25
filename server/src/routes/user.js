// 用户中心路由
import Router from 'koa-router';
import { authRequired } from '../middlewares/auth.js';
import { db } from '../db.js';

const router = new Router({ prefix: '/api/user' });

router.use(async (ctx, next) => {
  await authRequired(ctx, next);
});

// 我的投票
router.get('/my-votes', async ctx => {
  const { page = 1, size = 10 } = ctx.query;
  const total = db.prepare('SELECT COUNT(*) c FROM votes WHERE creator_id=?').get(ctx.state.user.id).c;
  const list = db.prepare(`SELECT v.*, (SELECT COUNT(*) FROM vote_records r WHERE r.vote_id=v.id) AS vote_count
    FROM votes v WHERE v.creator_id=? ORDER BY v.id DESC LIMIT ? OFFSET ?`).all(ctx.state.user.id, +size, (+page - 1) * +size);
  ctx.body = { code: 0, data: { total, list } };
});

// 我参与的投票
router.get('/participated', async ctx => {
  const { page = 1, size = 10 } = ctx.query;
  const total = db.prepare('SELECT COUNT(DISTINCT vote_id) c FROM vote_records WHERE user_id=?').get(ctx.state.user.id).c;
  const list = db.prepare(`SELECT DISTINCT v.* FROM votes v
    JOIN vote_records r ON r.vote_id=v.id WHERE r.user_id=?
    ORDER BY v.id DESC LIMIT ? OFFSET ?`).all(ctx.state.user.id, +size, (+page - 1) * +size);
  ctx.body = { code: 0, data: { total, list } };
});

// 我的收藏
router.get('/favorites', async ctx => {
  const { page = 1, size = 10 } = ctx.query;
  const total = db.prepare('SELECT COUNT(*) c FROM user_favorites WHERE user_id=?').get(ctx.state.user.id).c;
  const list = db.prepare(`SELECT v.*, f.created_at AS favorited_at FROM user_favorites f
    JOIN votes v ON v.id=f.vote_id WHERE f.user_id=?
    ORDER BY f.id DESC LIMIT ? OFFSET ?`).all(ctx.state.user.id, +size, (+page - 1) * +size);
  ctx.body = { code: 0, data: { total, list } };
});

// 更新资料
router.put('/profile', async ctx => {
  const { nickname, avatar, phone, email } = ctx.request.body;
  db.prepare('UPDATE users SET nickname=?, avatar=?, phone=?, email=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
    .run(nickname, avatar, phone, email, ctx.state.user.id);
  ctx.body = { code: 0, msg: '资料已更新' };
});

// 修改密码
router.put('/password', async ctx => {
  const { oldPassword, newPassword } = ctx.request.body;
  const bcrypt = (await import('bcryptjs')).default;
  const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(ctx.state.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) ctx.throw(400, '原密码错误');
  if (!newPassword || newPassword.length < 6) ctx.throw(400, '新密码至少6位');
  db.prepare('UPDATE users SET password_hash=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
    .run(bcrypt.hashSync(newPassword, 10), ctx.state.user.id);
  ctx.body = { code: 0, msg: '密码已修改' };
});

export default router;
