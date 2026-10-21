const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/岳思雨/WorkBuddy/2026-10-16-21-24-30/yujiacha';
const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/data/china-100000-full.json'), 'utf8'));

// 1. 计算经纬度总包围盒（用作投影参考，前端按同一范围投影以保持形状）
let minLng = 1e9, maxLng = -1e9, minLat = 1e9, maxLat = -1e9;
const walk = (arr, fn) => { if (typeof arr[0] === 'number') fn(arr); else arr.forEach((a) => walk(a, fn)); };
g.features.forEach((f) => walk(f.geometry.coordinates, ([x, y]) => {
  if (x < minLng) minLng = x; if (x > maxLng) maxLng = x;
  if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
}));

// 2. 简化：按最小面积阈值 + 抽稀（Douglas-Peucker 简化，容差可调）
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
  }
  return Math.abs(a / 2);
}
function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(x - x1, y - y1);
  let t = ((x - x1) * dx + (y - y1) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > tol) {
    const l = simplify(pts.slice(0, idx + 1), tol);
    const r = simplify(pts.slice(idx), tol);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

const TOL = 0.055;          // 约 1.2km 容差，视觉几乎无差
const MIN_AREA = 0.004;    // 过滤极小岛屿，保留主要轮廓与南海诸岛关键点

const out = { bbox: [minLng, minLat, maxLng, maxLat], provinces: [], islands: null };
let before = 0, after = 0;

for (const f of g.features) {
  const name = f.properties.name;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const kept = [];
  for (const poly of polys) {
    const outer = poly[0];
    before += outer.length;
    if (ringArea(outer) < MIN_AREA) { after += 1; continue; }
    const s = simplify(outer, TOL);
    after += s.length;
    kept.push(s.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]));
  }
  if (!name) { out.islands = kept; continue; }   // 空名要素 = 南海诸岛等
  out.provinces.push({ name, rings: kept });
}

// ── 国界 / 海岸线轮廓抽取（学术规范：用边共享检测求「国家外轮廓」）────────
// 方法：在原始全分辨率数据上，统计每条无向边出现的次数。
//   · 出现 2 次 = 相邻两省的省界（内部边界，不画）
//   · 出现 1 次 = 仅属于一个省的海岸线或国际陆界 → 国家轮廓
// 原始 GeoJSON 的省界坐标严格共享（datav 100000_full），故 2 位小数量化即可精确配对。
// 该轮廓含台湾省、海南岛、沿海岛屿的闭合环，以及与国际接壤的陆界，符合标准地图规范。
function qk(p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }
const edgeCount = new Map();
const outerRings = [];
for (const f of g.features) {
  if (!f.properties.name) continue;            // 空名要素（南海诸岛）不计入主图轮廓
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const outer = poly[0];                       // 仅取外环，湖泊等内环（洞）不计入
    outerRings.push(outer);
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      const k = qk(a) < qk(b) ? qk(a) + '|' + qk(b) : qk(b) + '|' + qk(a);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
}
const boundaryEdges = [];
for (const f of g.features) {
  if (!f.properties.name) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const outer = poly[0];
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      const k = qk(a) < qk(b) ? qk(a) + '|' + qk(b) : qk(b) + '|' + qk(a);
      if (edgeCount.get(k) === 1) boundaryEdges.push([a, b]);
    }
  }
}
// 链式拼接边界边 → 多条折线（大陆闭环 + 海南闭环 + 台湾闭环 + 沿海岛屿小环）
const coordOf = new Map();
for (const e of boundaryEdges) { coordOf.set(qk(e[0]), e[0]); coordOf.set(qk(e[1]), e[1]); }
const neighbors = new Map();
for (const [a, b] of boundaryEdges) {
  const ka = qk(a), kb = qk(b);
  (neighbors.get(ka) || neighbors.set(ka, []).get(ka)).push(kb);
  (neighbors.get(kb) || neighbors.set(kb, []).get(kb)).push(ka);
}
const usedPair = new Set();
const pairKey = (x, y) => (x < y ? x + '|' + y : y + '|' + x);
const outlineRaw = [];
for (const [a, b] of boundaryEdges) {
  const ka = qk(a), kb = qk(b), pk = pairKey(ka, kb);
  if (usedPair.has(pk)) continue;
  const line = [a];
  let cur = kb;
  usedPair.add(pk); line.push(b);
  while (true) {
    const nbrs = neighbors.get(cur) || [];
    let next = null;
    for (const nb of nbrs) { if (!usedPair.has(pairKey(cur, nb))) { next = nb; break; } }
    if (!next) break;
    usedPair.add(pairKey(cur, next));
    line.push(coordOf.get(next));
    cur = next;
  }
  outlineRaw.push(line);
}
// 对每条折线做 DP 简化（海岸线更平滑），闭合环补回首点
const TOL_OUT = 0.05;
const nationalOutline = outlineRaw.map((line) => {
  const s = simplify(line, TOL_OUT);
  const closed = qk(s[0]) === qk(s[s.length - 1]);
  const ring = closed ? s.concat([s[0]]) : s;
  return ring.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
}).filter((r) => r.length >= 2);
out.nationalOutline = nationalOutline;

const json = JSON.stringify(out);
const target = path.join(ROOT, 'shared/data/china-provinces.json');
fs.writeFileSync(target, json, 'utf8');
const jsTarget = path.join(ROOT, 'shared/data/china-provinces.js');
const banner = `/* ============================================================================
   渔价查 · 中国省级行政区边界数据（已简化）

   来源：自然资源部标准地图服务体系的省级行政区划界线
        （datav.aliyun.com 提供的标准地理边界，含台湾省、香港特别行政区、
          澳门特别行政区及南海诸岛，符合国家版图规范）
   处理：等距圆柱投影下按 Douglas-Peucker 抽稀（省界多边形 + 国家轮廓）
   用途：每日渔价地图「全国价格档位分布」中国地图形状省界拼色图（choropleth）
   ============================================================================ */
`;
fs.writeFileSync(jsTarget, banner + 'window.YJT_CHINA_GEO = ' + json + ';\n', 'utf8');
console.log('原始点数', before, '→ 简化后', after, `(${(100 - after / before * 100).toFixed(1)}% 压缩)`);
console.log('输出', (Buffer.byteLength(json) / 1024).toFixed(0) + 'KB');
console.log('bbox', out.bbox.map((v) => v.toFixed(2)).join(', '));
console.log('省份数', out.provinces.length, '| 南海诸岛环数', out.islands ? out.islands.length : 0);
const multi = out.provinces.filter((p) => p.rings.length > 1).length;
console.log('多岛省份', multi, '个（如浙江、福建、广东等）');
console.log('国家轮廓折线', out.nationalOutline.length, '条（大陆闭环 + 海南 + 台湾 + 沿海岛屿，含国际陆界与海岸线）');
console.log('已生成 china-provinces.json 与 china-provinces.js');
