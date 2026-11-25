// 数据统计服务：实时看板 + 多维分析 + 导出Excel
import { db } from '../db.js';
import { cacheGet, cacheSet } from '../middlewares/antiCheat.js';
import ExcelJS from 'exceljs';

// 实时统计（缓存10秒）
export function getVoteStats(voteId) {
  const cacheKey = `stats:${voteId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const vote = db.prepare('SELECT id, title, view_count, status, start_time, end_time FROM votes WHERE id=?').get(voteId);
  if (!vote) throw new Error('投票不存在');

  // 总票数 + 参与人数
  const summary = db.prepare(`SELECT
    COUNT(*) AS total_votes,
    (SELECT COUNT(*) FROM (SELECT DISTINCT user_id, device_fp FROM vote_records WHERE vote_id=?)) AS participants,
    SUM(CASE WHEN is_valid=0 THEN 1 ELSE 0 END) AS invalid_votes
    FROM vote_records WHERE vote_id=?`).get(voteId, voteId);

  // 选项占比 + 平均分
  const options = db.prepare(`SELECT id, content, image_url, vote_count, score_sum,
    ROUND(score_sum / NULLIF(vote_count,0), 2) AS avg_score
    FROM vote_options WHERE vote_id=? ORDER BY vote_count DESC`).all(voteId);
  const totalOpt = options.reduce((s, o) => s + o.vote_count, 0);
  options.forEach(o => { o.percent = totalOpt ? +(o.vote_count / totalOpt * 100).toFixed(2) : 0; });

  // 按小时趋势
  const hourly = db.prepare(`SELECT
    strftime('%Y-%m-%d %H:00', created_at) AS hour, COUNT(*) AS cnt
    FROM vote_records WHERE vote_id=? AND is_valid=1
    GROUP BY hour ORDER BY hour`).all(voteId);

  // 按天趋势
  const daily = db.prepare(`SELECT
    date(created_at) AS day, COUNT(*) AS cnt
    FROM vote_records WHERE vote_id=? AND is_valid=1
    GROUP BY day ORDER BY day`).all(voteId);

  // 地域分布（基于IP前两段简化）
  const region = db.prepare(`SELECT
    SUBSTR(ip,1, INSTR(ip,'.')+INSTR(SUBSTR(ip,INSTR(ip,'.')+1),'.')) AS region,
    COUNT(*) AS cnt
    FROM vote_records WHERE vote_id=? AND is_valid=1 AND ip LIKE '%.%.%'
    GROUP BY region ORDER BY cnt DESC LIMIT 10`).all(voteId);

  // 设备类型分布（基于UA关键字）
  const device = db.prepare(`SELECT
    CASE
      WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' OR user_agent LIKE '%iPhone%' THEN '移动端'
      WHEN user_agent LIKE '%iPad%' THEN '平板'
      WHEN user_agent LIKE '%Windows%' OR user_agent LIKE '%Macintosh%' THEN 'PC'
      ELSE '其他'
    END AS device_type, COUNT(*) AS cnt
    FROM vote_records WHERE vote_id=? AND is_valid=1
    GROUP BY device_type ORDER BY cnt DESC`).all(voteId);

  // 投票高峰时段
  const peakHours = db.prepare(`SELECT
    strftime('%H', created_at) AS hour, COUNT(*) AS cnt
    FROM vote_records WHERE vote_id=? AND is_valid=1
    GROUP BY hour ORDER BY cnt DESC LIMIT 5`).all(voteId);

  // 无效票分类
  const invalidBreakdown = db.prepare(`SELECT
    COALESCE(invalid_reason,'未标记') AS reason, COUNT(*) AS cnt
    FROM vote_records WHERE vote_id=? AND is_valid=0
    GROUP BY reason ORDER BY cnt DESC`).all(voteId);

  // 填空题答案汇总
  const textAnswers = db.prepare(`SELECT q.title AS question, r.answer_text, r.created_at, r.ip
    FROM vote_records r JOIN vote_questions q ON q.id=r.question_id
    WHERE r.vote_id=? AND r.answer_text IS NOT NULL AND r.answer_text != ''
    ORDER BY r.created_at DESC LIMIT 100`).all(voteId);

  const result = {
    vote,
    summary: { ...summary, view_count: vote.view_count, conversion_rate: vote.view_count ? +(summary.total_votes / vote.view_count * 100).toFixed(2) : 0 },
    options, hourly, daily, region, device, peakHours, invalidBreakdown, textAnswers,
    updatedAt: new Date().toISOString()
  };
  cacheSet(cacheKey, result, 10000);
  return result;
}

// 排行榜
export function getLeaderboard(voteId, limit = 50) {
  return db.prepare(`SELECT id, content, image_url, vote_count,
    ROUND(score_sum / NULLIF(vote_count,0), 2) AS avg_score
    FROM vote_options WHERE vote_id=? ORDER BY vote_count DESC LIMIT ?`).all(voteId, limit);
}

// 平台大盘
export function getDashboard() {
  const totalVotes = db.prepare('SELECT COUNT(*) c FROM votes').get().c;
  const activeVotes = db.prepare("SELECT COUNT(*) c FROM votes WHERE status=1").get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users WHERE role=0').get().c;
  const totalRecords = db.prepare('SELECT COUNT(*) c FROM vote_records').get().c;
  const todayRecords = db.prepare("SELECT COUNT(*) c FROM vote_records WHERE date(created_at)=date('now','localtime')").get().c;
  const recent7 = db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS cnt
    FROM vote_records WHERE created_at >= datetime('now','localtime','-7 days')
    GROUP BY day ORDER BY day`).all();
  const hotVotes = db.prepare(`SELECT v.id, v.title, v.view_count, v.category,
    (SELECT COUNT(*) FROM vote_records r WHERE r.vote_id=v.id) AS vote_count
    FROM votes v ORDER BY vote_count DESC LIMIT 10`).all();
  return { totalVotes, activeVotes, totalUsers, totalRecords, todayRecords, recent7, hotVotes };
}

