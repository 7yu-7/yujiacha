<template>
  <view class="mp">
    <!-- 忘记密码 -->
    <view v-if="mode === 'forgot'">
      <view style="padding:40rpx 40rpx 20rpx">
        <view style="font-size:34rpx;font-weight:700">找回密码</view>
        <view class="tiny faint" style="margin-top:8rpx;line-height:1.8">
          输入注册邮箱，我们会发送一封包含重置链接的邮件，链接 2 小时内有效。</view>
      </view>
      <view class="sec">
        <view class="field"><view class="field-label">注册邮箱</view>
          <input class="input" v-model="fEmail" placeholder="you@example.com" /></view>
        <button class="btn pri blk" @tap="sendReset">发送重置邮件</button>
        <view v-if="resetLink" class="notice" style="margin-top:22rpx">
          <text>✉</text>
          <text>演示环境重置链接：{{ resetLink }}（生产环境仅通过邮件下发）</text>
        </view>
      </view>
      <view class="center tiny faint" style="margin-top:22rpx">
        <text style="color:var(--brand)" @tap="mode = 'register'">← 返回注册</text></view>
    </view>

    <!-- 注册 -->
    <view v-else>
      <view style="padding:40rpx 40rpx 20rpx">
        <view style="font-size:34rpx;font-weight:700">注册新账号</view>
        <view class="tiny faint" style="margin-top:8rpx;line-height:1.8">
          注册需邮箱验证激活。请选择与您身份相符的角色，不同角色的数据权限不同。</view>
      </view>
      <view class="sec">
        <view class="field"><view class="field-label">邮箱 *</view>
          <input class="input" v-model="email" placeholder="you@example.com" /></view>
        <view class="field"><view class="field-label">密码 *（至少 6 位）</view>
          <input class="input" v-model="pw" password /></view>
        <view class="field"><view class="field-label">确认密码 *</view>
          <input class="input" v-model="pw2" password /></view>
        <view class="field"><view class="field-label">称呼</view>
          <input class="input" v-model="nickname" placeholder="如 老张 / 李老师" /></view>
        <view class="field"><view class="field-label">角色</view>
          <picker :range="roleNames" @change="onRole">
            <view class="input">{{ roleNames[roleIdx] }}</view>
          </picker></view>
        <view class="field"><view class="field-label">所属机构（教研 / 政府用户）</view>
          <input class="input" v-model="org" placeholder="如 上海海洋大学 水产与生命学院" /></view>

        <button class="btn pri blk" @tap="doRegister">注册并发送验证邮件</button>

        <view class="notice" style="margin-top:20rpx">
          <text>🔒</text>
          <text>密码使用 scrypt 加盐哈希存储，平台不保存明文密码。注册后需完成邮箱验证才能订阅推送。</text>
        </view>

        <view v-if="verifyLink" class="notice" style="margin-top:16rpx">
          <text>✉</text>
          <text>验证链接（演示环境）：{{ verifyLink }}</text>
        </view>
        <button v-if="verifyToken" class="btn blk" style="margin-top:16rpx" @tap="doVerify">立即验证并登录</button>

        <view class="center tiny faint" style="margin-top:24rpx">
          已有账号？<text style="color:var(--brand)" @tap="goLogin">前往登录</text></view>
      </view>
    </view>
  </view>
</template>

<script>
import { api, auth, toast } from '@/utils/api';

export default {
  data() {
    return {
      mode: 'register',
      email: '', pw: '', pw2: '', nickname: '', org: '',
      roleIdx: 0, roles: ['user', 'researcher', 'gov'],
      roleNames: ['普通用户（养殖户 / 消费者 / 批发商）', '教研师生（可导出数据）', '政府监测人员（可导出数据）'],
      fEmail: '', resetLink: '', verifyLink: '', verifyToken: '', lastPw: '',
    };
  },
  onLoad(q) { if (q.mode === 'forgot') this.mode = 'forgot'; },
  methods: {
    onRole(e) { this.roleIdx = Number(e.detail.value); },
    async doRegister() {
      if (!this.email || !this.pw) return toast('请填写邮箱与密码');
      if (this.pw !== this.pw2) return toast('两次输入的密码不一致');
      try {
        const r = await api.register({
          email: this.email.trim(), password: this.pw,
          nickname: this.nickname, role: this.roles[this.roleIdx], org: this.org,
        });
        this.verifyToken = r.verifyToken;
        this.verifyLink = r.verifyLink;
        this.lastPw = this.pw;
        toast('注册成功，请完成邮箱验证');
      } catch (e) { toast(e.message); }
    },
    async doVerify() {
      try {
        await api.verifyEmail(this.verifyToken);
        toast('邮箱验证成功，请登录');
        setTimeout(() => uni.navigateTo({ url: `/pages/login/index?email=${encodeURIComponent(this.email)}&pw=${encodeURIComponent(this.lastPw)}` }), 700);
      } catch (e) { toast(e.message); }
    },
    async sendReset() {
      if (!this.fEmail) return toast('请输入邮箱');
      try {
        const r = await api.forgotPassword(this.fEmail.trim());
        this.resetLink = r.resetLink || '';
        toast(r.message);
      } catch (e) { toast(e.message); }
    },
    goLogin() { uni.navigateTo({ url: '/pages/login/index' }); },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 40rpx; }
.sec { padding: 0 28rpx; }
</style>
