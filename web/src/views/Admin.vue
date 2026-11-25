<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <el-icon size="28" color="#fff"><DataLine /></el-icon>
        <span v-show="!sidebarCollapsed" class="sidebar-title">投票系统后台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="#001529"
        text-color="#b7bdc7"
        active-text-color="#fff"
        :collapse="sidebarCollapsed"
        @select="onMenuSelect"
      >
        <el-menu-item index="dashboard">
          <el-icon><Odometer /></el-icon><template #title>数据大盘</template>
        </el-menu-item>
        <el-menu-item index="votes">
          <el-icon><Document /></el-icon><template #title>投票管理</template>
        </el-menu-item>
        <el-menu-item index="users">
          <el-icon><User /></el-icon><template #title>用户管理</template>
        </el-menu-item>
        <el-menu-item index="blacklist">
          <el-icon><Warning /></el-icon><template #title>黑名单</template>
        </el-menu-item>
        <el-menu-item index="templates">
          <el-icon><Files /></el-icon><template #title>模板管理</template>
        </el-menu-item>
        <el-menu-item index="config">
          <el-icon><Setting /></el-icon><template #title>系统配置</template>
        </el-menu-item>
        <el-menu-item index="logs">
          <el-icon><Tickets /></el-icon><template #title>操作日志</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer" v-show="!sidebarCollapsed">
        <span>v1.0 · 管理员 {{ userStore.user?.username }}</span>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="admin-main">
      <!-- 顶栏 -->
      <header class="admin-topbar">
        <div class="topbar-left">
          <el-icon class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed" size="20">
            <Fold v-if="!sidebarCollapsed" /><Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/admin' }">后台</el-breadcrumb-item>
            <el-breadcrumb-item>{{ menuTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="topbar-right">
          <el-tooltip content="返回前台" placement="bottom">
            <el-icon class="topbar-icon" @click="$router.push('/')" size="18"><Monitor /></el-icon>
          </el-tooltip>
          <el-tooltip content="刷新数据" placement="bottom">
            <el-icon class="topbar-icon" @click="loadTab" size="18"><Refresh /></el-icon>
          </el-tooltip>
          <el-dropdown @command="onCommand">
            <div class="admin-user">
              <el-avatar :size="32" :src="userStore.user?.avatar">{{ userStore.user?.nickname?.[0] || 'A' }}</el-avatar>
              <span class="admin-username">{{ userStore.user?.nickname || 'admin' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人资料</el-dropdown-item>
                <el-dropdown-item command="frontend">返回前台</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="admin-content" v-loading="loading">
        <!-- 1. 数据大盘 -->
        <section v-if="activeMenu === 'dashboard'">
          <div v-if="dashboard">
            <!-- 核心指标卡片 -->
            <el-row :gutter="16" class="stat-row">
              <el-col :xs="12" :sm="6">
                <div class="stat-card stat-blue">
                  <div class="stat-icon"><el-icon size="28"><Document /></el-icon></div>
                  <div class="stat-info"><div class="stat-value">{{ dashboard.totalVotes }}</div><div class="stat-label">投票总数</div></div>
                </div>
              </el-col>
              <el-col :xs="12" :sm="6">
                <div class="stat-card stat-green">
                  <div class="stat-icon"><el-icon size="28"><TrendCharts /></el-icon></div>
                  <div class="stat-info"><div class="stat-value">{{ dashboard.activeVotes }}</div><div class="stat-label">进行中</div></div>
                </div>
              </el-col>
              <el-col :xs="12" :sm="6">
                <div class="stat-card stat-orange">
                  <div class="stat-icon"><el-icon size="28"><User /></el-icon></div>
                  <div class="stat-info"><div class="stat-value">{{ dashboard.totalUsers }}</div><div class="stat-label">注册用户</div></div>
                </div>
              </el-col>
              <el-col :xs="12" :sm="6">
                <div class="stat-card stat-purple">
                  <div class="stat-icon"><el-icon size="28"><Tickets /></el-icon></div>
                  <div class="stat-info"><div class="stat-value">{{ dashboard.totalRecords }}</div><div class="stat-label">总投票数</div></div>
                </div>
              </el-col>
            </el-row>

            <el-row :gutter="16">
              <!-- 趋势图 -->
              <el-col :xs="24" :lg="16">
                <el-card class="chart-card">
                  <template #header><div class="card-header"><span>近7天投票趋势</span></div></template>
                  <div ref="chartTrend" class="chart-box"></div>
                </el-card>
              </el-col>
              <!-- 今日数据 -->
              <el-col :xs="24" :lg="8">
                <el-card class="chart-card">
                  <template #header><div class="card-header"><span>今日数据</span></div></template>
                  <div class="today-stat">
                    <div class="today-item"><span class="today-label">今日投票</span><span class="today-value">{{ dashboard.todayRecords }}</span></div>
                    <el-divider />
                    <div class="today-item"><span class="today-label">活跃投票</span><span class="today-value text-green">{{ dashboard.activeVotes }}</span></div>
                    <el-divider />
                    <div class="today-item"><span class="today-label">总用户</span><span class="today-value text-blue">{{ dashboard.totalUsers }}</span></div>
                  </div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 热门投票 -->
            <el-card class="mt-16">
              <template #header><div class="card-header"><span>热门投票 TOP10</span><el-tag type="success" size="small">实时</el-tag></div></template>
              <el-table :data="dashboard.hotVotes" stripe size="default">
                <el-table-column type="index" label="排名" width="70"><template #default="{ $index }"><span class="rank-badge" :class="'rank-'+($index+1)">{{ $index + 1 }}</span></template></el-table-column>
                <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
                <el-table-column prop="category" label="分类" width="100"><template #default="{row}"><el-tag size="small" effect="plain">{{ row.category || '未分类' }}</el-tag></template></el-table-column>
                <el-table-column prop="view_count" label="浏览量" width="100" sortable />
                <el-table-column prop="vote_count" label="票数" width="100" sortable />
                <el-table-column label="操作" width="100">
                  <template #default="{row}"><el-button size="small" type="primary" plain @click="$router.push(`/vote/${row.id}`)">查看</el-button></template>
                </el-table-column>
              </el-table>
            </el-card>
          </div>
        </section>

        <!-- 2. 投票管理 -->
        <section v-else-if="activeMenu === 'votes'">
          <div class="toolbar">
            <div class="toolbar-left">
              <el-input v-model="voteKeyword" placeholder="搜索投票标题" clearable style="width:260px" @keyup.enter="loadVotes" @clear="loadVotes">
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-radio-group v-model="voteStatus" @change="loadVotes">
                <el-radio-button :value="1">进行中</el-radio-button>
                <el-radio-button :value="2">已暂停</el-radio-button>
                <el-radio-button :value="3">已结束</el-radio-button>
              </el-radio-group>
            </div>
            <el-button type="primary" @click="$router.push('/create')"><el-icon><Plus /></el-icon>创建投票</el-button>
          </div>
          <el-table :data="votes" stripe class="mt-16">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
            <el-table-column prop="creator_name" label="创建者" width="120" />
            <el-table-column prop="category" label="分类" width="100"><template #default="{row}"><el-tag size="small" effect="plain">{{ row.category || '未分类' }}</el-tag></template></el-table-column>
            <el-table-column prop="vote_count" label="票数" width="80" />
            <el-table-column prop="view_count" label="浏览" width="80" />
            <el-table-column label="状态" width="100">
              <template #default="{row}"><el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="end_time" label="截止时间" width="160" />
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{row}">
                <el-button size="small" @click="$router.push(`/vote/${row.id}`)">查看</el-button>
                <el-button size="small" type="warning" @click="onVoteAction(row.id,'offline')" v-if="row.status===1">下架</el-button>
                <el-button size="small" type="success" @click="onVoteAction(row.id,'online')" v-if="row.status!==1">上架</el-button>
                <el-button size="small" type="info" @click="onVoteAction(row.id,'end')" v-if="row.status!==3">结束</el-button>
                <el-button size="small" type="danger" @click="onVoteAction(row.id,'delete')">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrap" v-if="voteTotal > voteSize">
            <el-pagination background layout="total, prev, pager, next" :total="voteTotal" :page-size="voteSize" v-model:current-page="votePage" @current-change="loadVotes" />
          </div>
        </section>

        <!-- 3. 用户管理 -->
        <section v-else-if="activeMenu === 'users'">
          <div class="toolbar">
            <div class="toolbar-left">
              <el-input v-model="userKeyword" placeholder="搜索用户名/昵称/手机号" clearable style="width:300px" @keyup.enter="loadUsers" @clear="loadUsers">
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <el-select v-model="userRoleFilter" placeholder="角色筛选" clearable style="width:140px" @change="loadUsers">
                <el-option label="全部角色" :value="null" />
                <el-option label="管理员" :value="1" />
                <el-option label="普通用户" :value="0" />
              </el-select>
            </div>
          </div>
          <el-table :data="users" stripe class="mt-16">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="用户" min-width="200">
              <template #default="{row}">
                <div class="user-cell">
                  <el-avatar :size="36" :src="row.avatar">{{ (row.nickname || row.username || '')[0] }}</el-avatar>
                  <div>
                    <div class="user-name">{{ row.nickname || row.username }}</div>
                    <div class="user-sub">{{ row.username }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="phone" label="手机" width="130"><template #default="{row}">{{ row.phone || '—' }}</template></el-table-column>
            <el-table-column prop="email" label="邮箱" width="200" show-overflow-tooltip><template #default="{row}">{{ row.email || '—' }}</template></el-table-column>
            <el-table-column label="角色" width="90">
              <template #default="{row}"><el-tag :type="row.role===1?'danger':''" size="small" effect="dark">{{ row.role===1?'管理员':'用户' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{row}"><el-tag :type="row.status===1?'success':'info'" size="small">{{ row.status===1?'正常':'禁用' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="黑名单" width="80">
              <template #default="{row}"><el-tag :type="row.is_blacklist?'danger':'success'" size="small" effect="plain">{{ row.is_blacklist?'是':'否' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="created_at" label="注册时间" width="160" />
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{row}">
                <el-button size="small" :type="row.status===1?'warning':'success'" @click="onUserStatus(row.id,'status',row.status===1?0:1)">{{ row.status===1?'禁用':'启用' }}</el-button>
                <el-button size="small" :type="row.is_blacklist?'success':'danger'" plain @click="onUserStatus(row.id,'is_blacklist',row.is_blacklist===1?0:1)">{{ row.is_blacklist?'移出':'加入' }}黑名单</el-button>
                <el-button size="small" @click="onUserStatus(row.id,'role',row.role===1?0:1)">切换角色</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-wrap" v-if="userTotal > 20">
            <el-pagination background layout="total, prev, pager, next" :total="userTotal" :page-size="20" v-model:current-page="userPage" @current-change="loadUsers" />
          </div>
        </section>

        <!-- 4. 黑名单 -->
        <section v-else-if="activeMenu === 'blacklist'">
          <el-card class="mb-16">
            <template #header><div class="card-header"><el-icon><Plus /></el-icon><span>添加黑名单</span></div></template>
            <div class="flex gap-12" style="align-items:center">
              <el-select v-model="blForm.type" style="width:120px"><el-option label="设备指纹" value="device" /><el-option label="IP地址" value="ip" /></el-select>
              <el-input v-model="blForm.value" placeholder="请输入设备指纹或IP地址" style="width:300px" />
              <el-input v-model="blForm.reason" placeholder="拉黑原因（选填）" style="width:200px" />
              <el-button type="primary" @click="addBlacklist"><el-icon><Plus /></el-icon>添加</el-button>
            </div>
          </el-card>
          <el-row :gutter="16">
            <el-col :sm="24" :md="12">
              <el-card>
                <template #header><div class="card-header"><el-icon><Warning /></el-icon><span>设备黑名单</span><el-tag size="small">{{ blacklist.devices.length }}</el-tag></div></template>
                <el-table :data="blacklist.devices" size="small" empty-text="暂无数据">
                  <el-table-column prop="device_fp" label="设备指纹" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="reason" label="原因" width="140" />
                  <el-table-column prop="created_at" label="时间" width="160" />
                  <el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" type="danger" plain @click="removeBlacklist('device',row.id)">移除</el-button></template></el-table-column>
                </el-table>
              </el-card>
            </el-col>
            <el-col :sm="24" :md="12">
              <el-card>
                <template #header><div class="card-header"><el-icon><Warning /></el-icon><span>IP黑名单</span><el-tag size="small">{{ blacklist.ips.length }}</el-tag></div></template>
                <el-table :data="blacklist.ips" size="small" empty-text="暂无数据">
                  <el-table-column prop="ip" label="IP地址" min-width="160" />
                  <el-table-column prop="reason" label="原因" width="140" />
                  <el-table-column prop="created_at" label="时间" width="160" />
                  <el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" type="danger" plain @click="removeBlacklist('ip',row.id)">移除</el-button></template></el-table-column>
                </el-table>
              </el-card>
            </el-col>
          </el-row>
        </section>

        <!-- 5. 模板管理 -->
        <section v-else-if="activeMenu === 'templates'">
          <div class="toolbar"><div class="toolbar-left"></div><el-button type="primary" @click="showTplDialog = true"><el-icon><Plus /></el-icon>新建模板</el-button></div>
          <el-row :gutter="16" class="mt-16">
            <el-col :xs="24" :sm="12" :md="8" v-for="tpl in templates" :key="tpl.id">
              <el-card class="tpl-card" shadow="hover">
                <div class="tpl-category"><el-tag size="small" effect="dark">{{ tpl.category || '通用' }}</el-tag></div>
                <h3 class="tpl-name">{{ tpl.name }}</h3>
                <p class="tpl-desc">配置预览</p>
                <pre class="tpl-config">{{ JSON.parse(tpl.config).title }}</pre>
                <div class="tpl-actions">
                  <el-button size="small" type="primary" plain @click="useTemplate(tpl)">使用模板</el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </section>

        <!-- 6. 系统配置 -->
        <section v-else-if="activeMenu === 'config'">
          <el-card style="max-width:700px">
            <template #header><div class="card-header"><el-icon><Setting /></el-icon><span>系统配置</span></div></template>
            <el-form :model="sysConfig" label-width="140px" label-position="right">
              <el-form-item label="站点名称"><el-input v-model="sysConfig.site_name" placeholder="投票系统" /></el-form-item>
              <el-divider content-position="left">安全防护</el-divider>
              <el-form-item label="防作弊总开关"><el-switch v-model="sysConfig.anti_cheat_enabled" active-value="1" inactive-value="0" active-text="开启" inactive-text="关闭" /></el-form-item>
              <el-form-item label="验证码防护"><el-switch v-model="sysConfig.captcha_enabled" active-value="1" inactive-value="0" active-text="开启" inactive-text="关闭" /></el-form-item>
              <el-form-item label="IP限制"><el-switch v-model="sysConfig.ip_limit_enabled" active-value="1" inactive-value="0" active-text="开启" inactive-text="关闭" /></el-form-item>
              <el-form-item label="设备限制"><el-switch v-model="sysConfig.device_limit_enabled" active-value="1" inactive-value="0" active-text="开启" inactive-text="关闭" /></el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveConfig"><el-icon><Check /></el-icon>保存配置</el-button>
                <el-button @click="loadConfig">重置</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </section>

        <!-- 7. 操作日志 -->
        <section v-else-if="activeMenu === 'logs'">
          <div class="toolbar">
            <div class="toolbar-left">
              <el-input v-model="logAction" placeholder="按操作类型筛选" clearable style="width:240px" @keyup.enter="loadLogs" @clear="loadLogs">
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
            </div>
          </div>
          <el-table :data="logs" stripe class="mt-16">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="admin_name" label="管理员" width="120" />
            <el-table-column label="操作" width="180">
              <template #default="{row}"><el-tag size="small" :type="logTagType(row.action)">{{ row.action }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="target_type" label="目标" width="100"><template #default="{row}">{{ row.target_type || '—' }} #{{ row.target_id || '—' }}</template></el-table-column>
            <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
            <el-table-column prop="ip" label="IP" width="140" />
            <el-table-column prop="created_at" label="时间" width="170" />
          </el-table>
          <div class="pagination-wrap" v-if="logTotal > 20">
            <el-pagination background layout="total, prev, pager, next" :total="logTotal" :page-size="20" v-model:current-page="logPage" @current-change="loadLogs" />
          </div>
        </section>
      </main>
    </div>

    <!-- 新建模板弹窗 -->
    <el-dialog v-model="showTplDialog" title="新建投票模板" width="500px">
      <el-form :model="newTpl" label-width="80px">
        <el-form-item label="模板名"><el-input v-model="newTpl.name" placeholder="如：活动评选" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="newTpl.category" placeholder="如：评选" /></el-form-item>
        <el-form-item label="配置JSON"><el-input v-model="newTpl.config" type="textarea" :rows="6" placeholder='{"title":"示例投票","vote_type":1,"questions":[]}' /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showTplDialog = false">取消</el-button><el-button type="primary" @click="addTemplate">创建</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as echarts from 'echarts';
import api from '../api';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const sidebarCollapsed = ref(false);
const activeMenu = ref('dashboard');
const showTplDialog = ref(false);
const newTpl = reactive({ name: '', category: '', config: '' });

// 大盘
const dashboard = ref(null);
const chartTrend = ref(null);
let trendChart = null;
// 投票
const votes = ref([]), voteTotal = ref(0), votePage = ref(1), voteSize = 10;
const voteKeyword = ref(''), voteStatus = ref(1);
// 用户
const users = ref([]), userTotal = ref(0), userPage = ref(1);
const userKeyword = ref(''), userRoleFilter = ref(null);
// 黑名单
const blacklist = reactive({ devices: [], ips: [] });
const blForm = reactive({ type: 'ip', value: '', reason: '' });
// 配置
const sysConfig = reactive({});
// 日志
const logs = ref([]), logTotal = ref(0), logPage = ref(1);
const logAction = ref('');
// 模板
const templates = ref([]);

const menuTitle = computed(() => ({
  dashboard: '数据大盘', votes: '投票管理', users: '用户管理',
  blacklist: '黑名单', templates: '模板管理', config: '系统配置', logs: '操作日志'
}[activeMenu.value]));

const statusText = (s) => ({ 0: '草稿', 1: '进行中', 2: '已暂停', 3: '已结束' }[s]);
const statusType = (s) => ({ 1: 'success', 2: 'warning', 3: 'info' }[s] || '');
const logTagType = (a) => {
  if (a.includes('delete')) return 'danger';
  if (a.includes('add') || a.includes('update')) return 'warning';
  if (a.includes('set')) return 'info';
  return '';
};

function onMenuSelect(key) {
  activeMenu.value = key;
  loadTab();
}

async function loadTab() {
  loading.value = true;
  try {
    if (activeMenu.value === 'dashboard') await loadDashboard();
    else if (activeMenu.value === 'votes') await loadVotes();
    else if (activeMenu.value === 'users') await loadUsers();
    else if (activeMenu.value === 'blacklist') await loadBlacklist();
    else if (activeMenu.value === 'templates') await loadTemplates();
    else if (activeMenu.value === 'config') await loadConfig();
    else if (activeMenu.value === 'logs') await loadLogs();
  } catch (e) { ElMessage.error(e.msg || '加载失败'); }
  loading.value = false;
}

async function loadDashboard() {
  const res = await api.adminDashboard();
  dashboard.value = res.data;
  await nextTick();
  if (chartTrend.value) {
    if (trendChart) trendChart.dispose();
    const r = res.data.recent7 || [];
    trendChart = echarts.init(chartTrend.value);
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: r.map(x => x.day), boundaryGap: false },
      yAxis: { type: 'value' },
      series: [{
        name: '投票数', type: 'line', data: r.map(x => x.cnt), smooth: true,
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(64,158,255,0.5)' }, { offset: 1, color: 'rgba(64,158,255,0.05)' }]) },
        lineStyle: { width: 3, color: '#409eff' }, itemStyle: { color: '#409eff' }
      }]
    });
  }
}
async function loadVotes() {
  const res = await api.listVotes({ page: votePage.value, size: voteSize, status: voteStatus.value, keyword: voteKeyword.value });
  votes.value = res.data.list || []; voteTotal.value = res.data.total || 0;
}
async function loadUsers() {
  const res = await api.adminUsers({ page: userPage.value, size: 20, keyword: userKeyword.value, role: userRoleFilter.value });
  users.value = res.data.list || []; userTotal.value = res.data.total || 0;
}
async function loadBlacklist() {
  const res = await api.adminBlacklist();
  blacklist.devices = res.data.devices || []; blacklist.ips = res.data.ips || [];
}
async function loadTemplates() {
  const res = await api.adminTemplates();
  templates.value = res.data || [];
}
async function loadConfig() {
  const res = await api.adminConfig();
  Object.keys(sysConfig).forEach(k => delete sysConfig[k]);
  Object.assign(sysConfig, res.data);
}
async function loadLogs() {
  const res = await api.adminLogs({ page: logPage.value, size: 20, action: logAction.value });
  logs.value = res.data.list || []; logTotal.value = res.data.total || 0;
}

async function onVoteAction(id, action) {
  const actionText = { offline: '下架', online: '上架', end: '结束', delete: '删除' }[action];
  await ElMessageBox.confirm(`确认${actionText}该投票？`, '操作确认', { type: 'warning' });
  try { await api.adminVoteAction(id, action); ElMessage.success('操作成功'); loadVotes(); }
  catch (e) { ElMessage.error(e.msg || '操作失败'); }
}
async function onUserStatus(id, field, value) {
  const fieldText = { status: '状态', is_blacklist: '黑名单', role: '角色' }[field];
  try {
    await api.adminUserStatus(id, field, value);
    ElMessage.success(`${fieldText}已更新`);
    loadUsers();
  } catch (e) { ElMessage.error(e.msg || '操作失败'); }
}
async function addBlacklist() {
  if (!blForm.value) return ElMessage.warning('请输入值');
  try { await api.adminAddBlacklist(blForm.type, blForm.value, blForm.reason); ElMessage.success('已添加'); blForm.value = ''; blForm.reason = ''; loadBlacklist(); }
  catch (e) { ElMessage.error(e.msg || '添加失败'); }
}
async function removeBlacklist(type, id) {
  try { await api.adminRemoveBlacklist(type, id); ElMessage.success('已移除'); loadBlacklist(); }
  catch (e) { ElMessage.error(e.msg || '移除失败'); }
}
async function saveConfig() {
  try { await api.adminUpdateConfig(sysConfig); ElMessage.success('配置已保存'); }
  catch (e) { ElMessage.error(e.msg || '保存失败'); }
}
async function addTemplate() {
  try {
    await api.adminAddTemplate(newTpl);
    ElMessage.success('模板已创建');
    showTplDialog.value = false;
    newTpl.name = ''; newTpl.category = ''; newTpl.config = '';
    loadTemplates();
  } catch (e) { ElMessage.error(e.msg || '创建失败'); }
}
function useTemplate(tpl) {
  router.push({ path: '/create', query: { template: tpl.id } });
}

function onCommand(cmd) {
  if (cmd === 'logout') { userStore.logout(); ElMessage.success('已退出登录'); router.push('/login'); }
  else if (cmd === 'frontend') router.push('/');
  else if (cmd === 'profile') router.push('/user');
}

onMounted(loadTab);
</script>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; background: #f0f2f5; }
/* 侧边栏 */
.admin-sidebar { width: 230px; background: #001529; transition: width .3s; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 1001; }
.admin-sidebar.collapsed { width: 64px; }
.sidebar-header { height: 60px; display: flex; align-items: center; justify-content: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,.1); }
.sidebar-title { color: #fff; font-size: 16px; font-weight: 600; white-space: nowrap; }
.sidebar-menu { border-right: none; flex: 1; overflow-y: auto; }
.sidebar-menu:not(.el-menu--collapse) { width: 230px; }
.sidebar-footer { padding: 12px; color: #5a5e66; font-size: 12px; text-align: center; border-top: 1px solid rgba(255,255,255,.08); }

/* 主区域 */
.admin-main { flex: 1; margin-left: 230px; transition: margin-left .3s; display: flex; flex-direction: column; min-height: 100vh; }
.admin-sidebar.collapsed ~ .admin-main { margin-left: 64px; }

/* 顶栏 */
.admin-topbar { height: 60px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.08); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; position: sticky; top: 0; z-index: 100; }
.topbar-left { display: flex; align-items: center; gap: 16px; }
.collapse-btn { cursor: pointer; color: #606266; transition: color .2s; }
.collapse-btn:hover { color: #409eff; }
.topbar-right { display: flex; align-items: center; gap: 20px; }
.topbar-icon { cursor: pointer; color: #606266; transition: color .2s; }
.topbar-icon:hover { color: #409eff; }
.admin-user { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.admin-username { font-size: 14px; color: #303133; }

/* 内容区 */
.admin-content { flex: 1; padding: 20px; overflow-y: auto; }

/* 指标卡片 */
.stat-row { margin-bottom: 16px; }
.stat-card { background: #fff; border-radius: 8px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); transition: transform .2s; }
.stat-card:hover { transform: translateY(-2px); }
.stat-icon { width: 56px; height: 56px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; }
.stat-blue .stat-icon { background: linear-gradient(135deg, #409eff, #66b1ff); }
.stat-green .stat-icon { background: linear-gradient(135deg, #67c23a, #85ce61); }
.stat-orange .stat-icon { background: linear-gradient(135deg, #e6a23c, #ebb563); }
.stat-purple .stat-icon { background: linear-gradient(135deg, #9b59b6, #b367d6); }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 14px; color: #909399; margin-top: 4px; }

/* 图表卡片 */
.chart-card { margin-bottom: 16px; }
.chart-box { height: 320px; }
.card-header { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.today-stat { padding: 8px 0; }
.today-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.today-label { color: #909399; font-size: 14px; }
.today-value { font-size: 24px; font-weight: 700; color: #303133; }
.text-green { color: #67c23a; }
.text-blue { color: #409eff; }

/* 工具栏 */
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }

/* 排名徽章 */
.rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 700; background: #dcdfe6; color: #606266; }
.rank-1 { background: #f56c6c; color: #fff; }
.rank-2 { background: #e6a23c; color: #fff; }
.rank-3 { background: #67c23a; color: #fff; }

/* 用户单元格 */
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-name { font-size: 14px; color: #303133; font-weight: 500; }
.user-sub { font-size: 12px; color: #909399; }

/* 分页 */
.pagination-wrap { display: flex; justify-content: center; padding: 20px 0; }

/* 模板卡片 */
.tpl-card { margin-bottom: 16px; }
.tpl-category { margin-bottom: 8px; }
.tpl-name { font-size: 18px; margin: 8px 0; color: #303133; }
.tpl-desc { color: #909399; font-size: 13px; }
.tpl-config { background: #f5f7fa; padding: 8px; border-radius: 4px; font-size: 12px; max-height: 60px; overflow: hidden; }
.tpl-actions { margin-top: 12px; }

.mt-16 { margin-top: 16px; }
.mb-16 { margin-bottom: 16px; }

/* 响应式 */
@media (max-width: 768px) {
  .admin-sidebar { width: 64px; }
  .admin-sidebar .sidebar-title, .admin-sidebar .sidebar-footer { display: none; }
  .admin-main { margin-left: 64px; }
  .stat-card { padding: 12px; }
  .stat-value { font-size: 22px; }
  .toolbar { flex-direction: column; align-items: flex-start; }
}
</style>
