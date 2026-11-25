<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <h2 class="text-center">注册</h2>
      <el-form :model="form" label-width="0">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名（3-32位）" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.nickname" placeholder="昵称（选填）" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.phone" placeholder="手机号（选填）" prefix-icon="Iphone" size="large" maxlength="11" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.email" placeholder="邮箱（选填）" prefix-icon="Message" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码（至少6位）" prefix-icon="Lock" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.confirm" type="password" placeholder="确认密码" prefix-icon="Lock" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="onRegister">注册</el-button>
        </el-form-item>
      </el-form>
      <div class="text-center" style="font-size:14px;color:#909399">
        已有账号？<router-link to="/login" style="color:#409eff">去登录</router-link>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api';

const form = ref({ username: '', nickname: '', phone: '', email: '', password: '', confirm: '' });
const loading = ref(false);
const router = useRouter();

async function onRegister() {
  if (!form.value.username || !form.value.password) return ElMessage.warning('请填写完整');
  if (form.value.password !== form.value.confirm) return ElMessage.warning('两次密码不一致');
  if (form.value.phone && !/^1[3-9]\d{9}$/.test(form.value.phone)) return ElMessage.warning('手机号格式不正确');
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) return ElMessage.warning('邮箱格式不正确');
  loading.value = true;
  try {
    await api.register(form.value.username, form.value.password, form.value.nickname, form.value.phone, form.value.email);
    ElMessage.success('注册成功，请登录');
    router.push('/login');
  } catch (e) {
    ElMessage.error(e.msg || '注册失败');
  }
  loading.value = false;
}
</script>

<style scoped>
.auth-page { min-height: calc(100vh - 60px - 80px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.auth-card { width: 100%; max-width: 400px; padding: 20px; }
</style>
