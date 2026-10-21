<template>
  <view class="mp">
    <view class="sec">
      <view class="field"><view class="field-label">昵称</view>
        <input class="input" v-model="nickname" /></view>
      <view class="field"><view class="field-label">所属机构</view>
        <input class="input" v-model="org" placeholder="如 上海海洋大学 水产与生命学院" /></view>
      <view class="field"><view class="field-label">主题偏好（云端同步）</view>
        <picker :range="themeNames" :value="themeIdx" @change="onTheme">
          <view class="input">{{ themeNames[themeIdx] }}</view>
        </picker></view>
      <view class="field">
        <view class="row" style="gap:12rpx">
          <switch :checked="pushEnabled" @change="(e) => (pushEnabled = e.detail.value)" color="#0A9396" />
          <text class="sm">接收价格异动推送</text>
        </view>
      </view>
      <button class="btn pri blk" @tap="save">保存设置</button>
    </view>

    <view class="sec">
      <view class="sec-t"><text class="h">推送通道授权</text></view>
      <view class="row wrap" style="gap:14rpx">
        <button class="btn sm" @tap="sub('wechat_push')">微信订阅消息</button>
        <button class="btn sm" @tap="sub('app_push')">App 系统推送</button>
        <button class="btn sm" @tap="sub('web_push')">浏览器通知</button>
      </view>
      <view class="notice" style="margin-top:18rpx">
        <text>ℹ</text>
        <text>{{ pushHint }}</text></view>
    </view>

    <view class="sec">
      <view class="sec-t"><text class="h">修改密码</text></view>
      <view class="field"><view class="field-label">当前密码</view>
        <input class="input" v-model="oldPw" password /></view>
      <view class="field"><view class="field-label">新密码（至少 6 位）</view>
        <input class="input" v-model="newPw" password /></view>
      <button class="btn blk" @tap="changePw">修改密码</button>
    </view>

    <view class="sec" style="padding-bottom:40rpx">
      <view class="sec-t"><text class="h t-up">注销账号</text></view>
      <view class="tiny faint" style="line-height:1.8;margin-bottom:18rpx">
        注销后账号进入软删除状态，关注与订阅解绑，登录状态立即失效。</view>
      <button class="btn blk" style="color:var(--up);border-color:var(--up)" @tap="deactivate">申请注销账号</button>
    </view>
  </view>
</template>

<script>
import { api, auth, store, toast, applyTheme } from '@/utils/api';
import { THEMES, THEME_KEY } from '@/utils/config';

export default {
  data() {
    return {
      nickname: '', org: '', pushEnabled: true,
      themeNames: THEMES.map((t) => t.name), themeIds: THEMES.map((t) => t.id), themeIdx: 0,
      oldPw: '', newPw: '',
      pushHint: '小程序端通过 wx.requestSubscribeMessage 由用户确认授权；App 端通过系统通知权限引导；Web 端通过浏览器通知授权。',
    };
  },
  async onLoad() {
    const t = store.get(THEME_KEY) || 'light';
    this.themeIdx = Math.max(0, this.themeIds.indexOf(t));
    if (!auth.isLoggedIn) return;
    try {
      const u = await api.me();
      this.nickname = u.nickname || '';
      this.org = u.org || '';
      this.pushEnabled = !!u.pushEnabled;
      this.themeIdx = Math.max(0, this.themeIds.indexOf(u.theme || 'light'));
    } catch { /* 忽略 */ }
  },
  methods: {
    onTheme(e) { this.themeIdx = Number(e.detail.value); },
    async save() {
      try {
        const t = this.themeIds[this.themeIdx];
        applyTheme(t);
        const u = await api.updateProfile({ nickname: this.nickname, org: this.org, theme: t, pushEnabled: this.pushEnabled });
        auth.setUser(u);
        toast('设置已保存并同步到云端');
      } catch (e) { toast(e.message); }
    },
    async sub(channel) {
      try {
        await api.subscribePush({ channel, endpoint: 'preview:' + channel });
        this.pushHint = channel === 'wechat_push'
          ? '微信订阅消息已登记。真机环境将调用 wx.requestSubscribeMessage 引导用户确认授权。'
          : channel === 'app_push'
            ? 'App 推送已登记，将通过 APNs / FCM 与华为、小米、OPPO、vivo 厂商通道下发。'
            : '浏览器通知已登记。';
        toast('已登记');
      } catch (e) { toast(e.message); }
    },
    async changePw() {
      if (!this.newPw || this.newPw.length < 6) return toast('新密码至少 6 位');
      try {
        await api.changePassword({ oldPassword: this.oldPw, newPassword: this.newPw });
        toast('密码修改成功');
        this.oldPw = ''; this.newPw = '';
      } catch (e) { toast(e.message); }
    },
    deactivate() {
      uni.showModal({
        title: '申请注销账号',
        content: '注销后账号进入软删除状态，全部关注与订阅将解绑，且无法自助恢复。是否继续？',
        confirmColor: '#E5484D',
        success: (r) => {
          if (!r.confirm) return;
          uni.showModal({
            title: '请输入登录密码确认', editable: true, placeholderText: '登录密码',
            success: async (r2) => {
              if (!r2.confirm || !r2.content) return;
              try {
                const res = await api.deactivate({ password: r2.content, reason: '用户在客户端申请注销' });
                toast(`账号已注销，解绑关注 ${res.unbindWatches} 条`);
                auth.clear();
                setTimeout(() => uni.switchTab({ url: '/pages/market/index' }), 800);
              } catch (e) { toast(e.message); }
            },
          });
        },
      });
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.sec { padding: 22rpx 28rpx 0; }
.sec-t { margin-bottom: 16rpx; }
.sec-t .h { font-size: 29rpx; font-weight: 600; }
</style>
