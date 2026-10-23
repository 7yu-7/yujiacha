// 鱼价查 · 微信小程序 App 入口
App({
  globalData: {
    // 后端 API 基地址
    // 【开发调试】当前指向本机局域网地址（手机预览需与电脑同一 WiFi，且开发者工具勾选
    // 「详情 → 本地设置 → 不校验合法域名」）：'http://192.168.10.30:8787'
    // 【正式发布】改回公网 HTTPS 地址（Render / Hugging Face 部署后），并把 sharecode 留空。
    baseUrl: 'http://192.168.10.30:8787',
    sharecode: '',
    user: null
  },
  onLaunch() {
    try {
      const u = wx.getStorageSync('yjt_user');
      if (u) this.globalData.user = u;
    } catch (e) {}
  }
});
