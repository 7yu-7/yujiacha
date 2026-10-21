/**
 * 价格数据服务
 * 覆盖 F1 全品种浏览、F2 搜索、F3 地图选省与趋势、F5 日报表、F6 品种详情、F11 历史对比
 */
const db = require('../lib/db');
const config = require('../config');
const { CATEGORIES, SPECIES, PROVINCES, MARKETS, PRICE_TIERS } = require('../data/dictionary');

// ── 轻量内存缓存（热点查询：日报 / 省份榜）──────────────────────────────
const cacheStore = new Map();
function cached(key, producer, ttl = config.cache.ttl) {
  const now = Date.now();
  const hit = cacheStore.get(key);
  if (hit && hit.exp > now) return Promise.resolve(hit.val);
  return Promise.resolve(producer()).then((val) => {
    cacheStore.set(key, { val, exp: now + ttl * 1000 });
    return val;
  });
}
function invalidateCache(prefix = '') {
  for (const k of [...cacheStore.keys()]) if (!prefix || k.startsWith(prefix)) cacheStore.delete(k);
}

const round2 = (n) => (n == null ? null : Math.round(Number(n) * 100) / 100);
const pct = (cur, prev) => (prev == null || prev === 0 || cur == null ? null : round2(((cur - prev) / prev) * 100));

/**
 * 省份名归一化：把简称 / 拼音 / 别名统一为字典中的规范全称
 * 例：上海→上海市、鲁→山东省、shanghai→上海市
 * 找不到时返回原值（交由查询层兜底为空结果）
 */
function normalizeProvince(input) {
  if (!input) return null;
  const s = String(input).trim();
  const hit = PROVINCES.find((p) =>
    p.name === s || p.short === s ||
    p.py === s.toLowerCase() ||
    s.startsWith(p.short) || p.name.startsWith(s)
  );
  return hit ? hit.name : s;
}

/** 省份简称（用于展示，如 上海市 → 上海） */
function provinceShort(fullName) {
  const p = PROVINCES.find((x) => x.name === fullName);
  return p ? p.short : fullName;
}

/** 价格档位（元/斤口径，见说明书 3.1.1） */
function tierOf(pricePerKg) {
  if (pricePerKg == null) return { tier: 'na', label: '无数据', color: '#C3CDD4' };
  const perJin = pricePerKg / 2;
  for (const t of PRICE_TIERS) if (perJin > t.min && perJin <= t.max) return { tier: t.tier, label: t.label, color: t.color };
  return { tier: PRICE_TIERS[PRICE_TIERS.length - 1].tier, label: PRICE_TIERS[PRICE_TIERS.length - 1].label, color: PRICE_TIERS[PRICE_TIERS.length - 1].color };
}

/** 数据日期：最新有数据的日期（T+0 当日发布） */
async function latestDate() {
  return cached('meta:latestDate', async () => {
    const r = await db.query(`SELECT MAX(date) AS d FROM price_daily`);
    const d = r[0] && r[0].d;
    return d ? String(d).slice(0, 10) : db.formatDate(new Date());
  }, 30);
}

async function prevDate(date) {
  const r = await db.query(`SELECT MAX(date) AS d FROM price_daily WHERE date < ?`, [date]);
  return r[0] && r[0].d ? String(r[0].d).slice(0, 10) : null;
}

async function dateRange(days, endDate = null) {
  const end = endDate || (await latestDate());
  const r = await db.query(
    `SELECT DISTINCT date FROM price_daily WHERE date <= ? ORDER BY date DESC LIMIT ?`,
    [end, days]
  );
  return r.map((x) => String(x.date).slice(0, 10)).reverse();
}

/** 数据更新状态（F10 首页「最近更新」提示） */
async function dataStatus() {
  return cached('meta:status', async () => {
    const d = await latestDate();
    const r = await db.query(
      `SELECT market_count, province_count, species_count, record_count, batch_no, published_at, status
         FROM daily_snapshot WHERE date = ?`, [d]
    );
    const snap = r[0] || {};
    return {
      date: d,
      publishedAt: snap.published_at || null,
      status: snap.status || 'published',
      marketCount: Number(snap.market_count || 0),
      provinceCount: Number(snap.province_count || 0),
      speciesCount: Number(snap.species_count || 0),
      recordCount: Number(snap.record_count || 0),
      batchNo: snap.batch_no || null,
      totalSpecies: SPECIES.length,
      totalMarkets: MARKETS.length,
      source: '农业农村部全国农产品价格信息系统 pfsc.agri.cn',
      t0: true,
    };
  }, 30);
}

