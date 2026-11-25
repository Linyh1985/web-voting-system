<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <h2 class="text-center">登录</h2>

      <el-tabs v-model="activeTab" class="login-tabs">
        <!-- 1. 账号密码 -->
        <el-tab-pane label="账号密码" name="password">
          <el-form @submit.prevent="onPwdLogin">
            <el-form-item>
              <el-input v-model="pwdForm.username" placeholder="用户名" prefix-icon="User" size="large" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="pwdForm.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password @keyup.enter="onPwdLogin" />
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="onPwdLogin">登录</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 2. 手机号 -->
        <el-tab-pane label="手机号" name="phone">
          <el-form @submit.prevent="onPhoneLogin">
            <el-form-item>
              <el-input v-model="phoneForm.phone" placeholder="手机号" prefix-icon="Iphone" size="large" maxlength="11" />
            </el-form-item>
            <el-form-item>
              <div class="flex gap-12">
                <el-input v-model="phoneForm.code" placeholder="验证码" prefix-icon="Key" size="large" maxlength="6" @keyup.enter="onPhoneLogin" />
                <el-button size="large" :disabled="phoneCountdown > 0" :loading="sending" @click="onSendSms" style="width:140px">
                  {{ phoneCountdown > 0 ? `${phoneCountdown}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="onPhoneLogin">登录</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 3. 邮箱 -->
        <el-tab-pane label="邮箱" name="email">
          <el-form @submit.prevent="onMailLogin">
            <el-form-item>
              <el-input v-model="mailForm.email" placeholder="邮箱" prefix-icon="Message" size="large" />
            </el-form-item>
            <el-form-item>
              <div class="flex gap-12">
                <el-input v-model="mailForm.code" placeholder="验证码" prefix-icon="Key" size="large" maxlength="6" @keyup.enter="onMailLogin" />
                <el-button size="large" :disabled="mailCountdown > 0" :loading="sending" @click="onSendMail" style="width:140px">
                  {{ mailCountdown > 0 ? `${mailCountdown}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="onMailLogin">登录</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 4. 微信扫码 -->
        <el-tab-pane label="微信" name="wechat">
          <div class="oauth-area">
            <template v-if="!wechatQrcode">
              <el-button type="success" size="large" round @click="loadWechatQrcode">生成微信二维码</el-button>
            </template>
            <template v-else>
              <div class="qrcode-box" v-html="wechatQrcode"></div>
              <p class="hint">请使用微信扫码登录</p>
              <!-- 开发模式：模拟扫码按钮 -->
              <el-button v-if="wechatDev" type="success" size="large" :loading="loading" @click="onMockWechatScan" class="mt-20">
                模拟扫码确认（开发模式）
              </el-button>
              <div v-if="wechatStatus === 'scanned'" class="text-center mt-20">
                <el-icon size="32" color="#67c23a"><CircleCheckFilled /></el-icon>
                <p>扫码成功，正在登录...</p>
              </div>
              <div v-if="wechatStatus === 'waiting'" class="text-center mt-20">
                <el-icon size="32" color="#909399"><Loading /></el-icon>
                <p style="color:#909399">等待扫码中...</p>
              </div>
            </template>
          </div>
        </el-tab-pane>

        <!-- 5. QQ -->
        <el-tab-pane label="QQ" name="qq">
          <div class="oauth-area">
            <el-button type="primary" size="large" round @click="onQqLogin">
              <el-icon style="margin-right:4px"><User /></el-icon>
              使用 QQ 账号登录
            </el-button>
            <p class="hint mt-20">点击后将跳转 QQ 授权页（开发模式自动完成）</p>
          </div>
        </el-tab-pane>
      </el-tabs>

      <div class="text-center" style="font-size:14px;color:#909399;margin-top:16px">
        还没有账号？<router-link to="/register" style="color:#409eff">立即注册</router-link>
      </div>
      <el-divider>测试账号</el-divider>
      <p class="text-center" style="font-size:13px;color:#909399">管理员：admin / admin123</p>
      <p class="text-center" style="font-size:12px;color:#c0c4cc;margin-top:4px">手机/邮箱验证码为控制台打印（开发模式）</p>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api';
import { useUserStore } from '../stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const activeTab = ref('password');
const loading = ref(false);
const sending = ref(false);

// 账号密码
const pwdForm = ref({ username: '', password: '' });
async function onPwdLogin() {
  if (!pwdForm.value.username || !pwdForm.value.password) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    const res = await api.login(pwdForm.value.username, pwdForm.value.password);
    userStore.setLogin(res.data.token, res.data.user);
    ElMessage.success('登录成功');
    router.push('/');
  } catch (e) { ElMessage.error(e.msg || '登录失败'); }
  loading.value = false;
}

// 手机号
const phoneForm = ref({ phone: '', code: '' });
const phoneCountdown = ref(0);
let phoneTimer = null;
async function onSendSms() {
  if (!/^1[3-9]\d{9}$/.test(phoneForm.value.phone)) return ElMessage.warning('请输入正确的手机号');
  sending.value = true;
  try {
    const res = await api.sendSms(phoneForm.value.phone);
    ElMessage.success('验证码已发送');
    if (res.data.dev_preview) {
      ElMessage({ type: 'info', message: `开发模式验证码：${res.data.dev_preview}`, duration: 10000 });
    }
    phoneCountdown.value = 60;
    phoneTimer = setInterval(() => {
      phoneCountdown.value--;
      if (phoneCountdown.value <= 0) clearInterval(phoneTimer);
    }, 1000);
  } catch (e) { ElMessage.error(e.msg || '发送失败'); }
  sending.value = false;
}
async function onPhoneLogin() {
  if (!phoneForm.value.phone || !phoneForm.value.code) return ElMessage.warning('请填写完整');
  loading.value = true;
  try {
    const res = await api.loginBySms(phoneForm.value.phone, phoneForm.value.code);
    userStore.setLogin(res.data.token, res.data.user);
    ElMessage.success('登录成功');
    router.push('/');
  } catch (e) { ElMessage.error(e.msg || '登录失败'); }
  loading.value = false;
}

// 邮箱
const mailForm = ref({ email: '', code: '' });
const mailCountdown = ref(0);
let mailTimer = null;
async function onSendMail() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailForm.value.email)) return ElMessage.warning('请输入正确的邮箱');
  sending.value = true;
  try {
    const res = await api.sendMail(mailForm.value.email);
    ElMessage.success('验证码已发送');
    if (res.data.dev_preview) {
      ElMessage({ type: 'info', message: `开发模式验证码：${res.data.dev_preview}`, duration: 10000 });
    }
    mailCountdown.value = 60;
    mailTimer = setInterval(() => {
      mailCountdown.value--;
      if (mailCountdown.value <= 0) clearInterval(mailTimer);
    }, 1000);
  } catch (e) { ElMessage.error(e.msg || '发送失败'); }
  sending.value = false;
}
async function onMailLogin() {
  if (!mailForm.value.email || !mailForm.value.code) return ElMessage.warning('请填写完整');
  loading.value = true;
  try {
    const res = await api.loginByMail(mailForm.value.email, mailForm.value.code);
    userStore.setLogin(res.data.token, res.data.user);
    ElMessage.success('登录成功');
    router.push('/');
  } catch (e) { ElMessage.error(e.msg || '登录失败'); }
  loading.value = false;
}

