<template>
  <div class="page-container" v-loading="loading">
    <template v-if="vote.id">
      <!-- 投票头部 -->
      <el-card class="mb-20">
        <div class="vote-header">
          <div class="header-left">
            <h1 class="vote-title">{{ vote.title }}</h1>
            <div class="vote-meta">
              <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
              <span><el-icon><User /></el-icon> 创建者：{{ vote.creator_name }}</span>
              <span><el-icon><Clock /></el-icon> {{ vote.start_time?.slice(5,16) }} ~ {{ vote.end_time?.slice(5,16) }}</span>
              <span v-if="vote.is_anonymous"><el-icon><Hide /></el-icon> 匿名投票</span>
            </div>
            <p v-if="vote.description" class="vote-desc" v-html="vote.description"></p>
            <div class="stats-bar">
              <span><strong>{{ vote.view_count }}</strong> 浏览</span>
              <span><strong>{{ stats?.summary?.participants || 0 }}</strong> 参与</span>
              <span><strong>{{ stats?.summary?.total_votes || 0 }}</strong> 票数</span>
              <span v-if="vote.status===1" class="countdown"><strong>{{ countdown }}</strong></span>
            </div>
          </div>
          <img v-if="vote.cover_url" :src="vote.cover_url" class="header-cover" />
        </div>
      </el-card>

      <!-- 防作弊提示 -->
      <el-alert v-if="needCaptcha" type="warning" :closable="false" class="mb-20" title="检测到异常访问，请完成验证码">
        <template #default>
          <div class="flex gap-12" style="align-items:center">
            <img :src="captchaSvg" class="captcha-img" @click="loadCaptcha" v-if="captchaSvg" />
            <el-input v-model="captchaInput" placeholder="输入验证码" style="width:160px" />
            <el-button type="primary" @click="verifyCaptchaFn">提交验证</el-button>
          </div>
        </template>
      </el-alert>

      <!-- 题目区 -->
      <el-card class="mb-20">
        <template #header><span style="font-weight:600">投票题目（共 {{ vote.questions?.length || 0 }} 题）</span></template>
        <div v-for="(q, qi) in vote.questions" :key="q.id" class="question-block">
          <h3 class="q-title">{{ qi + 1 }}. {{ q.title }}
            <el-tag size="small" type="info">{{ typeNames[q.question_type] }}</el-tag>
            <span v-if="q.required" style="color:#f56c6c">*</span>
            <span v-if="q.question_type===2" class="hint">（选{{ q.min_select }}-{{ q.max_select }}项）</span>
            <span v-else-if="q.question_type===3" class="hint">（{{ q.min_score }}-{{ q.max_score }}分）</span>
          </h3>

          <!-- 单选 / 图文单选 -->
          <div v-if="q.question_type===1 || q.question_type===6" class="opt-list">
            <div v-for="o in q.options" :key="o.id" class="opt-item"
              :class="{ active: answers[q.id] === o.id }" @click="answers[q.id] = o.id">
              <img v-if="o.image_url" :src="o.image_url" class="opt-img" />
              <el-icon v-else-if="answers[q.id] === o.id" color="#409eff"><CircleCheckFilled /></el-icon>
              <el-icon v-else><ChatDotRound /></el-icon>
              <span>{{ o.content }}</span>
            </div>
          </div>

          <!-- 多选 -->
          <el-checkbox-group v-else-if="q.question_type===2" v-model="answers[q.id]" :min="q.min_select" :max="q.max_select">
            <div v-for="o in q.options" :key="o.id" class="opt-item"
              :class="{ active: answers[q.id]?.includes(o.id) }">
              <el-checkbox :label="o.id"><span>{{ o.content }}</span></el-checkbox>
            </div>
          </el-checkbox-group>

          <!-- 打分 -->
          <div v-else-if="q.question_type===3" class="opt-list">
            <div v-for="o in q.options" :key="o.id" class="score-row">
              <span style="min-width:120px">{{ o.content }}</span>
              <el-rate v-model="answers[q.id + '_' + o.id]" :min="q.min_score" :max="q.max_score" />
            </div>
          </div>

          <!-- 排序：拖拽排序选项 -->
          <div v-else-if="q.question_type===4" class="opt-list">
            <div v-for="(o, idx) in (answers[q.id] || q.options)" :key="o.id" class="rank-item">
              <el-icon><Rank /></el-icon>
              <span class="rank-num">{{ idx + 1 }}</span>
              <span>{{ o.content }}</span>
              <el-button-group size="small">
                <el-button :disabled="idx===0" @click="moveRank(q, idx, -1)">上移</el-button>
                <el-button :disabled="idx===(answers[q.id]||q.options).length-1" @click="moveRank(q, idx, 1)">下移</el-button>
              </el-button-group>
            </div>
          </div>

          <!-- 填空 -->
          <el-input v-else-if="q.question_type===5" v-model="answers[q.id]" type="textarea" :rows="3" placeholder="请输入您的回答" maxlength="1000" show-word-limit />
        </div>

        <div class="submit-bar">
          <el-button type="primary" size="large" :loading="submitting" @click="onSubmit">提交投票</el-button>
          <el-button size="large" @click="showResult = true">查看结果</el-button>
          <el-button @click="onFavorite" v-if="userStore.isLogin">
            <el-icon><Star /></el-icon>{{ favorited ? '已收藏' : '收藏' }}
          </el-button>
          <el-button @click="onShare"><el-icon><Share /></el-icon>分享</el-button>
        </div>
      </el-card>

      <!-- 结果弹窗 -->
      <el-dialog v-model="showResult" title="实时投票结果" width="90%" style="max-width:900px" @open="loadStats">
        <div v-if="stats">
          <h3 style="margin-bottom:12px">选项占比</h3>
          <div ref="chartPie" class="chart-box"></div>
          <el-divider />
          <h3 style="margin-bottom:12px">票数排行</h3>
          <div ref="chartBar" class="chart-box"></div>
          <el-divider />
          <h3 style="margin-bottom:12px">投票趋势</h3>
          <div ref="chartLine" class="chart-box"></div>
        </div>
        <el-empty v-else description="暂无数据" />
      </el-dialog>

      <!-- 分享弹窗 -->
      <el-dialog v-model="showShare" title="分享投票" width="360px">
        <div class="text-center">
          <p style="margin-bottom:12px;color:#606266">复制下方链接分享给好友：</p>
          <el-input :model-value="shareUrl" readonly>
            <template #append><el-button @click="copyShare">复制</el-button></template>
          </el-input>
        </div>
      </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import api from '../api';
