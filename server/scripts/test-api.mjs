/**
 * API 冒烟测试（覆盖 F1–F14 全部功能点）
 * 用法：node scripts/test-api.mjs [baseUrl]
 */
const B = process.argv[2] || 'http://127.0.0.1:8787';

let pass = 0, fail = 0;
const results = [];

async function call(path, { method = 'GET', body = null, token = null } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let json = null;
  try { json = JSON.parse(txt); } catch { /* 非 JSON（如 CSV / SVG） */ }
  return { status: r.status, json, txt, headers: r.headers };
}

function check(name, cond, detail = '') {
  if (cond) { pass += 1; results.push(`  ✓ ${name}${detail ? '  ' + detail : ''}`); }
  else { fail += 1; results.push(`  ✗ ${name}${detail ? '  ' + detail : ''}`); }
}

async function main() {
  console.log(`\n渔价查 · API 冒烟测试  →  ${B}\n${'─'.repeat(78)}`);

  // ── 健康检查 & 元数据 ───────────────────────────────────────────────
  const h = await call('/api/health');
  check('健康检查', h.status === 200 && h.json?.ok, `db=${h.json?.data?.db?.driver}`);

  const meta = await call('/api/meta');
  check('元数据 meta', meta.json?.ok && meta.json.data.species.length >= 22,
    `品种${meta.json?.data?.species.length} 省${meta.json?.data?.provinces.length} 市场${meta.json?.data?.markets.length} 档位${meta.json?.data?.priceTiers.length}`);
  check('34 个省级行政区', meta.json?.data?.provinces.length === 34);
  check('130 家批发市场', meta.json?.data?.markets.length === 130, `实际 ${meta.json?.data?.markets.length}`);
  check('5 大核心品类 + 1 补充', meta.json?.data?.categories.length === 6);
  check('三套主题', meta.json?.data?.themes.length === 3);

  const st = await call('/api/status');
  check('数据状态 status（T+0）', st.json?.ok && st.json.data.t0 && !!st.json.data.batchNo,
    `date=${st.json?.data?.date} 市场=${st.json?.data?.marketCount} 记录=${st.json?.data?.recordCount}`);

  // ── F1 全品种 ──────────────────────────────────────────────────────
  const f1 = await call('/api/species?pageSize=500');
  const d1 = f1.json?.data;
  check('F1 品种列表', f1.json?.ok && d1.total >= 22, `total=${d1?.total} 三级树=${d1?.tree?.length} 类`);
  check('F1 含价格与涨跌', d1.items.every((i) => i.price != null && i.tier),
    `样例 ${d1.items[0].species}=${d1.items[0].price} (${d1.items[0].tier.label})`);
  check('F1 含近 7 日 sparkline', d1.items[0].sparkline.length >= 5, `${d1.items[0].sparkline.length} 点`);

  const f1f = await call('/api/species?category=' + encodeURIComponent('海水鱼'));
  check('F1 品类筛选', f1f.json?.ok && f1f.json.data.items.every((i) => i.category === '海水鱼'),
    `${f1f.json?.data?.total} 个海水鱼品种`);

  const f1s = await call('/api/species?sort=price&order=desc');
  const sortedPrices = f1s.json?.data?.items.map((i) => i.price) || [];
  check('F1 价格降序排序', sortedPrices.every((v, i) => i === 0 || sortedPrices[i - 1] >= v), `最高 ${sortedPrices[0]}`);

  // ── F2 搜索 ────────────────────────────────────────────────────────
  const f2a = await call('/api/search?q=jyx');
  check('F2 拼音首字母 jyx → 鲫鱼', f2a.json?.data?.items?.some((i) => i.species === '鲫鱼'),
    `命中 ${f2a.json?.data?.items?.slice(0, 3).map((i) => i.species).join(',')}`);

  const f2b = await call('/api/search?q=' + encodeURIComponent('虾姑'));
  check('F2 别名识别 虾姑 → 虾类', f2b.json?.data?.total > 0,
    `${f2b.json?.data?.total} 条，首位 ${f2b.json?.data?.items?.[0]?.species}`);

  const f2c = await call('/api/search?q=' + encodeURIComponent('大黄鱼'));
  check('F2 精确匹配优先', f2c.json?.data?.items?.[0]?.species === '大黄鱼' && f2c.json.data.items[0].score === 100);

  const f2d = await call('/api/search?q=' + encodeURIComponent('不存在的品种XYZ'));
  check('F2 空结果 + 近似 + 申报入口', f2d.json?.data?.empty === true && f2d.json.data.reportEntry === true);

  const sug = await call('/api/search/suggest?q=' + encodeURIComponent('d'));
  check('F2 智能联想', sug.json?.ok && Array.isArray(sug.json.data.suggestions));

  const rq = await call('/api/species/request', { method: 'POST', body: { name: '鳜鱼', province: '江苏省南京市', remark: '测试申报' } });
  check('F2 申报新品种', rq.status === 201 && rq.json?.ok, rq.json?.data?.message);

  // ── F3 地图选省 ────────────────────────────────────────────────────
  const f3 = await call('/api/map/provinces?days=7');
  const d3 = f3.json?.data;
  check('F3 地图省份数据', f3.json?.ok && d3.provinces.length === 34 && d3.dates.length === 7);
  check('F3 价格档位着色', d3.provinces.filter((p) => p.hasData).every((p) => ['low', 'mid', 'high'].includes(p.tier.tier)),
    `低${d3.provinces.filter((p) => p.tier.tier === 'low').length} 中${d3.provinces.filter((p) => p.tier.tier === 'mid').length} 高${d3.provinces.filter((p) => p.tier.tier === 'high').length}`);
  check('F3 省份排行榜', d3.ranking.length === 34 && d3.ranking[0].rank === 1,
    `Top1=${d3.ranking[0].short} ${d3.ranking[0].avgPrice}`);
  check('F3 最高/最低省份', !!d3.maxProvince && !!d3.minProvince, `${d3.maxProvince.short} ↔ ${d3.minProvince.short}`);
  check('F3 省级均价落在三档区间', (() => {
    const ypj = d3.provinces.filter((p) => p.hasData).map((p) => p.avgPrice / 2);
    return ypj.every((v) => v > 0 && v < 60);
  })(), `区间 ${Math.min(...d3.provinces.filter((p) => p.hasData).map((p) => (p.avgPrice / 2).toFixed(2)))} – ${Math.max(...d3.provinces.filter((p) => p.hasData).map((p) => (p.avgPrice / 2).toFixed(2)))} 元/斤`);

  const f3p = await call('/api/provinces/' + encodeURIComponent('上海市') + '?range=7');
  const d3p = f3p.json?.data;
  check('F3 省份详情 5 个功能区', f3p.json?.ok && d3p.header && d3p.stats && d3p.trend.length > 0 && d3p.topSpecies.length > 0 && d3p.markets.length > 0,
    `均价=${d3p.header.avgPrice} 品种=${d3p.header.speciesCount} 市场=${d3p.header.marketCount} 7日振幅=${d3p.stats?.amplitude}%`);
  check('F3 Top8 品种报价', d3p.topSpecies.length === 8, `首位 ${d3p.topSpecies[0].species} ${d3p.topSpecies[0].price}`);

  const mv = await call('/api/movers?scope=species');
  check('涨跌榜', mv.json?.ok && mv.json.data.topGainers.length > 0,
    `涨幅首位 ${mv.json?.data?.topGainers?.[0]?.species} +${mv.json?.data?.topGainers?.[0]?.changePct}%`);

  // ── F5 日报表 ──────────────────────────────────────────────────────
  const f5 = await call('/api/report/daily');
  const d5 = f5.json?.data;
  check('F5 日报表省份排序', f5.json?.ok && d5.rows.length === 34 &&
    d5.rows.every((r, i) => i === 0 || d5.rows[i - 1].avgPrice >= r.avgPrice), `34 省从高到低`);
  check('F5 表头字段完整', ['rank', 'province', 'avgPrice', 'changePct', 'speciesCount', 'marketCount', 'leadUp', 'tier']
    .every((k) => k in d5.rows[0]));
  check('F5 五张概览卡', d5.overview.nationalAvg != null && d5.overview.upCount != null &&
    d5.overview.downCount != null && d5.overview.maxProvince && d5.overview.minProvince,
    `全国均价=${d5.overview.nationalAvg} 涨${d5.overview.upCount}省 跌${d5.overview.downCount}省 平${d5.overview.flatCount}省`);
  check('F5 涨跌省份分化（价格序列真实）', (d5.overview.upCount > 0 && d5.overview.downCount > 0),
    `涨 ${d5.overview.upCount} / 跌 ${d5.overview.downCount} / 平 ${d5.overview.flatCount}`);
  check('F5 审计信息（批次号/市场数/记录数）', !!d5.filterBar.batchNo && d5.filterBar.marketCount > 0 && d5.filterBar.recordCount > 0,
    `${d5.filterBar.batchNo} 市场${d5.filterBar.marketCount} 记录${d5.filterBar.recordCount}`);
  check('F5 口径说明', !!d5.disclaimer && d5.disclaimer.includes('加权平均'));

  const f5s = await call('/api/report/daily?dimension=species');
  check('F5 按品种维度切换', f5s.json?.data?.bySpecies?.length >= 22, `${f5s.json?.data?.bySpecies?.length} 个品种`);

  // ── F6 详情 ────────────────────────────────────────────────────────
  const f6 = await call('/api/species/' + encodeURIComponent('大黄鱼') + '?days=180');
  const d6 = f6.json?.data;
  check('F6 品种详情', f6.json?.ok && d6.price.avg > 0 && d6.coverage.provinceCount > 0,
    `均价=${d6.price.avg} 覆盖${d6.coverage.provinceCount}省/${d6.coverage.marketCount}市场`);
  check('F6 来源 URL 与采集批次（可审计）', !!d6.source.url && !!d6.source.batchNo && d6.source.url.includes('pfsc'),
    `${d6.source.batchNo}`);
  check('F6 历史曲线', d6.history.length > 100, `${d6.history.length} 天`);
  check('F6 市场报价明细含规格/单位/批次', d6.quotes.length > 0 && d6.quotes[0].spec && d6.quotes[0].unit && d6.quotes[0].batchNo);

  // ── F11 对比 ───────────────────────────────────────────────────────
  const f11 = await call('/api/compare?species=' + encodeURIComponent('大黄鱼,草鱼,鲍鱼') + '&days=365');
  check('F11 多品种历史对比', f11.json?.ok && f11.json.data.series.length === 3,
    f11.json?.data?.series.map((s) => `${s.species}:${s.changePct}%`).join(' '));

  // ══ F13 账户体系 ═══════════════════════════════════════════════════
  const email = `t${Date.now()}@test.local`;
  const reg = await call('/api/auth/register', { method: 'POST', body: { email, password: 'Test@2026', nickname: '测试用户', role: 'researcher' } });
  check('F13 注册（邮箱+密码）', reg.status === 201 && reg.json?.ok && !!reg.json.data.verifyToken);
  const vtoken = reg.json?.data?.verifyToken;

  const vf = await call('/api/auth/verify-email?token=' + vtoken);
  check('F13 邮箱验证激活', vf.json?.ok && vf.json.data.emailVerified === true);

  const vf2 = await call('/api/auth/verify-email?token=' + vtoken);
  check('F13 验证令牌一次性', vf2.status === 400 && vf2.json?.error?.code === 'TOKEN_USED');

  const lg = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Test@2026' } });
  check('F13 登录（JWT + 刷新令牌）', lg.json?.ok && !!lg.json.data.token && !!lg.json.data.refreshToken,
    `角色=${lg.json?.data?.user?.roleLabel} 权限导出=${lg.json?.data?.user?.permissions?.export}`);
  const token = lg.json?.data?.token;
  const rtoken = lg.json?.data?.refreshToken;

  const me = await call('/api/auth/me', { token });
  check('F13 获取当前用户', me.json?.ok && me.json.data.email === email);

  const rf = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: rtoken } });
  check('F13 刷新令牌轮换', rf.json?.ok && rf.json.data.token && rf.json.data.refreshToken !== rtoken);
  const token2 = rf.json?.data?.token;
  const rtoken2 = rf.json?.data?.refreshToken;

  const rf2 = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: rtoken } });
  check('F13 旧刷新令牌失效', rf2.status === 400 && rf2.json?.error?.code === 'TOKEN_USED');

  const badLg = await call('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
  check('F13 错误密码拒绝', badLg.status === 401 && badLg.json?.error?.code === 'BAD_CREDENTIALS');

  const fp = await call('/api/auth/forgot-password', { method: 'POST', body: { email } });
  check('F13 忘记密码发重置令牌', fp.json?.ok && !!fp.json.data.resetToken);
  const rp = await call('/api/auth/reset-password', { method: 'POST', body: { token: fp.json.data.resetToken, password: 'NewPass@2026' } });
  check('F13 重置密码', rp.json?.ok === true);
  const lg2 = await call('/api/auth/login', { method: 'POST', body: { email, password: 'NewPass@2026' } });
  check('F13 新密码可登录', lg2.json?.ok === true);
  const token3 = lg2.json?.data?.token;

  const up = await call('/api/auth/profile', { method: 'PUT', token: token3, body: { nickname: '改名了', theme: 'dark' } });
  check('F13 资料修改 + 主题云端同步', up.json?.ok && up.json.data.nickname === '改名了' && up.json.data.theme === 'dark');

  const cp = await call('/api/auth/change-password', { method: 'POST', token: token3, body: { oldPassword: 'NewPass@2026', newPassword: 'Final@2026' } });
  check('F13 修改密码', cp.json?.ok === true);

  // ── F4 关注 ────────────────────────────────────────────────────────
  const w1 = await call('/api/watch', { method: 'POST', token: token3, body: { species: '草鱼', province: '上海', thresholdUp: 5, thresholdDown: -5, notifyChannel: 'web_push' } });
  check('F4 新增关注（品种+地区，省份名归一化）', w1.status === 201 && w1.json?.ok);
  await call('/api/watch', { method: 'POST', token: token3, body: { species: '大黄鱼', thresholdUp: 6, thresholdDown: -4, notifyChannel: 'app_push' } });
  const wl = await call('/api/watch', { token: token3 });
  check('F4 关注列表 + 迷你趋势', wl.json?.ok && wl.json.data.items.length === 2 &&
    wl.json.data.items.every((i) => i.trend && i.price != null),
    wl.json?.data?.items?.map((i) => `${i.species}@${i.scope}=${i.price}(${i.changePct}%)`).join(' '));

  // ── F7 异动提醒 ────────────────────────────────────────────────────
  const scan = await call('/api/admin/alerts/scan', { method: 'POST', token: token3, body: {} });
  check('F7 阈值扫描（需管理员）', scan.status === 403, '非管理员被拒绝，符合权限设计');

  const al = await call('/api/alerts', { token: token3 });
  check('F7 告警列表接口', al.json?.ok && typeof al.json.data.unread === 'number', `未读 ${al.json?.data?.unread}`);

  const sub = await call('/api/push/subscribe', { method: 'POST', token: token3, body: { channel: 'web_push', endpoint: 'test-device' } });
  check('F7 推送订阅登记', sub.status === 201 && sub.json?.ok);

  // ── F8 导出权限 ────────────────────────────────────────────────────
  // 注：fetch 的 text() 会剥离 UTF-8 BOM，故用原始字节校验 BOM
  const csvRes = await fetch(B + '/api/export/report.csv', { headers: { Authorization: `Bearer ${token3}` } });
  const csvBytes = new Uint8Array(await csvRes.arrayBuffer());
  const csvText = new TextDecoder('utf-8').decode(csvBytes);
  const hasBom = csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF;
  check('F8 教研用户导出 CSV', csvRes.status === 200 && hasBom && csvText.includes('省级行政区') && csvText.includes('采集批次'),
    `${csvText.split('\r\n').filter(Boolean).length - 1} 行数据 · BOM=${hasBom ? '有' : '无'} · ${csvBytes.length} 字节`);

  const svg = await call('/api/export/report.svg');
  check('F8 分享长图 SVG', svg.status === 200 && svg.txt.startsWith('<svg'), `${svg.txt.length} 字节`);

  const pr = await call('/api/export/print');
  check('F8 打印页（导出 PDF）', pr.status === 200 && pr.txt.includes('渔价查'));

  // ── 游客权限门禁 ───────────────────────────────────────────────────
  const gcsv = await call('/api/export/report.csv');
  check('权限：游客不可导出', gcsv.status === 403 && gcsv.json?.error?.code === 'EXPORT_FORBIDDEN');

  const gwatch = await call('/api/watch');
  check('权限：游客不可查看关注', gwatch.status === 401 && gwatch.json?.error?.code === 'UNAUTHORIZED');

  const gadmin = await call('/api/admin/dashboard');
  check('权限：游客不可访问管理后台', gadmin.status === 403 && gadmin.json?.error?.code === 'FORBIDDEN');

  const nwatch = await call('/api/watch', { method: 'POST', token: token3, body: { species: '草鱼', province: '上海', thresholdUp: 8 } });
  check('F4 重复关注为更新（幂等）', nwatch.status === 201, nwatch.json?.data?.updated ? '已更新阈值' : '新建');

  // ══ F14 管理后台 ═══════════════════════════════════════════════════
  const adm = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@yujiacha.local', password: 'Admin@2026' } });
  const atoken = adm.json?.data?.token;
  check('F14 管理员登录', adm.json?.ok && adm.json.data.user.role === 'admin');

  const dash = await call('/api/admin/dashboard', { token: atoken });
  check('F14 管理后台概览', dash.json?.ok && dash.json.data.users.total >= 5 && dash.json.data.trend.length > 0,
    `用户${dash.json?.data?.users?.total} 关注${dash.json?.data?.watch?.total} 告警${dash.json?.data?.alert?.total} 趋势${dash.json?.data?.trend?.length}天`);

  const ul = await call('/api/admin/users?pageSize=20', { token: atoken });
  check('F14 用户管理列表', ul.json?.ok && ul.json.data.items.length >= 5 &&
    ul.json.data.items.every((u) => 'watchCount' in u && 'roleLabel' in u), `${ul.json?.data?.total} 个用户`);

  const sc = await call('/api/admin/alerts/scan', { method: 'POST', token: atoken, body: {} });
  check('F14 手动触发阈值扫描', sc.json?.ok && typeof sc.json.data.scanned === 'number',
    `扫描 ${sc.json?.data?.scanned} 条关注，新增 ${sc.json?.data?.created} 条告警`);

  const prices = await call('/api/admin/prices?pageSize=5', { token: atoken });
  check('F14 价格数据查看', prices.json?.ok && prices.json.data.items.length > 0 && !!prices.json.data.items[0].batchNo,
    `共 ${prices.json?.data?.total} 条`);

  const pid = prices.json?.data?.items?.[0]?.id;
  const oldPrice = prices.json?.data?.items?.[0]?.price;
  const corr = await call(`/api/admin/prices/${pid}`, { method: 'PUT', token: atoken, body: { price: oldPrice + 1, reason: '测试修正' } });
  check('F14 价格修正（留痕）', corr.json?.ok && corr.json.data.after === oldPrice + 1);

  const snaps = await call('/api/admin/snapshots?limit=5', { token: atoken });
  check('F14 每日快照与批次审计', snaps.json?.ok && snaps.json.data.items.length === 5 && !!snaps.json.data.items[0].batchNo);

  const wc = await call('/api/admin/watch-config', { token: atoken });
  check('F14 关注阈值配置', wc.json?.ok && wc.json.data.items.length > 0);

  const pc = await call('/api/admin/push-config', { token: atoken });
  check('F14 推送通道配置', pc.json?.ok && pc.json.data.channels.length === 4,
    pc.json?.data?.channels?.map((c) => c.name).join('/'));

  const aud = await call('/api/admin/audit?pageSize=10', { token: atoken });
  check('F14 操作审计日志', aud.json?.ok && aud.json.data.items.length > 0,
    `${aud.json?.data?.total} 条，动作 ${aud.json?.data?.actionSummary?.slice(0, 3).map((a) => a.action).join(',')}`);

  const cfg = await call('/api/admin/config', { token: atoken });
  check('F14 系统设置读取', cfg.json?.ok && !!cfg.json.data.site_name);

  const cfgw = await call('/api/admin/config', { method: 'PUT', token: atoken, body: { announcement: '测试公告内容' } });
  check('F14 系统设置写入', cfgw.json?.ok && cfgw.json.data.config.announcement === '测试公告内容');

  const reqs = await call('/api/admin/species-requests', { token: atoken });
  check('F14 品种申报处理列表', reqs.json?.ok && reqs.json.data.items.length > 0);
  const rid = reqs.json?.data?.items?.[0]?.id;
  const hr = await call(`/api/admin/species-requests/${rid}`, { method: 'PUT', token: atoken, body: { status: 'approved' } });
  check('F14 品种申报审批', hr.json?.ok === true);

  // 导出权限门禁：普通用户
  const fu = await call('/api/auth/login', { method: 'POST', body: { email: 'user@yujiacha.local', password: 'Demo@2026' } });
  const utoken = fu.json?.data?.token;
  const ucsv = await call('/api/export/report.csv', { token: utoken });
  check('权限：普通用户不可导出', ucsv.status === 403 && ucsv.json?.error?.code === 'EXPORT_FORBIDDEN');

  const uw = await call('/api/watch', { token: utoken });
  check('权限：普通用户可订阅关注', uw.json?.ok && uw.json.data.items.length >= 3, `${uw.json?.data?.total} 个关注`);

  // ── F13 注销 ───────────────────────────────────────────────────────
  const de = await call('/api/auth/deactivate', { method: 'POST', token: token3, body: { password: 'Final@2026', reason: '测试注销' } });
  check('F13 注销账号（软删除+解绑）', de.json?.ok && typeof de.json.data.unbindWatches === 'number',
    `解绑关注 ${de.json?.data?.unbindWatches} 条`);
  const afterDe = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Final@2026' } });
  check('F13 注销后无法登录（邮箱已匿名化）', afterDe.status === 401 || afterDe.status === 403,
    `HTTP ${afterDe.status} ${afterDe.json?.error?.code}`);
  const oldToken = await call('/api/auth/me', { token: token3 });
  check('F13 注销后旧令牌失效', oldToken.status === 401, `HTTP ${oldToken.status}`);

  // ── 静态资源 ───────────────────────────────────────────────────────
  for (const [p, name] of [['/web/', 'Web 网站'], ['/admin/', '管理后台'], ['/mini/', '小程序预览']]) {
    const r = await fetch(B + p);
    const t = await r.text();
    check(`静态资源 ${name}（${p}）`, r.status === 200 && t.includes('<'), `HTTP ${r.status}`);
  }
  const tok = await fetch(B + '/shared/tokens.css');
  check('共享 Design Token', tok.status === 200);
  const tokText = await tok.text();
  check('Design Token 含涨红跌绿约定', tokText.includes('--up:') && tokText.includes('--down:') && tokText.includes('涨'));
  check('Design Token 含三套主题', tokText.includes('data-theme="dark"') && tokText.includes('data-theme="academic"'));

  // ── 输出 ───────────────────────────────────────────────────────────
  console.log(results.join('\n'));
  console.log('─'.repeat(78));
  console.log(`  通过 ${pass}　失败 ${fail}　共 ${pass + fail} 项\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('测试异常：', e); process.exit(1); });
