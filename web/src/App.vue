<template>
  <div class="app-wrapper">
    <header class="navbar">
      <div class="nav-inner page-container">
        <div class="logo" @click="$router.push('/')">
          <el-icon size="24" color="#409eff"><DataLine /></el-icon>
          <span>投票系统</span>
        </div>
        <nav class="nav-menu">
          <router-link to="/" class="nav-item">首页</router-link>
          <router-link to="/create" class="nav-item" v-if="userStore.isLogin">创建投票</router-link>
          <router-link to="/user" class="nav-item" v-if="userStore.isLogin">用户中心</router-link>
          <router-link to="/admin" class="nav-item" v-if="userStore.isAdmin">后台管理</router-link>
        </nav>
        <div class="nav-right">
          <template v-if="userStore.isLogin">
            <el-dropdown @command="onCommand">
              <span class="user-info">
                <el-avatar :size="32" :src="userStore.user?.avatar">{{ userStore.user?.nickname?.[0] || 'U' }}</el-avatar>
                <span class="username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">个人资料</el-dropdown-item>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button type="primary" @click="$router.push('/login')">登录</el-button>
            <el-button @click="$router.push('/register')">注册</el-button>
          </template>
        </div>
      </div>
    </header>
    <main class="main-content">
      <router-view />
    </main>
    <footer class="footer text-center">
      <p>投票系统 · 具备防作弊机制与专业数据分析能力</p>
    </footer>
  </div>
</template>

<script setup>
import { useUserStore } from './stores/user';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const userStore = useUserStore();
const router = useRouter();

function onCommand(cmd) {
  if (cmd === 'logout') {
    userStore.logout();
    ElMessage.success('已退出登录');
    router.push('/');
  } else if (cmd === 'profile') {
    router.push('/user');
  }
}
</script>

<style scoped>
.app-wrapper { display: flex; flex-direction: column; min-height: 100vh; }
.navbar { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.06); position: sticky; top: 0; z-index: 100; }
.nav-inner { display: flex; align-items: center; height: 60px; gap: 24px; }
.logo { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; cursor: pointer; color: #303133; }
.nav-menu { display: flex; gap: 20px; flex: 1; }
.nav-item { color: #606266; font-size: 15px; transition: color .2s; }
.nav-item.router-link-exact-active { color: #409eff; font-weight: 600; }
.nav-item:hover { color: #409eff; }
.nav-right { display: flex; align-items: center; gap: 8px; }
.user-info { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.username { font-size: 14px; color: #303133; }
.main-content { flex: 1; }
.footer { padding: 24px; color: #909399; font-size: 13px; background: #fff; border-top: 1px solid #ebeef5; }
@media (max-width: 768px) {
  .nav-menu { gap: 12px; }
  .nav-item { font-size: 13px; }
  .username { display: none; }
}
</style>
