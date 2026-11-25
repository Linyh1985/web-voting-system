<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="flex-between">
          <span style="font-weight:600">{{ isEdit ? '编辑投票' : '创建投票' }}</span>
          <el-button @click="showTemplate = true">从模板创建</el-button>
        </div>
      </template>

      <el-form :model="form" label-width="120px">
        <el-divider>基本信息</el-divider>
        <el-form-item label="投票标题" required>
          <el-input v-model="form.title" placeholder="请输入投票标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="投票描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="投票说明（支持HTML）" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="form.cover_url" placeholder="封面图URL（选填）" />
        </el-form-item>
        <el-form-item label="分类标签">
          <el-select v-model="form.category" placeholder="选择分类" style="width:200px">
            <el-option label="评选" value="评选" /><el-option label="问卷" value="问卷" />
            <el-option label="测评" value="测评" /><el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>

        <el-divider>投票规则</el-divider>
        <el-form-item label="匿名模式">
          <el-switch v-model="form.is_anonymous" />
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-date-picker v-model="form.start_time" type="datetime" placeholder="选择开始时间" value-format="YYYY-MM-DD HH:mm" style="width:240px" />
        </el-form-item>
        <el-form-item label="结束时间" required>
          <el-date-picker v-model="form.end_time" type="datetime" placeholder="选择结束时间" value-format="YYYY-MM-DD HH:mm" style="width:240px" />
        </el-form-item>
        <el-form-item label="每人总次数">
          <el-radio-group v-model="form.max_votes_per_user">
            <el-radio :value="0">不限次数</el-radio>
            <el-radio :value="1">仅1次</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="每日次数">
          <el-input-number v-model="form.daily_limit" :min="0" :max="100" />
          <span class="form-tip">0 表示不限</span>
        </el-form-item>
        <el-form-item label="结果可见">
          <el-radio-group v-model="form.result_visible">
            <el-radio :value="0">始终可见</el-radio>
            <el-radio :value="1">投票后可见</el-radio>
            <el-radio :value="2">结束后公布</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="访问密码">
          <el-input v-model="form.password" placeholder="留空表示公开" style="width:240px" />
        </el-form-item>
        <el-form-item label="结束语">
          <el-input v-model="form.end_message" placeholder="投票成功后展示" />
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="form.redirect_url" placeholder="投票后跳转（选填）" />
        </el-form-item>

        <el-divider>
          <span>题目配置</span>
          <el-button type="primary" link @click="addQuestion" style="margin-left:12px">+ 添加题目</el-button>
        </el-divider>

        <div v-for="(q, qi) in form.questions" :key="qi" class="question-config">
          <div class="flex-between mb-20">
            <span class="q-num">第 {{ qi + 1 }} 题</span>
            <el-button type="danger" link @click="removeQuestion(qi)">删除</el-button>
          </div>
          <el-form-item label="题目标题" required>
            <el-input v-model="q.title" placeholder="请输入题目标题" />
          </el-form-item>
          <el-form-item label="题型">
            <el-select v-model="q.question_type" @change="onTypeChange(q)" style="width:200px">
              <el-option label="单选" :value="1" /><el-option label="多选" :value="2" />
              <el-option label="打分" :value="3" /><el-option label="排序" :value="4" />
              <el-option label="填空" :value="5" /><el-option label="图文" :value="6" />
            </el-select>
          </el-form-item>
          <template v-if="q.question_type === 2">
            <el-form-item label="最少选择">
              <el-input-number v-model="q.min_select" :min="1" :max="q.options.length || 1" />
            </el-form-item>
            <el-form-item label="最多选择">
              <el-input-number v-model="q.max_select" :min="q.min_select" :max="q.options.length || 1" />
            </el-form-item>
          </template>
          <template v-if="q.question_type === 3">
            <el-form-item label="最低分">
              <el-input-number v-model="q.min_score" :min="1" :max="q.max_score" />
            </el-form-item>
            <el-form-item label="最高分">
              <el-input-number v-model="q.max_score" :min="q.min_score" :max="100" />
            </el-form-item>
          </template>
          <el-form-item label="必答">
            <el-switch v-model="q.required" />
          </el-form-item>

          <!-- 选项配置（除填空外） -->
          <template v-if="q.question_type !== 5">
            <el-form-item label="选项">
              <div class="opts-config">
                <div v-for="(o, oi) in q.options" :key="oi" class="opt-config-row">
                  <el-input v-model="o.content" placeholder="选项内容" style="flex:1" />
                  <el-input v-if="q.question_type === 6" v-model="o.image_url" placeholder="图片URL" style="width:200px" />
                  <el-button type="danger" :icon="Delete" circle @click="q.options.splice(oi, 1)" />
                </div>
                <el-button type="primary" link @click="q.options.push({ content: '', image_url: '' })">+ 添加选项</el-button>
              </div>
            </el-form-item>
          </template>
        </div>

        <el-form-item>
          <el-button type="primary" size="large" :loading="saving" @click="onSave(true)">发布投票</el-button>
          <el-button size="large" :loading="saving" @click="onSave(false)">保存草稿</el-button>
          <el-button size="large" @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 模板选择 -->
    <el-dialog v-model="showTemplate" title="选择模板" width="700px">
      <el-row :gutter="16">
        <el-col :span="6" v-for="t in templates" :key="t.id">
          <el-card class="vote-card" @click="useTemplate(t)" style="text-align:center">
            <el-icon size="32" color="#409eff"><Document /></el-icon>
            <p style="margin:8px 0;font-weight:600">{{ t.name }}</p>
            <el-tag size="small">{{ t.category }}</el-tag>
          </el-card>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import api from '../api';