// ── F1 全品种 ────────────────────────────────────────────────────────────
/**
 * 品种列表：三级（大类 → 小类 → 品种）
 * @param {object} o { province, market, category, subCategory, sort, order, page, pageSize, keyword }
 */
async function listSpecies(o = {}) {
  const date = o.date || (await latestDate());
  const prev = await prevDate(date);
  const page = Math.max(1, Number(o.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(o.pageSize || 100)));
  const province = o.province ? normalizeProvince(o.province) : null;

  // 价格聚合：按品种（可选省份/市场过滤）
  const where = ['pd.date = ?'];
  const params = [date];
  if (province) { where.push('pd.province = ?'); params.push(province); }
  if (o.market) { where.push('pd.market = ?'); params.push(o.market); }
  if (o.category) { where.push('pd.category_l1 = ?'); params.push(o.category); }
  if (o.subCategory) { where.push('pd.category_l2 = ?'); params.push(o.subCategory); }

  const curRows = await db.query(
    `SELECT pd.species, pd.category_l1, pd.category_l2,
            AVG(pd.price) AS avg_price, MIN(pd.price) AS min_price, MAX(pd.price) AS max_price,
            COUNT(DISTINCT pd.market) AS market_count, COUNT(DISTINCT pd.province) AS province_count
       FROM price_daily pd
      WHERE ${where.join(' AND ')}
      GROUP BY pd.species, pd.category_l1, pd.category_l2`, params
  );
  const prevRows = prev
    ? await db.query(
      `SELECT pd.species, AVG(pd.price) AS avg_price
         FROM price_daily pd
        WHERE pd.date = ?${province ? ' AND pd.province = ?' : ''}${o.market ? ' AND pd.market = ?' : ''}
        GROUP BY pd.species`,
      (() => {
        const p = [prev];
        if (province) p.push(province);
        if (o.market) p.push(o.market);
        return p;
      })()
    )
    : [];
  const prevMap = new Map(prevRows.map((r) => [r.species, Number(r.avg_price)]));

  // 近 7 日迷你趋势（sparkline）
  const dates7 = await dateRange(7, date);
  const sparkRows = await db.query(
    `SELECT pd.species, pd.date, AVG(pd.price) AS avg_price
       FROM price_daily pd
      WHERE pd.date >= ? AND pd.date <= ?${province ? ' AND pd.province = ?' : ''}
      GROUP BY pd.species, pd.date`,
    province ? [dates7[0], date, province] : [dates7[0], date]
  );
  const sparkMap = new Map();
  for (const r of sparkRows) {
    const k = r.species;
    if (!sparkMap.has(k)) sparkMap.set(k, []);
    sparkMap.get(k).push({ date: String(r.date).slice(0, 10), price: round2(r.avg_price) });
  }

  const metaMap = new Map(SPECIES.map((s) => [s.name, s]));
  const catMap = new Map(CATEGORIES.map((c) => [c.name, c]));

  let items = curRows.map((r) => {
    const meta = metaMap.get(r.species) || {};
    const avg = round2(r.avg_price);
    const prevAvg = prevMap.get(r.species);
    return {
      species: r.species,
      alias: meta.alias || [],
      pinyin: meta.py || '',
      pinyinVariants: meta.pyx || [],
      category: r.category_l1,
      categoryOrder: (catMap.get(r.category_l1) || {}).order || 99,
      subCategory: r.category_l2 || meta.sub || '',
      spec: meta.spec || '',
      unit: '元/公斤',
      price: avg,
      minPrice: round2(r.min_price),
      maxPrice: round2(r.max_price),
      prevPrice: prevAvg == null ? null : round2(prevAvg),
      changePct: pct(avg, prevAvg),
      marketCount: Number(r.market_count),
      provinceCount: Number(r.province_count),
      tier: tierOf(avg),
      sparkline: sparkMap.get(r.species) || [],
      date,
    };
  });

  // 关键词过滤（标准名 / 别名 / 拼音 / 品类）
  if (o.keyword) {
    const kw = String(o.keyword).trim().toLowerCase();
    items = items.filter((it) => matchKeyword(it, kw));
  }

  // 排序
  const sortKey = o.sort || 'category';
  const dir = (o.order || (sortKey === 'price' ? 'desc' : 'asc')).toLowerCase() === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    let va, vb;
    switch (sortKey) {
      case 'price': va = a.price; vb = b.price; break;
      case 'change': va = a.changePct ?? -999; vb = b.changePct ?? -999; break;
      case 'updated': va = a.species; vb = b.species; break;
      case 'name': va = a.species; vb = b.species; break;
      default: va = a.categoryOrder; vb = b.categoryOrder;
    }
    if (typeof va === 'string') return va.localeCompare(vb, 'zh-CN') * dir;
    return ((va ?? -1e9) - (vb ?? -1e9)) * dir;
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  // 三级树
  const tree = CATEGORIES.map((c) => {
    const inCat = items.filter((i) => i.category === c.name);
    const subs = [...new Set(inCat.map((i) => i.subCategory).filter(Boolean))];
    return {
      id: c.id, name: c.name, order: c.order, core: c.core,
      count: inCat.length,
      children: subs.map((s) => ({
        name: s,
        count: inCat.filter((i) => i.subCategory === s).length,
        species: inCat.filter((i) => i.subCategory === s).map((i) => i.species),
      })),
    };
  }).filter((c) => c.count > 0);

  return { date, prevDate: prev, total, page, pageSize, items: paged, tree };
}

