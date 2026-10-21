/**
 * 导出与分享服务（F8）
 *  - CSV 导出（日报 / 榜单 / 品种明细），带 UTF-8 BOM 以便 Excel 直接打开
 *  - SVG 长图分享卡（自绘，零依赖，可截图分享）
 *  - PDF：使用浏览器打印样式产出（前端 调用 window.print），后端提供打印友好 HTML
 *  - 审批门禁：教研 / 政府 / 管理员可导出（对应 PRD 2 权限差异表）
 */
const { ApiError } = require('../lib/http');
const price = require('./price-service');

/** CSV 字段转义 */
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.map((h) => csvCell(h.label)).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(h.get(r))).join(','));
  // BOM：让 Excel 正确识别 UTF-8 中文
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/** 日报 CSV（按省份 / 按品种） */
async function reportCsv({ date = null, dimension = 'province' } = {}) {
  const rep = await price.dailyReport({ date, dimension });
  if (dimension === 'species') {
    const headers = [
      { label: '名次', get: (r) => r.rank },
      { label: '品种', get: (r) => r.species },
      { label: '大类', get: (r) => r.category },
      { label: '均价(元/公斤)', get: (r) => r.avgPrice },
      { label: '最低价(元/公斤)', get: (r) => r.minPrice },
      { label: '最高价(元/公斤)', get: (r) => r.maxPrice },
      { label: '较前日涨跌幅(%)', get: (r) => r.changePct },
      { label: '覆盖省份数', get: (r) => r.provinceCount },
      { label: '覆盖市场数', get: (r) => r.marketCount },
      { label: '价格档位', get: (r) => (r.tier ? r.tier.label : '') },
    ];
    const csv = toCsv(headers, rep.bySpecies || []);
    return { filename: `鱼价查_品种榜_${rep.date}.csv`, csv, meta: { date: rep.date, dimension, count: (rep.bySpecies || []).length } };
  }
  const headers = [
    { label: '名次', get: (r) => r.rank },
    { label: '省级行政区', get: (r) => r.province },
    { label: '当日综合均价(元/公斤)', get: (r) => r.avgPrice },
    { label: '折合(元/斤)', get: (r) => (r.avgPrice == null ? '' : (r.avgPrice / 2).toFixed(2)) },
    { label: '较昨日涨跌幅(%)', get: (r) => r.changePct },
    { label: '覆盖品种数', get: (r) => r.speciesCount },
    { label: '覆盖市场数', get: (r) => r.marketCount },
    { label: '记录条数', get: (r) => r.recordCount },
    { label: '领涨品种', get: (r) => (r.leadUp ? r.leadUp.species : '') },
    { label: '领涨幅度(%)', get: (r) => (r.leadUp ? r.leadUp.changePct : '') },
    { label: '价格档位', get: (r) => (r.tier ? r.tier.label : '') },
    { label: '采集批次号', get: () => rep.filterBar.batchNo || '' },
    { label: '数据来源', get: () => rep.status.source || '' },
  ];
  return {
    filename: `鱼价查_全国日报_${rep.date}.csv`,
    csv: toCsv(headers, rep.rows),
    meta: {
      date: rep.date, dimension: 'province', count: rep.rows.length,
      marketCount: rep.filterBar.marketCount, recordCount: rep.filterBar.recordCount, batchNo: rep.filterBar.batchNo,
    },
  };
}

/** 品种明细 CSV 导出（含来源 URL 与采集批次，可审计） */
async function speciesCsv({ species, province = null, days = 30 } = {}) {
  const det = await price.speciesDetail(species, { province, days });
  const headers = [
    { label: '日期', get: (r) => r.date },
    { label: '省份', get: (r) => r.province },
    { label: '批发市场', get: (r) => r.market },
    { label: '价格(元/公斤)', get: (r) => r.price },
    { label: '规格', get: (r) => r.spec },
    { label: '单位', get: (r) => r.unit },
    { label: '采集批次号', get: (r) => r.batchNo },
    { label: '采集时间', get: (r) => r.collectedAt },
    { label: '来源URL', get: (r) => r.sourceUrl },
  ];
  return {
    filename: `鱼价查_${det.species}_${det.date}.csv`,
    csv: toCsv(headers, det.quotes),
    meta: { species: det.species, province: det.province, count: det.quotes.length, source: det.source },
  };
}

