<template>
  <view class="mp">
    <view class="bar">
      <input class="inp" v-model="kw" placeholder="中文名 / 拼音首字母 / 别名"
             confirm-type="search" @confirm="run" @input="onInput" />
      <button class="btn pri sm" @tap="run">搜索</button>
    </view>
    <scroll-view scroll-x class="chips-scroll" style="padding:16rpx 28rpx">
      <text style="font-size:22rpx;color:var(--text-3);margin-right:12rpx">热门：</text>
      <text v-for="h in hot" :key="h" class="chip" @tap="pickHot(h)">{{ h }}</text>
    </scroll-view>

    <view class="sec" v-if="result">
      <view v-if="result.items.length">
        <view class="tiny faint" style="margin-bottom:14rpx">找到 {{ result.total }} 个相关品种</view>
        <view v-for="s in result.items" :key="s.species" class="card" @tap="goDetail(s.species)">
          <view class="row-between">
            <view class="grow">
              <view class="row" style="gap:12rpx">
                <text style="font-size:30rpx;font-weight:600">{{ s.species }}</text>
                <text class="tiny faint">{{ s.category }}</text>
              </view>
              <view class="tiny faint" style="margin-top:4rpx">
                别名：{{ (s.alias || []).slice(0, 3).join('、') || '—' }} · {{ s.spec || '' }}</view>
            </view>
            <view class="right">
              <text class="price-sm">{{ fmt.num(s.price) }}</text>
              <view><text class="delta" :class="fmt.deltaClass(s.changePct)">{{ fmt.deltaText(s.changePct) }}</text></view>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="empty">
        <view class="t">未找到「{{ result.keyword }}」</view>
        <view class="d">换一个关键词试试，或提交新品种申报</view>
        <button class="btn pri" @tap="reportSpecies">申报新品种</button>
      </view>
    </view>

    <view class="sec" v-else>
      <view class="empty">
        <view class="t">输入关键词开始搜索</view>
        <view class="d">支持中文名、拼音首字母（如 jyx → 鲫鱼）与别名（如 虾姑 → 皮皮虾）</view>
      </view>
    </view>
  </view>
</template>

<script>
import { api, fmt, toast } from '@/utils/api';
import { HOT_SEARCH } from '@/utils/config';

export default {
  data() { return { kw: '', result: null, hot: HOT_SEARCH, timer: null }; },
  methods: {
    fmt,
    onInput() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.run(), 380);
    },
    async run() {
      const q = this.kw.trim();
      if (!q) { this.result = null; return; }
      try { this.result = await api.search(q, 30); }
      catch (e) { toast(e.message); }
    },
    pickHot(h) { this.kw = h; this.run(); },
    goDetail(sp) { uni.navigateTo({ url: `/pages/species/detail?name=${encodeURIComponent(sp)}` }); },
    reportSpecies() {
      uni.showModal({
        title: '申报新品种', editable: true, content: this.kw,
        placeholderText: '请输入品种名称',
        success: async (r) => {
          if (!r.confirm || !r.content) return;
          try { const res = await api.reportSpecies({ name: r.content }); toast(res.message || '申报已提交'); }
          catch (e) { toast(e.message); }
        },
      });
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 30rpx; }
.bar { display: flex; gap: 14rpx; padding: 20rpx 28rpx; background: var(--surface); border-bottom: 1rpx solid var(--border); }
.inp { flex: 1; padding: 18rpx 24rpx; border: 1rpx solid var(--border-strong); border-radius: 14rpx;
  font-size: 26rpx; background: var(--bg); color: var(--text-1); }
.sec { padding: 22rpx 28rpx 0; }
</style>
