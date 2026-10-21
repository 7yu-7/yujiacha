<template>
  <view class="mp">
    <!-- 未登录 -->
    <view v-if="!user">
      <view style="text-align:center;padding:60rpx 40rpx 20rpx">
        <view class="avatar-lg">👤</view>
        <view style="font-size:32rpx;font-weight:600;margin-top:20rpx">尚未登录</view>
        <view class="tiny faint" style="margin-top:10rpx;line-height:1.8">
          登录后可云端保存关注品种、<br>接收价格异动推送，并解锁数据导出</view>
        <view class="row" style="gap:18rpx;margin-top:36rpx">
          <button class="btn pri grow" @tap="goLogin">登录</button>
          <button class="btn grow" @tap="goRegister">注册</button>
        </view>
      </view>

      <view class="sec">
        <view class="sec-t"><text class="h">访客可用功能</text></view>
        <view class="grp">
          <view v-for="f in guestFeatures" :key="f.t" class="grp-row">
            <text class="ico">{{ f.i }}</text>
            <text class="grow">{{ f.t }}</text>
            <text class="tiny faint">{{ f.c }}</text>
          </view>
        </view>
      </view>

      <view class="sec">
        <view class="notice"><text>ℹ</text>
          <text>游客为只读模式，不可订阅云端关注、不可接收推送、不可导出数据。登录后可解锁全部能力。</text></view>
      </view>

      <view class="sec">
        <view class="sec-t"><text class="h">演示账号（点击填入）</text></view>
        <view class="grp">
          <view v-for="a in demoAccounts" :key="a.n" class="grp-row" @tap="goLogin(a)">
            <text class="grow">{{ a.n }}</text>
            <text class="tiny faint mono">{{ a.e }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 已登录 -->
    <view v-else>
      <view class="head">
        <view class="avatar-lg brand">{{ initials }}</view>
        <view class="grow" style="min-width:0">
          <view style="font-size:33rpx;font-weight:700">{{ user.nickname || '用户' }}</view>
          <view class="tiny faint" style="margin-top:4rpx">{{ user.email }}</view>
          <view class="row wrap" style="gap:10rpx;margin-top:10rpx">
            <text class="badge">{{ user.roleLabel }}</text>
            <text class="badge" :class="user.emailVerified ? 'down' : 'warn'">
              {{ user.emailVerified ? '邮箱已验证' : '邮箱待验证' }}</text>
          </view>
        </view>
      </view>

      <view class="ov-grid">
        <view class="ov"><text class="k">关注品种</text><text class="v">{{ watchCount }}</text></view>
        <view class="ov warn"><text class="k">未读提醒</text><text class="v">{{ unread }}</text></view>
        <view class="ov"><text class="k">导出权限</text>
          <text class="v" style="font-size:28rpx">{{ perms.export ? '已开通' : '未开通' }}</text></view>
      </view>

      <view class="sec">
        <view class="grp">
          <view class="grp-row" @tap="goAlerts">
            <text class="ico">🔔</text><text class="grow">价格异动提醒</text>
            <text class="tiny" :class="unread ? 't-up' : 'faint'">{{ unread ? `${unread} 未读` : '查看' }} ›</text>
          </view>
          <view class="grp-row" @tap="goCompare">
            <text class="ico">📈</text><text class="grow">历史趋势对比</text><text class="tiny faint">›</text>
          </view>
          <view class="grp-row" @tap="goSettings">
            <text class="ico">⚙️</text><text class="grow">账户设置</text>
            <text class="tiny faint">昵称 / 机构 / 主题 ›</text>
          </view>
          <view class="grp-row" @tap="switchTheme">
            <text class="ico">🌓</text><text class="grow">主题切换</text>
            <text class="tiny faint">{{ themeLabel }} ›</text>
          </view>
        </view>
      </view>

      <view class="sec">
        <view class="sec-t"><text class="h">数据导出与分享</text>
          <text class="m">{{ perms.export ? '已开通' : '需教研 / 政府权限' }}</text></view>
        <view class="grp">
          <view v-for="e in exports" :key="e.k" class="grp-row" @tap="doExport(e.k)">
            <text class="ico">📤</text><text class="grow">{{ e.t }}</text>
            <text class="tiny faint">{{ perms.export ? '导出 ›' : '🔒' }}</text>
          </view>
        </view>
        <view v-if="!perms.export" class="notice warn" style="margin-top:16rpx">
          <text>⚠</text>
          <text>当前角色「{{ user.roleLabel }}」暂无导出权限。导出面向教研师生、政府监测人员与管理员开放。</text>
        </view>
      </view>

      <view class="sec">
        <view class="grp">
          <view class="grp-row" @tap="togglePush">
            <text class="ico">🔕</text><text class="grow">推送授权</text>
            <text class="tiny faint">{{ user.pushEnabled ? '已开启 ›' : '已关闭 ›' }}</text>
          </view>
          <view class="grp-row" @tap="logout">
            <text class="ico">🚪</text><text class="grow t-up">退出登录</text><text class="tiny faint"></text>
          </view>
        </view>
      </view>

      <view class="sec" style="text-align:center;padding-bottom:40rpx">
        <view class="tiny faint" style="line-height:1.9">
          鱼价查 v1.0.0 · 智慧渔业全国水产品价格日报系统<br>
          数据来源：农业农村部全国农产品价格信息系统 pfsc.agri.cn
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api, auth, store, fmt, toast, applyTheme } from '@/utils/api';
import { THEMES, THEME_KEY } from '@/utils/config';

