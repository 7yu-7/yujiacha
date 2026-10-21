/**
 * 统一 REST API 路由
 * 服务四端：微信小程序 / 移动 App / 管理后台 / Web(H5)
 *
 * 约定：
 *  - 统一响应体 { ok, data, ts } / { ok:false, error:{code,message,details} }
 *  - 鉴权：Authorization: Bearer <accessToken>
 *  - 权限分级：游客只读不可订阅；登录可订阅；教研/政府可导出；管理员可进管理后台
 */
const { ApiError } = require('../lib/http');
const price = require('../services/price-service');
const account = require('../services/account-service');
const admin = require('../services/admin-service');
const exporter = require('../services/export-service');
const config = require('../config');

// ── 鉴权中间件（可选鉴权：游客可访问只读接口）────────────────────────────
async function attachUser(ctx) {
  const h = ctx.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  ctx.state.user = null;
  ctx.state.role = 'guest';
  if (token) {
    const payload = account.authenticate(token);
    if (payload) {
      try {
        const u = await account.findById(payload.uid);
        if (u && u.status !== 'deleted') {
          ctx.state.user = account.publicUser(u);
          ctx.state.role = u.role;
        }
      } catch { /* 令牌失效时按游客处理 */ }
    }
  }
}

/** 强制登录 */
function auth(ctx) {
  if (!ctx.state.user) throw new ApiError(401, '请先登录', 'UNAUTHORIZED');
  return ctx.state.user;
}

/** 需要指定角色之一 */
function requireRole(ctx, roles) {
  const u = auth(ctx);
  if (!roles.includes(u.role)) throw new ApiError(403, '当前账号权限不足', 'FORBIDDEN');
  return u;
}

/** 导出权限门禁（教研/政府/管理员） */
function guardExport(ctx) {
  const perm = exporter.checkExportPermission(ctx.state.user);
  if (!perm.allowed) throw new ApiError(403, perm.reason, 'EXPORT_FORBIDDEN');
  return ctx.state.user;
}

