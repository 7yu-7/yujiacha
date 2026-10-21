<template>
  <view class="mp">
    <!-- 顶部：全国概览 + 搜索入口 -->
    <view class="hero">
      <view class="hero-row">
        <view>
          <view class="hero-k">全国综合均价 · {{ dateLabel }}</view>
          <view class="hero-v">{{ nationalAvg }}<text class="hero-u"> 元/公斤</text></view>
          <view class="hero-s">覆盖 34 个省级行政区 · 130 家批发市场 · T+0 当日发布</view>
        </view>
      </view>
      <view class="hero-search" @tap="goSearch">
        <text class="ico">🔍</text>
        <text class="ph">搜索品种：中文名 / 拼音首字母 / 别名</text>
      </view>
    </view>

    <!-- 涨跌榜 -->
    <view class="sec" v-if="movers">
      <view class="sec-t">
        <text class="h">涨跌榜</text>
        <text class="m">较前日</text>
      </view>
      <view class="rank-list">
        <view v-for="(m, i) in moverList" :key="m.species" class="rank-row" @tap="goDetail(m.species)">
          <text class="rk" :class="'t' + (i + 1)">{{ i + 1 }}</text>
          <text class="grow bold sm">{{ m.species }}</text>
          <text class="p">{{ fmt.num(m.avgPrice) }}</text>
          <text class="delta" :class="fmt.deltaClass(m.changePct)">{{ fmt.deltaText(m.changePct) }}</text>
        </view>
      </view>
    </view>

    <!-- 品类筛选 -->
    <view class="sec">
      <view class="sec-t">
        <text class="h">全部品种</text>
        <text class="m">{{ list.total || 0 }} 个</text>
      </view>
      <scroll-view scroll-x class="chips-scroll">
        <text class="chip" :class="{ on: !category }" @tap="setCategory('')">全部</text>
        <text v-for="c in tree" :key="c.name" class="chip" :class="{ on: category === c.name }"
              @tap="setCategory(c.name)">{{ c.name }} {{ c.count }}</text>
      </scroll-view>
    </view>

    <!-- 品种卡片 -->
    <view class="sec" v-if="loading">
      <view class="sp-grid">
        <view v-for="n in 6" :key="n" class="sk" style="height:190rpx" />
      </view>
    </view>

    <view class="sec" v-else-if="list.items && list.items.length">
      <view class="sp-grid">
        <view v-for="s in list.items" :key="s.species" class="sp-card" @tap="goDetail(s.species)">
          <text class="cat">{{ s.category }}</text>
          <view class="nm">{{ s.species }}</view>
          <view class="spc">{{ s.spec || '—' }}</view>
          <view class="pr">
            <text class="pv">{{ fmt.num(s.price) }}</text>
            <text class="pu">元/公斤</text>
          </view>
          <text class="delta" :class="fmt.deltaClass(s.changePct)">{{ fmt.deltaText(s.changePct) }}</text>
          <text class="sw" :class="{ on: isWatched(s.species) }" @tap.stop="toggleWatch(s.species)">
            {{ isWatched(s.species) ? '★' : '☆' }}
          </text>
        </view>
      </view>
    </view>

    <view class="sec" v-else>
      <view class="empty">
        <view class="t">没有匹配的品种</view>
        <view class="d">试试其他关键词，或提交新品种申报</view>
        <button class="btn pri" @tap="reportSpecies">申报新品种</button>
      </view>
    </view>

    <view v-if="offline" class="notice warn" style="margin:20rpx 28rpx">
      <text>⚠</text>
      <text>当前展示离线缓存数据，联网后将自动更新</text>
    </view>
  </view>
</template>

<script>
import { api, auth, localWatch, store, fmt, toast } from '@/utils/api';

