<template>
  <view class="mp">
    <view style="text-align:center;padding:50rpx 40rpx 24rpx">
      <view style="font-size:36rpx;font-weight:700">登录 鱼价查</view>
      <view class="tiny faint" style="margin-top:8rpx">登录后关注品种云端同步、接收价格异动推送</view>
    </view>

    <view class="sec">
      <view class="field">
        <view class="field-label">邮箱</view>
        <input class="input" v-model="email" type="text" placeholder="you@example.com" />
      </view>
      <view class="field">
        <view class="field-label">密码</view>
        <input class="input" v-model="pw" password placeholder="请输入密码" />
      </view>
      <button class="btn pri blk" :disabled="loading" @tap="doLogin">{{ loading ? '登录中 …' : '登录' }}</button>
      <view class="center tiny faint" style="margin-top:22rpx">
        还没有账号？<text style="color:var(--brand)" @tap="goReg">立即注册</text>
        <text style="margin:0 14rpx">·</text>
        <text style="color:var(--brand)" @tap="goForgot">忘记密码</text>
      </view>

      <view class="tiny faint" style="margin:34rpx 0 14rpx">快速体验演示账号：</view>
      <view class="chips">
        <text v-for="a in accounts" :key="a.n" class="chip" @tap="fill(a)">{{ a.n }}</text>
      </view>

      <!-- 一键登录（App 端） -->
      <!-- #ifdef APP-PLUS -->
      <button class="btn blk" style="margin-top:24rpx" @tap="phoneLogin">手机号一键登录</button>
      <button class="btn blk" style="margin-top:14rpx" @tap="wechatLogin">微信授权登录</button>
      <view class="notice" style="margin-top:16rpx"><text>ℹ</text>
        <text>一键登录与微信登录需在 uni-app 中接入对应 SDK（运营商一键登录 / 微信开放平台）。</text></view>
      <!-- #endif -->

      <!-- 微信小程序授权登录 -->
      <!-- #ifdef MP-WEIXIN -->
      <button class="btn pri blk" style="margin-top:24rpx" open-type="getPhoneNumber"
              @getphonenumber="onPhoneNumber">微信手机号一键登录</button>
      <view class="notice" style="margin-top:16rpx"><text>ℹ</text>
        <text>该能力需在小程序管理后台开通「手机号快速验证」组件，并在服务端对接解密接口。</text></view>
      <!-- #endif -->
    </view>
  </view>
</template>

<script>
import { api, auth, toast } from '@/utils/api';

export default {
  data() {
    return {
      email: '', pw: '', loading: false,
      accounts: [
        { n: '普通用户', e: 'farmer@yujiacha.local', p: 'Demo@2026' },
        { n: '教研师生', e: 'teacher@shou.edu.cn', p: 'Demo@2026' },
        { n: '政府监测', e: 'gov@agri.local', p: 'Demo@2026' },
      ],
    };
  },
  onLoad(q) {
    if (q.email) this.email = decodeURIComponent(q.email);
    if (q.pw) this.pw = decodeURIComponent(q.pw);
  },
  methods: {
    fill(a) { this.email = a.e; this.pw = a.p; },
    async doLogin() {
      if (!this.email || !this.pw) return toast('请填写邮箱与密码');
      this.loading = true;
      try {
        const r = await api.login({ email: this.email.trim(), password: this.pw });
        if (r.user.role === 'admin') { this.loading = false; return toast('管理员请使用管理后台登录'); }
        auth.save(r);
        toast(`欢迎回来，${r.user.nickname || r.user.email}`);
        setTimeout(() => uni.switchTab({ url: '/pages/watch/index' }), 700);
      } catch (e) { toast(e.message); }
      finally { this.loading = false; }
    },
    goReg() { uni.navigateTo({ url: '/pages/register/index' }); },
    goForgot() { uni.navigateTo({ url: '/pages/register/index?mode=forgot' }); },
    phoneLogin() { toast('需接入运营商一键登录 SDK'); },
    wechatLogin() { toast('需接入微信开放平台 SDK'); },
    onPhoneNumber(e) {
      if (!e.detail || !e.detail.code) return toast('未授权手机号');
      toast('需在服务端对接微信手机号解密接口');
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.sec { padding: 0 28rpx; }
</style>
