// 防作弊中间件：设备指纹 + IP限流 + 间隔限制 + 验证码触发 + 黑名单
import crypto from 'crypto';
import { config } from '../config.js';
import { db } from '../db.js';

// 内存级缓存（替代Redis，开箱即用；如需分布式可替换为Redis）
const cache = new Map();
function cacheGet(key) { return cache.get(key); }
function cacheSet(key, val, ttlMs) { cache.set(key, val); if (ttlMs) setTimeout(() => cache.delete(key), ttlMs); }
function cacheIncr(key) { const v = (cache.get(key) || 0) + 1; cache.set(key, v); return v; }
function cacheIncrTTL(key, ttlMs) { const v = (cache.get(key) || 0) + 1; cache.set(key, v); if (v === 1) setTimeout(() => cache.delete(key), ttlMs); return v; }

export { cacheGet, cacheSet, cacheIncr, cacheIncrTTL };

// 生成设备指纹：后端兜底 = UA + IP前两段 + 前端上报指纹
export function deviceFingerprintMiddleware(ctx, next) {
  const rawFp = ctx.headers['x-device-fp'] || '';
  const ua = ctx.headers['user-agent'] || '';
  const ipSeg = ctx.ip.split('.').slice(0, 2).join('.');
  const fpSource = `${ua}|${ipSeg}|${rawFp}`;
  ctx.state.deviceFp = crypto.createHash('sha256').update(fpSource).digest('hex').slice(0, 32);

  // 设备黑名单校验
  const blocked = db.prepare('SELECT 1 FROM device_blacklist WHERE device_fp = ?').get(ctx.state.deviceFp);
  if (blocked) ctx.throw(403, '该设备已被加入黑名单');

  return next();
}

// IP黑名单校验
export function ipBlacklistMiddleware(ctx, next) {
  const blocked = db.prepare('SELECT 1 FROM ip_blacklist WHERE ip = ?').get(ctx.ip);
  if (blocked) ctx.throw(403, '该IP已被加入黑名单');
  return next();
}

// 通用API限流（按IP，每分钟最多60次）
export function rateLimitMiddleware(ctx, next) {
  const key = `rl:${ctx.ip}`;
  const cnt = cacheIncrTTL(key, 60000);
  if (cnt > 120) ctx.throw(429, '请求过于频繁，请稍后再试');
  return next();
}

// 投票接口多重防护
export function voteAntiCheatMiddleware(ctx, next) {
  const voteId = ctx.params.voteId || (ctx.request.body && ctx.request.body.voteId);
  if (!voteId) ctx.throw(400, '缺少voteId');
  const ip = ctx.ip;
  const fp = ctx.state.deviceFp;
  const now = Date.now();

  // 读取系统配置开关
  const cfg = getSystemConfig();
  const antiEnabled = cfg.anti_cheat_enabled === '1';
  const ipLimitOn = cfg.ip_limit_enabled === '1';
  const deviceLimitOn = cfg.device_limit_enabled === '1';
  const captchaOn = cfg.captcha_enabled === '1';

  // 1. IP间隔限制
  if (antiEnabled && ipLimitOn) {
    const ipKey = `ipint:${ip}`;
    const lastTs = cacheGet(ipKey);
    if (lastTs && now - parseInt(lastTs) < config.antiCheat.ipMinIntervalSec * 1000) {
      ctx.throw(429, `投票过于频繁，请等待${config.antiCheat.ipMinIntervalSec}秒后再试`);
    }
    cacheSet(ipKey, String(now), config.antiCheat.ipMinIntervalSec * 1000);

    // 2. IP每小时上限
    const ipHourKey = `iphour:${ip}`;
    const ipHourCnt = cacheIncrTTL(ipHourKey, 3600000);
    if (ipHourCnt > config.antiCheat.ipMaxPerHour) {
      // 标记为观察名单
      cacheSet(`watch:${fp}`, '1', 3600000);
      ctx.throw(429, '该IP今日投票次数已达上限');
    }
  }

  // 3. 高频触发验证码
  if (antiEnabled && captchaOn) {
    const fpCntKey = `fpcnt:${fp}`;
    const fpCnt = cacheIncrTTL(fpCntKey, 3600000);
    if (fpCnt > config.antiCheat.triggerCaptchaAfter) {
      const captchaPassed = ctx.headers['x-captcha-passed'] === '1';
      if (!captchaPassed) {
        ctx.status = 449;
        ctx.body = { code: 449, msg: '请先完成验证码', needCaptcha: true };
        return;
      }
    }
  }

  // 4. 设备指纹每投票次数限制
  if (antiEnabled && deviceLimitOn) {
    const vote = db.prepare('SELECT max_votes_per_user FROM votes WHERE id = ?').get(voteId);
    if (vote) {
      const max = vote.max_votes_per_user;
      if (max > 0) {
        // DB查询该设备对该投票的有效票数
        const fpVoteCnt = db.prepare('SELECT COUNT(DISTINCT created_at) c FROM vote_records WHERE vote_id=? AND device_fp=? AND is_valid=1').get(voteId, fp);
        // 使用唯一批次判断（同一次提交多题算一次，这里简化用 user+fp 维度）
        const fpBatchKey = `fpbatch:${voteId}:${fp}`;
        if (cacheIncr(fpBatchKey) > max) {
          // 查询DB实际次数
          const realCnt = db.prepare(`SELECT COUNT(*) c FROM (
            SELECT device_fp, date(created_at) d FROM vote_records WHERE vote_id=? AND device_fp=? AND is_valid=1 GROUP BY d
          )`).get(voteId, fp);
          if ((realCnt?.c || 0) >= max) {
            ctx.throw(403, '该设备投票次数已达上限');
          }
        }
      }
    }
  }
  return next();
}

function getSystemConfig() {
  const rows = db.prepare('SELECT key, value FROM system_config').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}
