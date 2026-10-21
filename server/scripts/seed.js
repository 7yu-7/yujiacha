/**
 * 演示数据生成器
 *
 * 生成内容：
 *  1) price_daily   —— 34 省级行政区 × 130 家批发市场 × 核心品种 × 22 个月历史时序
 *  2) daily_snapshot —— 每日快照与采集批次号（T+0 发布状态）
 *  3) app_user      —— 演示账户（管理员 / 教研 / 政府 / 普通用户）
 *  4) watch_item / alert_log —— 关注订阅与异动告警（F4 / F7）
 *
 * 价格模型（可复现，种子固定）：
 *   价格 = 品种基准价 × 区域价格指数 × 市场系数 × 季节因子 × 周内因子 × 趋势 × 随机扰动
 *   区域价格指数经「校准」后，使各省综合均价精确落在说明书三档区间：
 *   低位 ≤26 元/斤（沿海主产区） / 中位 26–36 / 高位 >36（内陆高原与西部边远地区）
 */
const crypto = require('crypto');
const { CATEGORIES, SPECIES, PROVINCES, MARKETS, SOURCE } = require('../src/data/dictionary');
const db = require('../src/lib/db');
const config = require('../src/config');
const { hashPassword } = require('../src/lib/crypto-util');

// ── 可复现随机数（mulberry32）──────────────────────────────────────────
function makeRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = makeRng('yujiacha-2026');
const jitter = (spread) => 1 + (rnd() * 2 - 1) * spread;

/** 由字符串确定性派生 [0,1) —— 用于「品种×日期」共享冲击，与生成顺序无关 */
function hash01(str) {
  const h = crypto.createHash('sha256').update(str).digest();
  return h.readUInt32BE(0) / 4294967296;
}

/**
 * 品种级 + 省份级日内共享冲击（零均值，±spread）
 *
 * 真实市场中，同一品种在同一天会受产地天气、到货量、捕捞季等因素影响出现跨市场
 * 同步涨跌；同时不同省份的供需与物流条件不同，涨跌方向也会分化。
 *
 * 因此 shock 的键取「品种 × 省份 × 日期」：
 *  - 同一省份内所有市场对同一品种同步（产地集货价统一）；
 *  - 不同省份相互独立（区域供需差异），使各省日环比自然分化，
 *    避免「全国省份同涨同跌」的失真结果。
 */
const SPECIES_DAILY_SPREAD = 0.030;
function speciesDailyShock(sp, provCode, dateStr) {
  return 1 + (hash01(`${sp.id}|${provCode}|${dateStr}`) * 2 - 1) * SPECIES_DAILY_SPREAD;
}

// ── 全国基准（由 28 个品种基准价均值决定，见字典说明）────────────────────
const BASKET_MEAN_KG = SPECIES.reduce((s, x) => s + x.base, 0) / SPECIES.length; // ≈63.2 元/公斤 = 31.6 元/斤

// 季节因子（月，1–12）：春节 / 中秋 / 国庆为消费高峰
const MONTH_FACTOR = [1.12, 1.15, 1.02, 0.98, 1.03, 0.96, 0.94, 0.98, 1.05, 1.09, 0.99, 1.04];
// 周内因子（0=周日 … 6=周六）：周末消费需求小幅抬升。
// 相邻日比值刻意贴近 1（均值 ≈1）——若周内跳变过大，会让所有省份同向涨跌而失去分化。
const DOW_FACTOR = [1.004, 0.998, 0.997, 0.999, 1.001, 1.003, 1.005];

// 节假日窗口加成（月-日区间）
const HOLIDAY_WINDOWS = [
  { from: [1, 20], to: [2, 20], factor: 1.06, name: '春节备货' },
  { from: [9, 20], to: [10, 8], factor: 1.05, name: '中秋国庆' },
  { from: [4, 28], to: [5, 5], factor: 1.03, name: '五一' },
  { from: [12, 25], to: [12, 31], factor: 1.03, name: '元旦' },
];

