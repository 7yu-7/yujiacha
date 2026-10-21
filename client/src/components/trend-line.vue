<template>
  <!--
    自绘趋势折线（说明书创新三：零依赖纯 SVG 前端）
    小程序端不支持 SVG 标签，故用 canvas 绘制；H5/App 端使用 SVG。
    两端行为一致：平滑折线 + 数据点 + 渐变面积。
  -->
  <view class="wrap">
    <!-- #ifndef MP-WEIXIN -->
    <svg :viewBox="`0 0 ${W} ${H}`" :height="height" style="width:100%">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.24" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      <line v-for="(g, i) in gridLines" :key="'g' + i" :x1="padL" :y1="g.y" :x2="W - padR" :y2="g.y"
            stroke="#E2EAEB" stroke-width="1" stroke-dasharray="3 4" />
      <text v-for="(g, i) in gridLines" :key="'t' + i" :x="padL - 6" :y="g.y + 4"
            font-size="10" fill="#9AA5B1" text-anchor="end">{{ g.label }}</text>
      <text v-for="(x, i) in xLabels" :key="'x' + i" :x="x.pos" :y="H - 6"
            font-size="10" fill="#9AA5B1" text-anchor="middle">{{ x.label }}</text>
      <path v-if="areaPath" :d="areaPath" :fill="`url(#${gid})`" />
      <path :d="linePath" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle v-for="(p, i) in pts" :key="'c' + i" :cx="p.x" :cy="p.y" r="2.6"
              fill="#FFFFFF" :stroke="color" stroke-width="1.6" />
    </svg>
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <canvas :canvas-id="cid" :id="cid" :style="`width:100%;height:${height}px`" />
    <!-- #endif -->

    <view v-if="!pts.length" class="empty-mini">暂无数据</view>
  </view>
</template>

<script>
export default {
  name: 'TrendLine',
  props: {
    points: { type: Array, default: () => [] },
    height: { type: Number, default: 180 },
    color: { type: String, default: '#0A9396' },
    yTicks: { type: Number, default: 3 },
  },
  data() {
    return { W: 800, H: 0, padL: 40, padR: 12, padT: 12, padB: 22, cid: 'tl' + Math.random().toString(36).slice(2, 8) };
  },
  computed: {
    gid() { return 'g' + this.cid; },
    vals() {
      return (this.points || []).map((p) => Number(p.price ?? p)).filter((v) => !isNaN(v));
    },
    bounds() {
      const v = this.vals;
      if (!v.length) return { min: 0, max: 1 };
      let min = Math.min(...v), max = Math.max(...v);
      if (min === max) { min -= 1; max += 1; }
      const pad = (max - min) * 0.16;
      return { min: min - pad, max: max + pad };
    },
    innerW() { return this.W - this.padL - this.padR; },
    innerH() { return this.H - this.padT - this.padB; },
    pts() {
      const v = this.vals;
      if (!v.length) return [];
      const { min, max } = this.bounds;
      return v.map((val, i) => ({
        x: +(this.padL + (v.length <= 1 ? this.innerW / 2 : (i / (v.length - 1)) * this.innerW)).toFixed(1),
        y: +(this.padT + this.innerH - ((val - min) / (max - min)) * this.innerH).toFixed(1),
      }));
    },
    linePath() {
      return this.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    },
    areaPath() {
      if (this.pts.length < 2) return '';
      const bottom = +(this.padT + this.innerH).toFixed(1);
      return `${this.linePath} L${this.pts[this.pts.length - 1].x},${bottom} L${this.pts[0].x},${bottom} Z`;
    },
    gridLines() {
      const { min, max } = this.bounds;
      const out = [];
      for (let i = 0; i <= this.yTicks; i++) {
        const val = min + ((max - min) * i) / this.yTicks;
        out.push({
          y: +(this.padT + this.innerH - ((val - min) / (max - min)) * this.innerH).toFixed(1),
          label: val.toFixed(val >= 100 ? 0 : 1),
        });
      }
      return out;
    },
    xLabels() {
      const pts = this.points || [];
      if (!pts.length) return [];
      const step = Math.max(1, Math.ceil(pts.length / 4));
      const out = [];
      pts.forEach((p, i) => {
        if (i % step !== 0 && i !== pts.length - 1) return;
        out.push({ pos: this.pts[i] ? this.pts[i].x : 0, label: String(p.date || '').slice(5, 10) });
      });
      return out;
    },
  },
  watch: {
    points() { this.$nextTick(() => this.drawCanvas()); },
  },
  mounted() {
    this.H = this.height;
    this.$nextTick(() => this.drawCanvas());
  },
  methods: {
    drawCanvas() {
      // #ifdef MP-WEIXIN
      const v = this.vals;
      if (!v.length) return;
      const ctx = uni.createCanvasContext(this.cid, this);
      const { min, max } = this.bounds;
      // 网格
      ctx.setStrokeStyle('#E2EAEB');
      ctx.setLineWidth(1);
      this.gridLines.forEach((g) => {
        ctx.beginPath();
        ctx.moveTo(this.padL, g.y);
        ctx.lineTo(this.W - this.padR, g.y);
        ctx.stroke();
      });
      // 面积
      if (this.pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(this.pts[0].x, this.padT + this.innerH);
        this.pts.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(this.pts[this.pts.length - 1].x, this.padT + this.innerH);
        ctx.closePath();
        ctx.setFillStyle('rgba(10,147,150,0.14)');
        ctx.fill();
      }
      // 折线
      ctx.beginPath();
      this.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.setStrokeStyle(this.color);
      ctx.setLineWidth(2);
      ctx.setLineJoin('round');
      ctx.stroke();
      ctx.draw();
      // #endif
    },
  },
};
</script>

<style scoped>
.wrap { position: relative; }
.empty-mini { text-align: center; font-size: 23rpx; color: var(--text-3); padding: 40rpx 0; }
</style>
