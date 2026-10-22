const { api } = require('../../utils/api.js');

Page({
  data: {
    kw: '',
    results: [],
    loading: false
  },

  input(e) {
    this.setData({ kw: e.detail.value });
    this.doSearch();
  },

  doSearch() {
    const kw = (this.data.kw || '').trim();
    if (!kw) {
      this.setData({ results: [], loading: false });
      return;
    }
    this.setData({ loading: true });
    api.search(kw, 30)
      .then((r) => {
        const list = (r && r.suggestions) || [];
        this.setData({ results: list, loading: false });
      })
      .catch(() => {
        this.setData({ results: [], loading: false });
      });
  },

  goSpecies(e) {
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: '/pages/species/species?name=' + encodeURIComponent(name) });
  }
});