function seasonalFactor(d) {
  let f = MONTH_FACTOR[d.getMonth()];
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  for (const w of HOLIDAY_WINDOWS) {
    const a = w.from[0] * 100 + w.from[1];
    const b = w.to[0] * 100 + w.to[1];
    if (md >= a && md <= b) { f *= w.factor; break; }
  }
  return f;
}

// ── 品种在各省的可得性权重（沿海偏海水品种，内陆兼有淡水与高档海产）──────
function speciesWeight(sp, prov) {
  const marine = sp.cat !== 'danshui';
  return prov.coast
    ? (marine ? 1.0 : 0.55)
    : (marine ? (sp.base >= 100 ? 0.55 : 0.42) : 1.0);
}

// ── 每家市场经营的品种篮子（确定性抽样）────────────────────────────────
const MARKET_BASKETS = new Map();
function basketFor(market) {
  if (MARKET_BASKETS.has(market.id)) return MARKET_BASKETS.get(market.id);
  const prov = PROVINCES.find((p) => p.code === market.provinceCode);
  const n = market.level === 1 ? 18 : market.level === 2 ? 13 : 9;

  // 加权不放回抽样
  const pool = SPECIES.map((s) => ({ s, w: speciesWeight(s, prov) }));
  const chosen = [];
  while (chosen.length < n && pool.length) {
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = rnd() * total;
    let i = 0;
    for (; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) break; }
    const idx = Math.min(i, pool.length - 1);
    chosen.push(pool[idx].s);
    pool.splice(idx, 1);
  }
  MARKET_BASKETS.set(market.id, chosen);
  return chosen;
}

// ── 市场系数（同省内市场间的小幅差异：一级市场走量价优，三级市场加价）────
const MARKET_FACTOR = new Map();
for (const m of MARKETS) {
  const base = m.level === 1 ? 0.975 : m.level === 2 ? 1.0 : 1.032;
  MARKET_FACTOR.set(m.id, base * jitter(0.05));
}

// ── 区域校准系数：使各省「最新日期」综合均价 = BASKET_MEAN_KG × idx ────────
/**
 * 校准以最新日期为基准：把季节因子、周内因子、趋势因子一并纳入分母，
 * 这样当期（最新一天）各省均价精确落在说明书三档区间内；历史日期则随
 * 季节与趋势自然浮动（去年价格低于今年），符合真实价格序列形态。
 */
function computeCalibration(referenceDate, trendAtRef) {
  const season = seasonalFactor(referenceDate);
  const dow = DOW_FACTOR[referenceDate.getDay()];
  const level = season * dow * trendAtRef;   // 当期基准水平（不含省份系数与市场噪声）

  const cal = new Map();
  for (const prov of PROVINCES) {
    const ms = MARKETS.filter((m) => m.provinceCode === prov.code);
    let sum = 0, cnt = 0;
    for (const m of ms) {
      const f = MARKET_FACTOR.get(m.id);
      for (const sp of basketFor(m)) { sum += sp.base * f; cnt += 1; }
    }
    const raw = cnt ? sum / cnt : BASKET_MEAN_KG;
    // 目标均价（元/公斤）= 全国基准 × 省指数；反推校准系数
    const target = round2(BASKET_MEAN_KG * prov.idx);
    cal.set(prov.code, raw > 0 && level > 0 ? target / (raw * level) : 1);
  }
  return cal;
}

