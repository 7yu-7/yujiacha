<template>
  <view class="mp" v-if="d">
    <view class="head">
      <view class="row-between" style="align-items:flex-start">
        <view class="grow">
          <view class="row" style="gap:14rpx;flex-wrap:wrap">
            <text style="font-size:40rpx;font-weight:700">{{ d.species }}</text>
            <text class="tier" :class="d.price.tier.tier">{{ d.price.tier.label }}</text>
          </view>
          <view class="tiny faint" style="margin-top:8rpx">
            {{ d.category }} / {{ d.subCategory }} · {{ d.spec }}</view>
          <view class="tiny faint">别名：{{ (d.alias || []).join('、') || '—' }}</view>
        </view>
        <button class="btn sm" :class="{ pri: !watched }" @tap="toggleWatch">
          {{ watched ? '★ 已关注' : '+ 关注' }}</button>
      </view>
      <view class="row" style="align-items:baseline;gap:12rpx;margin-top:24rpx">
        <text class="price">{{ fmt.num(d.price.avg) }}</text>
        <text class="price-unit">元/公斤</text>
        <text class="delta" :class="fmt.deltaClass(d.price.changePct)">{{ fmt.deltaText(d.price.changePct) }}</text>
      </view>
      <view class="tiny faint">约 {{ fmt.num(d.price.avg / 2) }} 元/斤 · 较前日 {{ fmt.num(d.price.prev) }}</view>
    </view>

    <view class="mini-grid">
      <view class="mini"><text class="k">当日最低</text><text class="v">{{ fmt.num(d.price.min) }}</text></view>
      <view class="mini"><text class="k">当日最高</text><text class="v">{{ fmt.num(d.price.max) }}</text></view>
      <view class="mini"><text class="k">覆盖市场</text><text class="v">{{ d.coverage.marketCount }}</text></view>
      <view class="mini"><text class="k">覆盖省份</text><text class="v">{{ d.coverage.provinceCount }}</text></view>
      <view class="mini"><text class="k">记录条数</text><text class="v">{{ fmt.int(d.coverage.recordCount) }}</text></view>
      <view class="mini"><text class="k">采集批次</text><text class="v" style="font-size:20rpx">{{ batchShort }}</text></view>
    </view>

    <view class="sec">
      <view class="sec-t"><text class="h">历史价格走势</text>
        <view class="chips">
          <text v-for="n in dayOptions" :key="n" class="chip" :class="{ on: days === n }"
                @tap="setDays(n)">{{ n }}天</text>
        </view>
      </view>
      <view class="card"><trend-line :points="historyPts" :height="190" /></view>
      <view class="row" style="gap:26rpx;margin-top:12rpx">
        <text class="tiny faint">区间均价 <text class="bold mono">{{ rangeAvg }}</text></text>
        <text class="tiny faint">区间最低 <text class="bold mono">{{ rangeMin }}</text></text>
        <text class="tiny faint">区间最高 <text class="bold mono">{{ rangeMax }}</text></text>
      </view>
    </view>

    <view class="sec">
      <view class="sec-t"><text class="h">分省价格</text><text class="m">{{ d.provinces.length }} 个省份</text></view>
      <view class="tbl">
        <view class="tbl-h">
          <text class="tbl-c" style="flex:2">省份</text>
          <text class="tbl-c num">均价</text>
          <text class="tbl-c num">市场</text>
          <text class="tbl-c">档位</text>
        </view>
        <view v-for="(p, i) in d.provinces" :key="p.name" class="tbl-r" :class="{ alt: i % 2 }">
          <text class="tbl-c" style="flex:2">{{ p.name }}</text>
          <text class="tbl-c num bold">{{ fmt.num(p.avgPrice) }}</text>
          <text class="tbl-c num">{{ p.marketCount }}</text>
          <text class="tbl-c"><text class="tier outline" :class="p.tier.tier">{{ p.tier.label }}</text></text>
        </view>
      </view>
    </view>

    <view class="sec">
      <view class="sec-t"><text class="h">市场报价明细</text><text class="m">最多 50 条 · 价格降序</text></view>
      <view class="tbl">
        <view class="tbl-h">
          <text class="tbl-c" style="flex:2">批发市场</text>
          <text class="tbl-c num">价格</text>
          <text class="tbl-c">规格</text>
        </view>
        <view v-for="(q, i) in d.quotes.slice(0, 50)" :key="i" class="tbl-r" :class="{ alt: i % 2 }">
          <view class="tbl-c" style="flex:2">
            <text class="sm">{{ q.market }}</text>
            <view class="tiny faint">{{ q.province }}</view>
          </view>
          <text class="tbl-c num bold">{{ fmt.num(q.price) }}</text>
          <text class="tbl-c tiny faint">{{ q.spec || '—' }}</text>
        </view>
      </view>
    </view>

    <view class="sec" style="padding-bottom:40rpx">
      <view class="notice">
        <text>✓</text>
        <text><text class="bold">数据可信：</text>来源 {{ d.source.name }}，采集批次号 {{ d.source.batchNo || '—' }}，
        采集时间 {{ fmt.dt(d.coverage.collectedAt) }}，每条报价均可回溯来源链接。</text>
      </view>
      <button class="btn blk" style="margin-top:20rpx" @tap="openSource">查看来源页面 ↗</button>
    </view>
  </view>

  <view v-else class="mp">
    <view class="sk" style="height:300rpx" />
  </view>
