// 统计路由
import Router from 'koa-router';
import * as statsService from '../services/statsService.js';
import { authOptional } from '../middlewares/auth.js';

const router = new Router({ prefix: '/api/stats' });

// 实时统计
router.get('/votes/:id', async ctx => {
  ctx.body = { code: 0, data: statsService.getVoteStats(+ctx.params.id) };
});

// 排行榜
router.get('/votes/:id/leaderboard', async ctx => {
  ctx.body = { code: 0, data: statsService.getLeaderboard(+ctx.params.id, +ctx.query.limit || 50) };
});

// 导出明细Excel
router.get('/votes/:id/export', authOptional, async ctx => {
  const buf = await statsService.exportRecords(+ctx.params.id);
  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', `attachment; filename=vote-${ctx.params.id}-records.xlsx`);
  ctx.body = Buffer.from(buf);
});

// 导出统计Excel
router.get('/votes/:id/export-stats', authOptional, async ctx => {
  const buf = await statsService.exportStats(+ctx.params.id);
  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', `attachment; filename=vote-${ctx.params.id}-stats.xlsx`);
  ctx.body = Buffer.from(buf);
});

export default router;