export default {
  data() {
    return {
      user: null, watchCount: 0, unread: 0, themeLabel: '浅色',
      guestFeatures: [
        { i: '📊', t: '浏览全部品种行情', c: 'F1' },
        { i: '🔍', t: '搜索品种（拼音 / 别名）', c: 'F2' },
        { i: '🗺', t: '地图选省看趋势', c: 'F3' },
        { i: '⭐', t: '本机保存关注列表', c: 'F4' },
        { i: '📋', t: '查看全国日报表', c: 'F5' },
        { i: '🌓', t: '切换 3 套主题', c: 'F9' },
      ],
      demoAccounts: [
        { n: '普通用户', e: 'farmer@yujiacha.local', p: 'Demo@2026' },
        { n: '教研师生', e: 'teacher@shou.edu.cn', p: 'Demo@2026' },
        { n: '政府监测', e: 'gov@agri.local', p: 'Demo@2026' },
      ],
      exports: [
        { t: '日报 CSV', k: 'report' },
        { t: '关注列表 CSV', k: 'watch' },
        { t: '分享长图', k: 'svg' },
      ],
    };
  },
  computed: {
    initials() {
      const s = (this.user && (this.user.nickname || this.user.email)) || '游';
      return String(s).trim().charAt(0).toUpperCase();
    },
    perms() { return (this.user && this.user.permissions) || {}; },
  },
  onShow() { this.load(); },
  methods: {
    fmt,
    async load() {
      const t = store.get(THEME_KEY) || 'light';
      this.themeLabel = (THEMES.find((x) => x.id === t) || {}).name || '浅色';
      if (!auth.isLoggedIn) { this.user = null; return; }
      try {
        this.user = await api.me();
        auth.setUser(this.user);
        const [w, a] = await Promise.all([
          api.watches().catch(() => null),
          api.alerts({ limit: 1 }).catch(() => null),
        ]);
        this.watchCount = w ? w.total : 0;
        this.unread = a ? a.unread : 0;
      } catch {
        auth.clear(); this.user = null;
      }
    },
    goLogin(prefill) {
      const q = prefill ? `?email=${encodeURIComponent(prefill.e)}&pw=${encodeURIComponent(prefill.p)}` : '';
      uni.navigateTo({ url: '/pages/login/index' + q });
    },
    goRegister() { uni.navigateTo({ url: '/pages/register/index' }); },
    goAlerts() { uni.navigateTo({ url: '/pages/alerts/index' }); },
    goCompare() { uni.navigateTo({ url: '/pages/compare/index' }); },
    goSettings() { uni.navigateTo({ url: '/pages/settings/index' }); },
    async switchTheme() {
      const order = THEMES.map((x) => x.id);
      const cur = store.get(THEME_KEY) || 'light';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      applyTheme(next);
      this.themeLabel = (THEMES.find((x) => x.id === next) || {}).name;
      try { const u = await api.updateProfile({ theme: next }); auth.setUser(u); } catch { /* 忽略 */ }
      toast(`已切换为「${this.themeLabel}」主题`);
    },
    async togglePush() {
      try {
        const u = await api.updateProfile({ pushEnabled: !this.user.pushEnabled });
        this.user = u; auth.setUser(u);
        toast(u.pushEnabled ? '已开启推送' : '已关闭推送');
      } catch (e) { toast(e.message); }
    },
    async doExport(kind) {
      if (!this.perms.export) return toast('当前角色无导出权限');
      if (kind === 'svg') {
        // #ifdef MP-WEIXIN
        uni.downloadFile({
          url: api.exportUrl('svg', { top: 15 }),
          success: (r) => uni.previewImage({ urls: [r.tempFilePath] }),
          fail: () => toast('生成失败'),
        });
        // #endif
        return;
      }
      // #ifdef MP-WEIXIN
      uni.downloadFile({
        url: api.exportUrl(kind, {}),
        success: (r) => {
          uni.openDocument({
            filePath: r.tempFilePath, fileType: 'csv',
            fail: () => toast('已下载，可在文件管理中查看'),
          });
        },
        fail: () => toast('导出失败'),
      });
      // #endif
      // #ifndef MP-WEIXIN
      uni.showToast({ title: '请在 Web 端导出该格式', icon: 'none' });
      // #endif
    },
    async logout() {
      await api.logout();
      auth.clear();
      this.user = null; this.watchCount = 0; this.unread = 0;
      toast('已退出登录');
    },
  },
};
</script>

<style scoped>
.mp { padding-bottom: 30rpx; }
.avatar-lg { width: 104rpx; height: 104rpx; border-radius: 50%; background: var(--surface-2);
  display: flex; align-items: center; justify-content: center; font-size: 48rpx; margin: 0 auto; }
.avatar-lg.brand { background: var(--brand); color: #fff; font-weight: 700; margin: 0; flex-shrink: 0; }
.head { background: var(--surface); padding: 32rpx 28rpx; border-bottom: 1rpx solid var(--border);
  display: flex; align-items: center; gap: 26rpx; }
.ov-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rpx; background: var(--border); }
.ov { background: var(--surface); padding: 24rpx 16rpx; text-align: center; }
.ov .k { font-size: 21rpx; color: var(--text-2); }
.ov .v { display: block; font-size: 36rpx; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 6rpx; }
.ov.warn .v { color: #F5A623; }
.sec { padding: 26rpx 28rpx 0; }
.sec-t { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.sec-t .h { font-size: 29rpx; font-weight: 600; }
.sec-t .m { font-size: 21rpx; color: var(--text-3); }
.grp { border-radius: 20rpx; overflow: hidden; border: 1rpx solid var(--border); }
.grp-row { display: flex; align-items: center; gap: 18rpx; padding: 24rpx 26rpx;
  background: var(--surface); border-bottom: 1rpx solid var(--border); font-size: 27rpx; }
.grp-row:last-child { border-bottom: none; }
.grp-row .ico { font-size: 30rpx; }
</style>
