<template>
  <view class="mp">
    <!-- 概览 -->
    <view class="ov-grid">
      <view class="ov"><text class="k">全国综合均价</text>
        <text class="v">{{ fmt.num(data.nationalAvg) }}<text class="u">元/公斤</text></text>
        <text class="x">{{ fmt.date(data.date) }}</text></view>
      <view class="ov up"><text class="k">上涨省份</text>
        <text class="v">{{ data.upCount || 0 }}<text class="u">个</text></text>
        <text class="x">▲ 价格上行</text></view>
      <view class="ov down"><text class="k">下跌省份</text>
        <text class="v">{{ data.downCount || 0 }}<text class="u">个</text></text>
        <text class="x">▼ 价格下行</text></view>
      <view class="ov warn"><text class="k">最高均价</text>
        <text class="v">{{ (data.maxProvince || {}).short || '—' }}</text>
        <text class="x">{{ maxPrice }} 元/公斤</text></view>
    </view>

    <!-- 省份芯片 -->
    <view class="sec">
      <view class="sec-t"><text class="h">省份快速切换</text>
        <text class="m">共 {{ (data.provinces || []).length }} 个</text></view>
      <scroll-view scroll-x class="chips-scroll">
        <text v-for="p in data.provinces || []" :key="p.name" class="chip"
              :class="{ on: selected === p.name }" @tap="pick(p.name)">{{ p.short }}</text>
      </scroll-view>
    </view>

    <!-- 价格档位分布 -->
    <view class="sec">
      <view class="card">
        <view class="sec-t"><text class="h">价格档位分布</text>
          <text class="m">颜色越红价格越高</text></view>
        <view v-for="t in tierRows" :key="t.tier" class="tier-row">
          <view class="sw" :style="{ background: t.color }" />
          <text class="grow">{{ t.label }} {{ t.range }}</text>
          <text class="bold mono">{{ t.count }}</text>
        </view>
        <view class="notice" style="margin-top:16rpx">
          <text>ℹ</text>
          <text>档位以「元/斤」划分：低位 ≤26 / 中位 26–36 / 高位 >36。省内陆及高原因冷链与中转成本系统性偏高。</text>
        </view>
      </view>
    </view>

    <!-- 省份排行（同时作为地图不可用时的兜底列表，对应说明书「地图加载失败兜底」） -->
    <view class="sec">
      <view class="sec-t"><text class="h">省份价格排行</text><text class="m">由高到低</text></view>
      <view class="rank-list">
        <view v-for="r in (data.ranking || []).slice(0, 15)" :key="r.name" class="rank-row" @tap="pick(r.name)">
          <text class="rk" :class="'t' + r.rank">{{ r.rank }}</text>
          <text class="grow bold sm">{{ r.short }}</text>
          <text class="p">{{ fmt.num(r.avgPrice) }}</text>
          <text class="delta" :class="fmt.deltaClass(r.changePct)">{{ fmt.deltaText(r.changePct) }}</text>
        </view>
      </view>
    </view>

    <!-- 选中省份详情 -->
    <view class="sec" v-if="detail">
      <view class="card">
        <view class="row-between">
          <view class="row" style="gap:12rpx">
            <text style="font-size:36rpx;font-weight:700">{{ detail.province.name }}</text>
            <text class="tier" :class="detail.header.tier.tier">{{ detail.header.tier.label }}</text>
          </view>
          <text class="badge gray">{{ detail.province.coast ? '沿海主产区' : '内陆' }}</text>
        </view>
        <view class="tiny faint" style="margin-top:8rpx">
          覆盖 {{ detail.header.speciesCount }} 个品种 · {{ detail.header.marketCount }} 家市场 · {{ fmt.int(detail.header.recordCount) }} 条记录</view>
        <view class="tiny faint">数据截至 {{ fmt.dt(detail.header.collectedAt) }}</view>

        <view class="row" style="align-items:baseline;gap:12rpx;margin-top:22rpx">
          <text class="price">{{ fmt.num(detail.header.avgPrice) }}</text>
          <text class="price-unit">元/公斤</text>
          <text class="delta" :class="fmt.deltaClass(detail.header.changePct)">{{ fmt.deltaText(detail.header.changePct) }}</text>
        </view>
        <view class="tiny faint">约 {{ fmt.num(detail.header.avgPrice / 2) }} 元/斤 · 较前日</view>
      </view>

      <view class="mini-grid">
        <view class="mini"><text class="k">近 7 日最高</text>
          <text class="v">{{ fmt.num(detail.stats.max) }}</text>
          <text class="x">{{ fmt.dateShort(detail.stats.maxDate) }}</text></view>
        <view class="mini"><text class="k">近 7 日最低</text>
          <text class="v">{{ fmt.num(detail.stats.min) }}</text>
          <text class="x">{{ fmt.dateShort(detail.stats.minDate) }}</text></view>
        <view class="mini"><text class="k">7 日振幅</text>
          <text class="v">{{ fmt.num(detail.stats.amplitude) }}%</text>
          <text class="x">波动幅度</text></view>
      </view>

      <!-- 自绘 SVG 折线（canvas 兜底，小程序端无需第三方图表库） -->
      <view class="card">
        <view class="sec-t"><text class="h">近一周均价趋势</text></view>
        <trend-line :points="detail.trend" :height="180" />
      </view>

      <view class="card">
        <view class="sec-t"><text class="h">Top 8 品种报价</text><text class="m">按价格降序</text></view>
        <view class="tbl">
          <view class="tbl-h">
            <text class="tbl-c" style="flex:2">品种</text>
            <text class="tbl-c">规格</text>
            <text class="tbl-c num">价格</text>
            <text class="tbl-c num">较前日</text>
          </view>
          <view v-for="(s, i) in detail.topSpecies" :key="s.species" class="tbl-r" :class="{ alt: i % 2 }">
            <view class="tbl-c" style="flex:2">
              <text class="bold">{{ s.species }}</text>
              <view class="tiny faint">{{ s.category }}</view>
            </view>
            <text class="tbl-c tiny faint">{{ s.spec || '—' }}</text>
            <text class="tbl-c num bold">{{ fmt.num(s.price) }}</text>
            <text class="tbl-c num delta" :class="fmt.deltaClass(s.changePct)">{{ fmt.deltaText(s.changePct) }}</text>
          </view>
        </view>
      </view>

      <button class="btn pri blk" @tap="subscribe">订阅该省价格异动</button>
    </view>

    <view class="sec" v-else-if="selected">
      <view class="empty">
        <view class="t">{{ selected }} 暂无当日数据</view>
        <view class="d">该省份当日尚未采集到报价数据，可能因休市或采集中断。系统以「—」占位并标注。</view>
      </view>
    </view>
  </view>
