// 创建春游投票任务（Node.js 脚本，确保 UTF-8 编码正确）
import http from 'http';

// 1. 登录获取 token
function login() {
  return request('/api/auth/login', 'POST', { username: 'admin', password: 'admin123' });
}

// 2. 创建投票
function createVote(token, payload) {
  return request('/api/votes', 'POST', payload, token);
}

// 3. 删除乱码投票
function deleteVote(token, id) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action: 'delete' });
    const req = http.request({
      hostname: 'localhost', port: 3000, path: `/api/votes/${id}/manage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`,
        'X-Device-FP': 'cleanup-fp',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function request(path, method, payload, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['X-Device-FP'] = 'create-vote-fp';
    headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method, headers
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 主流程
const votePayload = {
  title: '2027年大学生春游目的地投票',
  description: '亲爱的同学们：\n\n春暖花开，学校拟定于2027年4月组织一年一度的春游活动。现就春游目的地向全体同学征求意见，请为你最想去的地方投出宝贵一票！投票截止后我们将按票数确定最终地点。\n\n【投票规则】\n• 每人限投1次\n• 选项共6个，请选择你最心仪的目的地\n• 投票截止：2026年10月10日 23:59',
  category: '评选',
  vote_type: 1,
  is_anonymous: false,
  start_time: '2026-09-10 00:00',
  end_time: '2026-10-10 23:59',
  max_votes_per_user: 1,
  daily_limit: 1,
  result_visible: 0,
  password: null,
  status: 1,
  end_message: '感谢您的参与！最终目的地将根据投票结果确定，敬请关注后续通知。',
  redirect_url: null,
  questions: [{
    title: '你最想去哪个地方作为本次春游目的地？',
    question_type: 1,
    required: true,
    min_select: 1,
    max_select: 1,
    options: [
      { content: '杭州西湖 - 赏苏堤春晓、断桥残雪，品味江南诗意', image_url: null },
      { content: '苏州园林 - 游拙政园、留园，感受古典园林之美', image_url: null },
      { content: '黄山 - 登光明顶、观云海奇松，体验五岳归来不看山', image_url: null },
      { content: '厦门鼓浪屿 - 海岛风情、万国建筑、文艺慢生活', image_url: null },
      { content: '成都都江堰+熊猫基地 - 看国宝大熊猫，访千年水利工程', image_url: null },
      { content: '桂林漓江 - 乘竹筏游漓江，赏山水甲天下画卷', image_url: null }
    ]
  }]
};

(async () => {
  try {
    // 1. 登录
    const loginRes = await login();
    console.log('[1] 登录:', loginRes.msg, '| user:', loginRes.data.user.username);
    const token = loginRes.data.token;

    // 2. 删除之前的乱码投票(ID=2)
    console.log('[2] 清理之前的乱码投票 ID=2...');
    try {
      const del = await deleteVote(token, 2);
      console.log('   删除结果:', del.msg);
    } catch (e) { console.log('   (ID=2 不存在或已删除)'); }

    // 3. 创建新投票
    console.log('[3] 创建春游投票...');
    const createRes = await createVote(token, votePayload);
    console.log('   创建结果:', createRes.msg, '| ID:', createRes.data.id);

    // 4. 验证详情
    console.log('[4] 验证详情...');
    const detailRes = await new Promise((resolve, reject) => {
      http.get({ hostname: 'localhost', port: 3000, path: `/api/votes/${createRes.data.id}`, headers: { 'X-Device-FP': 'verify-fp' } }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    const v = detailRes.data;
    console.log('   标题:', v.title);
    console.log('   描述:', v.description.slice(0, 60) + '...');
    console.log('   状态:', v.status, '(1=进行中)');
    console.log('   时间:', v.start_time, '~', v.end_time);
    console.log('   题目数:', v.questions.length);
    v.questions[0].options.forEach((o, i) => {
      console.log(`   选项${i + 1}:`, o.content);
    });
    console.log('\n[完成] 投票已创建，访问: http://localhost:5173/vote/' + createRes.data.id);
  } catch (e) {
    console.error('失败:', e.message);
  }
})();