/** 关注列表 CSV */
async function watchCsv(uid) {
  const account = require('./account-service');
  const w = await account.listWatches(uid);
  const headers = [
    { label: '品种', get: (r) => r.species },
    { label: '地区', get: (r) => r.scope },
    { label: '最新价(元/公斤)', get: (r) => r.price },
    { label: '较前日涨跌幅(%)', get: (r) => r.changePct },
    { label: '涨阈值(%)', get: (r) => r.thresholdUp },
    { label: '跌阈值(%)', get: (r) => r.thresholdDown },
    { label: '推送通道', get: (r) => r.notifyChannel },
  ];
  return { filename: `鱼价查_我的关注_${w.date}.csv`, csv: toCsv(headers, w.items), meta: { count: w.items.length, date: w.date } };
}

// ── SVG 分享长图（F8 生成可分享长图）────────────────────────────────────
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TIER_COLORS = { low: '#6FA8DC', mid: '#F4C361', high: '#E98B7B', na: '#C3CDD4' };
const deltaColor = (v) => (v == null ? '#93A0AC' : v > 0 ? '#E0503C' : v < 0 ? '#30A46C' : '#93A0AC');
const deltaText = (v) => (v == null ? '—' : `${v > 0 ? '▲' : v < 0 ? '▼' : '—'} ${Math.abs(v).toFixed(2)}%`);

