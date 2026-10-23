const { api } = require('../../utils/api.js');

Page({
  data: {
    date: '',
    cats: [],
    activeCat: '',
    items: [],
    movers: null,
    loading: true
  },

  onLoad() {
    this.loadMovers();
    this.loadList('');
  },

  onPullDownRefresh() {
    Promise.all([this.loadList(this.data.activeCat, false), this.loadMovers(false)]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadList(cat, showLoading) {
    if (showLoading !== false) this.setData({ loading: true });
    return api.species({ limit: 100, category: cat || undefined })
      .then((sp) => {
        const items = (sp && sp.items) || [];
        const d = { items, date: (sp && sp.date) || '', loading: false };
        if (!cat) {
          const cs = [];
          items.forEach((i) => { if (i.category && cs.indexOf(i.category) === -1) cs.push(i.category); });
          d.cats = cs;
        }
        this.setData(d);
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  loadMovers(showLoading) {
    if (showLoading !== false) wx.showLoading({ title: '加载中' });
    return api.movers({ limit: 5 })
      .then((m) => { this.setData({ movers: m || null }); })
      .catch(() => { this.setData({ movers: null }); })
      .finally(() => { if (showLoading !== false) wx.hideLoading(); });
  },

  pickCat(e) {
    const cat = e.currentTarget.dataset.cat;
    const activeCat = this.data.activeCat === cat ? '' : cat;
    this.setData({ activeCat });
    this.loadList(activeCat);
  },

  goSpecies(e) {
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: '/pages/species/species?name=' + encodeURIComponent(name) });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  goReport() {
    wx.switchTab({ url: '/pages/report/report' });
  }
});
