const { api } = require('../../utils/api.js');

Page({
  data: {
    loading: true,
    d: null,          // /api/map/provinces 返回
    tierRows: [],     // 档位分布行（含计数）
    ranking: [],      // 前 15 排行
    maxShort: '—',
    maxPriceTxt: '',
    selected: '',
    detail: null,     // /api/provinces/:name 返回
    trendMax: 1,
    trendMin: 0
  },

  onLoad() { this.load(); },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  load() {
    this.setData({ loading: true });
    return api.mapProvinces({ days: 7 })
      .then((d) => {
        // 档位计数
        const counts = { low: 0, mid: 0, high: 0, na: 0 };
        (d.provinces || []).forEach((p) => {
          const t = (p.tier && p.tier.tier) || 'na';
          counts[t] = (counts[t] || 0) + 1;
        });
        const tierRows = (d.tiers || []).map((t) => ({
          tier: t.tier,
          label: t.label,
          color: t.color,
          desc: t.desc,
          range: t.min == null ? ('≤' + t.max + ' 元/斤')
            : (t.max == null ? ('>' + t.min + ' 元/斤') : (t.min + '–' + t.max + ' 元/斤')),
          count: counts[t.tier] || 0
        }));
        if (counts.na) {
          tierRows.push({ tier: 'na', label: '暂无数据', color: '#8595AC', range: '—', count: counts.na });
        }
        const selected = this.data.selected ||
          (d.maxProvince && d.maxProvince.name) ||
          ((d.provinces || []).find((p) => p.hasData) || {}).name || '';
        const mp = d.maxProvince || null;
        this.setData({
          d, tierRows,
          ranking: (d.ranking || []).slice(0, 15),
          maxShort: mp ? mp.short : '—',
          maxPriceTxt: mp ? (mp.avgPrice.toFixed(2) + ' 元/公斤') : '',
          loading: false
        });
        if (selected) this.pick(selected);
        else this.setData({ loading: false });
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '地图数据加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  pick(name) {
    this.setData({ selected: name, detail: null });
    api.province(name, { range: 7 })
      .then((d) => {
        if (!d.header || !d.header.hasData) { this.setData({ detail: null }); return; }
        const trend = d.trend || [];
        let mx = 0, mn = 1e9;
        trend.forEach((t) => { if (t.price > mx) mx = t.price; if (t.price < mn) mn = t.price; });
        this.setData({ detail: d, trendMax: mx || 1, trendMin: mn === 1e9 ? 0 : mn });
      })
      .catch(() => this.setData({ detail: null }));
  },

  goSpecies(e) {
    const name = e.currentTarget.dataset.name;
    if (name) wx.navigateTo({ url: '/pages/species/species?name=' + encodeURIComponent(name) });
  },

  subscribe() {
    const token = wx.getStorageSync('yjt_token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    api.addWatch({ species: null, province: this.data.selected })
      .then(() => wx.showToast({ title: '订阅成功', icon: 'success' }))
      .catch((e) => wx.showToast({ title: e.message || '订阅失败', icon: 'none' }));
  }
});