import { useUserStore } from '../stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const loading = ref(true);
const vote = ref({});
const answers = reactive({});
const stats = ref(null);
const showResult = ref(false);
const submitting = ref(false);
const favorited = ref(false);

// 验证码相关
const needCaptcha = ref(false);
const captchaSvg = ref('');
const captchaToken = ref('');
const captchaInput = ref('');

const chartPie = ref(null);
const chartBar = ref(null);
const chartLine = ref(null);

const typeNames = { 1: '单选', 2: '多选', 3: '打分', 4: '排序', 5: '填空', 6: '图文', 7: '问卷' };

const statusText = computed(() => ({ 0: '草稿', 1: '进行中', 2: '已暂停', 3: '已结束' }[vote.value.status]));
const statusType = computed(() => ({ 1: 'success', 2: 'warning', 3: 'info' }[vote.value.status] || ''));

const now = ref(Date.now());
setInterval(() => now.value = Date.now(), 1000);
const countdown = computed(() => {
  if (!vote.value.end_time) return '--';
  const diff = new Date(vote.value.end_time.replace(' ', 'T')) - now.value;
  if (diff <= 0) return '已结束';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `剩余 ${d}天 ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

onMounted(async () => {
  const id = route.params.id;
  try {
    const res = await api.getVote(id);
    vote.value = res.data;
    // 初始化答案容器
    (vote.value.questions || []).forEach(q => {
      if (q.question_type === 2) answers[q.id] = [];
      else if (q.question_type === 4) answers[q.id] = [...q.options];
      else answers[q.id] = null;
    });
    favorited.value = false;
  } catch (e) {
    ElMessage.error(e.msg || '加载失败');
  }
  loading.value = false;
});

// 排序题上移/下移
function moveRank(q, idx, dir) {
  const arr = answers[q.id];
  const target = idx + dir;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
}

// 提交投票
async function onSubmit() {
  if (vote.value.password) {
    // 密码校验（简化：前端提示）
    const { value } = await ElMessageBox.prompt('请输入访问密码', '投票密码', { inputType: 'password' });
    if (value !== vote.value.password) return ElMessage.error('密码错误');
  }

  const built = buildAnswers();
  if (!built.length && !needCaptcha.value) return;

  submitting.value = true;
  try {
    await api.submitVote(vote.value.id, built);
    ElMessage.success('投票成功！');
    if (vote.value.redirect_url) {
      setTimeout(() => window.location.href = vote.value.redirect_url, 1500);
    }
    showResult.value = true;
    await loadStats();
  } catch (e) {
    if (e.needCaptcha) {
      needCaptcha.value = true;
      await loadCaptcha();
      ElMessage.warning('请先完成验证码');
    } else {
      ElMessage.error(e.msg || '提交失败');
    }
  }
  submitting.value = false;
}

function buildAnswers() {
  const arr = [];
  for (const q of vote.value.questions || []) {
    const a = answers[q.id];
    if (q.required) {
      if (q.question_type === 5 && !a?.trim()) { ElMessage.warning(`请填写：${q.title}`); return []; }
      if ([1, 6].includes(q.question_type) && !a) { ElMessage.warning(`请选择：${q.title}`); return []; }
      if (q.question_type === 2 && !a?.length) { ElMessage.warning(`请选择：${q.title}`); return []; }
    }
    if (q.question_type === 5) {
      if (a?.trim()) arr.push({ questionId: q.id, answerText: a.trim() });
    } else if (q.question_type === 3) {
      q.options.forEach(o => {
        const sc = answers[q.id + '_' + o.id];
        if (sc != null) arr.push({ questionId: q.id, optionId: o.id, score: sc });
      });
    } else if (q.question_type === 4) {
      (a || []).forEach((o, idx) => arr.push({ questionId: q.id, optionId: o.id, rank: idx + 1 }));
    } else if (q.question_type === 2) {
      (a || []).forEach(oid => arr.push({ questionId: q.id, optionId: oid }));
    } else {
      if (a) arr.push({ questionId: q.id, optionId: a });
    }
  }
  return arr;
}

// 验证码
async function loadCaptcha() {
  const res = await api.getCaptcha();
  captchaSvg.value = res.data.svg;
  captchaToken.value = res.data.token;
}
async function verifyCaptchaFn() {
  const res = await api.verifyCaptcha(captchaToken.value, captchaInput.value);
  if (res.data.passed) {
    ElMessage.success('验证通过');
    needCaptcha.value = false;
    // 设置标记（通过自定义header，简化方案：localStorage）
    localStorage.setItem('captchaPassed', Date.now().toString());
  } else {
    ElMessage.error('验证码错误');
    await loadCaptcha();
  }
}

// 统计
async function loadStats() {
  try {
    const res = await api.getStats(vote.value.id);
    stats.value = res.data;
    await nextTick();
    drawCharts();
  } catch (e) { ElMessage.error('加载统计失败'); }
}

function drawCharts() {
  if (!stats.value) return;
  // 饼图
  if (chartPie.value) {
    echarts.init(chartPie.value).setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}票 ({d}%)' },
      legend: { orient: 'vertical', left: 'left', type: 'scroll' },
      series: [{ type: 'pie', radius: ['35%', '70%'], avoidLabelOverlap: true,
        data: stats.value.options.map(o => ({ name: o.content, value: o.vote_count })) }]
    });
  }
  // 柱状排行
  if (chartBar.value) {
    const sorted = [...stats.value.options].sort((a, b) => b.vote_count - a.vote_count);
    echarts.init(chartBar.value).setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '5%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: sorted.map(o => o.content), inverse: true },
      series: [{ type: 'bar', data: sorted.map(o => o.vote_count), itemStyle: { color: '#409eff' },
        label: { show: true, position: 'right' } }]
    });
  }
  // 趋势折线
  if (chartLine.value) {
    const hourly = stats.value.hourly || [];
    echarts.init(chartLine.value).setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '5%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: hourly.map(h => h.hour?.slice(11, 16) || h.hour), axisLabel: { rotate: 30 } },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: hourly.map(h => h.cnt), smooth: true, areaStyle: {}, itemStyle: { color: '#67c23a' } }]
    });
  }
}

// 收藏
async function onFavorite() {
  try {
    const res = await api.favorite(vote.value.id);
    favorited.value = res.data.added;
    ElMessage.success(res.msg);
  } catch (e) { ElMessage.error(e.msg); }
}

// 分享
const showShare = ref(false);
const shareUrl = ref('');
async function onShare() {
  const res = await api.share(vote.value.id);
  shareUrl.value = res.data.url;
  showShare.value = true;
}
async function copyShare() {
  try { await navigator.clipboard.writeText(shareUrl.value); ElMessage.success('已复制链接'); }
  catch { ElMessage.warning('请手动复制'); }
}
</script>

<style scoped>
.vote-header { display: flex; gap: 20px; }
.header-left { flex: 1; }
.vote-title { font-size: 24px; margin-bottom: 12px; }
.vote-meta { display: flex; flex-wrap: wrap; gap: 16px; color: #909399; font-size: 13px; align-items: center; }
.vote-desc { margin: 12px 0; color: #606266; line-height: 1.6; }
.stats-bar { display: flex; gap: 20px; margin-top: 12px; padding: 12px; background: #f5f7fa; border-radius: 8px; font-size: 14px; color: #606266; }
.stats-bar strong { color: #409eff; font-size: 18px; margin-right: 4px; }
.countdown strong { color: #e6a23c; }
.header-cover { width: 200px; height: 140px; object-fit: cover; border-radius: 8px; }
.question-block { padding: 16px 0; border-bottom: 1px solid #f0f2f5; }
.q-title { font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.q-title .hint { font-size: 12px; color: #909399; font-weight: normal; }
.opt-list { display: flex; flex-direction: column; gap: 8px; }
.opt-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid #e4e7ed; border-radius: 8px; cursor: pointer; transition: all .2s; }
.opt-item:hover { border-color: #409eff; }
.opt-item.active { border-color: #409eff; background: #ecf5ff; }
.opt-img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; }
.score-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
.rank-item { display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px solid #e4e7ed; border-radius: 8px; }
.rank-num { width: 24px; height: 24px; background: #409eff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.submit-bar { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
.chart-box { height: 350px; }
@media (max-width: 768px) {
  .header-cover { display: none; }
  .stats-bar { flex-wrap: wrap; gap: 12px; }
}
</style>