</template>

<script>
import { api, auth, localWatch, fmt, toast } from '@/utils/api';
import TrendLine from '@/components/trend-line.vue';

export default {
  components: { TrendLine },
  data() {
    return { d: null, name: '', province: '', days: 30, dayOptions: [7, 30, 90, 180, 365] };
  },
  computed: {
    watched() {
      if (!this.d) return false;
      if (auth.isLoggedIn) return false;   // 详情页不查云端，交由切换时刷新
      return localWatch.has(this.d.species, this.province || null);
    },
    historyPts() { return (this.d && this.d.history || []).map((h) => ({ date: h.date, price: h.avg })); },
    rangeAvg() {
      const h = this.d && this.d.history || [];
      return h.length ? fmt.num(h.reduce((a, b) => a + b.avg, 0) / h.length) : '—';
    },
    rangeMin() {
      const h = this.d && this.d.history || [];
      return h.length ? fmt.num(Math.min(...h.map((x) => x.avg))) : '—';
    },
    rangeMax() {
      const h = this.d && this.d.history || [];
      return h.length ? fmt.num(Math.max(...h.map((x) => x.avg))) : '—';
    },
    batchShort() { return this.d && this.d.source.batchNo ? String(this.d.source.batchNo).slice(-10) : '—'; },
  },
  onLoad(q) {
    this.name = decodeURIComponent(q.name || '');
    this.province = q.province ? decodeURIComponent(q.province) : '';
    this.load();
  },
  methods: {
    fmt,
    async load() {
      try {
        this.d = await api.speciesDetail(this.name, { province: this.province || null, days: this.days });
      } catch (e) { toast(e.message || '加载失败'); }
    },
    setDays(n) { this.days = n; this.load(); },
    async toggleWatch() {
      const sp = this.d.species;
      if (!auth.isLoggedIn) {
        if (localWatch.has(sp)) localWatch.remove(sp); else localWatch.add(sp);
        toast(localWatch.has(sp) ? '已关注（本机保存）' : '已取消关注');
        this.$forceUpdate();
        return;
      }
      try {
        const w = await api.watches();
        const hit = (w.items || []).find((x) => x.species === sp && !x.province);
        if (hit) { await api.removeWatch(hit.id); toast('已取消关注'); }
        else { await api.addWatch({ species: sp, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'wechat_push' }); toast('已关注'); }
      } catch (e) { toast(e.message); }
    },
    openSource() {
      uni.setStorageSync('yjt_src', this.d.source.url);
      uni.navigateTo({ url: '/pages/webview/index' });
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 30rpx; }
.head { background: var(--surface); padding: 28rpx; border-bottom: 1rpx solid var(--border); }
.mini-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rpx; background: var(--border); }
.mini { background: var(--surface); padding: 20rpx 12rpx; text-align: center; }
.mini .k { font-size: 20rpx; color: var(--text-2); }
.mini .v { display: block; font-size: 28rpx; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 6rpx; }
.sec { padding: 26rpx 28rpx 0; }
.sec-t { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; flex-wrap: wrap; gap: 12rpx; }
.sec-t .h { font-size: 29rpx; font-weight: 600; }
.sec-t .m { font-size: 21rpx; color: var(--text-3); }
</style>