const route = useRoute();
const router = useRouter();
const isEdit = ref(false);
const saving = ref(false);
const showTemplate = ref(false);
const templates = ref([]);

const form = ref({
  title: '', description: '', cover_url: '', category: '',
  vote_type: 7, is_anonymous: false,
  start_time: '', end_time: '',
  max_votes_per_user: 0, daily_limit: 0, result_visible: 0,
  password: '', status: 1, end_message: '', redirect_url: '',
  questions: [newQuestion()]
});

function newQuestion() {
  return { title: '', question_type: 1, min_select: 1, max_select: 1, min_score: 1, max_score: 10, required: true, options: [{ content: '', image_url: '' }, { content: '', image_url: '' }] };
}

function addQuestion() { form.value.questions.push(newQuestion()); }
function removeQuestion(i) { form.value.questions.splice(i, 1); }
function onTypeChange(q) {
  if (q.question_type === 5) q.options = [];
  else if (!q.options.length) q.options = [{ content: '', image_url: '' }, { content: '', image_url: '' }];
}

async function onSave(publish) {
  if (!form.value.title) return ElMessage.warning('请输入标题');
  if (!form.value.start_time || !form.value.end_time) return ElMessage.warning('请设置起止时间');
  for (const q of form.value.questions) {
    if (!q.title) return ElMessage.warning('请填写所有题目标题');
    if (q.question_type !== 5) {
      if (!q.options.filter(o => o.content).length) return ElMessage.warning('每题至少一个选项');
    }
  }
  saving.value = true;
  form.value.status = publish ? 1 : 0;
  try {
    if (isEdit.value) {
      await api.updateVote(route.params.id, form.value);
      ElMessage.success('更新成功');
    } else {
      const res = await api.createVote(form.value);
      ElMessage.success('创建成功');
      router.push(`/vote/${res.data.id}`);
    }
  } catch (e) { ElMessage.error(e.msg || '保存失败'); }
  saving.value = false;
}

async function loadTemplates() {
  try {
    const res = await api.adminTemplates();
    templates.value = res.data || [];
  } catch { /* ignore */ }
}

function useTemplate(t) {
  const cfg = JSON.parse(t.config);
  form.value = { ...form.value, ...cfg, questions: cfg.questions.map(q => ({ ...q, options: q.options || [] })) };
  showTemplate.value = false;
  ElMessage.success('已应用模板');
}

onMounted(async () => {
  loadTemplates();
  if (route.name === 'VoteEdit') {
    isEdit.value = true;
    try {
      const res = await api.getVote(route.params.id);
      const v = res.data;
      form.value = { ...v, is_anonymous: !!v.is_anonymous, questions: (v.questions || []).map(q => ({ ...q, required: !!q.required, options: q.options || [] })) };
    } catch (e) { ElMessage.error('加载失败'); router.push('/'); }
  }
});
</script>

<style scoped>
.question-config { background: #fafafa; border: 1px solid #ebeef5; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
.q-num { font-weight: 600; color: #409eff; }
.opts-config { display: flex; flex-direction: column; gap: 8px; }
.opt-config-row { display: flex; gap: 8px; align-items: center; }
.form-tip { margin-left: 8px; color: #909399; font-size: 12px; }
</style>
