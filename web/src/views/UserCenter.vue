<template>
  <div class="page-container">
    <el-tabs v-model="activeTab" @tab-change="loadTab">
      <el-tab-pane label="我的投票" name="my">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column prop="view_count" label="浏览" width="80" />
          <el-table-column prop="vote_count" label="票数" width="80" />
          <el-table-column label="状态" width="100">
            <template #default="{row}">
              <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="180" />
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="$router.push(`/vote/${row.id}`)">查看</el-button>
              <el-button size="small" @click="$router.push(`/edit/${row.id}`)">编辑</el-button>
              <el-button size="small" @click="onManage(row.id,'pause')" v-if="row.status===1">暂停</el-button>
              <el-button size="small" @click="onManage(row.id,'resume')" v-if="row.status===2">开启</el-button>
              <el-button size="small" type="danger" @click="onManage(row.id,'end')" v-if="row.status!==3">结束</el-button>
              <el-button size="small" @click="onDuplicate(row.id)">复制</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="我参与的" name="participated">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column prop="created_at" label="创建时间" width="180" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="$router.push(`/vote/${row.id}`)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="我的收藏" name="favorites">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column prop="favorited_at" label="收藏时间" width="180" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="$router.push(`/vote/${row.id}`)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="个人资料" name="profile">
        <el-form :model="profile" label-width="100px" style="max-width:500px" v-loading="loading">
          <el-form-item label="用户名"><el-input v-model="profile.username" disabled /></el-form-item>
          <el-form-item label="昵称"><el-input v-model="profile.nickname" /></el-form-item>
          <el-form-item label="手机"><el-input v-model="profile.phone" /></el-form-item>
          <el-form-item label="邮箱"><el-input v-model="profile.email" /></el-form-item>
          <el-form-item><el-button type="primary" @click="saveProfile">保存</el-button></el-form-item>
        </el-form>
        <el-divider />
        <h3 style="margin:20px 0">修改密码</h3>
        <el-form :model="pwd" label-width="100px" style="max-width:500px">
          <el-form-item label="原密码"><el-input v-model="pwd.oldPassword" type="password" show-password /></el-form-item>
          <el-form-item label="新密码"><el-input v-model="pwd.newPassword" type="password" show-password /></el-form-item>
          <el-form-item><el-button type="primary" @click="savePwd">修改密码</el-button></el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
    <div class="text-center mt-20" v-if="total > 10">
      <el-pagination background layout="prev, pager, next" :total="total" :page-size="10" v-model:current-page="page" @current-change="loadTab" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';
import { useUserStore } from '../stores/user';

const userStore = useUserStore();
const router = useRouter();
const activeTab = ref('my');
const list = ref([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const profile = reactive({ username:'', nickname:'', phone:'', email:'' });
const pwd = reactive({ oldPassword:'', newPassword:'' });

const statusText = (s) => ({0:'草稿',1:'进行中',2:'已暂停',3:'已结束'}[s]);
const statusType = (s) => ({1:'success',2:'warning',3:'info'}[s]||'');

async function loadTab() {
  loading.value = true;
  try {
    let res;
    if (activeTab.value === 'my') res = await api.myVotes(page.value);
    else if (activeTab.value === 'participated') res = await api.participated(page.value);
    else if (activeTab.value === 'favorites') res = await api.favorites(page.value);
    else if (activeTab.value === 'profile') { await loadProfile(); loading.value=false; return; }
    list.value = res.data.list || [];
    total.value = res.data.total || 0;
  } catch (e) { ElMessage.error(e.msg); }
  loading.value = false;
}

async function loadProfile() {
  const u = userStore.user;
  profile.username = u.username;
  profile.nickname = u.nickname || '';
  profile.phone = ''; profile.email = '';
  try {
    const res = await api.getVote(1); // dummy to ensure api works; profile via separate call
  } catch {}
}

async function saveProfile() {
  try { await api.updateProfile(profile); ElMessage.success('保存成功'); }
  catch (e) { ElMessage.error(e.msg); }
}

async function savePwd() {
  if (!pwd.oldPassword || !pwd.newPassword) return ElMessage.warning('请填写完整');
  try { await api.changePassword(pwd.oldPassword, pwd.newPassword); ElMessage.success('密码已修改'); pwd.oldPassword=''; pwd.newPassword=''; }
  catch (e) { ElMessage.error(e.msg); }
}

async function onManage(id, action) {
  const actionText = {pause:'暂停',resume:'开启',end:'结束',delete:'删除'}[action];
  await ElMessageBox.confirm(`确认${actionText}该投票？`, '提示', { type: 'warning' });
  try { await api.manageVote(id, action); ElMessage.success('操作成功'); loadTab(); }
  catch (e) { ElMessage.error(e.msg); }
}

async function onDuplicate(id) {
  try { const res = await api.duplicateVote(id); ElMessage.success('复制成功'); router.push(`/edit/${res.data.id}`); }
  catch (e) { ElMessage.error(e.msg); }
}

onMounted(loadTab);
</script>