// 微信扫码
const wechatQrcode = ref('');
const wechatTicket = ref('');
const wechatDev = ref(false);
const wechatStatus = ref('waiting');
let wechatPollTimer = null;
async function loadWechatQrcode() {
  loading.value = true;
  try {
    const res = await api.getWechatQrcode();
    wechatQrcode.value = res.data.qrcodeSvg || '';
    wechatTicket.value = res.data.ticket;
    wechatDev.value = !!res.data.dev;
    wechatStatus.value = 'waiting';
    // 开发模式：自动轮询扫码状态
    startWechatPoll();
  } catch (e) { ElMessage.error(e.msg || '获取二维码失败'); }
  loading.value = false;
}
function startWechatPoll() {
  stopWechatPoll();
  wechatPollTimer = setInterval(async () => {
    try {
      const res = await api.pollWechatScan(wechatTicket.value);
      wechatStatus.value = res.data.status;
      if (res.data.status === 'scanned') {
        stopWechatPoll();
        // 自动完成登录
        const loginRes = await api.loginByWechat(wechatTicket.value);
        userStore.setLogin(loginRes.data.token, loginRes.data.user);
        ElMessage.success('登录成功');
        router.push('/');
      } else if (res.data.status === 'expired' || res.data.status === 'invalid') {
        stopWechatPoll();
        ElMessage.error('二维码已失效，请重新生成');
      }
    } catch (e) { stopWechatPoll(); }
  }, 2000);
}
function stopWechatPoll() {
  if (wechatPollTimer) { clearInterval(wechatPollTimer); wechatPollTimer = null; }
}
async function onMockWechatScan() {
  loading.value = true;
  try {
    await api.mockWechatScan(wechatTicket.value);
    ElMessage.success('已模拟扫码');
  } catch (e) { ElMessage.error(e.msg || '扫码失败'); }
  loading.value = false;
}

// QQ
async function onQqLogin() {
  loading.value = true;
  try {
    const res = await api.getQqAuthorize();
    if (res.data.dev) {
      // 开发模式：通过 iframe 加载 mock-callback URL 完成 OAuth
      const ticket = res.data.ticket;
      // 用隐藏 iframe 触发服务端的 mock 回调
      await new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = res.data.authorizeUrl;
        iframe.onload = () => {
          // 给后端 1 秒处理时间
          setTimeout(resolve, 1000);
        };
        iframe.onerror = reject;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 5000);
      });
      // 用 ticket 完成登录
      const loginRes = await api.loginByQq(ticket);
      userStore.setLogin(loginRes.data.token, loginRes.data.user);
      ElMessage.success('QQ登录成功');
      router.push('/');
    } else {
      // 生产模式：跳转到 QQ 授权页
      window.location.href = res.data.authorizeUrl;
    }
  } catch (e) { ElMessage.error(e.msg || 'QQ登录失败'); }
  loading.value = false;
}

// 处理 OAuth 回调（URL 带 token 参数）
onMounted(() => {
  if (route.query.token) {
    // 微信/QQ 生产模式回调
    userStore.setLogin(route.query.token, { id: +route.query.uid, username: 'oauth_user', role: 0 });
    ElMessage.success('登录成功');
    router.push('/');
  }
});

onUnmounted(() => {
  stopWechatPoll();
  if (phoneTimer) clearInterval(phoneTimer);
  if (mailTimer) clearInterval(mailTimer);
});
</script>

<style scoped>
.auth-page { min-height: calc(100vh - 60px - 80px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.auth-card { width: 100%; max-width: 420px; padding: 20px; }
.login-tabs :deep(.el-tabs__item) { font-size: 15px; padding: 0 14px; }
.gap-12 { gap: 12px; }
.oauth-area { display: flex; flex-direction: column; align-items: center; padding: 30px 0; min-height: 200px; justify-content: center; }
.qrcode-box { width: 200px; height: 200px; margin: 0 auto; }
.qrcode-box :deep(svg) { width: 200px !important; height: 200px !important; }
.hint { color: #909399; font-size: 13px; margin-top: 12px; text-align: center; }
</style>
