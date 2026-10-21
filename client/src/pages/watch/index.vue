<template>
  <view class="mp">
    <view v-if="!auth.isLoggedIn" class="notice" style="margin:22rpx 28rpx">
      <text>ℹ</text>
      <text>访客模式，关注列表保存在本机。登录后可云端同步并开启价格异动推送。</text>
    </view>

    <view class="ov-grid">
      <view class="ov"><text class="k">关注品种</text><text class="v">{{ items.length }}<text class="u">个</text></text></view>
      <view class="ov up"><text class="k">今日上涨</text><text class="v">{{ upN }}<text class="u">个</text></text></view>
      <view class="ov down"><text class="k">今日下跌</text><text class="v">{{ downN }}<text class="u">个</text></text></view>
    </view>

    <view class="sec" v-if="auth.isLoggedIn && alerts && alerts.items.length">
      <view class="sec-t"><text class="h">最近价格异动</text>
        <text class="m" @tap="goAlerts">全部{{ alerts.unread ? `（${alerts.unread} 未读）` : '' }} ›</text></view>
      <view class="al-list">
        <view v-for="a in alerts.items.slice(0, 3)" :key="a.id" class="al-row" :class="{ read: a.isRead }">
          <view>
            <text class="bold sm">{{ a.species }}</text>
            <text class="tiny faint"> {{ a.scope }}</text>
            <view class="tiny faint">{{ fmt.date(a.date) }} · {{ fmt.num(a.prevPrice) }} → {{ fmt.num(a.currPrice) }}</view>
          </view>
          <text class="badge" :class="a.direction === 'up' ? 'up' : 'down'">
            {{ a.direction === 'up' ? '▲' : '▼' }} {{ fmt.num(Math.abs(a.changePct)) }}%</text>
        </view>
      </view>
    </view>

    <view class="sec" v-if="items.length">
      <view class="sec-t"><text class="h">我的关注</text><text class="m">{{ items.length }} 个</text></view>
      <view v-for="w in items" :key="w.id" class="card">
        <view class="row-between">
          <view>
            <text class="bold" style="font-size:30rpx" @tap="goDetail(w.species)">{{ w.species }}</text>
            <view class="tiny faint">{{ w.scope }}</view>
          </view>
          <view class="right">
            <text class="price-sm">{{ fmt.num(w.price) }}</text>
            <view><text class="delta" :class="fmt.deltaClass(w.changePct)">{{ fmt.deltaText(w.changePct) }}</text></view>
          </view>
        </view>
        <view style="margin-top:16rpx">
          <trend-line :points="w.trend" :height="90" />
          <view class="tiny faint" style="margin-top:6rpx">{{ w.trendRange || '近 7 日' }} 走势</view>
        </view>
        <view v-if="auth.isLoggedIn" class="row wrap" style="gap:10rpx;margin-top:16rpx">
          <text class="badge gray">涨阈值 {{ w.thresholdUp == null ? 5 : w.thresholdUp }}%</text>
          <text class="badge gray">跌阈值 {{ w.thresholdDown == null ? -5 : w.thresholdDown }}%</text>
          <text class="badge">{{ channelLabel(w.notifyChannel) }}</text>
          <button class="btn sm" style="margin-left:auto" @tap="openEdit(w)">设置阈值</button>
        </view>
        <view v-else style="margin-top:16rpx;text-align:right">
          <button class="btn sm" @tap="remove(w)">取消关注</button>
        </view>
      </view>
    </view>

    <view class="sec" v-else-if="!loading">
      <view class="empty">
        <view class="t">还没有关注任何品种</view>
        <view class="d">关注后可集中查看最新价、近一周走势与涨跌，并设置价格异动提醒。</view>
        <button class="btn pri" @tap="goMarket">前往全部品种 →</button>
      </view>
    </view>
  </view>
</template>

<script>
import { api, auth, localWatch, fmt, toast } from '@/utils/api';
import TrendLine from '@/components/trend-line.vue';

