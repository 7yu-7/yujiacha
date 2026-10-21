<template>
  <view class="mp">
    <view class="head">
      <view class="row-between">
        <view>
          <text class="h-date">数据日期 {{ fmt.date(rep.date) }}</text>
          <view class="tiny faint">覆盖 {{ rep.filterBar.marketCount }} 家市场 · {{ fmt.int(rep.filterBar.recordCount) }} 条记录</view>
          <view class="tiny faint mono">批次 {{ rep.filterBar.batchNo || '—' }}</view>
        </view>
        <text class="badge" :class="rep.status.status === 'published' ? 'down' : 'warn'">
          {{ rep.status.status === 'published' ? 'T+0 已发布' : '待发布' }}</text>
      </view>
    </view>

    <view class="ov-grid">
      <view class="ov"><text class="k">当日全国综合均价</text>
        <text class="v">{{ fmt.num(rep.overview.nationalAvg) }}<text class="u">元/公斤</text></text>
        <text class="x">约 {{ fmt.num(rep.overview.nationalAvg / 2) }} 元/斤</text></view>
      <view class="ov up"><text class="k">上涨省份</text><text class="v">{{ rep.overview.upCount }}<text class="u">个</text></text><text class="x">▲ 需关注</text></view>
      <view class="ov down"><text class="k">下跌省份</text><text class="v">{{ rep.overview.downCount }}<text class="u">个</text></text><text class="x">▼ 存机会</text></view>
      <view class="ov warn"><text class="k">最高均价省份</text>
        <text class="v">{{ (rep.overview.maxProvince || {}).short || '—' }}</text>
        <text class="x">{{ maxPrice }} 元/公斤</text></view>
      <view class="ov"><text class="k">最低均价省份</text>
        <text class="v">{{ (rep.overview.minProvince || {}).short || '—' }}</text>
        <text class="x">{{ minPrice }} 元/公斤</text></view>
      <view class="ov"><text class="k">覆盖省级行政区</text><text class="v">{{ rep.overview.coveredProvinces }}<text class="u">个</text></text></view>
    </view>

    <view class="sec">
      <view class="row-between" style="margin-bottom:18rpx">
        <view class="chips">
          <text class="chip" :class="{ on: dim === 'province' }" @tap="setDim('province')">按省份</text>
          <text class="chip" :class="{ on: dim === 'species' }" @tap="setDim('species')">按品种</text>
        </view>
        <button class="btn sm" @tap="share">分享 ↗</button>
      </view>

      <view class="tbl">
        <view class="tbl-h">
          <text class="tbl-c" style="flex:0 0 60rpx">名次</text>
          <text class="tbl-c" style="flex:2">{{ dim === 'province' ? '省级行政区' : '品种' }}</text>
          <text class="tbl-c num">均价</text>
          <text class="tbl-c num">较昨日</text>
        </view>
        <view v-for="r in rows" :key="r.rank" class="tbl-r" :class="{ alt: r.rank % 2 === 0 }" @tap="rowTap(r)">
          <text class="tbl-c" style="flex:0 0 60rpx">
            <text class="rk" :class="'t' + r.rank">{{ r.rank }}</text></text>
          <view class="tbl-c" style="flex:2">
            <text class="bold">{{ dim === 'province' ? r.short : r.species }}</text>
            <view class="tiny faint" v-if="dim === 'species'">{{ r.category }}</view>
            <view class="tiny faint" v-if="dim === 'province' && r.leadUp">
              领涨 {{ r.leadUp.species }} ▲{{ fmt.num(r.leadUp.changePct) }}%</view>
          </view>
          <view class="tbl-c num">
            <text class="bold" style="font-size:28rpx">{{ fmt.num(r.avgPrice) }}</text>
            <view class="tiny faint">{{ fmt.num(r.avgPrice / 2) }} 元/斤</view>
          </view>
          <text class="tbl-c num delta" :class="fmt.deltaClass(r.changePct)">{{ fmt.deltaText(r.changePct) }}</text>
        </view>
      </view>

      <view class="note">
        <text class="bold">口径说明：</text>{{ rep.disclaimer }}
      </view>
      <view class="note">
        <text class="bold">数据来源：</text>{{ rep.status.source }}
      </view>
    </view>
  </view>
</template>

<script>
import { api, auth, fmt, toast } from '@/utils/api';

export default {
  data() { return { rep: { overview: {}, filterBar: {}, status: {} }, dim: 'province', rows: [] }; },
  computed: {
    maxPrice() { const m = this.rep.overview.maxProvince; return m ? fmt.num(m.avgPrice) : '—'; },
    minPrice() { const m = this.rep.overview.minProvince; return m ? fmt.num(m.avgPrice) : '—'; },
  },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => uni.stopPullDownRefresh()); },
  methods: {
    fmt,
    async load() {
      try {
        const rep = await api.dailyReport({ dimension: this.dim });
        this.rep = rep;
        this.rows = this.dim === 'species' ? (rep.bySpecies || []) : rep.rows;
      } catch (e) { toast(e.message || '日报加载失败'); }
    },
    setDim(d) { this.dim = d; this.load(); },
    rowTap(r) {
      if (this.dim === 'species') uni.navigateTo({ url: `/pages/species/detail?name=${encodeURIComponent(r.species)}` });
      else uni.switchTab({ url: '/pages/map/index' });
    },
    async share() {
      const u = auth.user;
      if (!(u && u.permissions && u.permissions.export)) return toast('分享长图需教研 / 政府 / 管理员权限');
      // 小程序端：下载文件后调用 saveImageToPhotosAlbum（需在服务端生成图片）
      // #ifdef MP-WEIXIN
      uni.showLoading({ title: '生成中' });
      uni.downloadFile({
        url: api.exportUrl('svg', { top: 15 }),
        success: (res) => {
          uni.hideLoading();
          uni.previewImage({ urls: [res.tempFilePath] });
          uni.showModal({
            title: '分享长图已生成',
            content: '长按图片可保存到相册，或转发给微信好友 / 群聊。',
            showCancel: false,
          });
        },
        fail: () => { uni.hideLoading(); toast('生成失败，请稍后重试'); },
      });
      // #endif
      // #ifndef MP-WEIXIN
      toast('分享长图已生成，可在浏览器中保存');
      // #endif
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.head { background: var(--surface); padding: 24rpx 28rpx; border-bottom: 1rpx solid var(--border); }
.h-date { font-size: 30rpx; font-weight: 700; }
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
.rk { width: 38rpx; height: 38rpx; border-radius: 8rpx; background: var(--surface-2); color: var(--text-2);
  font-size: 22rpx; font-weight: 700; text-align: center; line-height: 38rpx; }
.rk.t1 { background: var(--up); color: #fff; }
.rk.t2 { background: #E88B2F; color: #fff; }
.rk.t3 { background: #C9A227; color: #fff; }
.note { font-size: 22rpx; color: var(--text-2); line-height: 1.8; background: var(--surface-2);
  border-radius: 14rpx; padding: 20rpx 24rpx; margin-top: 18rpx; }
</style>
