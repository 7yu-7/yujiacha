/* ============================================================================
   鱼价查 · UI 组件与自绘 SVG 图表库（四端共用）
   依据说明书 3.5.4「零依赖的纯 SVG 前端」：折线图 / sparkline / 地图标注点 /
   Top 徽章 / 渐变填充 / 悬停 Tooltip 全部自绘，不依赖 ECharts / D3 / Chart.js
   ============================================================================ */

(function (global) {
  'use strict';

  const TIER_COLOR = { low: 'var(--tier-low)', mid: 'var(--tier-mid)', high: 'var(--tier-high)', na: 'var(--flat)' };
  // 档位填充色（柔和浅色调：低位浅蓝 / 中位浅琥珀 / 高位浅珊瑚红 / 无数据浅灰）
  const TIER_HEX = { low: '#6FA8DC', mid: '#F4C361', high: '#E98B7B', na: '#C3CDD4' };

  // ── 基础工具 ──────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, digits = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(digits));
  const int = (v) => (v == null ? '—' : Number(v).toLocaleString('zh-CN'));
  const pctText = (v) => (v == null ? '—' : `${v > 0 ? '▲' : v < 0 ? '▼' : '—'} ${Math.abs(v).toFixed(2)}%`);
  const deltaClass = (v) => (v == null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down');
  const dateShort = (d) => (d ? String(d).slice(5, 10) : '');
  const dateFull = (d) => (d ? String(d).slice(0, 10) : '');
  const dtText = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '—');

  /** 涨跌标签（始终含箭头 + 百分比文字，不单靠颜色表达） */
  function delta(v, { plain = false, suffix = '' } = {}) {
    const cls = deltaClass(v);
    return `<span class="delta ${cls}${plain ? ' plain' : ''}">${esc(pctText(v))}${esc(suffix)}</span>`;
  }

  /** 价格档位徽章 */
  function tierBadge(tier, { outline = false } = {}) {
    const t = tier || { tier: 'na', label: '无数据' };
    return `<span class="tier ${t.tier}${outline ? ' outline' : ''}">${esc(t.label)}</span>`;
  }

  /** 价格大字 */
  function priceBlock(value, { unit = '元/公斤', lg = false, sm = false, delta: d } = {}) {
    return `<div class="price-wrap">
      <span class="price${lg ? ' lg' : ''}${sm ? ' sm' : ''}">${num(value)}</span>
      <span class="price-unit">${esc(unit)}</span>
      ${d !== undefined ? delta(d) : ''}
    </div>`;
  }

  /** 概览卡 */
  function stat({ label, value, unit = '', sub = '', tone = '' }) {
    return `<div class="stat ${tone}">
      <div class="k">${esc(label)}</div>
      <div class="v">${value}${unit ? `<span class="u">${esc(unit)}</span>` : ''}</div>
      ${sub ? `<div class="x">${sub}</div>` : ''}
    </div>`;
  }

  // ── 自绘 SVG：折线图（趋势，带数据点 + 悬停 Tooltip）──────────────────
  /**
   * @param {Array<{date:string,price:number}>} points
   * @param {object} o { height, color, showArea, showDots, showAxis, yTicks, tipHost, valueKey, unit }
   */
  function lineChart(points, o = {}) {
    const H = o.height || 220;
    const W = 800;                      // viewBox 宽，实际按容器缩放
    const padL = o.padL ?? 46, padR = o.padR ?? 16, padT = o.padT ?? 16, padB = o.padB ?? 26;
    const vals = points.map((p) => Number(p[o.valueKey || 'price'])).filter((v) => !Number.isNaN(v));
    if (!vals.length) return `<div class="empty" style="padding:32px"><p>暂无数据</p></div>`;

    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const pad = span * 0.16;
    min -= pad; max += pad;

    const innerW = W - padL - padR, innerH = H - padT - padB;
    const X = (i) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const Y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;

    const color = o.color || 'var(--brand-2)';
    const id = 'lc' + Math.random().toString(36).slice(2, 8);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(Number(p[o.valueKey || 'price'])).toFixed(1)}`).join(' ');
    const areaPath = o.showArea === false ? '' :
      `${linePath} L${X(points.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${X(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

    // Y 轴刻度
    const yTicks = o.yTicks || 4;
    let grid = '';
    for (let i = 0; i <= yTicks; i++) {
      const v = min + ((max - min) * i) / yTicks;
      const y = Y(v);
      grid += `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>`;
      grid += `<text class="axis-label" x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(v >= 100 ? 0 : 1)}</text>`;
    }

    // X 轴刻度（最多 7 个）
    const step = Math.max(1, Math.ceil(points.length / 7));
    let xLabels = '';
    points.forEach((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return;
      xLabels += `<text class="axis-label" x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(dateShort(p.date || p.label))}</text>`;
    });

    // 数据点 + 悬停热区
    let dots = '', hotspots = '';
    if (o.showDots !== false && points.length <= 60) {
      points.forEach((p, i) => {
        dots += `<circle cx="${X(i).toFixed(1)}" cy="${Y(Number(p[o.valueKey || 'price'])).toFixed(1)}" r="${points.length > 30 ? 2 : 3}" fill="${o.dotFill || 'var(--surface)'}" stroke="${color}" stroke-width="1.8"/>`;
      });
    }
    points.forEach((p, i) => {
      const v = Number(p[o.valueKey || 'price']);
      hotspots += `<rect x="${(X(i) - (innerW / points.length) / 2).toFixed(1)}" y="${padT}" width="${Math.max(6, innerW / points.length).toFixed(1)}" height="${innerH}" fill="transparent"
        data-tip="${esc((p.date || p.label || '') + '　' + num(v) + ' ' + (o.unit || '元/公斤'))}" data-x="${X(i).toFixed(1)}" data-y="${Y(v).toFixed(1)}" class="hotspot"/>`;
    });

    return `<div class="chart-host" data-chart="${id}">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="价格趋势折线图">
        <defs>
          <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.26"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${grid}${xLabels}
        ${areaPath ? `<path d="${areaPath}" fill="url(#g${id})"/>` : ''}
        <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${hotspots}
      </svg>
      <div class="chart-tip" style="opacity:0"></div>
    </div>`;
  }

  /** sparkline（迷你走势） */
  function sparkline(points, o = {}) {
    const W = o.width || 92, H = o.height || 30;
    const vals = (points || []).map((p) => Number(p.price ?? p)).filter((v) => !Number.isNaN(v));
    if (vals.length < 2) return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3"/></svg>`;

    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const padY = 3;
    const X = (i) => (i / (vals.length - 1)) * (W - 2) + 1;
    const Y = (v) => H - padY - ((v - min) / span) * (H - padY * 2);

    const rising = vals[vals.length - 1] >= vals[0];
    const color = o.color || (rising ? 'var(--up)' : 'var(--down)');
    const path = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const gid = 'sp' + Math.random().toString(36).slice(2, 8);

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${path} L${X(vals.length - 1).toFixed(1)},${H} L${X(0).toFixed(1)},${H} Z" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(vals.length - 1).toFixed(1)}" cy="${Y(vals[vals.length - 1]).toFixed(1)}" r="2.4" fill="${color}"/>
    </svg>`;
  }

  /** 横向条形排行（省份比价 / 品种榜） */
  function barRank(items, o = {}) {
    if (!items || !items.length) return `<div class="empty" style="padding:24px"><p>暂无数据</p></div>`;
    const max = Math.max(...items.map((x) => Number(x.value) || 0), 1);
    return `<div style="display:flex;flex-direction:column;gap:8px">
      ${items.map((x, i) => {
      const w = Math.max(3, (Number(x.value) / max) * 100);
      const color = x.color || (x.tier ? TIER_HEX[x.tier.tier] : '#0A9396');
      return `<div style="display:flex;align-items:center;gap:10px">
          <span class="rank-badge ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}" style="flex-shrink:0">${i + 1}</span>
          <span style="width:${o.labelWidth || 62}px;flex-shrink:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.label)}">${esc(x.label)}</span>
          <div style="flex:1;height:18px;background:var(--surface-2);border-radius:5px;overflow:hidden;position:relative">
            <div style="width:${w}%;height:100%;background:${color};opacity:.28;border-radius:5px"></div>
            <span class="mono" style="position:absolute;left:8px;top:0;line-height:18px;font-size:12px;font-weight:600;color:var(--text-1)">${num(x.value)}</span>
          </div>
          ${x.delta !== undefined ? `<span style="width:76px;flex-shrink:0;text-align:right">${delta(x.delta)}</span>` : ''}
        </div>`;
    }).join('')}
    </div>`;
  }

  /** 多品种折线叠加（F11 历史对比） */
  function multiLine(series, o = {}) {
    const H = o.height || 260, W = 800;
    const padL = 46, padR = 16, padT = 16, padB = 26;
    const all = series.flatMap((s) => s.points.map((p) => Number(p.price))).filter((v) => !Number.isNaN(v));
    if (!all.length) return `<div class="empty" style="padding:32px"><p>暂无数据</p></div>`;
    let min = Math.min(...all), max = Math.max(...all);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.14; min -= pad; max += pad;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const maxLen = Math.max(...series.map((s) => s.points.length));
    const X = (i) => padL + (maxLen <= 1 ? innerW / 2 : (i / (maxLen - 1)) * innerW);
    const Y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;

    const palette = ['#0A9396', '#E5484D', '#F5A623', '#2F7ED8', '#8B5CF6', '#30A46C'];
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = min + ((max - min) * i) / 4, y = Y(v);
      grid += `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>`;
      grid += `<text class="axis-label" x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(v >= 100 ? 0 : 1)}</text>`;
    }
    const base = series[0];
    const step = Math.max(1, Math.ceil(base.points.length / 7));
    let xLabels = '';
    base.points.forEach((p, i) => {
      if (i % step !== 0 && i !== base.points.length - 1) return;
      xLabels += `<text class="axis-label" x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(dateShort(p.date))}</text>`;
    });

    const paths = series.map((s, si) => {
      const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(Number(p.price)).toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${palette[si % palette.length]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');

    return `<div>
      <div class="chart-host"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="多品种趋势对比">${grid}${xLabels}${paths}</svg></div>
      <div class="chips" style="margin-top:10px">
        ${series.map((s, si) => `<span class="chip" style="cursor:default;border-color:${palette[si % palette.length]};color:${palette[si % palette.length]}">
          <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${palette[si % palette.length]};margin-right:5px"></span>
          ${esc(s.species)} ${s.changePct != null ? (s.changePct > 0 ? '▲' : '▼') + Math.abs(s.changePct).toFixed(1) + '%' : ''}
        </span>`).join('')}
      </div>
    </div>`;
  }

  /** 省份价格档位分布环（地图页概览） */
  function tierDonut(counts, o = {}) {
    const size = o.size || 132, r = size / 2 - 12, cx = size / 2, cy = size / 2;
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const order = ['low', 'mid', 'high', 'na'];
    let acc = -Math.PI / 2;
    let arcs = '';
    for (const k of order) {
      const v = counts[k] || 0;
      if (!v) continue;
      const ang = (v / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
      const x2 = cx + r * Math.cos(acc + ang), y2 = cy + r * Math.sin(acc + ang);
      const large = ang > Math.PI ? 1 : 0;
      arcs += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z"
        fill="${TIER_HEX[k]}" stroke="var(--surface)" stroke-width="2"/>`;
      acc += ang;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="价格档位分布">
      ${arcs}
      <circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="var(--surface)"/>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="19" font-weight="700" fill="var(--text-1)" font-family="var(--font-num)">${total}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="10.5" fill="var(--text-3)">省级行政区</text>
    </svg>`;
  }

  // ── 地图渲染 ──────────────────────────────────────────────────────────
  /**
   * 全国省级行政区价格分布图（中国地图形状的省界拼色图 / choropleth）
   *
   * 依据说明书 3.1「地图选省」——以省界多边形按「低/中/高」三档填色，
   * 使用等距圆柱投影（经纬度线性映射），零第三方地图库、零外部瓦片依赖。
   *
   * 边界数据来源：自然资源部标准地图服务体系的省级行政区划界线
   * （经 shared/data/china-provinces.json 预简化至约 5100 个坐标点，80% 压缩率）。
   * 该数据含台湾省、香港特别行政区、澳门特别行政区及南海诸岛，符合国家版图规范。
   *
   * @param {Array} provinces  后端 /api/map/provinces 返回的省份数组
   * @param {object} o         { height, focus, showLabels, geo }
   */
  function provinceMap(provinces, o = {}) {
    const geo = o.geo || (typeof window !== 'undefined' && window.YJT_CHINA_GEO) || null;
    // 无边界数据时退化为点位图（保证功能不中断）
    if (!geo || !geo.provinces || !geo.provinces.length) return pointMap(provinces, o);

    const H = o.height || 520;   // viewBox 宽度由版图比例自适应推导（见下方 VW）

    /**
     * 主图包围盒：大陆 + 海南岛 + 台湾岛等主要陆地，不含南海诸岛（含三沙市岛礁）。
     *
     * 关键点：海南省行政区包含三沙市，其环最南达北纬 7.3°（曾母暗沙一带）。
     * 若把这些岛礁并入主图，大陆会被纵向压到画布上半部、下方大块空白。
     * 标准中国地图的通行做法是「主图只画大陆与主要岛屿，南海诸岛单列附图」，
     * 本实现遵循该惯例：主图按北纬 17.5° 以上取界，南海诸岛由右下角附图框呈现。
     */
    const MAIN_LAT_FLOOR = 17.5;   // 主图南界：海南岛南端（约 18.1°N）之下留少量余量
    let minLng = 1e9, maxLng = -1e9, minLat = 1e9, maxLat = -1e9;
    for (const gp of geo.provinces) {
      for (const ring of gp.rings) {
        for (const [lng, lat] of ring) {
          if (lat < MAIN_LAT_FLOOR) continue;   // 跳过南海岛礁，交由附图呈现
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }

    // 等距圆柱投影：经度→X，纬度→Y（翻转使北在上）
    // 纬度方向做 cos 修正，避免高纬（东北、新疆）被纵向拉伸
    const latMid = (minLat + maxLat) / 2;
    const kx = Math.cos((latMid * Math.PI) / 180);
    const geoW = (maxLng - minLng) * kx;
    const geoH = maxLat - minLat;

    /**
     * 画布尺寸与投影比例。
     *
     * viewBox 宽度固定为 800，高度由「版图长宽比 × 可用宽度」反推，
     * 使版图在容器内既铺满横向、又不会纵向留白。
     * 容器通过 CSS 让 svg 填满卡片高度，再由 preserveAspectRatio 居中。
     */
    const VW = 800;
    const padX = 14, padTop = 12, padBottom = 12;
    const availW = VW - padX * 2;
    const scale = availW / geoW;               // 以宽度为基准铺满
    const drawW = geoW * scale, drawH = geoH * scale;
    // 自适应 viewBox 高度：版图高度 + 上下留白（不小于容器传入值的一半，避免过扁）
    const VH = Math.max(Math.round(drawH + padTop + padBottom), Math.round(H * 0.68));
    const offX = padX;
    const offY = padTop + (VH - padTop - padBottom - drawH) / 2;

    const X = (lng) => offX + (lng - minLng) * kx * scale;
    const Y = (lat) => offY + (maxLat - lat) * scale;

    // 价格档位 → 填充色；无数据用灰
    const byName = new Map(provinces.map((p) => [p.name, p]));
    const stableId = 'cm' + Math.abs(hashStr(provinces.map((p) => p.name + p.avgPrice).join('|'))) % 1e6;

    // ── 省级多边形路径 ────────────────────────────────────────────────
    /**
     * 环裁切：只保留 MAIN_LAT_FLOOR 以北的环（用于主图）。
     * 海南省的环包含三沙市岛礁（最南至 7.3°N），若整体投影会伸到画布外，
     * 故主图仅绘制北纬 17.5° 以上的部分（海南岛本岛），岛礁由附图框呈现。
     */
    const ringsForMain = (rings) => rings
      .map((ring) => ring.filter(([, lat]) => lat >= MAIN_LAT_FLOOR))
      .filter((ring) => ring.length >= 3);

    const shapes = geo.provinces.map((gp) => {
      const p = byName.get(gp.name);
      const has = p && p.hasData;
      const fill = has ? TIER_HEX[p.tier.tier] : VAR_NA;
      const isFocus = o.focus && p && p.name === o.focus;
      const mainRings = ringsForMain(gp.rings);
      // 每省用一条 path（多个环用 M...Z 串接，evenodd 处理岛屿与湖泊）
      const d = mainRings.map((ring) => 'M' + ring.map(([lng, lat]) => `${X(lng).toFixed(1)},${Y(lat).toFixed(1)}`).join('L') + 'Z').join(' ');
      if (!d) return '';   // 全部岛礁在附图范围内的省份不参与主图
      const label = p && p.hasData ? p.short : (p ? p.short : gp.name.replace(/(省|市|自治区|特别行政区|维吾尔|壮族|回族)/g, ''));
      // 标签位置：用最大环的形心附近（避免落在岛屿上）
      const main = mainRings.reduce((a, r) => (r.length > a.length ? r : a), mainRings[0]);
      const cen = ringCentroid(main);
      const showLabel = o.showLabels !== false && cen;
      return `<g class="prov-shape" data-province="${esc(gp.name)}" data-short="${esc(label)}" style="cursor:pointer">
        <path d="${d}" fill="${fill}" fill-opacity="${has ? 0.82 : 0.5}"
              stroke="${isFocus ? '#005F73' : '#FFFFFF'}" stroke-width="${isFocus ? 2.2 : 1.1}"
              stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        ${showLabel ? `<text x="${X(cen[0]).toFixed(1)}" y="${Y(cen[1]).toFixed(1)}" text-anchor="middle"
              dominant-baseline="middle" font-size="${labelFontSize(label)}" font-weight="600"
              fill="${has ? '#FFFFFF' : VAR_TEXT2}" style="pointer-events:none;
              paint-order:stroke;stroke:rgba(0,0,0,.28);stroke-width:2.2px;stroke-linejoin:round">${esc(label)}</text>` : ''}
        <title>${esc(gp.name)}${p && p.hasData
        ? `　${num(p.avgPrice)} 元/公斤（${p.tier.label}）${p.changePct != null ? `　较前日 ${pctText(p.changePct)}` : ''}`
        : '　暂无数据'}</title>
      </g>`;
    }).join('');

    // ── 国界 / 海岸线轮廓（学术规范：国家外轮廓以 distinct 描边强调，
    //     与省界内部白线区分；采用「白底 casing + 浅青主线」双层描边，
    //     取自 geo.nationalOutline，仅取主图范围（北纬 17.5° 以上）。）──────
    const coastLines = (geo.nationalOutline || [])
      .map((ring) => ring.filter(([, lat]) => lat >= MAIN_LAT_FLOOR))
      .filter((ring) => ring.length >= 2)
      .map((ring) => 'M' + ring.map(([lng, lat]) => `${X(lng).toFixed(1)},${Y(lat).toFixed(1)}`).join('L'))
      .join(' ');
    const coastline = coastLines ? `
      <path d="${coastLines}" fill="none" stroke="#FFFFFF" stroke-width="3.4" pointer-events="none"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.92"/>
      <path d="${coastLines}" fill="none" stroke="#4A6B75" stroke-width="1.5" pointer-events="none"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : '';

    // ── 南海诸岛附图框（标准地图惯例：右下角独立小框）──────────────────
    // 主图只画省级行政区陆地范围，南海诸岛与九段线在此框内单独呈现，
    // 既符合国家版图完整性要求，又避免大陆主体被纵向压缩。
    const inset = (() => {
      const boxW = Math.min(96, VW * 0.13);
      const boxH = boxW * 1.34;
      const bx = VW - boxW - 12, by = VH - boxH - 12;
      // 南海海域范围：北纬 3–24°，东经 105–123°
      const sLng = 105, eLng = 123, sLat = 3.2, nLat = 23.5;
      const insetKx = Math.cos(((sLat + nLat) / 2 * Math.PI) / 180);
      const ax = bx + 8, ay = by + 17;
      const aw = boxW - 16, ah = boxH - 25;
      const sc = Math.min(aw / ((eLng - sLng) * insetKx), ah / (nLat - sLat));
      const sx = (lng) => ax + (lng - sLng) * insetKx * sc;
      const sy = (lat) => ay + (nLat - lat) * sc;
      const toPath = (rings) => rings
        .map((ring) => 'M' + ring.map(([lng, lat]) => `${sx(lng).toFixed(1)},${sy(lat).toFixed(1)}`).join('L') + 'Z')
        .join(' ');
      const paths = (geo.islands || []).length ? toPath(geo.islands) : '';
      const hainan = geo.provinces.find((p) => p.name === '海南省');
      // 海南全省（含三沙市岛礁）完整绘入附图，保证南海海域版图完整
      const hn = hainan ? toPath(hainan.rings) : '';
      const guangdong = geo.provinces.find((p) => p.name === '广东省');
      const gd = guangdong ? toPath(guangdong.rings) : '';
      return `<g class="map-inset" style="pointer-events:none">
        <rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="5"
              fill="${VAR_SURFACE}" fill-opacity="0.95" stroke="${VAR_BORDER}" stroke-width="1"/>
        <text x="${bx + boxW / 2}" y="${by + 11}" text-anchor="middle" font-size="${Math.max(8, boxW * 0.095)}"
              fill="${VAR_TEXT2}" font-weight="600">南海诸岛</text>
        ${gd ? `<path d="${gd}" fill="${VAR_NA}" fill-opacity="0.42" stroke="${VAR_BORDER}" stroke-width="0.5"/>` : ''}
        ${hn ? `<path d="${hn}" fill="${VAR_NA}" fill-opacity="0.5" stroke="${VAR_BORDER}" stroke-width="0.5"/>` : ''}
        ${paths ? `<path d="${paths}" fill="${VAR_TEXT2}" fill-opacity="0.62"/>` : ''}
      </g>`;
    })();

    return `<svg viewBox="0 0 ${VW} ${VH}" class="province-map china-map" role="img"
        aria-label="全国省级行政区价格分布图（按低中高三档填色）" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto">
      <defs>
        <linearGradient id="${stableId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${VAR_BG}"/><stop offset="100%" stop-color="${VAR_SURFACE2}"/>
        </linearGradient>
        <filter id="${stableId}f" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#0B1F24" flood-opacity="0.10"/>
        </filter>
      </defs>
      <rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#${stableId})" rx="12"/>
      <g filter="url(#${stableId}f)">${shapes}</g>
      ${coastline}
      ${inset}
    </svg>`;
  }

  /** 环的形心（用面积加权，比顶点平均更稳） */
  function ringCentroid(ring) {
    if (!ring || ring.length < 3) return null;
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f;
      cx += (ring[j][0] + ring[i][0]) * f;
      cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (Math.abs(a) < 1e-9) return null;
    a *= 0.5;
    return [cx / (6 * a), cy / (6 * a)];
  }

  /** 省份标签字号：名称长的省份缩小，避免溢出轮廓 */
  function labelFontSize(label) {
    if (!label) return 9;
    if (label.length <= 2) return 11.5;
    if (label.length === 3) return 10;
    if (label.length === 4) return 9;
    return 8;
  }

  /** 字符串哈希（用于生成稳定的 defs id，避免每帧变化导致滤镜重算） */
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
  }

  // 主题色变量（SVG 内联属性不能直接用 var() 的地方用这些兜底）
  const VAR_BG = 'var(--brand-softer, #F1F9FA)';
  const VAR_SURFACE = 'var(--surface, #FFFFFF)';
  const VAR_SURFACE2 = 'var(--surface-2, #F2F7F8)';
  const VAR_BORDER = 'var(--border, #E2EAEB)';
  const VAR_TEXT2 = 'var(--text-2, #6B7280)';
  const VAR_NA = '#C7D2D6';

  /**
   * 兜底：省份点位图（无边界数据时使用，保证地图区块不空白）
   * 按经纬度等距投影绘制点位，颜色 = 价格档位。
   */
  function pointMap(provinces, o = {}) {
    const W = 800, H = o.height || 520;
    const pad = 40;
    const lngs = provinces.map((p) => p.lng), lats = provinces.map((p) => p.lat);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const X = (lng) => pad + ((lng - minLng) / (maxLng - minLng)) * (W - pad * 2);
    const Y = (lat) => H - pad - ((lat - minLat) / (maxLat - minLat)) * (H - pad * 2);

    const gid = 'map' + Math.random().toString(36).slice(2, 7);
    const withData = provinces.filter((p) => p.hasData);
    const maxPrice = Math.max(...withData.map((p) => p.avgPrice), 1);
    const minPrice = Math.min(...withData.map((p) => p.avgPrice), 0);

    const dots = provinces.map((p) => {
      const cx = X(p.lng).toFixed(1), cy = Y(p.lat).toFixed(1);
      const color = p.hasData ? TIER_HEX[p.tier.tier] : VAR_NA;
      const t = p.hasData ? (p.avgPrice - minPrice) / (maxPrice - minPrice || 1) : 0;
      const rr = p.hasData ? 6 + t * 7 : 5;
      return `<g class="prov-dot" data-province="${esc(p.name)}" data-short="${esc(p.short)}" style="cursor:pointer">
        <circle cx="${cx}" cy="${cy}" r="${(rr + 6).toFixed(1)}" fill="${color}" fill-opacity="0.16"/>
        <circle cx="${cx}" cy="${cy}" r="${rr.toFixed(1)}" fill="${color}" stroke="#FFFFFF" stroke-width="1.6"/>
        <text x="${cx}" y="${(Number(cy) - rr - 5).toFixed(1)}" text-anchor="middle" font-size="10.5"
          fill="${VAR_TEXT2}" style="pointer-events:none;font-weight:600">${esc(p.short)}</text>
        <title>${esc(p.name)}${p.hasData ? `　${num(p.avgPrice)} 元/公斤（${p.tier.label}）` : '　暂无数据'}</title>
      </g>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" class="province-map" role="img" aria-label="全国省级行政区价格分布图">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${VAR_BG}"/><stop offset="100%" stop-color="${VAR_SURFACE2}"/>
      </linearGradient></defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${gid})" rx="12"/>
      ${dots}
    </svg>`;
  }

  // ── 图表交互绑定（Tooltip）────────────────────────────────────────────
  function bindChartTips(root = document) {
    root.querySelectorAll('.chart-host').forEach((host) => {
      if (host._tipBound) return;
      host._tipBound = true;
      const tip = host.querySelector('.chart-tip');
      if (!tip) return;
      host.querySelectorAll('.hotspot').forEach((sp) => {
        sp.addEventListener('mouseenter', () => {
          const rect = host.getBoundingClientRect();
          const svg = host.querySelector('svg');
          const vb = svg.viewBox.baseVal;
          const sx = rect.width / vb.width;
          const sy = rect.height / vb.height;
          tip.textContent = sp.getAttribute('data-tip');
          tip.style.left = (Number(sp.getAttribute('data-x')) * sx) + 'px';
          tip.style.top = (Number(sp.getAttribute('data-y')) * sy) + 'px';
          tip.style.opacity = '1';
        });
        sp.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
      });
    });
  }

  // ── 空状态插画（波浪 + 鱼，说明书 8.6）────────────────────────────────
  function emptyIllustration(kind = 'default') {
    const wave = `<path d="M0 34 Q22 22 44 34 T88 34 T132 34 T176 34" fill="none" stroke="var(--brand-2)" stroke-width="2" stroke-linecap="round" opacity=".5"/>`;
    const fish = `<path d="M52 30 C58 20, 74 18, 84 26 L96 18 L94 32 L104 40 L92 44 C82 52, 62 50, 54 40 Z" fill="var(--brand-2)" opacity=".28"/>
      <circle cx="66" cy="32" r="2.2" fill="var(--brand-deep)" opacity=".55"/>`;
    if (kind === 'search') {
      return `<svg width="176" height="88" viewBox="0 0 176 88">${wave}
        <circle cx="82" cy="36" r="18" fill="none" stroke="var(--brand-2)" stroke-width="2.6" opacity=".55"/>
        <line x1="95" y1="49" x2="112" y2="66" stroke="var(--brand-2)" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>
        <circle cx="76" cy="30" r="2.4" fill="var(--brand-deep)" opacity=".4"/></svg>`;
    }
    if (kind === 'map') {
      return `<svg width="176" height="88" viewBox="0 0 176 88">${wave}
        <path d="M60 44 C60 30, 76 24, 88 30 C100 24, 116 30, 116 44 Z" fill="var(--brand-2)" opacity=".22"/>
        <circle cx="88" cy="28" r="6" fill="none" stroke="var(--brand-2)" stroke-width="2.2" opacity=".6"/>
        <path d="M88 34 L88 50" stroke="var(--brand-deep)" stroke-width="2.4" stroke-linecap="round" opacity=".5"/></svg>`;
    }
    return `<svg width="176" height="88" viewBox="0 0 176 88">${wave}${fish}</svg>`;
  }

  function empty({ title = '暂无数据', desc = '', action = '', kind = 'default' }) {
    return `<div class="empty">
      ${emptyIllustration(kind)}
      <h3>${esc(title)}</h3>
      ${desc ? `<p>${desc}</p>` : ''}
      ${action}
    </div>`;
  }

  // ── Toast ─────────────────────────────────────────────────────────────
  function toastHost() {
    let host = document.querySelector('.toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
    return host;
  }
  function toast(msg, type = '', ms = 2600) {
    const host = toastHost();
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, ms);
  }

  // ── 主题 ─────────────────────────────────────────────────────────────
  const Theme = {
    get current() { return YJT.LS.get(YJT.KEYS.theme, 'light') || 'light'; },
    apply(t) {
      const theme = t || Theme.current;
      document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : theme);
      YJT.LS.set(YJT.KEYS.theme, theme);
      document.dispatchEvent(new CustomEvent('yjt:theme', { detail: theme }));
      return theme;
    },
    cycle() {
      const order = ['light', 'dark', 'academic'];
      const next = order[(order.indexOf(Theme.current) + 1) % order.length];
      return Theme.apply(next);
    },
    labels: { light: '浅色', dark: '深色', academic: '学术白底' },
  };

  // ── 骨架屏 ───────────────────────────────────────────────────────────
  function skeletonCards(n = 6, h = 92) {
    return `<div class="species-grid">${Array.from({ length: n }).map(() =>
      `<div class="card"><div class="skeleton" style="height:${h}px"></div></div>`).join('')}</div>`;
  }
  function skeletonTable(rows = 8) {
    return `<div class="card">${Array.from({ length: rows }).map(() =>
      `<div class="skeleton" style="height:20px;margin-bottom:10px"></div>`).join('')}</div>`;
  }

  // ── 头像首字母 ───────────────────────────────────────────────────────
  function initials(user) {
    const s = (user && (user.nickname || user.email)) || '游';
    return esc(String(s).trim().charAt(0).toUpperCase());
  }

  global.YJT = global.YJT || {};
  Object.assign(global.YJT, {
    esc, num, int, pctText, deltaClass, dateShort, dateFull, dtText,
    delta, tierBadge, priceBlock, stat,
    lineChart, sparkline, barRank, multiLine, tierDonut, provinceMap, pointMap, ringCentroid, bindChartTips,
    empty, emptyIllustration, toast, toastHost,
    Theme, skeletonCards, skeletonTable, initials,
    TIER_HEX, TIER_COLOR,
  });
})(window);
