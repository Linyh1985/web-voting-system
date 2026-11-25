<template>
  <div class="page-container">
    <el-card v-loading="loading">
      <div v-if="stats" class="stats-page">
        <h1>{{ stats.vote.title }} - 数据统计</h1>
        <el-row :gutter="20" class="mb-20">
          <el-col :xs="12" :sm="6">
            <el-statistic title="总票数" :value="stats.summary.total_votes" />
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-statistic title="参与人数" :value="stats.summary.participants" />
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-statistic title="访问量" :value="stats.summary.view_count" />
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-statistic title="转化率" :value="stats.summary.conversion_rate" suffix="%" />
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :sm="24" :md="12">
            <h3>选项占比</h3>
            <div ref="chartPie" class="chart-box"></div>
          </el-col>
          <el-col :sm="24" :md="12">
            <h3>票数排行</h3>
            <div ref="chartBar" class="chart-box"></div>
          </el-col>
        </el-row>

        <el-divider />
        <h3>投票趋势</h3>
        <div ref="chartLine" class="chart-box"></div>

        <el-divider />
        <el-row :gutter="20">
          <el-col :sm="24" :md="8">
            <h3>设备类型分布</h3>
            <div ref="chartDevice" class="chart-box"></div>
          </el-col>
          <el-col :sm="24" :md="8">
            <h3>地域分布</h3>
            <div ref="chartRegion" class="chart-box"></div>
          </el-col>
          <el-col :sm="24" :md="8">
            <h3>高峰时段TOP5</h3>
            <div ref="chartPeak" class="chart-box"></div>
          </el-col>
        </el-row>

        <el-divider />
        <div class="text-center">
          <el-button @click="onExport('records')"><el-icon><Download /></el-icon> 导出明细Excel</el-button>
          <el-button @click="onExport('stats')"><el-icon><Download /></el-icon> 导出统计Excel</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import api from '../api';

const route = useRoute();
const loading = ref(true);
const stats = ref(null);
const chartPie = ref(null), chartBar = ref(null), chartLine = ref(null);
const chartDevice = ref(null), chartRegion = ref(null), chartPeak = ref(null);

onMounted(async () => {
  try {
    const res = await api.getStats(route.params.id);
    stats.value = res.data;
    await nextTick();
    drawAll();
  } catch (e) { ElMessage.error(e.msg || '加载失败'); }
  loading.value = false;
});

function drawAll() {
  if (!stats.value) return;
  const s = stats.value;
  if (chartPie.value) echarts.init(chartPie.value).setOption({ tooltip:{trigger:'item'}, legend:{orient:'vertical',left:'left'},
    series:[{ type:'pie', radius:['35%','70%'], data:s.options.map(o=>({name:o.content,value:o.vote_count})) }] });
  if (chartBar.value) { const sorted=[...s.options].sort((a,b)=>b.vote_count-a.vote_count);
    echarts.init(chartBar.value).setOption({ tooltip:{trigger:'axis'}, grid:{left:'3%',right:'8%',bottom:'3%',containLabel:true},
      xAxis:{type:'value'}, yAxis:{type:'category',data:sorted.map(o=>o.content),inverse:true},
      series:[{ type:'bar', data:sorted.map(o=>o.vote_count), label:{show:true,position:'right'} }] }); }
  if (chartLine.value) { const h=s.hourly||[];
    echarts.init(chartLine.value).setOption({ tooltip:{trigger:'axis'}, grid:{left:'3%',right:'5%',bottom:'3%',containLabel:true},
      xAxis:{type:'category',data:h.map(x=>x.hour?.slice(11)||x.hour),axisLabel:{rotate:30}},
      yAxis:{type:'value'}, series:[{ type:'line', data:h.map(x=>x.cnt), smooth:true, areaStyle:{} }] }); }
  if (chartDevice.value) echarts.init(chartDevice.value).setOption({ tooltip:{trigger:'item'},
    series:[{ type:'pie', radius:'60%', data:(s.device||[]).map(d=>({name:d.device_type,value:d.cnt})) }] });
  if (chartRegion.value) echarts.init(chartRegion.value).setOption({ tooltip:{trigger:'item'},
    series:[{ type:'pie', radius:'60%', data:(s.region||[]).map(r=>({name:r.region,value:r.cnt})) }] });
  if (chartPeak.value) { const p=s.peakHours||[];
    echarts.init(chartPeak.value).setOption({ tooltip:{trigger:'axis'}, grid:{left:'3%',right:'5%',bottom:'3%',containLabel:true},
      xAxis:{type:'category',data:p.map(x=>x.hour+':00')}, yAxis:{type:'value'},
      series:[{ type:'bar', data:p.map(x=>x.cnt), itemStyle:{color:'#e6a23c'} }] }); }
}

async function onExport(type) {
  try {
    const blob = type === 'records' ? await api.exportRecords(route.params.id) : await api.exportStats(route.params.id);
    const url = URL.createObjectURL(new Blob([blob]));
    const a = document.createElement('a');
    a.href = url; a.download = `vote-${route.params.id}-${type}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (e) { ElMessage.error('导出失败'); }
}
</script>

<style scoped>
.stats-page h1 { font-size: 24px; margin-bottom: 20px; }
.stats-page h3 { margin: 16px 0 8px; font-size: 16px; }
.chart-box { height: 320px; }
</style>
