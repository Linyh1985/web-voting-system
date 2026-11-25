// 投票路由
import Router from 'koa-router';
import * as voteService from '../services/voteService.js';
import * as socialService from '../services/socialService.js';
import { authOptional, authRequired } from '../middlewares/auth.js';
import { deviceFingerprintMiddleware, voteAntiCheatMiddleware } from '../middlewares/antiCheat.js';

const router = new Router({ prefix: '/api/votes' });

// 投票列表
router.get('/', async ctx => {
  const { page, size, status, category, keyword, sort, creatorId } = ctx.query;
  ctx.body = { code: 0, data: voteService.listVotes({ page: +page || 1, size: +size || 10, status, category, keyword, sort, creatorId: creatorId ? +creatorId : null }) };
});

// 投票详情
router.get('/:id', authOptional, deviceFingerprintMiddleware, async ctx => {
  const vote = voteService.getVoteDetail(+ctx.params.id, {
    incView: true,
    userId: ctx.state.user?.id,
    deviceFp: ctx.state.deviceFp
  });
  if (!vote) ctx.throw(404, '投票不存在');
  ctx.body = { code: 0, data: vote };
});

// 创建投票
router.post('/', authRequired, async ctx => {
  const id = voteService.createVote(ctx.state.user.id, ctx.request.body);
  ctx.body = { code: 0, data: { id }, msg: '创建成功' };
});

// 更新投票
router.put('/:id', authRequired, async ctx => {
  voteService.updateVote(ctx.state.user.id, +ctx.params.id, ctx.request.body);
  ctx.body = { code: 0, msg: '更新成功' };
});

// 复制投票
router.post('/:id/duplicate', authRequired, async ctx => {
  const id = voteService.duplicateVote(ctx.state.user.id, +ctx.params.id);
  ctx.body = { code: 0, data: { id }, msg: '复制成功' };
});

// 管理投票（暂停/恢复/结束/清空/删除）
router.post('/:id/manage', authRequired, async ctx => {
  voteService.manageVote(ctx.state.user.id, +ctx.params.id, ctx.request.body.action);
  ctx.body = { code: 0, msg: '操作成功' };
});

// 提交投票（防作弊中间件链）
router.post('/:voteId/submit',
  authOptional, deviceFingerprintMiddleware, voteAntiCheatMiddleware,
  async ctx => {
    voteService.submitVote({
      voteId: +ctx.params.voteId,
      answers: ctx.request.body.answers || [],
      userId: ctx.state.user?.id || null,
      deviceFp: ctx.state.deviceFp,
      ip: ctx.ip,
      userAgent: ctx.headers['user-agent'] || ''
    });
    ctx.body = { code: 0, msg: '投票成功' };
  }
);

// 收藏
router.post('/:id/favorite', authRequired, async ctx => {
  const added = voteService.toggleFavorite(ctx.state.user.id, +ctx.params.id);
  ctx.body = { code: 0, data: { added }, msg: added ? '已收藏' : '已取消收藏' };
});

// 分享信息
router.get('/:id/share', async ctx => {
  const baseUrl = `${ctx.protocol}://${ctx.host}`;
  ctx.body = { code: 0, data: socialService.getShareInfo(+ctx.params.id, baseUrl) };
});

// 选项评论
router.get('/options/:optionId/comments', async ctx => {
  ctx.body = { code: 0, data: socialService.getComments(+ctx.params.optionId) };
});

router.post('/options/:optionId/comments', authOptional, async ctx => {
  socialService.addComment({
    optionId: +ctx.params.optionId,
    userId: ctx.state.user?.id,
    username: ctx.state.user?.nickname || ctx.state.user?.username,
    content: ctx.request.body.content,
    ip: ctx.ip
  });
  ctx.body = { code: 0, msg: '评论成功' };
});

// 举报评论
router.post('/comments/:commentId/report', authOptional, async ctx => {
  socialService.reportComment(+ctx.params.commentId);
  ctx.body = { code: 0, msg: '已提交举报' };
});

export default router;