export default {
  data() {
    return {
      list: {}, tree: [], movers: null, category: '',
      loading: true, offline: false, nationalAvg: '—', dateLabel: '加载中',
      watches: null, status: null,
    };
  },
  computed: {
    moverList() {
      if (!this.movers) return [];
      return [...(this.movers.topGainers || []).slice(0, 3), ...(this.movers.topLosers || []).slice(0, 2)];
    },
  },
  onLoad() {
    this.load();
  },
  onShow() {
    if (auth.isLoggedIn) this.loadWatches();
  },
  onPullDownRefresh() {
    this.load().finally(() => uni.stopPullDownRefresh());
  },
  methods: {
    fmt,
    async load() {
      this.loading = true;
      try {
        const [list, movers, status] = await Promise.all([
          api.species({ category: this.category, pageSize: 500 }),
          api.movers({ scope: 'species', limit: 8 }),
          api.status().catch(() => null),
        ]);
        this.list = list;
        this.tree = list.tree || [];
        this.movers = movers;
        this.status = status;
        const prices = (list.items || []).map((x) => x.price).filter((x) => x != null);
        this.nationalAvg = prices.length ? fmt.num(prices.reduce((a, b) => a + b, 0) / prices.length) : '—';
        this.dateLabel = fmt.date(list.date);
        this.offline = false;
        await this.loadWatches();
      } catch (e) {
        this.offline = true;
        toast(e.message || '数据加载失败');
      } finally {
        this.loading = false;
      }
    },
    async loadWatches() {
      if (auth.isLoggedIn) {
        try { this.watches = await api.watches(); } catch { /* 忽略 */ }
      }
    },
    isWatched(species, province = null) {
      if (auth.isLoggedIn && this.watches) {
        return (this.watches.items || []).some((w) => w.species === species && (w.province || null) === (province || null));
      }
      return localWatch.has(species, province);
    },
    setCategory(c) {
      this.category = c;
      this.load();
    },
    goSearch() { uni.navigateTo({ url: '/pages/search/index' }); },
    goDetail(species) {
      uni.navigateTo({ url: `/pages/species/detail?name=${encodeURIComponent(species)}` });
    },
    async toggleWatch(species) {
      if (!auth.isLoggedIn) {
        if (localWatch.has(species)) localWatch.remove(species); else localWatch.add(species);
        toast(localWatch.has(species) ? `已关注 ${species}` : `已取消关注 ${species}`);
        this.$forceUpdate();
        return;
      }
      try {
        const w = (this.watches.items || []).find((x) => x.species === species && !x.province);
        if (w) { await api.removeWatch(w.id); toast('已取消关注'); }
        else { await api.addWatch({ species, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'wechat_push' }); toast(`已关注 ${species}`); }
        await this.loadWatches();
      } catch (e) { toast(e.message); }
    },
    reportSpecies() {
      uni.showModal({
        title: '申报新品种',
        editable: true,
        placeholderText: '请输入品种名称',
        success: async (r) => {
          if (!r.confirm || !r.content) return;
          try {
            const res = await api.reportSpecies({ name: r.content });
            toast(res.message || '申报已提交');
          } catch (e) { toast(e.message); }
        },
      });
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 30rpx; }
.hero { background: linear-gradient(135deg, #005F73 0%, #0A9396 100%); padding: 26rpx 28rpx 30rpx; }
.hero-k { font-size: 22rpx; color: rgba(255, 255, 255, .78); }
.hero-v { font-size: 56rpx; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; line-height: 1.2; }
.hero-u { font-size: 22rpx; font-weight: 400; }
.hero-s { font-size: 20rpx; color: rgba(255, 255, 255, .7); margin-top: 4rpx; }
.hero-search { display: flex; align-items: center; gap: 12rpx; background: rgba(255, 255, 255, .16);
  border: 1rpx solid rgba(255, 255, 255, .25); border-radius: 36rpx; padding: 16rpx 26rpx; margin-top: 24rpx; }
.hero-search .ico { font-size: 26rpx; }
.hero-search .ph { font-size: 24rpx; color: rgba(255, 255, 255, .8); }

.sec { padding: 26rpx 28rpx 0; }
.sec-t { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18rpx; }
.sec-t .h { font-size: 30rpx; font-weight: 600; }
.sec-t .m { font-size: 22rpx; color: var(--text-3); }

.rank-list { display: flex; flex-direction: column; gap: 10rpx; }
.rank-row { display: flex; align-items: center; gap: 18rpx; padding: 15rpx 18rpx;
  border-radius: 12rpx; background: var(--surface-2); }
.rank-row .p { font-size: 27rpx; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 110rpx; text-align: right; }
.rk { width: 36rpx; height: 36rpx; border-radius: 8rpx; background: var(--surface-2); color: var(--text-2);
  font-size: 22rpx; font-weight: 700; text-align: center; line-height: 36rpx; font-variant-numeric: tabular-nums; }
.rk.t1 { background: var(--up); color: #fff; }
.rk.t2 { background: #E88B2F; color: #fff; }
.rk.t3 { background: #C9A227; color: #fff; }

.sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.sp-card { position: relative; background: var(--surface); border: 1rpx solid var(--border);
  border-radius: 20rpx; padding: 20rpx 22rpx; }
.sp-card .cat { position: absolute; top: 14rpx; right: 14rpx; font-size: 19rpx; padding: 2rpx 12rpx;
  border-radius: 6rpx; background: var(--surface-2); color: var(--text-2); font-weight: 600; }
.sp-card .nm { font-size: 29rpx; font-weight: 600; padding-right: 100rpx; }
.sp-card .spc { font-size: 20rpx; color: var(--text-3); margin-top: 3rpx; }
.sp-card .pr { display: flex; align-items: baseline; margin-top: 12rpx; }
.sp-card .pv { font-size: 38rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.sp-card .pu { font-size: 19rpx; color: var(--text-2); margin-left: 6rpx; }
.sp-card .sw { position: absolute; right: 18rpx; bottom: 18rpx; font-size: 36rpx; color: var(--text-3); }
.sp-card .sw.on { color: #F5A623; }
</style>
