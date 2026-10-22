const { api } = require('../../utils/api.js');

Page({
  data: {
    items: [],
    loading: true
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true });
    let local = [];
    try { local = wx.getStorageSync('yjt_watch') || []; } catch (e) {}
    let token = '';
    try { token = wx.getStorageSync('yjt_token'); } catch (e) {}

    if (token) {
      api.watch()
        .then((cloud) => {
          const c = (cloud && cloud.items) || cloud || [];
          const merged = (c.length ? c : local).map((x) => ({
            species: x.species,
            province: x.province || null,
            id: x.id || null,
            cloud: !!c.length
          }));
          this.setData({ items: merged, loading: false });
        })
        .catch(() => { this.setData({ items: local, loading: false }); });
    } else {
      this.setData({ items: local, loading: false });
    }
  },

  goSpecies(e) {
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: '/pages/species/species?name=' + encodeURIComponent(name) });
  },

  remove(e) {
    const name = e.currentTarget.dataset.name;
    const id = e.currentTarget.dataset.id;
    let w = [];
    try { w = wx.getStorageSync('yjt_watch') || []; } catch (err) {}
    w = w.filter((x) => x.species !== name);
    try { wx.setStorageSync('yjt_watch', w); } catch (err) {}
    if (id) api.removeWatch(id).catch(() => {});
    this.load();
  }
});