function registerRoutes(router) {
  router.use(attachUser);

  // ═══════════════════════════════════════════════════════════════════
  //  健康检查 / 元数据
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/health', async (ctx) => {
    const info = await require('../lib/db').ping();
    ctx.ok({ status: 'ok', app: config.app.name, version: config.app.version, db: info, uptime: process.uptime() });
  });

  router.get('/api/meta', async (ctx) => {
    ctx.ok(await price.meta());
  });

  router.get('/api/status', async (ctx) => {
    ctx.ok(await price.dataStatus());
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F1 查看所有品种
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/species', async (ctx) => {
    const q = ctx.query;
    ctx.ok(await price.listSpecies({
      date: q.date || null,
      province: q.province || null,
      market: q.market || null,
      category: q.category || null,
      subCategory: q.subCategory || q.sub || null,
      keyword: q.keyword || q.kw || null,
      sort: q.sort || 'category',
      order: q.order || null,
      page: q.page, pageSize: q.pageSize || q.size,
    }));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F2 搜索某一品种（中文名 / 拼音首字母 / 别名 / 模糊 / 智能联想）
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/search', async (ctx) => {
    const kw = ctx.query.q || ctx.query.keyword || ctx.query.kw || '';
    ctx.ok(await price.search(kw, { limit: Number(ctx.query.limit || 20) }));
  });

  /** 智能联想（输入即出，轻量） */
  router.get('/api/search/suggest', async (ctx) => {
    const kw = ctx.query.q || ctx.query.keyword || '';
    const r = await price.search(kw, { limit: 8 });
    ctx.ok({ keyword: r.keyword, suggestions: r.suggestions.map((s) => ({ species: s.species, category: s.category, price: s.price, changePct: s.changePct })) });
  });

  /** F2 空结果引导：申报新品种 */
  router.post('/api/species/request', async (ctx) => {
    const b = await ctx.body();
    if (!b.name) throw new ApiError(400, '请填写品种名称', 'BAD_NAME');
    const { insertId } = await require('../lib/db').run(
      `INSERT INTO species_request (user_id, name, province, contact, remark) VALUES (?, ?, ?, ?, ?)`,
      [ctx.state.user ? ctx.state.user.id : null, String(b.name).slice(0, 64), b.province || null, b.contact || null, b.remark || null]
    );
    ctx.created({ id: insertId, message: '申报已提交，我们会在 3 个工作日内评估。' });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F3 每日渔价 + 地图选省（近一周趋势）
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/map/provinces', async (ctx) => {
    ctx.ok(await price.mapProvinces({ date: ctx.query.date || null, days: Number(ctx.query.days || 7) }));
  });

  router.get('/api/provinces/:name', async (ctx) => {
    ctx.ok(await price.provinceDetail(ctx.params.name, {
      date: ctx.query.date || null,
      range: Number(ctx.query.range || 7),
      market: ctx.query.market || null,
    }));
  });

  router.get('/api/movers', async (ctx) => {
    ctx.ok(await price.movers({ date: ctx.query.date || null, scope: ctx.query.scope || 'province', limit: Number(ctx.query.limit || 10) }));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F5 全国渔价日报表（省份排序，T+0）
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/report/daily', async (ctx) => {
    ctx.ok(await price.dailyReport({ date: ctx.query.date || null, dimension: ctx.query.dimension || 'province' }));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F6 品种详情 / F11 历史对比
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/species/:name', async (ctx) => {
    ctx.ok(await price.speciesDetail(ctx.params.name, {
      province: ctx.query.province || null,
      days: Number(ctx.query.days || 30),
    }));
  });

  router.get('/api/compare', async (ctx) => {
    ctx.ok(await price.compare(ctx.query.species || ctx.query.names || '', {
      days: Number(ctx.query.days || 90),
      province: ctx.query.province || null,
    }));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F13 账户体系
  // ═══════════════════════════════════════════════════════════════════
  router.post('/api/auth/register', async (ctx) => {
    const b = await ctx.body();
    ctx.created(await account.register(b));
  });

  router.get('/api/auth/verify-email', async (ctx) => {
    const token = ctx.query.token;
    if (!token) throw new ApiError(400, '缺少 token', 'BAD_TOKEN');
    ctx.ok(await account.verifyEmail(token));
  });

  router.post('/api/auth/login', async (ctx) => {
    const b = await ctx.body();
    ctx.ok(await account.login(b));
  });

  router.post('/api/auth/refresh', async (ctx) => {
    const b = await ctx.body();
    if (!b.refreshToken) throw new ApiError(400, '缺少 refreshToken', 'BAD_TOKEN');
    ctx.ok(await account.refresh(b.refreshToken));
  });

  router.post('/api/auth/forgot-password', async (ctx) => {
    const b = await ctx.body();
    ctx.ok(await account.forgotPassword(b.email));
  });

  router.post('/api/auth/reset-password', async (ctx) => {
    const b = await ctx.body();
    ctx.ok(await account.resetPassword({ token: b.token, password: b.password }));
  });

  router.get('/api/auth/me', async (ctx) => {
    const u = auth(ctx);
    ctx.ok(u);
  });

  router.put('/api/auth/profile', async (ctx) => {
    const u = auth(ctx);
    const b = await ctx.body();
    ctx.ok(await account.updateProfile({
      uid: u.id, nickname: b.nickname, org: b.org, theme: b.theme,
      pushEnabled: b.pushEnabled, email: b.email,
    }));
  });

  router.post('/api/auth/change-password', async (ctx) => {
    const u = auth(ctx);
    const b = await ctx.body();
    ctx.ok(await account.changePassword({ uid: u.id, oldPassword: b.oldPassword, newPassword: b.newPassword }));
  });

  router.post('/api/auth/deactivate', async (ctx) => {
    const u = auth(ctx);
    const b = await ctx.body();
    ctx.ok(await account.deactivate({ uid: u.id, password: b.password, reason: b.reason }));
  });

  router.post('/api/auth/logout', async (ctx) => {
    const b = await ctx.body().catch(() => ({}));
    if (b && b.refreshToken) {
      await require('../lib/db').run(
        `UPDATE auth_token SET used_at = ? WHERE token = ? AND type = 'refresh'`,
        [require('../lib/db').formatDateTime(new Date()), b.refreshToken]
      );
    }
    ctx.ok({ ok: true });
  });

  /** 站内取件箱（开发环境：无 SMTP 时读取邮箱验证 / 重置链接，便于联调） */
  router.get('/api/auth/outbox', async (ctx) => {
    if (config.isProd) throw new ApiError(404, '接口不存在', 'NOT_FOUND');
    ctx.ok({ items: account.readOutbox(Number(ctx.query.limit || 20)) });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F4 我的关注品种（多端同步）
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/watch', async (ctx) => {
    const u = auth(ctx);
    ctx.ok(await account.listWatches(u.id));
  });

  router.post('/api/watch', async (ctx) => {
    const u = auth(ctx);
    const b = await ctx.body();
    ctx.created(await account.addWatch(u.id, {
      species: b.species, province: b.province || null,
      thresholdUp: b.thresholdUp ?? null, thresholdDown: b.thresholdDown ?? null,
      notifyChannel: b.notifyChannel || 'app',
    }));
  });

  router.delete('/api/watch/:id', async (ctx) => {
    const u = auth(ctx);
    ctx.ok(await account.removeWatch(u.id, Number(ctx.params.id)));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F7 异动提醒
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/alerts', async (ctx) => {
    const u = auth(ctx);
    ctx.ok(await account.listAlerts(u.id, {
      unreadOnly: ctx.query.unread === '1' || ctx.query.unread === 'true',
      limit: Number(ctx.query.limit || 50),
    }));
  });

  router.post('/api/alerts/read', async (ctx) => {
    const u = auth(ctx);
    const b = await ctx.body().catch(() => ({}));
    ctx.ok(await account.readAlerts(u.id, b && b.ids ? b.ids : null));
  });

  /** 注册推送订阅（小程序订阅消息 / Web Push 授权登记） */
  router.post('/api/push/subscribe', async (ctx) => {
    const u = auth(ctx);
    const b = await ctx.body();
    if (!b.channel) throw new ApiError(400, '缺少 channel', 'BAD_CHANNEL');
    await require('../lib/db').run(
      `INSERT INTO push_subscription (user_id, channel, endpoint, enabled) VALUES (?, ?, ?, 1)`,
      [u.id, b.channel, b.endpoint ? String(b.endpoint).slice(0, 500) : null]
    );
    ctx.created({ ok: true, channel: b.channel });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F8 导出与分享（教研 / 政府 / 管理员）
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/export/report.csv', async (ctx) => {
    guardExport(ctx);
    const r = await exporter.reportCsv({ date: ctx.query.date || null, dimension: ctx.query.dimension || 'province' });
    ctx.text(200, r.csv, 'text/csv; charset=utf-8');
  });

  router.get('/api/export/species.csv', async (ctx) => {
    guardExport(ctx);
    const r = await exporter.speciesCsv({ species: ctx.query.species, province: ctx.query.province || null, days: Number(ctx.query.days || 30) });
    ctx.text(200, r.csv, 'text/csv; charset=utf-8');
  });

  router.get('/api/export/watch.csv', async (ctx) => {
    const u = guardExport(ctx);
    const r = await exporter.watchCsv(u.id);
    ctx.text(200, r.csv, 'text/csv; charset=utf-8');
  });

  /** 分享长图（SVG，可截图/另存） */
  router.get('/api/export/report.svg', async (ctx) => {
    const r = await exporter.reportSvg({ date: ctx.query.date || null, top: Number(ctx.query.top || 12) });
    ctx.text(200, r.svg, 'image/svg+xml; charset=utf-8');
  });

  /** 打印友好页（用于浏览器「另存为 PDF」） */
  router.get('/api/export/print', async (ctx) => {
    const rep = await price.dailyReport({ date: ctx.query.date || null, dimension: ctx.query.dimension || 'province' });
    ctx.text(200, renderPrintPage(rep), 'text/html; charset=utf-8');
  });

  // ═══════════════════════════════════════════════════════════════════
  //  F14 管理后台
  // ═══════════════════════════════════════════════════════════════════
  router.get('/api/admin/dashboard', async (ctx) => { admin.requireAdmin(ctx); ctx.ok(await admin.dashboard()); });

  router.get('/api/admin/users', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.listUsers({
      keyword: ctx.query.keyword || '', status: ctx.query.status || '', role: ctx.query.role || '',
      page: ctx.query.page, pageSize: ctx.query.pageSize,
    }));
  });

  router.put('/api/admin/users/:id/status', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body();
    ctx.ok(await admin.setUserStatus(a, { userId: Number(ctx.params.id), status: b.status }));
  });

  router.put('/api/admin/users/:id/role', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body();
    ctx.ok(await admin.setUserRole(a, { userId: Number(ctx.params.id), role: b.role }));
  });

  router.delete('/api/admin/users/:id', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    ctx.ok(await admin.purgeUser(a, { userId: Number(ctx.params.id) }));
  });

  router.get('/api/admin/prices', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.listPriceRows({
      date: ctx.query.date || null, province: ctx.query.province || '', species: ctx.query.species || '',
      market: ctx.query.market || '', category: ctx.query.category || '',
      page: ctx.query.page, pageSize: ctx.query.pageSize,
    }));
  });

  router.put('/api/admin/prices/:id', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body();
    ctx.ok(await admin.correctPrice(a, { id: Number(ctx.params.id), price: b.price, reason: b.reason }));
  });

  router.get('/api/admin/snapshots', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.listSnapshots({ limit: Number(ctx.query.limit || 30) }));
  });

  router.get('/api/admin/watch-config', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.listWatchConfig({
      page: ctx.query.page, pageSize: ctx.query.pageSize, keyword: ctx.query.keyword || '',
    }));
  });

  router.put('/api/admin/watch-config/:id', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body();
    ctx.ok(await admin.updateWatchConfig(a, {
      id: Number(ctx.params.id), thresholdUp: b.thresholdUp, thresholdDown: b.thresholdDown, notifyChannel: b.notifyChannel,
    }));
  });

  router.get('/api/admin/push-config', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.pushConfig());
  });

  /** 手动触发阈值扫描（等价于定时任务） */
  router.post('/api/admin/alerts/scan', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body().catch(() => ({}));
    const r = await account.scanAlerts({ date: b && b.date ? b.date : null });
    await account.audit(a.id, a.email, 'ALERT_SCAN_MANUAL', r.date, `手动扫描：新增 ${r.created} 条`);
    ctx.ok(r);
  });

  router.get('/api/admin/audit', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.listAudit({
      action: ctx.query.action || '', keyword: ctx.query.keyword || '',
      page: ctx.query.page, pageSize: ctx.query.pageSize,
    }));
  });

  router.get('/api/admin/config', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.getConfig());
  });

  router.put('/api/admin/config', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body();
    ctx.ok(await admin.setConfig(a, b));
  });

  router.get('/api/admin/species-requests', async (ctx) => {
    admin.requireAdmin(ctx);
    ctx.ok(await admin.listRequests({ status: ctx.query.status || '', page: ctx.query.page, pageSize: ctx.query.pageSize }));
  });

  router.put('/api/admin/species-requests/:id', async (ctx) => {
    const a = admin.requireAdmin(ctx);
    const b = await ctx.body();
    ctx.ok(await admin.handleRequest(a, { id: Number(ctx.params.id), status: b.status }));
  });

  // ── 公开配置（前端读取公告等）─────────────────────────────────────────
  router.get('/api/config/public', async (ctx) => {
    const cfg = await admin.getConfig();
    ctx.ok({
      siteName: cfg.site_name || config.app.name,
      announcement: cfg.announcement || '',
      hotSearch: (cfg.hot_search || '').split(',').filter(Boolean),
      alertThreshold: Number(cfg.alert_threshold || 5),
      dataSource: cfg.data_source || '',
      t0: cfg.t0_publish === 'true',
    });
  });
}