const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = (d) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ── 主流程 ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const days = args.includes('--full')
    ? 669
    : (() => {
        const i = args.indexOf('--days');
        return i >= 0 ? Number(args[i + 1]) : (config.app.demo.historyDays || 669);
      })();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  console.log('═'.repeat(72));
  console.log(` 鱼价查 · 演示数据生成`);
  console.log(` 驱动：${config.usingSqlite ? 'SQLite' : 'MySQL'}   品种：${SPECIES.length}   市场：${MARKETS.length}   省份：${PROVINCES.length}`);
  console.log(` 时间区间：${fmtDate(start)} → ${fmtDate(today)}（${days} 天）`);
  console.log('═'.repeat(72));

  // 校准基准取「最后一天」的趋势因子，使最新日期的均价精确对齐目标档位
  const trendAtRef = 1 + ((days - 1) / 365.25) * 0.035;
  const cal = computeCalibration(today, trendAtRef);

  // 打印省份目标档位，便于核对
  console.log('\n【省级综合均价档位核对（以最新日期为准）】');
  const tierOf = (yuanPerJin) =>
    yuanPerJin <= 26 ? '低位' : yuanPerJin <= 36 ? '中位' : '高位';
  let lastTier = '';
  for (const p of [...PROVINCES].sort((a, b) => a.idx - b.idx)) {
    const ypj = round2((BASKET_MEAN_KG * p.idx) / 2);
    const t = tierOf(ypj);
    if (t !== lastTier) { console.log(`  ── ${t} ──`); lastTier = t; }
    console.log(`  ${p.short.padEnd(4, '　')} ${String(ypj).padStart(6)} 元/斤  (${p.coast ? '沿海' : '内陆'}·指数 ${p.idx})`);
  }

  // ── 1. 清空业务表（保留结构）────────────────────────────────────────
  console.log('\n[1/5] 清理历史数据 …');
  for (const t of ['price_daily', 'daily_snapshot', 'watch_item', 'alert_log', 'audit_log', 'push_subscription']) {
    await db.run(`DELETE FROM ${t}`);
  }
  await db.run(`DELETE FROM auth_token`);
  await db.run(`DELETE FROM species_request`);
  await db.run(`DELETE FROM app_user`);

  // ── 2. 生成 price_daily ────────────────────────────────────────────
  console.log('[2/5] 生成 price_daily 价格明细 …');
  const snapshots = [];

  let totalRows = 0;
  const t0 = Date.now();
  let buf = [];

  for (let di = 0; di < days; di++) {
    const d = new Date(start);
    d.setDate(d.getDate() + di);
    const dateStr = fmtDate(d);
    const batchNo = `PFSC-${dateStr.replace(/-/g, '')}-01`;
    const collectedAt = `${dateStr} 06:30:00`;
    const season = seasonalFactor(d);
    const dow = DOW_FACTOR[d.getDay()];
    // 22 个月缓慢上行趋势（年化 +3.5%）
    const trend = 1 + (di / 365.25) * 0.035;
    const provMarkets = new Map();
    for (const m of MARKETS) {
      if (!provMarkets.has(m.provinceCode)) provMarkets.set(m.provinceCode, []);
      provMarkets.get(m.provinceCode).push(m);
    }

    // 当日聚合（仅本日，避免跨天累积）
    let dayMarkets = 0, dayProvinces = 0, daySpeciesMax = 0, dayRecords = 0;

    for (const prov of PROVINCES) {
      const ms = provMarkets.get(prov.code) || [];
      const provSpecies = new Set();
      const provMarketsSet = new Set();

      for (const m of ms) {
        const mf = MARKET_FACTOR.get(m.id);
        const basket = basketFor(m);
        for (const sp of basket) {
          const price = round2(
            sp.base * cal.get(prov.code) * mf * season * dow * trend
            * speciesDailyShock(sp, prov.code, dateStr) * jitter(0.010)
          );
          if (price <= 0) continue;
          buf.push({
            date: dateStr,
            province: prov.name,
            province_code: prov.code,
            market: m.name,
            category_l1: (CATEGORIES.find((c) => c.id === sp.cat) || {}).name || sp.cat,
            category_l2: sp.sub,
            species: sp.name,
            price,
            unit: '元/公斤',
            spec: sp.spec,
            source_url: `${SOURCE.baseUrl}${SOURCE.path}?kw=${encodeURIComponent(sp.name)}`,
            batch_no: batchNo,
            collected_at: collectedAt,
          });
          provSpecies.add(sp.name);
          provMarketsSet.add(m.name);
        }
      }

      dayProvinces += 1;
      dayMarkets += provMarketsSet.size;
      daySpeciesMax = Math.max(daySpeciesMax, provSpecies.size);
      }
    dayRecords = buf.length;
    totalRows += buf.length;

    // 分批落库，控制内存
    await db.batchInsert('price_daily', buf.splice(0, buf.length));

    snapshots.push({
      date: dateStr,
      status: 'published',
      market_count: dayMarkets,
      province_count: dayProvinces,
      species_count: daySpeciesMax,
      record_count: dayRecords,
      batch_no: batchNo,
      published_at: collectedAt,
    });

    if ((di + 1) % 25 === 0 || di === days - 1) {
      const pct = (((di + 1) / days) * 100).toFixed(0);
      console.log(`   · ${dateStr}  ${pct.padStart(3)}%  累计 ${totalRows.toLocaleString()} 行  用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  console.log(`   ✓ price_daily 共写入 ${totalRows.toLocaleString()} 行`);

  // ── 3. 快照 ────────────────────────────────────────────────────────
  console.log('[3/5] 写入每日快照 …');
  await db.batchInsert('daily_snapshot', snapshots);
  console.log(`   ✓ daily_snapshot 共 ${snapshots.length} 条`);

  // ── 4. 演示账户 ────────────────────────────────────────────────────
  console.log('[4/5] 创建演示账户 …');
  const users = [
    { email: 'admin@yujiacha.local', pw: 'Admin@2026', nickname: '系统管理员', role: 'admin', org: '鱼价查运营中心' },
    { email: 'teacher@shou.edu.cn', pw: 'Demo@2026', nickname: '李老师', role: 'researcher', org: '上海海洋大学 水产与生命学院' },
    { email: 'gov@agri.local', pw: 'Demo@2026', nickname: '省渔业监测站', role: 'gov', org: '地方渔业主管部门' },
    { email: 'farmer@yujiacha.local', pw: 'Demo@2026', nickname: '老张', role: 'user', org: '水产养殖合作社' },
    { email: 'user@yujiacha.local', pw: 'Demo@2026', nickname: '市民小王', role: 'user', org: null },
  ];
  const userIds = {};
  for (const u of users) {
    const r = await db.run(
      `INSERT INTO app_user (email, password_hash, nickname, role, org, status, email_verified, theme)
       VALUES (?, ?, ?, ?, ?, 'active', 1, 'light')`,
      [u.email, hashPassword(u.pw), u.nickname, u.role, u.org]
    );
    userIds[u.email] = r.insertId;
    console.log(`   ✓ ${u.email}  /  ${u.pw}   [${u.role}]`);
  }

  // ── 5. 关注订阅与异动告警 ──────────────────────────────────────────
  console.log('[5/5] 生成关注订阅与异动告警 …');
  const watchSeeds = [
    { email: 'farmer@yujiacha.local', species: '草鱼', province: '上海' },
    { email: 'farmer@yujiacha.local', species: '南美白对虾', province: null },
    { email: 'farmer@yujiacha.local', species: '大黄鱼', province: '浙江' },
    { email: 'farmer@yujiacha.local', species: '梭子蟹', province: '山东' },
    { email: 'user@yujiacha.local', species: '生蚝', province: null },
    { email: 'user@yujiacha.local', species: '鲍鱼', province: null },
    { email: 'user@yujiacha.local', species: '小龙虾', province: '湖北' },
    { email: 'teacher@shou.edu.cn', species: '大黄鱼', province: null },
    { email: 'teacher@shou.edu.cn', species: '南美白对虾', province: null },
    { email: 'teacher@shou.edu.cn', species: '海参', province: '辽宁' },
    { email: 'teacher@shou.edu.cn', species: '鲍鱼', province: '福建' },
    { email: 'gov@agri.local', species: '草鱼', province: null },
    { email: 'gov@agri.local', species: '大黄鱼', province: null },
    { email: 'gov@agri.local', species: '梭子蟹', province: null },
  ];
  for (const w of watchSeeds) {
    await db.run(
      `INSERT INTO watch_item (user_id, species, province, threshold_up, threshold_down, notify_channel)
       VALUES (?, ?, ?, 5.00, -5.00, ?)`,
      [userIds[w.email], w.species, w.province, w.email.includes('farmer') ? 'app_push' : 'web_push']
    );
  }
  console.log(`   ✓ watch_item 共 ${watchSeeds.length} 条`);

  // 告警：取最近 14 天中「关注品种（全国或指定省份）均价日环比」绝对值 ≥3% 的记录
  const alertDays = Math.min(14, days - 1);
  const watchedSpecies = [...new Set(watchSeeds.map((w) => w.species))];

  // 一次性把需要的品种 × 日期 × 省份聚合取回内存，避免逐条查询
  const alertStart = new Date(start);
  alertStart.setDate(alertStart.getDate() + Math.max(0, days - alertDays - 1));
  const aggRows = await db.query(
    `SELECT species, date, province, AVG(price) AS avg_price
       FROM price_daily
      WHERE species IN (${watchedSpecies.map(() => '?').join(',')})
        AND date >= ?
      GROUP BY species, date, province`,
    [...watchedSpecies, fmtDate(alertStart)]
  );
  const byKey = new Map(); // species|date|province → avg
  const byKeyNat = new Map(); // species|date → {sum,cnt}
  for (const r of aggRows) {
    byKey.set(`${r.species}|${r.date}|${r.province}`, Number(r.avg_price));
    const nk = `${r.species}|${r.date}`;
    const acc = byKeyNat.get(nk) || { sum: 0, cnt: 0 };
    acc.sum += Number(r.avg_price); acc.cnt += 1;
    byKeyNat.set(nk, acc);
  }

  const avgFor = (species, dateStr, provName) => {
    if (provName) {
      const v = byKey.get(`${species}|${dateStr}|${provName}`);
      return v == null ? null : round2(v);
    }
    const acc = byKeyNat.get(`${species}|${dateStr}`);
    return acc && acc.cnt ? round2(acc.sum / acc.cnt) : null;
  };

  let alertCount = 0;
  for (let di = days - alertDays; di < days; di++) {
    const d = new Date(start); d.setDate(d.getDate() + di);
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    const dateStr = fmtDate(d), prevStr = fmtDate(prev);
    for (const w of watchSeeds) {
      const provName = w.province || null;
      const nat = avgFor(w.species, dateStr, provName);
      const natPrev = avgFor(w.species, prevStr, provName);
      if (nat == null || natPrev == null || natPrev === 0) continue;
      const chg = round2(((nat - natPrev) / natPrev) * 100);
      if (Math.abs(chg) < 3) continue;
      const dir = chg > 0 ? 'up' : 'down';
      const scope = provName || '全国';
      await db.run(
        `INSERT INTO alert_log (user_id, species, province, date, prev_price, curr_price, change_pct, direction, channel, pushed, is_read, title, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [
          userIds[w.email], w.species, provName, dateStr, natPrev, nat, chg, dir,
          w.email.includes('farmer') ? 'app_push' : 'web_push',
          0,
          `${w.species}${dir === 'up' ? '价格上涨' : '价格下跌'}提醒`,
          `${scope}${w.species} 均价 ${nat} 元/公斤，较前日${dir === 'up' ? '上涨' : '下跌'} ${Math.abs(chg)}%，已触发您设置的 ±5% 阈值。`,
        ]
      );
      alertCount += 1;
    }
  }
  console.log(`   ✓ alert_log 共 ${alertCount} 条`);

  // 审计日志示例
  await db.run(
    `INSERT INTO audit_log (user_id, user_email, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)`,
    [userIds['admin@yujiacha.local'], 'admin@yujiacha.local', 'DATA_SEED', 'price_daily', `初始化演示数据 ${totalRows} 行`, '127.0.0.1']
  );

  const verify = await db.query(`SELECT COUNT(*) AS c FROM price_daily`);
  console.log('\n' + '═'.repeat(72));
  console.log(` 完成：price_daily ${Number(verify[0].c).toLocaleString()} 行，耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log('═'.repeat(72));
}

/** 某品种某日全国均价（元/公斤） */
async function nationalSpeciesAvg(species, dateStr) {
  const r = await db.query(
    `SELECT AVG(price) AS a FROM price_daily WHERE species = ? AND date = ?`,
    [species, dateStr]
  );
  return r[0] && r[0].a != null ? round2(Number(r[0].a)) : null;
}

main()
  .then(async () => { await db.close(); process.exit(0); })
  .catch(async (e) => { console.error('\n✗ 生成失败：', e); await db.close().catch(() => {}); process.exit(1); });
