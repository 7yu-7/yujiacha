// 鱼价查 · 微信小程序 App 入口
App({
  globalData: {
    // 后端 API 基地址（公网 HTTPS，需在微信公众平台配置 request 合法域名）
    // 当前为 WorkBuddy 托管实例，带 sharecode 网关；若后续部署到独立域名（如 Render），
    // 只需把 baseUrl 改成新地址、并把 sharecode 留空即可，无需改动任何页面代码。
    baseUrl: 'https://yujiacha.app.workbuddy.host',
    sharecode: '274LOJXASW',
    user: null
  },
  onLaunch() {
    try {
      const u = wx.getStorageSync('yjt_user');
      if (u) this.globalData.user = u;
    } catch (e) {}
  }
});