/** 生成日报分享长图（SVG） */
async function reportSvg({ date = null, top = 12 } = {}) {
  const rep = await price.dailyReport({ date });
  const rows = rep.rows.slice(0, top);
  const W = 900;
  const headerH = 210;
  const rowH = 46;
  const footerH = 130;
  const H = headerH + rows.length * rowH + footerH;

  const barMax = Math.max(...rows.map((r) => r.avgPrice || 0), 1);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'PingFang SC','Microsoft YaHei',sans-serif">`);
  parts.push(`<defs>
    <linearGradient id="hd" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#005F73"/><stop offset="1" stop-color="#0A9396"/>
    </linearGradient>
  </defs>`);
  // 背景
  parts.push(`<rect width="${W}" height="${H}" fill="#F7FAFA"/>`);
  // 头部
  parts.push(`<rect x="0" y="0" width="${W}" height="${headerH}" fill="url(#hd)"/>`);
  parts.push(`<text x="40" y="62" fill="#FFFFFF" font-size="34" font-weight="700">鱼价查 · 全国水产品价格日报</text>`);
  parts.push(`<text x="40" y="100" fill="#B8E4E8" font-size="17">数据日期 ${esc(rep.date)}　|　覆盖市场 ${rep.filterBar.marketCount} 家　|　记录 ${Number(rep.filterBar.recordCount).toLocaleString()} 条</text>`);
  parts.push(`<text x="40" y="130" fill="#B8E4E8" font-size="14">采集批次号 ${esc(rep.filterBar.batchNo || '—')}（可审计）　·　来源：农业农村部全国农产品价格信息系统</text>`);
  // 概览三卡
  const cards = [
    { label: '全国综合均价', value: rep.overview.nationalAvg ? `${rep.overview.nationalAvg} 元/公斤` : '—', color: '#FFFFFF' },
    { label: '上涨省份', value: `${rep.overview.upCount} 个`, color: '#FFC9C4' },
    { label: '下跌省份', value: `${rep.overview.downCount} 个`, color: '#B9F0CE' },
    { label: '最高均价省份', value: rep.overview.maxProvince ? `${rep.overview.maxProvince.short}` : '—', color: '#FFE3B0' },
  ];
  cards.forEach((c, i) => {
    const x = 40 + i * 208;
    parts.push(`<rect x="${x}" y="146" width="192" height="46" rx="8" fill="#FFFFFF" fill-opacity="0.14"/>`);
    parts.push(`<text x="${x + 14}" y="166" fill="#B8E4E8" font-size="12">${esc(c.label)}</text>`);
    parts.push(`<text x="${x + 14}" y="185" fill="${c.color}" font-size="16" font-weight="700">${esc(c.value)}</text>`);
  });

  // 表头
  const y0 = headerH + 34;
  parts.push(`<text x="40" y="${y0}" fill="#1F2933" font-size="14" font-weight="700">名次</text>`);
  parts.push(`<text x="100" y="${y0}" fill="#1F2933" font-size="14" font-weight="700">省级行政区</text>`);
  parts.push(`<text x="270" y="${y0}" fill="#1F2933" font-size="14" font-weight="700">当日综合均价（元/公斤）</text>`);
  parts.push(`<text x="640" y="${y0}" fill="#1F2933" font-size="14" font-weight="700">较昨日</text>`);
  parts.push(`<text x="760" y="${y0}" fill="#1F2933" font-size="14" font-weight="700">档位</text>`);
  parts.push(`<line x1="40" y1="${y0 + 10}" x2="${W - 40}" y2="${y0 + 10}" stroke="#D8E3E4" stroke-width="1"/>`);

  // 数据行
  rows.forEach((r, i) => {
    const y = y0 + 40 + i * rowH;
    if (i % 2 === 1) parts.push(`<rect x="40" y="${y - 24}" width="${W - 80}" height="${rowH}" rx="6" fill="#FFFFFF"/>`);
    const rc = r.rank <= 3 ? '#E0503C' : '#1F2933';
    parts.push(`<text x="44" y="${y}" fill="${rc}" font-size="17" font-weight="700">${r.rank}</text>`);
    parts.push(`<text x="100" y="${y}" fill="#1F2933" font-size="16">${esc(r.province)}</text>`);
    const bw = Math.max(6, (r.avgPrice / barMax) * 260);
    parts.push(`<rect x="270" y="${y - 13}" width="${bw}" height="16" rx="4" fill="${TIER_COLORS[r.tier.tier] || '#0A9396'}" fill-opacity="0.22"/>`);
    parts.push(`<text x="278" y="${y}" fill="#0B4F57" font-size="16" font-weight="700">${r.avgPrice}</text>`);
    parts.push(`<text x="640" y="${y}" fill="${deltaColor(r.changePct)}" font-size="15" font-weight="600">${deltaText(r.changePct)}</text>`);
    parts.push(`<text x="760" y="${y}" fill="${TIER_COLORS[r.tier.tier]}" font-size="14" font-weight="600">${esc(r.tier.label)}</text>`);
  });

  // 脚注
  const fy = y0 + 40 + rows.length * rowH + 26;
  parts.push(`<line x1="40" y1="${fy - 26}" x2="${W - 40}" y2="${fy - 26}" stroke="#D8E3E4" stroke-width="1"/>`);
  parts.push(`<text x="40" y="${fy}" fill="#6B7280" font-size="12.5">口径：省级综合均价 = 该省监测水产市场主流品种当日报价的加权平均；内陆及高原省份因活鲜运输</text>`);
  parts.push(`<text x="40" y="${fy + 20}" fill="#6B7280" font-size="12.5">损耗、冷链与中转成本，均价通常高于沿海主产区。价格档位：低位 ≤26 元/斤 / 中位 26–36 / 高位 &gt;36。</text>`);
  parts.push(`<text x="40" y="${fy + 48}" fill="#0A9396" font-size="13" font-weight="700">鱼价查 · 智慧渔业全国水产品价格日报系统</text>`);
  parts.push(`<text x="${W - 40}" y="${fy + 48}" fill="#6B7280" font-size="12" text-anchor="end">数据来源：pfsc.agri.cn　T+0 当日发布</text>`);
  parts.push('</svg>');

  return { svg: parts.join('\n'), filename: `鱼价查_日报长图_${rep.date}.svg`, date: rep.date };
}

/**
 * 导出权限校验：对应 PRD 2 权限差异
 * 游客与普通用户不可导出；教研/政府/管理员可导出
 * @returns {{allowed:boolean, reason?:string}}
 */
function checkExportPermission(user) {
  const role = user ? user.role : 'guest';
  const perms = require('./account-service').ROLE_PERMS[role] || require('./account-service').ROLE_PERMS.guest;
  if (!perms.export) {
    return { allowed: false, reason: '导出功能面向教研师生、政府监测人员与管理员开放。当前账号暂无导出权限。' };
  }
  return { allowed: true };
}

module.exports = { reportCsv, speciesCsv, watchCsv, reportSvg, checkExportPermission, toCsv };
