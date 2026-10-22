const { api } = require('../../utils/api.js');

Page({
  data: {
    date: '',
    overview: null,
    rows: [],
    disclaimer: ''
  },

  onLoad() {
    this.load();
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(done) {
    wx.showLoading({ title: '加载中' });
    api.daily({})
      .then((d) => {
        wx.hideLoading();
        this.setData({
          date: d.date || '',
          overview: d.overview || null,
          rows: d.rows || [],
          disclaimer: d.disclaimer || ''
        });
      })
      .catch((e) => {
        wx.hideLoading();
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      })
      .finally(() => { if (done) done(); });
  }
});