/** 关键词匹配：标准名 / 别名 / 拼音首字母 / 拼音全拼 / 品类名 */
function matchKeyword(item, kw) {
  const k = kw.toLowerCase();
  if (item.species.toLowerCase().includes(k)) return true;
  if (item.category.toLowerCase().includes(k)) return true;
  if (item.subCategory && item.subCategory.toLowerCase().includes(k)) return true;
  if (item.pinyin && item.pinyin.toLowerCase().startsWith(k)) return true;
  if ((item.pinyinVariants || []).some((p) => p.toLowerCase().startsWith(k) || p.toLowerCase().includes(k))) return true;
  return (item.alias || []).some((a) => a.toLowerCase().includes(k));
}

// ── F2 搜索（含智能联想 + 近似品种 + 申报入口）────────────────────────────
async function search(keyword, { limit = 20 } = {}) {
  const kw = String(keyword || '').trim();
  if (!kw) return { keyword: kw, items: [], suggestions: [], near: [], empty: true };
  const k = kw.toLowerCase();

  const list = await listSpecies({ pageSize: 500 });
  const scored = [];
  for (const it of list.items) {
    let score = 0;
    const name = it.species.toLowerCase();
    const pys = [it.pinyin, ...(it.pinyinVariants || [])].filter(Boolean).map((x) => x.toLowerCase());
    const alias = (it.alias || []).map((x) => x.toLowerCase());

    if (name === k) score = 100;
    else if (alias.includes(k)) score = 92;                        // 别名精确（如 虾姑 → 皮皮虾）
    else if (alias.some((a) => a.includes(k))) score = 72;
    else if (name.startsWith(k)) score = 80;
    else if (name.includes(k)) score = 60;
    else if (pys.some((p) => p === k)) score = 76;                 // 拼音全拼精确（如 jyx → 鲫鱼）
    else if (pys.some((p) => p.startsWith(k))) score = 55;         // 拼音首字母（如 dhy → 大黄鱼）
    else if (it.category.toLowerCase().includes(k)) score = 30;
    else if (it.subCategory && it.subCategory.toLowerCase().includes(k)) score = 25;

    if (score > 0) scored.push({ ...it, score });
  }
  scored.sort((a, b) => b.score - a.score || a.species.localeCompare(b.species, 'zh-CN'));
  const items = scored.slice(0, limit);

  // 近似品种：取同品类或名称含相同字的品种
  const near = [];
  if (items.length === 0) {
    const chars = [...new Set(kw.split(''))];
    for (const it of list.items) {
      if (chars.some((c) => it.species.includes(c)) || it.pinyin.includes(k)) near.push(it);
      if (near.length >= 6) break;
    }
  }

  return {
    keyword: kw,
    total: scored.length,
    items,
    suggestions: scored.slice(0, 8).map((x) => ({ species: x.species, category: x.category, price: x.price, changePct: x.changePct })),
    near: near.slice(0, 6),
    empty: scored.length === 0,
    // F2 空结果引导：申报新品种入口
    reportEntry: scored.length === 0,
  };
}

