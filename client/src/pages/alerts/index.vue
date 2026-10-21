<template>
  <view class="mp">
    <view v-if="data && data.items.length" class="bar">
      <text class="tiny faint">共 {{ data.items.length }} 条 · 未读 {{ data.unread }} 条</text>
      <button class="btn sm" @tap="readAll">全部已读</button>
    </view>
    <view class="sec" v-if="data && data.items.length">
      <view v-for="a in data.items" :key="a.id" class="card" :class="{ read: a.isRead }">
        <view class="row-between">
          <text class="badge" :class="a.direction === 'up' ? 'up' : 'down'">
            {{ a.direction === 'up' ? '▲ 涨' : '▼ 跌' }} {{ fmt.num(Math.abs(a.changePct)) }}%</text>
          <text class="tiny faint">{{ fmt.date(a.date) }}</text>
        </view>
        <view style="font-size:29rpx;font-weight:600;margin-top:14rpx">{{ a.title || a.species }}</view>
        <view class="sm muted" style="line-height:1.75;margin-top:8rpx">{{ a.content }}</view>
        <view class="tiny faint" style="margin-top:10rpx">
          通道：{{ channelLabel(a.channel) }} · {{ a.pushed ? '已推送' : '未推送' }}</view>
      </view>
    </view>
    <view class="sec" v-else-if="loaded">
      <view class="empty">
        <view class="t">暂无价格异动提醒</view>
        <view class="d">当关注的品种涨跌幅超过设定阈值时，这里会显示提醒记录。</view>
      </view>
    </view>
  </view>
</template>

<script>
import { api, fmt, toast } from '@/utils/api';

export default {
  data() { return { data: null, loaded: false }; },
  onShow() { this.load(); },
  methods: {
    fmt,
    channelLabel(c) {
      return { wechat_push: '微信订阅消息', app_push: 'App 推送', web_push: '浏览器通知', inbox: '站内消息' }[c] || c || '站内消息';
    },
    async load() {
      try { this.data = await api.alerts({ limit: 50 }); }
      catch (e) { toast(e.message); }
      finally { this.loaded = true; }
    },
    async readAll() {
      try { await api.readAlerts([]); toast('已全部标为已读'); this.load(); }
      catch (e) { toast(e.message); }
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.bar { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 28rpx;
  background: var(--surface); border-bottom: 1rpx solid var(--border); }
.sec { padding: 22rpx 28rpx 0; }
.card.read { opacity: .62; }
</style>
