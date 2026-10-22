const { api } = require('../../utils/api.js');

Page({
  data: {
    name: '',
    d: null,
    loading: true,
    watched: false,
    histMax: 1,
    histMin: 0
  },

  onLoad(q) {
    const name = q.name || '';
    this.setData({ name });
    this.load(name);
  },

  load(name) {
    this.setData({ loading: true });
    api.speciesDetail(name, { days: 30 })
      .then((d) => {
        const hist = d.history || [];
        let mx = 0;
        let mn = 1e9;
        hist.forEach((h) => {
          if (h.avg > mx) mx = h.avg;
          if (h.avg < mn) mn = h.avg;
        });
        this.setData({
          d,
          loading: false,
          watched: this.isWatched(name),
          histMax: mx || 1,
          histMin: mn === 1e9 ? 0 : mn
        });
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  isWatched(name) {
    try {
      const w = wx.getStorageSync('yjt_watch') || [];
      return w.some((x) => x.species === name);
    } catch (e) {
      return false;
    }
  },

  toggleWatch() {
    const name = this.data.name;
    let w = [];
    try { w = wx.getStorageSync('yjt_watch') || []; } catch (e) {}
    const idx = w.findIndex((x) => x.species === name);
    let watched;
    if (idx >= 0) {
      w.splice(idx, 1);
      watched = false;
    } else {
      w.push({ species: name, province: null });
      watched = true;
    }
    try { wx.setStorageSync('yjt_watch', w); } catch (e) {}
    this.setData({ watched });

    // 已登录则同步云端（尽力而为）
    const token = wx.getStorageSync('yjt_token');
    if (token && watched) {
      api.addWatch({ species: name, province: null }).catch(() => {});
    }
    wx.showToast({ title: watched ? '已加入关注' : '已取消', icon: 'none' });
  }
});