</template>

<script>
import { api, auth, fmt, toast } from '@/utils/api';
import TrendLine from '@/components/trend-line.vue';

export default {
  components: { TrendLine },
  data() {
    return { data: {}, detail: null, selected: '' };
  },
  computed: {
    maxPrice() {
      const m = this.data.maxProvince;
      return m ? fmt.num(m.avgPrice) : '—';
    },
    tierRows() {
      const counts = { low: 0, mid: 0, high: 0, na: 0 };
      (this.data.provinces || []).forEach((p) => { counts[p.tier.tier] = (counts[p.tier.tier] || 0) + 1; });
      const meta = [
        { tier: 'low', label: '低位（沿海主产区）', range: '≤26 元/斤', color: '#2F7ED8' },
        { tier: 'mid', label: '中位（中部与一般内陆）', range: '26–36 元/斤', color: '#F5A623' },
        { tier: 'high', label: '高位（内陆高原与西部边远）', range: '>36 元/斤', color: '#E0503C' },
        { tier: 'na', label: '暂无数据', range: '—', color: '#8595AC' },
      ];
      return meta.map((m) => ({ ...m, count: counts[m.tier] || 0 }));
    },
  },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => uni.stopPullDownRefresh()); },
  methods: {
    fmt,
    async load() {
      try {
        this.data = await api.mapProvinces({ days: 7 });
        if (!this.selected) {
          this.selected = (this.data.maxProvince || {}).name
            || ((this.data.provinces || []).find((p) => p.hasData) || {}).name || '';
        }
        if (this.selected) await this.loadDetail(this.selected);
      } catch (e) { toast(e.message || '地图数据加载失败'); }
    },
    async pick(name) {
      this.selected = name;
      await this.loadDetail(name);
    },
    async loadDetail(name) {
      try {
        const d = await api.province(name, { range: 7 });
        this.detail = d.header.hasData ? d : null;
      } catch (e) { this.detail = null; toast(e.message); }
    },
    subscribe() {
      if (!auth.isLoggedIn) {
        uni.navigateTo({ url: '/pages/login/index' });
        return;
      }
      uni.navigateTo({ url: `/pages/watch/index?province=${encodeURIComponent(this.selected)}` });
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.ov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rpx; background: var(--border); }
.ov { background: var(--surface); padding: 22rpx 20rpx; }
.ov .k { font-size: 21rpx; color: var(--text-2); }
.ov .v { display: block; font-size: 36rpx; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 6rpx; }
.ov .u { font-size: 19rpx; font-weight: 400; color: var(--text-2); }
.ov .x { display: block; font-size: 19rpx; color: var(--text-3); margin-top: 3rpx; }
.ov.up .v { color: var(--up); }
.ov.down .v { color: var(--down); }
.ov.warn .v { color: #E0503C; }

.sec { padding: 26rpx 28rpx 0; }
.sec-t { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.sec-t .h { font-size: 29rpx; font-weight: 600; }
.sec-t .m { font-size: 21rpx; color: var(--text-3); }

.tier-row { display: flex; align-items: center; gap: 16rpx; padding: 13rpx 0; border-bottom: 1rpx solid var(--border); }
.tier-row:last-of-type { border-bottom: none; }
.tier-row .sw { width: 22rpx; height: 22rpx; border-radius: 6rpx; flex-shrink: 0; }

.rank-list { display: flex; flex-direction: column; gap: 10rpx; }
.rank-row { display: flex; align-items: center; gap: 18rpx; padding: 15rpx 18rpx; border-radius: 12rpx; background: var(--surface-2); }
.rank-row .p { font-size: 27rpx; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 100rpx; text-align: right; }
.rk { width: 34rpx; height: 34rpx; border-radius: 8rpx; background: var(--surface-2); color: var(--text-2);
  font-size: 21rpx; font-weight: 700; text-align: center; line-height: 34rpx; }
.rk.t1 { background: var(--up); color: #fff; }
.rk.t2 { background: #E88B2F; color: #fff; }
.rk.t3 { background: #C9A227; color: #fff; }

.mini-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rpx; background: var(--border); margin-bottom: 20rpx; }
.mini { background: var(--surface); padding: 20rpx 12rpx; text-align: center; }
.mini .k { font-size: 20rpx; color: var(--text-2); }
.mini .v { display: block; font-size: 30rpx; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 6rpx; }
.mini .x { display: block; font-size: 19rpx; color: var(--text-3); }
</style>
