// 后台管理路由
import Router from 'koa-router';
import { adminRequired } from '../middlewares/auth.js';
import * as adminService from '../services/adminService.js';
import * as statsService from '../services/statsService.js';

const router = new Router({ prefix: '/api/admin' });

// 所有接口都需要管理员权限
router.use(async (ctx, next) => {
  await adminRequired(ctx, next);
});

function log(ctx, action, targetType, targetId, detail) {
  adminService.adminLog(ctx.state.user.id, ctx.state.user.username || ctx.state.user.nickname, action, targetType, targetId, detail, ctx.ip);
}

// 用户管理
router.get('/users', async ctx => {
  ctx.body = { code: 0, data: adminService.listUsers({ page: +ctx.query.page || 1, size: +ctx.query.size || 20, keyword: ctx.query.keyword, role: ctx.query.role, status: ctx.query.status }) };
});

router.post('/users/:id/status', async ctx => {
  const { field, value } = ctx.request.body;
  adminService.updateUserStatus(+ctx.params.id, field, value, ctx.state.user.id, ctx.state.user.username, ctx.ip);
  ctx.body = { code: 0, msg: '操作成功' };
});

// 投票管理
router.post('/votes/:id/action', async ctx => {
  adminService.adminVoteAction(ctx.state.user.id, ctx.state.user.username, +ctx.params.id, ctx.request.body.action, ctx.ip);
  ctx.body = { code: 0, msg: '操作成功' };
});

// 数据大盘
router.get('/dashboard', async ctx => {
  ctx.body = { code: 0, data: statsService.getDashboard() };
});

// 操作日志
router.get('/logs', async ctx => {
  ctx.body = { code: 0, data: adminService.listLogs({ page: +ctx.query.page || 1, size: +ctx.query.size || 20, action: ctx.query.action, adminId: ctx.query.adminId ? +ctx.query.adminId : null }) };
});

// 黑名单
router.get('/blacklist', async ctx => {
  ctx.body = { code: 0, data: adminService.listBlacklist() };
});

router.post('/blacklist', async ctx => {
  const { type, value, reason } = ctx.request.body;
  adminService.addToBlacklist(type, value, reason, ctx.state.user.id, ctx.state.user.username, ctx.ip);
  ctx.body = { code: 0, msg: '已加入黑名单' };
});

router.delete('/blacklist', async ctx => {
  const { type, id } = ctx.query;
  adminService.removeFromBlacklist(type, +id, ctx.state.user.id, ctx.state.user.username, ctx.ip);
  ctx.body = { code: 0, msg: '已移除' };
});

// 系统配置
router.get('/config', async ctx => {
  ctx.body = { code: 0, data: adminService.getSystemConfig() };
});

router.put('/config', async ctx => {
  adminService.updateSystemConfig(ctx.request.body, ctx.state.user.id, ctx.state.user.username, ctx.ip);
  ctx.body = { code: 0, msg: '配置已更新' };
});

// 模板管理
router.get('/templates', async ctx => {
  ctx.body = { code: 0, data: adminService.listTemplates(ctx.query.category) };
});

router.post('/templates', async ctx => {
  const { name, category, coverUrl, config } = ctx.request.body;
  const id = adminService.addTemplate(name, category, coverUrl, config);
  ctx.body = { code: 0, data: { id }, msg: '模板已创建' };
});

export default router;