// 导出明细 Excel
export async function exportRecords(voteId) {
  const rows = db.prepare(`SELECT r.id, q.title AS question, o.content AS option_name,
    r.answer_text, r.score, r.rank_value, r.ip, r.device_fp,
    COALESCE(u.username,'匿名') AS user, r.is_valid, r.invalid_reason, r.created_at
    FROM vote_records r
    LEFT JOIN vote_questions q ON q.id=r.question_id
    LEFT JOIN vote_options o ON o.id=r.option_id
    LEFT JOIN users u ON u.id=r.user_id
    WHERE r.vote_id=? ORDER BY r.created_at`).all(voteId);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('投票明细');
  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: '题目', key: 'question', width: 25 },
    { header: '选项', key: 'option_name', width: 20 },
    { header: '填空内容', key: 'answer_text', width: 30 },
    { header: '打分', key: 'score', width: 8 },
    { header: '排序值', key: 'rank_value', width: 8 },
    { header: 'IP', key: 'ip', width: 15 },
    { header: '设备指纹', key: 'device_fp', width: 20 },
    { header: '用户', key: 'user', width: 12 },
    { header: '有效', key: 'is_valid', width: 6 },
    { header: '无效原因', key: 'invalid_reason', width: 15 },
    { header: '时间', key: 'created_at', width: 20 }
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRows(rows);
  return wb.xlsx.writeBuffer();
}

// 导出统计结果 Excel
export async function exportStats(voteId) {
  const stats = getVoteStats(voteId);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('统计结果');
  ws.columns = [
    { header: '选项', key: 'content', width: 30 },
    { header: '票数', key: 'vote_count', width: 10 },
    { header: '占比(%)', key: 'percent', width: 12 },
    { header: '平均分', key: 'avg_score', width: 10 }
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRows(stats.options);
  return wb.xlsx.writeBuffer();
}
