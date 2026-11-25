<template>
  <div class="page-container">
    <!-- 搜索与筛选 -->
    <el-card class="mb-20" shadow="never">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px">
        <el-input v-model="keyword" placeholder="搜索投票标题..." style="max-width:300px" clearable @keyup.enter="loadVotes">
          <template #append>
            <el-button @click="loadVotes">搜索</el-button>
          </template>
        </el-input>
        <div class="flex gap-12">
          <el-select v-model="category" placeholder="全部分类" clearable @change="loadVotes" style="width:140px">
            <el-option label="评选" value="评选" />
            <el-option label="问卷" value="问卷" />
            <el-option label="测评" value="测评" />
            <el-option label="其他" value="其他" />
          </el-select>
          <el-radio-group v-model="sort" @change="loadVotes">
            <el-radio-button value="hot">热门</el-radio-button>
            <el-radio-button value="new">最新</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-card>

    <!-- 投票列表 -->
    <div v-loading="loading">
      <el-row :gutter="20" v-if="list.length">
        <el-col :xs="24" :sm="12" :md="8" v-for="v in list" :key="v.id">
          <el-card class="vote-card mb-20" @click="$router.push(`/vote/${v.id}`)">
            <div style="position:relative">
              <img v-if="v.cover_url" :src="v.cover_url" class="cover-img" />
              <div v-else class="cover-img flex" style="align-items:center;justify-content:center;font-size:40px;color:#c0c4cc">
                <el-icon><Picture /></el-icon>
              </div>
              <el-tag v-if="v.status===1" type="success" class="hot-badge">进行中</el-tag>
              <el-tag v-else-if="v.status===2" type="warning" class="hot-badge">已暂停</el-tag>
              <el-tag v-else type="info" class="hot-badge">已结束</el-tag>
            </div>
            <h3 style="margin:12px 0 8px;font-size:16px;line-height:1.4">{{ v.title }}</h3>
            <p class="desc">{{ v.description || '暂无描述' }}</p>
            <div class="flex-between mt-20" style="font-size:13px;color:#909399">
              <span><el-icon><User /></el-icon> {{ v.creator_name }}</span>
              <span><el-icon><View /></el-icon> {{ v.view_count }} · {{ v.vote_count || 0 }}票</span>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-empty v-else-if="!loading" description="暂无投票" />
    </div>

    <div class="text-center mt-20" v-if="total > size">
      <el-pagination background layout="prev, pager, next" :total="total" :page-size="size" v-model:current-page="page" @current-change="loadVotes" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../api';

const keyword = ref('');
const category = ref('');
const sort = ref('hot');
const list = ref([]);
const total = ref(0);
const page = ref(1);
const size = 9;
const loading = ref(false);

async function loadVotes() {
  loading.value = true;
  try {
    const res = await api.listVotes({ page: page.value, size, keyword: keyword.value, category: category.value, sort: sort.value, status: 1 });
    list.value = res.data.list || [];
    total.value = res.data.total || 0;
  } catch (e) { /* ignore */ }
  loading.value = false;
}
onMounted(loadVotes);
</script>

<style scoped>
.desc { color: #909399; font-size: 13px; line-height: 1.5; height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>
