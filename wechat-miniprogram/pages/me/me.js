Page({
  data: {
    user: null
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    let user = null;
    try { user = wx.getStorageSync('yjt_user') || null; } catch (e) {}
    this.setData({ user });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goWatch() {
    wx.navigateTo({ url: '/pages/watch/watch' });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: (r) => {
        if (r.confirm) {
          try {
            wx.removeStorageSync('yjt_token');
            wx.removeStorageSync('yjt_user');
          } catch (e) {}
          this.refresh();
          wx.showToast({ title: '已退出', icon: 'none' });
        }
      }
    });
  }
});