/** 打印友好 HTML（用于浏览器导出 PDF） */
function renderPrintPage(rep) {
  const rows = rep.rows.map((r) => `
    <tr>
      <td class="r">${r.rank}</td><td>${r.province}</td>
      <td class="n">${r.avgPrice}</td>
      <td class="n ${r.changePct > 0 ? 'up' : r.changePct < 0 ? 'down' : ''}">${r.changePct == null ? '—' : (r.changePct > 0 ? '▲' : r.changePct < 0 ? '▼' : '—') + ' ' + Math.abs(r.changePct).toFixed(2) + '%'}</td>
      <td class="n">${r.speciesCount}</td><td class="n">${r.marketCount}</td>
      <td>${r.leadUp ? `${r.leadUp.species}（+${r.leadUp.changePct}%）` : '—'}</td>
      <td><span class="tag t-${r.tier.tier}">${r.tier.label}</span></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>鱼价查 · 全国水产品价格日报 ${rep.date}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "PingFang SC","Microsoft YaHei",sans-serif; color:#1F2933; margin:0; padding:24px; background:#fff; }
  h1 { font-size:22px; margin:0 0 6px; color:#005F73; }
  .sub { font-size:12.5px; color:#6B7280; margin-bottom:18px; line-height:1.7; }
  .cards { display:flex; gap:10px; margin-bottom:18px; }
  .card { flex:1; border:1px solid #D8E3E4; border-radius:10px; padding:12px 14px; }
  .card .l { font-size:11.5px; color:#6B7280; }
  .card .v { font-size:19px; font-weight:700; color:#005F73; margin-top:4px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th { background:#005F73; color:#fff; padding:9px 8px; text-align:left; font-weight:600; }
  td { padding:8px; border-bottom:1px solid #E7EEEF; }
  tr:nth-child(even) td { background:#F7FAFA; }
  .r { width:44px; font-weight:700; color:#E0503C; }
  .n { text-align:right; font-variant-numeric: tabular-nums; }
  .up { color:#E0503C; font-weight:600; } .down { color:#30A46C; font-weight:600; }
  .tag { padding:2px 8px; border-radius:10px; font-size:11.5px; color:#fff; }
  .t-low { background:#6FA8DC; } .t-mid { background:#F4C361; } .t-high { background:#E98B7B; } .t-na { background:#C3CDD4; }
  .foot { margin-top:16px; font-size:11.5px; color:#6B7280; line-height:1.7; border-top:1px solid #E7EEEF; padding-top:12px; }
  @media print { body { padding:0; } .noprint { display:none; } }
</style></head>
<body>
  <h1>鱼价查 · 全国水产品价格日报</h1>
  <div class="sub">
    数据日期 <b>${rep.date}</b>　|　覆盖市场 ${rep.filterBar.marketCount} 家　|　记录 ${Number(rep.filterBar.recordCount).toLocaleString()} 条　|　采集批次号 ${rep.filterBar.batchNo || '—'}（可审计）<br>
    数据来源：农业农村部全国农产品价格信息系统 pfsc.agri.cn　·　T+0 当日发布
  </div>
  <div class="cards">
    <div class="card"><div class="l">全国综合均价</div><div class="v">${rep.overview.nationalAvg ?? '—'} 元/公斤</div></div>
    <div class="card"><div class="l">上涨省份</div><div class="v" style="color:#E0503C">${rep.overview.upCount} 个</div></div>
    <div class="card"><div class="l">下跌省份</div><div class="v" style="color:#30A46C">${rep.overview.downCount} 个</div></div>
    <div class="card"><div class="l">最高均价省份</div><div class="v">${rep.overview.maxProvince ? rep.overview.maxProvince.short : '—'}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>名次</th><th>省级行政区</th><th style="text-align:right">当日综合均价</th><th style="text-align:right">较昨日</th>
      <th style="text-align:right">覆盖品种</th><th style="text-align:right">覆盖市场</th><th>领涨品种</th><th>价格档位</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">口径说明：${rep.disclaimer}</div>
  <div class="noprint" style="margin-top:20px;text-align:center;color:#6B7280;font-size:12px">按 Ctrl/Cmd + P 可另存为 PDF</div>
</body></html>`;
}

module.exports = { registerRoutes };