// ── F3 地图选省 + 近一周趋势 ─────────────────────────────────────────────
async function mapProvinces({ date = null, days = 7 } = {}) {
  const d = date || (await latestDate());
  const prev = await prevDate(d);
  return cached(`map:${d}:${days}`, async () => {
    const rows = await db.query(
      `SELECT province, province_code, AVG(price) AS avg_price,
              COUNT(DISTINCT market) AS market_count, COUNT(DISTINCT species) AS species_count, COUNT(*) AS record_count
         FROM price_daily WHERE date = ? GROUP BY province, province_code`, [d]
    );
    const prevRows = prev
      ? await db.query(`SELECT province, AVG(price) AS avg_price FROM price_daily WHERE date = ? GROUP BY province`, [prev])
      : [];
    const prevMap = new Map(prevRows.map((r) => [r.province, Number(r.avg_price)]));

    // 近 N 日趋势
    const datesN = await dateRange(days, d);
    const trendRows = await db.query(
      `SELECT province, date, AVG(price) AS avg_price FROM price_daily
        WHERE date >= ? AND date <= ? GROUP BY province, date`,
      [datesN[0], d]
    );
    const trendMap = new Map();
    for (const r of trendRows) {
      if (!trendMap.has(r.province)) trendMap.set(r.province, []);
      trendMap.get(r.province).push({ date: String(r.date).slice(0, 10), price: round2(r.avg_price) });
    }

    const covered = new Map(rows.map((r) => [r.province, r]));
    const provinces = PROVINCES.map((p) => {
      const r = covered.get(p.name);
      const avg = r ? round2(r.avg_price) : null;
      const prevAvg = prevMap.get(p.name);
      const trend = trendMap.get(p.name) || [];
      const prices = trend.map((t) => t.price).filter((x) => x != null);
      return {
        name: p.name, short: p.short, code: p.code, pinyin: p.py,
        lng: p.lng, lat: p.lat, coast: p.coast,
        avgPrice: avg,
        prevPrice: prevAvg == null ? null : round2(prevAvg),
        changePct: pct(avg, prevAvg),
        tier: tierOf(avg),
        hasData: avg != null,
        marketCount: r ? Number(r.market_count) : 0,
        speciesCount: r ? Number(r.species_count) : 0,
        recordCount: r ? Number(r.record_count) : 0,
        trend,
        stats: prices.length
          ? {
            max: round2(Math.max(...prices)),
            min: round2(Math.min(...prices)),
            amplitude: round2(((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100),
            avg: round2(prices.reduce((a, b) => a + b, 0) / prices.length),
          }
          : null,
      };
    });

    const withData = provinces.filter((p) => p.hasData);
    const sorted = [...withData].sort((a, b) => b.avgPrice - a.avgPrice);
    return {
      date: d,
      prevDate: prev,
      days,
      dates: datesN,
      tiers: PRICE_TIERS.map((t) => ({ tier: t.tier, label: t.label, min: t.min === 0 ? null : t.min, max: t.max === Infinity ? null : t.max, color: t.color, desc: t.desc })),
      provinces,
      nationalAvg: withData.length ? round2(withData.reduce((a, b) => a + b.avgPrice, 0) / withData.length) : null,
      ranking: sorted.map((p, i) => ({ rank: i + 1, name: p.name, short: p.short, avgPrice: p.avgPrice, changePct: p.changePct, tier: p.tier })),
      upCount: withData.filter((p) => (p.changePct ?? 0) > 0).length,
      downCount: withData.filter((p) => (p.changePct ?? 0) < 0).length,
      flatCount: withData.filter((p) => (p.changePct ?? 0) === 0).length,
      maxProvince: sorted[0] || null,
      minProvince: sorted[sorted.length - 1] || null,
      noDataProvinces: provinces.filter((p) => !p.hasData).map((p) => p.name),
    };
  }, 60);
}

/** 省份详情（F3 右侧面板 5 个功能区） */
async function provinceDetail(provName, { date = null, range = 7, market = null } = {}) {
  const d = date || (await latestDate());
  const prev = await prevDate(d);
  const canonical = normalizeProvince(provName);
  const prov = PROVINCES.find((p) => p.name === canonical);
  if (!prov) throw new Error(`未知省份：${provName}`);

  const datesN = await dateRange(range, d);
  const mFilter = market ? ' AND market = ?' : '';
  const mParams = market ? [market] : [];

  // 头部：当前省名、覆盖品种数、数据截至时间、当日均价与较昨日涨跌幅
  const headRows = await db.query(
    `SELECT AVG(price) AS avg_price, COUNT(DISTINCT species) AS species_count,
            COUNT(DISTINCT market) AS market_count, COUNT(*) AS record_count, MAX(collected_at) AS collected_at
       FROM price_daily WHERE date = ? AND province = ?${mFilter}`, [d, prov.name, ...mParams]
  );
  const prevHead = await db.query(
    `SELECT AVG(price) AS avg_price FROM price_daily WHERE date = ? AND province = ?${mFilter}`, [prev, prov.name, ...mParams]
  );
  const head = headRows[0] || {};
  const avg = round2(head.avg_price);
  const prevAvg = prevHead[0] ? round2(prevHead[0].avg_price) : null;

  // 趋势（全省 / 分批发市场）
  const trendRows = await db.query(
    `SELECT date, AVG(price) AS avg_price FROM price_daily
      WHERE date >= ? AND date <= ? AND province = ?${mFilter}
      GROUP BY date ORDER BY date`, [datesN[0], d, prov.name, ...mParams]
  );
  const trend = trendRows.map((r) => ({ date: String(r.date).slice(0, 10), price: round2(r.avg_price) }));
  const prices = trend.map((t) => t.price);

  // 分市场趋势（左图可切换）
  const marketRows = await db.query(
    `SELECT market, AVG(price) AS avg_price FROM price_daily
      WHERE date = ? AND province = ? GROUP BY market ORDER BY avg_price DESC`, [d, prov.name]
  );

  // Top8 品种报价（按价格降序，含规格与涨跌幅）
  const topRows = await db.query(
    `SELECT species, spec, category_l1, AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price
       FROM price_daily WHERE date = ? AND province = ? GROUP BY species, spec, category_l1
      ORDER BY avg_price DESC LIMIT 8`, [d, prov.name]
  );
  const prevSpecies = prev
    ? await db.query(`SELECT species, AVG(price) AS avg_price FROM price_daily WHERE date = ? AND province = ? GROUP BY species`, [prev, prov.name])
    : [];
  const prevSpMap = new Map(prevSpecies.map((r) => [r.species, Number(r.avg_price)]));
  const topSpecies = topRows.map((r) => ({
    species: r.species, spec: r.spec, category: r.category_l1,
    price: round2(r.avg_price), minPrice: round2(r.min_price), maxPrice: round2(r.max_price),
    changePct: pct(round2(r.avg_price), prevSpMap.get(r.species)),
    tier: tierOf(round2(r.avg_price)),
  }));

  // 领涨品种
  const leadUp = [...topSpecies].filter((x) => (x.changePct ?? 0) > 0).sort((a, b) => b.changePct - a.changePct)[0] || null;

  return {
    province: { name: prov.name, short: prov.short, code: prov.code, coast: prov.coast, lng: prov.lng, lat: prov.lat },
    date: d, prevDate: prev, range, dates: datesN,
    header: {
      avgPrice: avg, prevPrice: prevAvg, changePct: pct(avg, prevAvg),
      speciesCount: Number(head.species_count || 0),
      marketCount: Number(head.market_count || 0),
      recordCount: Number(head.record_count || 0),
      collectedAt: head.collected_at || null,
      tier: tierOf(avg),
      hasData: avg != null,
    },
    stats: prices.length ? {
      max: round2(Math.max(...prices)), maxDate: trend[prices.indexOf(Math.max(...prices))].date,
      min: round2(Math.min(...prices)), minDate: trend[prices.indexOf(Math.min(...prices))].date,
      amplitude: round2(((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100),
      avg: round2(prices.reduce((a, b) => a + b, 0) / prices.length),
    } : null,
    trend,
    markets: marketRows.map((r) => ({ market: r.market, avgPrice: round2(r.avg_price), tier: tierOf(round2(r.avg_price)) })),
    topSpecies,
    leadUp,
  };
}

// ── F5 全国渔价日报表（省份排序 T+0）─────────────────────────────────────
async function dailyReport({ date = null, dimension = 'province' } = {}) {
  const d = date || (await latestDate());
  return cached(`report:${d}:${dimension}`, async () => {
    const prev = await prevDate(d);
    const map = await mapProvinces({ date: d, days: 7 });
    const status = await dataStatus();

    // 领涨品种：各省当日与昨日对比
    const prevSp = prev
      ? await db.query(`SELECT province, species, AVG(price) AS avg_price FROM price_daily WHERE date = ? GROUP BY province, species`, [prev])
      : [];
    const prevSpMap = new Map(prevSp.map((r) => [`${r.province}|${r.species}`, Number(r.avg_price)]));
    const curSp = await db.query(
      `SELECT province, species, category_l1, AVG(price) AS avg_price FROM price_daily WHERE date = ? GROUP BY province, species`, [d]
    );
    const leadMap = new Map();
    for (const r of curSp) {
      const p = prevSpMap.get(`${r.province}|${r.species}`);
      if (p == null || p === 0) continue;
      const chg = ((Number(r.avg_price) - p) / p) * 100;
      if (chg <= 0) continue;
      const cur = leadMap.get(r.province);
      if (!cur || chg > cur.changePct) {
        leadMap.set(r.province, { species: r.species, category: r.category_l1, changePct: round2(chg), price: round2(r.avg_price) });
      }
    }

    const rows = map.provinces.filter((p) => p.hasData)
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .map((p, i) => ({
        rank: i + 1,
        province: p.name,
        short: p.short,
        code: p.code,
        avgPrice: p.avgPrice,
        prevPrice: p.prevPrice,
        changePct: p.changePct,
        speciesCount: p.speciesCount,
        marketCount: p.marketCount,
        recordCount: p.recordCount,
        leadUp: leadMap.get(p.name) || null,
        tier: p.tier,
        trend: p.trend,
      }));

    // 五张概览卡
    const overview = {
      nationalAvg: map.nationalAvg,
      upCount: map.upCount,
      downCount: map.downCount,
      flatCount: map.flatCount,
      maxProvince: map.maxProvince ? { name: map.maxProvince.name, short: map.maxProvince.short, avgPrice: map.maxProvince.avgPrice } : null,
      minProvince: map.minProvince ? { name: map.minProvince.name, short: map.minProvince.short, avgPrice: map.minProvince.avgPrice } : null,
      maxChangeProvince: [...rows].filter((r) => r.changePct != null).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0] || null,
      coveredProvinces: rows.length,
    };

    // 按品种维度（可选）
    let bySpecies = null;
    if (dimension === 'species') {
      const spRows = await db.query(
        `SELECT species, category_l1, AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price,
                COUNT(DISTINCT province) AS province_count, COUNT(DISTINCT market) AS market_count
           FROM price_daily WHERE date = ? GROUP BY species, category_l1 ORDER BY avg_price DESC`, [d]
      );
      const prevSpRows = prev
        ? await db.query(`SELECT species, AVG(price) AS avg_price FROM price_daily WHERE date = ? GROUP BY species`, [prev])
        : [];
      const pMap = new Map(prevSpRows.map((r) => [r.species, Number(r.avg_price)]));
      bySpecies = spRows.map((r, i) => ({
        rank: i + 1, species: r.species, category: r.category_l1,
        avgPrice: round2(r.avg_price), minPrice: round2(r.min_price), maxPrice: round2(r.max_price),
        prevPrice: pMap.has(r.species) ? round2(pMap.get(r.species)) : null,
        changePct: pct(round2(r.avg_price), pMap.get(r.species)),
        provinceCount: Number(r.province_count), marketCount: Number(r.market_count),
        tier: tierOf(round2(r.avg_price)),
      }));
    }

    return {
      date: d, prevDate: prev, dimension,
      status: { ...status, date: d },
      overview,
      rows,
      bySpecies,
      disclaimer: '省级综合均价 = 该省监测水产市场主流品种当日报价的加权平均。内陆及高原省份因活鲜运输损耗、冷链与中转成本，均价通常高于沿海主产区。',
      filterBar: {
        date: d,
        marketCount: status.marketCount,
        recordCount: status.recordCount,
        batchNo: status.batchNo,
        source: status.source,
      },
    };
  }, 60);
}

// ── F6 品种详情 ─────────────────────────────────────────────────────────
async function speciesDetail(name, { province = null, days = 30 } = {}) {
  const date = await latestDate();
  const prev = await prevDate(date);
  const meta = SPECIES.find((s) => s.name === name || (s.alias || []).includes(name));
  if (!meta) throw new Error(`未知品种：${name}`);
  const provNorm = province ? normalizeProvince(province) : null;

  const d = date;
  const provFilter = provNorm ? ' AND province = ?' : '';
  const pp = provNorm ? [provNorm] : [];

  const cur = await db.query(
    `SELECT AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price,
            COUNT(DISTINCT province) AS province_count, COUNT(DISTINCT market) AS market_count,
            COUNT(*) AS record_count, MAX(collected_at) AS collected_at
       FROM price_daily WHERE date = ? AND species = ?${provFilter}`, [d, meta.name, ...pp]
  );
  const prevCur = await db.query(
    `SELECT AVG(price) AS avg_price FROM price_daily WHERE date = ? AND species = ?${provFilter}`, [prev, meta.name, ...pp]
  );
  const c = cur[0] || {};
  const avg = round2(c.avg_price);

  // 历史曲线
  const hist = await db.query(
    `SELECT date, AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price
       FROM price_daily WHERE species = ?${provFilter} AND date >= ?
      GROUP BY date ORDER BY date`,
    (() => {
      const p = [meta.name, ...pp];
      const from = new Date(date); from.setDate(from.getDate() - days);
      return [...p, db.formatDate(from)];
    })()
  );

  // 省份分布（当日）
  const provRows = await db.query(
    `SELECT province, province_code, AVG(price) AS avg_price, COUNT(DISTINCT market) AS market_count
       FROM price_daily WHERE date = ? AND species = ? GROUP BY province, province_code ORDER BY avg_price DESC`,
    [d, meta.name]
  );

  // 市场报价明细
  const mktRows = await db.query(
    `SELECT province, market, price, spec, unit, source_url, batch_no, collected_at
       FROM price_daily WHERE date = ? AND species = ?${provFilter}
      ORDER BY price DESC LIMIT 50`, [d, meta.name, ...pp]
  );

  return {
    species: meta.name,
    alias: meta.alias, pinyin: meta.py,
    category: (CATEGORIES.find((x) => x.id === meta.cat) || {}).name || meta.cat,
    subCategory: meta.sub,
    spec: meta.spec,
    unit: '元/公斤',
    date: d, prevDate: prev, province: provNorm ? provinceShort(provNorm) : '全国',
    price: {
      avg, min: round2(c.min_price), max: round2(c.max_price),
      prev: prevCur[0] ? round2(prevCur[0].avg_price) : null,
      changePct: pct(avg, prevCur[0] ? round2(prevCur[0].avg_price) : null),
      tier: tierOf(avg),
    },
    coverage: {
      provinceCount: Number(c.province_count || 0),
      marketCount: Number(c.market_count || 0),
      recordCount: Number(c.record_count || 0),
      collectedAt: c.collected_at || null,
    },
    source: {
      name: '农业农村部全国农产品价格信息系统',
      url: `${'https://pfsc.agri.cn'}/#/marketQuotation/?kw=${encodeURIComponent(meta.name)}`,
      batchNo: mktRows[0] ? mktRows[0].batch_no : null,
    },
    history: hist.map((r) => ({ date: String(r.date).slice(0, 10), avg: round2(r.avg_price), min: round2(r.min_price), max: round2(r.max_price) })),
    provinces: provRows.map((r) => ({ name: r.province, code: r.province_code, avgPrice: round2(r.avg_price), marketCount: Number(r.market_count), tier: tierOf(round2(r.avg_price)) })),
    quotes: mktRows.map((r) => ({
      province: r.province, market: r.market, price: round2(r.price), spec: r.spec,
      unit: r.unit, sourceUrl: r.source_url, batchNo: r.batch_no, collectedAt: r.collected_at,
    })),
  };
}

// ── 涨跌榜 ──────────────────────────────────────────────────────────────
async function movers({ date = null, scope = 'province', limit = 10 } = {}) {
  const d = date || (await latestDate());
  const prev = await prevDate(d);
  if (scope === 'species') {
    const rep = await dailyReport({ date: d, dimension: 'species' });
    const arr = (rep.bySpecies || []).filter((x) => x.changePct != null);
    return {
      date: d, prevDate: prev, scope,
      topGainers: [...arr].sort((a, b) => b.changePct - a.changePct).slice(0, limit),
      topLosers: [...arr].sort((a, b) => a.changePct - b.changePct).slice(0, limit),
    };
  }
  const map = await mapProvinces({ date: d, days: 2 });
  const arr = map.provinces.filter((p) => p.hasData && p.changePct != null);
  return {
    date: d, prevDate: prev, scope,
    topGainers: [...arr].sort((a, b) => b.changePct - a.changePct).slice(0, limit)
      .map((p) => ({ name: p.name, short: p.short, avgPrice: p.avgPrice, changePct: p.changePct })),
    topLosers: [...arr].sort((a, b) => a.changePct - b.changePct).slice(0, limit)
      .map((p) => ({ name: p.name, short: p.short, avgPrice: p.avgPrice, changePct: p.changePct })),
  };
}

// ── F11 多品种历史对比 ──────────────────────────────────────────────────
async function compare(speciesList, { days = 90, province = null } = {}) {
  const list = (Array.isArray(speciesList) ? speciesList : String(speciesList).split(','))
    .map((s) => s.trim()).filter(Boolean).slice(0, 6);
  if (!list.length) throw new Error('请至少指定一个品种');
  const provNorm = province ? normalizeProvince(province) : null;
  const date = await latestDate();
  const from = new Date(date); from.setDate(from.getDate() - days);
  const fromStr = db.formatDate(from);

  const series = [];
  for (const sp of list) {
    const rows = await db.query(
      `SELECT date, AVG(price) AS avg_price FROM price_daily
        WHERE species = ?${provNorm ? ' AND province = ?' : ''} AND date >= ?
        GROUP BY date ORDER BY date`,
      provNorm ? [sp, provNorm, fromStr] : [sp, fromStr]
    );
    const points = rows.map((r) => ({ date: String(r.date).slice(0, 10), price: round2(r.avg_price) }));
    const prices = points.map((p) => p.price);
    series.push({
      species: sp, points,
      base: prices[0] ?? null, last: prices[prices.length - 1] ?? null,
      changePct: prices.length > 1 ? pct(prices[prices.length - 1], prices[0]) : null,
      max: prices.length ? round2(Math.max(...prices)) : null,
      min: prices.length ? round2(Math.min(...prices)) : null,
    });
  }
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  return { date, from: fromStr, days, province: provNorm ? provinceShort(provNorm) : '全国', dates, series };
}

// ── 基础元数据 ──────────────────────────────────────────────────────────
async function meta() {
  const status = await dataStatus();
  return {
    app: { name: config.app.name, fullName: config.app.fullName, version: config.app.version },
    categories: CATEGORIES,
    species: SPECIES.map((s) => ({
      name: s.name, alias: s.alias, pinyin: s.py,
      category: (CATEGORIES.find((c) => c.id === s.cat) || {}).name || s.cat,
      subCategory: s.sub, spec: s.spec, basePrice: s.base,
    })),
    provinces: PROVINCES.map((p) => ({ name: p.name, short: p.short, code: p.code, pinyin: p.py, lng: p.lng, lat: p.lat, coast: p.coast })),
    markets: MARKETS,
    priceTiers: PRICE_TIERS.map((t) => ({ tier: t.tier, label: t.label, color: t.color, min: t.min === 0 ? null : t.min, max: t.max === Infinity ? null : t.max, desc: t.desc, unit: '元/斤' })),
    status,
    themes: [
      { id: 'light', name: '浅色', desc: '默认浅色主题' },
      { id: 'dark', name: '深色', desc: '近黑青背景，适合夜间与大屏监测墙' },
      { id: 'academic', name: '学术白底', desc: '白底 + 青色点缀，适合教研与报告截图' },
    ],
    hotSearch: ['大黄鱼', '梭子蟹', '对虾', '生蚝', '鲍鱼', '贝类'],
  };
}

module.exports = {
  latestDate, prevDate, dateRange, dataStatus, tierOf,
  normalizeProvince, provinceShort,
  listSpecies, search, mapProvinces, provinceDetail, dailyReport,
  speciesDetail, movers, compare, meta,
  cached, invalidateCache,
};
