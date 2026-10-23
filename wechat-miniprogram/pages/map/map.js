const { api } = require('../../utils/api.js');
const chinaMap = require('../../utils/chinaMap.js');

const TIER_COLOR = { low: '#6FA8DC', mid: '#F4C361', high: '#E98B7B' };
const NA_COLOR = '#D9DEE3';
const VIEW_W = 800;
const VIEW_H = 572;

// 将 SVG 路径（仅 M/L/Z 直线指令）描到 canvas 当前路径上
function tracePath(ctx, d) {
  const segs = d.match(/[MLZmlz][^MLZmlz]*/g) || [];
  segs.forEach((seg) => {
    const cmd = seg[0].toUpperCase();
    const nums = (seg.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
    if (cmd === 'M') {
      ctx.moveTo(nums[0], nums[1]);
      for (let i = 2; i < nums.length; i += 2) ctx.lineTo(nums[i], nums[i + 1]);
    } else if (cmd === 'L') {
      for (let i = 0; i < nums.length; i += 2) ctx.lineTo(nums[i], nums[i + 1]);
    } else if (cmd === 'Z') {
      ctx.closePath();
    }
  });
}

Page({
  data: {
    loading: true,
    error: false,
    d: null,
    tierRows: [],
    ranking: [],
    maxShort: '-',
    maxPriceTxt: '',
    selected: '',
    detail: null,
    trendMax: 1,
    trendMin: 0,
    mapH: 0
  },

  onLoad() {
    this.computeMapH();
    this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  computeMapH() {
    try {
      const sys = wx.getSystemInfoSync();
      const sw = sys.screenWidth;
      const canvasW = sw - (88 / 750) * sw;
      this._canvasW = canvasW;
      this.setData({ mapH: canvasW * VIEW_H / VIEW_W });
    } catch (e) {
      this.setData({ mapH: 260 });
    }
  },

  load() {
    this.setData({ loading: true });
    return api.mapProvinces({ days:7 })
      .then((d) => {
        const counts = { low: 0, mid: 0, high: 0, na: 0 };
        (d.provinces || []).forEach((p) => {
          const t = (p.tier && p.tier.tier) || 'na';
          counts[t] = (counts[t] || 0) + 1;
        });
        const tierRows = (d.tiers || []).map((t) => ({
          tier: t.tier, label: t.label, color: t.color, desc: t.desc,
          range: t.min == null ? ('≤' + t.max + ' 元/斤')
            : (t.max == null ? ('>' + t.min + ' 元/斤') : (t.min + '–' + t.max + ' 元/斤')),
          count: counts[t.tier] || 0
        }));
        if (counts.na) tierRows.push({ tier: 'na', label: '暂无数据', color: '#8595AC', range: '-', count: counts.na });

        const selected = this.data.selected ||
          (d.maxProvince && d.maxProvince.name) ||
          ((d.provinces || []).find((p) => p.hasData) || {}).name || '';
        const mp = d.maxProvince || null;
        this.setData({
          d, tierRows,
          ranking: (d.ranking || []).slice(0, 15),
          maxShort: mp ? mp.short : '-',
          maxPriceTxt: mp ? (mp.avgPrice.toFixed(2) + ' 元/公斤') : '',
          loading: false
        });
        this.drawChinaMap();
        if (selected) this.pick(selected);
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '地图数据加载失败', icon: 'none' });
        this.setData({ loading: false, error: true });
      });
  },

  retry() {
    this.setData({ error: false });
    this.load();
  },

  drawChinaMap() {
    const q = wx.createSelectorQuery().in(this);
    q.select('#chinamap').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = (wx.getSystemInfoSync().pixelRatio) || 2;
      const W = this._canvasW || res[0].width;
      const H = W * VIEW_H / VIEW_W;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      this._ctx = ctx; this._dpr = dpr; this._scale = W / VIEW_W;

      ctx.clearRect(0, 0, W, H);

      const provMap = {};
      (this.data.d.provinces || []).forEach((p) => { provMap[p.short] = p; });

      const scale = this._scale;
      chinaMap.forEach((prov) => {
        const p = provMap[prov.short];
        const tier = p && p.tier ? p.tier.tier : 'na';
        const fill = TIER_COLOR[tier] || NA_COLOR;
        const isSel = this.data.selected === (p && p.name);
        ctx.save();
        ctx.scale(scale, scale);
        ctx.beginPath();
        tracePath(ctx, prov.d);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = isSel ? '#005F73' : '#FFFFFF';
        ctx.lineWidth = (isSel ? 2.6 : 1.1) / scale;
        ctx.lineJoin = 'round';
        ctx.stroke();
        if (prov.d.length > 40) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = (11.5 / scale) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(prov.label, prov.lx, prov.ly);
        }
        ctx.restore();
      });
    });
  },

  onMapTap(e) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#chinamap').boundingClientRect();
    q.exec((r) => {
      if (!r || !r[0]) return;
      const rect = r[0];
      const t = (e.touches && e.touches[0]) || {};
      const tx = t.clientX != null ? t.clientX : (e.detail.x || 0);
      const ty = t.clientY != null ? t.clientY : (e.detail.y || 0);
      const x = tx - rect.left;
      const y = ty - rect.top;
      const prov = this.hitTest(x, y);
      if (prov) this.pick(prov.name);
    });
  },

  hitTest(x, y) {
    const ctx = this._ctx; const dpr = this._dpr; const s = this._scale;
    if (!ctx || !s) return null;
    for (let i = chinaMap.length - 1; i >= 0; i--) {
      const prov = chinaMap[i];
      ctx.save();
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      ctx.beginPath();
      tracePath(ctx, prov.d);
      const hit = ctx.isPointInPath(x * dpr, y * dpr);
      ctx.restore();
      if (hit) return prov;
    }
    return null;
  },

  pick(name) {
    this.setData({ selected: name, detail: null });
    this.drawChinaMap();
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