export default {
  components: { TrendLine },
  data() { return { items: [], alerts: null, loading: true, auth }; },
  computed: {
    upN() { return this.items.filter((i) => (i.changePct || 0) > 0).length; },
    downN() { return this.items.filter((i) => (i.changePct || 0) < 0).length; },
  },
  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => uni.stopPullDownRefresh()); },
  methods: {
    fmt,
    channelLabel(c) {
      return { wechat_push: '微信订阅消息', app_push: 'App 推送', web_push: '浏览器通知', inbox: '站内消息', app: 'App 推送' }[c] || c;
    },
    async load() {
      this.loading = true;
      try {
        if (auth.isLoggedIn) {
          const [w, a] = await Promise.all([api.watches(), api.alerts({ limit: 10 })]);
          this.items = w.items; this.alerts = a;
        } else {
          const list = [];
          for (const lw of localWatch.all()) {
            try {
              const d = await api.speciesDetail(lw.species, { province: lw.province, days: 7 });
              const h = d.history || [];
              list.push({
                id: 'local_' + lw.species + (lw.province || ''),
                species: lw.species, province: lw.province,
                scope: lw.province || '全国',
                price: d.price.avg, changePct: d.price.changePct,
                trend: h.slice(-7).map((x) => ({ date: x.date, price: x.avg })),
                trendRange: h.length ? `${fmt.dateShort(h[Math.max(0, h.length - 7)].date)} — ${fmt.dateShort(h[h.length - 1].date)}` : '',
              });
            } catch { /* 忽略单条失败 */ }
          }
          this.items = list; this.alerts = null;
        }
      } catch (e) { toast(e.message || '加载失败'); }
      finally { this.loading = false; }
    },
    async remove(w) {
      try {
        if (String(w.id).startsWith('local_')) localWatch.remove(w.species, w.province || null);
        else await api.removeWatch(w.id);
        toast('已取消关注'); this.load();
      } catch (e) { toast(e.message); }
    },
    openEdit(w) {
      uni.showModal({
        title: `${w.species} · 设置阈值`,
        editable: true,
        content: String(w.thresholdUp == null ? 5 : w.thresholdUp),
        placeholderText: '涨阈值（%），默认 5',
        success: async (r) => {
          if (!r.confirm) return;
          const up = Number(r.content);
          if (isNaN(up)) return toast('请输入数字');
          try {
            await api.addWatch({ species: w.species, province: w.province, thresholdUp: up, thresholdDown: -Math.abs(up), notifyChannel: w.notifyChannel });
            toast('阈值已更新'); this.load();
          } catch (e) { toast(e.message); }
        },
      });
    },
    goAlerts() { uni.navigateTo({ url: '/pages/alerts/index' }); },
    goDetail(sp) { uni.navigateTo({ url: `/pages/species/detail?name=${encodeURIComponent(sp)}` }); },
    goMarket() { uni.switchTab({ url: '/pages/market/index' }); },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.ov-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rpx; background: var(--border); }
.ov { background: var(--surface); padding: 22rpx 16rpx; text-align: center; }
.ov .k { font-size: 21rpx; color: var(--text-2); }
.ov .v { display: block; font-size: 38rpx; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 6rpx; }
.ov .u { font-size: 19rpx; font-weight: 400; color: var(--text-2); }
.ov.up .v { color: var(--up); }
.ov.down .v { color: var(--down); }
.sec { padding: 26rpx 28rpx 0; }
.sec-t { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.sec-t .h { font-size: 29rpx; font-weight: 600; }
.sec-t .m { font-size: 22rpx; color: var(--brand); }
.al-list { border-radius: 20rpx; overflow: hidden; border: 1rpx solid var(--border); }
.al-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx;
  padding: 20rpx 22rpx; background: var(--surface); border-bottom: 1rpx solid var(--border); }
.al-row:last-child { border-bottom: none; }
.al-row.read { opacity: .62; }
</style>
