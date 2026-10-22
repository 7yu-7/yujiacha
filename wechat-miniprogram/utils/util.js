// 鱼价查 · 格式化工具
function fmtPrice(v, d) {
  d = d == null ? 2 : d;
  if (v == null || v === '' || isNaN(Number(v))) return '—';
  return Number(v).toFixed(d);
}

// 涨跌百分比文本（带正负号）
function fmtPct(v) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

// 涨跌 CSS class：红涨绿跌
function clsPct(v) {
  if (v == null || Number(v) === 0) return 'flat';
  return Number(v) > 0 ? 'up' : 'down';
}

function fmtDate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

function fmtDt(s) {
  if (!s) return '';
  return String(s).slice(0, 16).replace('T', ' ');
}

module.exports = { fmtPrice, fmtPct, clsPct, fmtDate, fmtDt };
