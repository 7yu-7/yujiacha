<template>
  <view class="mp">
    <view class="bar">
      <view class="tiny faint" style="margin-bottom:14rpx">选择最多 6 个品种进行对比</view>
      <scroll-view scroll-x class="chips-scroll">
        <text v-for="s in species" :key="s" class="chip" :class="{ on: sel.includes(s) }"
              @tap="toggle(s)">{{ s }}</text>
      </scroll-view>
      <view class="row" style="gap:16rpx;margin-top:18rpx">
        <picker :range="dayNames" :value="dayIdx" @change="onDays" style="flex:1">
          <view class="input">{{ dayNames[dayIdx] }}</view>
        </picker>
        <button class="btn pri" @tap="run">开始对比</button>
      </view>
    </view>

    <view class="sec" v-if="result">
      <view class="card">
        <view class="tiny faint" style="margin-bottom:12rpx">
          区间走势对比 · {{ fmt.date(result.from) }} — {{ fmt.date(result.date) }}</view>
        <trend-line :points="chartBase" :height="200" />
        <view class="chips" style="margin-top:16rpx">
          <text v-for="(s, i) in result.series" :key="s.species" class="chip"
                :style="{ borderColor: colors[i % colors.length], color: colors[i % colors.length] }">
            {{ s.species }} {{ s.changePct != null ? (s.changePct > 0 ? '▲' : '▼') + fmt.num(Math.abs(s.changePct), 1) + '%' : '' }}
          </text>
        </view>
      </view>

      <view class="tbl">
        <view class="tbl-h">
          <text class="tbl-c" style="flex:2">品种</text>
          <text class="tbl-c num">起价</text>
          <text class="tbl-c num">终价</text>
          <text class="tbl-c num">涨跌</text>
        </view>
        <view v-for="(s, i) in result.series" :key="s.species" class="tbl-r" :class="{ alt: i % 2 }">
          <text class="tbl-c bold" style="flex:2">{{ s.species }}</text>
          <text class="tbl-c num">{{ fmt.num(s.base) }}</text>
          <text class="tbl-c num bold">{{ fmt.num(s.last) }}</text>
          <text class="tbl-c num delta" :class="fmt.deltaClass(s.changePct)">{{ fmt.deltaText(s.changePct) }}</text>
        </view>
      </view>

      <view class="notice" style="margin-top:20rpx">
        <text>ℹ</text>
        <text>对比基于全国（或所选省份）当日各市场均价的日均值。区间振幅 =（区间最高 − 区间最低）/ 区间最低。</text>
      </view>
    </view>

    <view class="sec" v-else>
      <view class="empty">
        <view class="t">请选择品种</view>
        <view class="d">在上方选择 1–6 个品种后点击「开始对比」</view>
      </view>
    </view>
  </view>
</template>

<script>
import { api, fmt, toast } from '@/utils/api';
import TrendLine from '@/components/trend-line.vue';

export default {
  components: { TrendLine },
  data() {
    return {
      species: [], sel: [], result: null,
      dayNames: ['近 30 天', '近 90 天', '近 180 天', '近 365 天'],
      dayValues: [30, 90, 180, 365], dayIdx: 1,
      colors: ['#0A9396', '#E5484D', '#F5A623', '#2F7ED8', '#8B5CF6', '#30A46C'],
    };
  },
  computed: {
    // 简化：以第一个品种为基准绘制折线（多品叠加可在 H5 端由 multiLine 呈现）
    chartBase() {
      if (!this.result || !this.result.series.length) return [];
      return this.result.series[0].points.map((p) => ({ date: p.date, price: p.price }));
    },
  },
  async onLoad() {
    try {
      const m = await api.meta();
      this.species = (m.species || []).map((s) => s.name);
    } catch { /* 忽略 */ }
  },
  methods: {
    fmt,
    toggle(s) {
      const i = this.sel.indexOf(s);
      if (i >= 0) this.sel.splice(i, 1);
      else if (this.sel.length < 6) this.sel.push(s);
      else toast('最多选择 6 个品种');
    },
    onDays(e) { this.dayIdx = Number(e.detail.value); },
    async run() {
      if (!this.sel.length) return toast('请至少选择一个品种');
      try {
        this.result = await api.compare(this.sel, { days: this.dayValues[this.dayIdx] });
      } catch (e) { toast(e.message); }
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.bar { padding: 22rpx 28rpx; background: var(--surface); border-bottom: 1rpx solid var(--border); }
.sec { padding: 22rpx 28rpx 0; }
</style>
