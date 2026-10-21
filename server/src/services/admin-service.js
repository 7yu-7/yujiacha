/**
 * 管理后台服务（F14）
 * 用户管理（查看/禁用/处理注销） / 价格数据（日报·品种·趋势 / 修正） /
 * 关注阈值与推送配置 / 操作审计日志 / 系统设置与公告
 * 仅 role=admin 可访问，全部写操作留痕到 audit_log
 */
const db = require('../lib/db');
const { ApiError } = require('../lib/http');
const { publicUser, audit } = require('./account-service');
const price = require('./price-service');

function requireAdmin(ctx) {
  if (!ctx.state.user || ctx.state.user.role !== 'admin') {
    throw new ApiError(403, '需要管理员权限', 'FORBIDDEN');
  }
  return ctx.state.user;
}

// ── 概览看板 ────────────────────────────────────────────────────────────
async function dashboard() {
  const status = await price.dataStatus();
  const totalUsers = await db.query(`SELECT COUNT(*) AS c FROM app_user WHERE status <> 'deleted'`);
  const activeUsers = await db.query(`SELECT COUNT(*) AS c FROM app_user WHERE status = 'active'`);
  const pendingUsers = await db.query(`SELECT COUNT(*) AS c FROM app_user WHERE status = 'pending'`);
  const disabledUsers = await db.query(`SELECT COUNT(*) AS c FROM app_user WHERE status = 'disabled'`);
  const deletedUsers = await db.query(`SELECT COUNT(*) AS c FROM app_user WHERE status = 'deleted'`);
  const watchTotal = await db.query(`SELECT COUNT(*) AS c FROM watch_item`);
  const alertTotal = await db.query(`SELECT COUNT(*) AS c FROM alert_log`);
  const alertUnread = await db.query(`SELECT COUNT(*) AS c FROM alert_log WHERE is_read = 0`);
  const requestPending = await db.query(`SELECT COUNT(*) AS c FROM species_request WHERE status = 'pending'`);

  // 近 14 天采集记录量趋势
  const trend = await db.query(
    `SELECT date, record_count, market_count, species_count, province_count, batch_no, published_at
       FROM daily_snapshot ORDER BY date DESC LIMIT 14`
  );

  const roleDist = await db.query(`SELECT role, COUNT(*) AS c FROM app_user WHERE status <> 'deleted' GROUP BY role`);

  return {
    status,
    users: {
      total: Number(totalUsers[0].c), active: Number(activeUsers[0].c),
      pending: Number(pendingUsers[0].c), disabled: Number(disabledUsers[0].c), deleted: Number(deletedUsers[0].c),
      byRole: roleDist.map((r) => ({ role: r.role, count: Number(r.c) })),
    },
    watch: { total: Number(watchTotal[0].c) },
    alert: { total: Number(alertTotal[0].c), unread: Number(alertUnread[0].c) },
    request: { pending: Number(requestPending[0].c) },
    trend: trend.reverse().map((r) => ({
      date: String(r.date).slice(0, 10), recordCount: Number(r.record_count),
      marketCount: Number(r.market_count), speciesCount: Number(r.species_count),
      provinceCount: Number(r.province_count), batchNo: r.batch_no, publishedAt: r.published_at,
    })),
    dbInfo: await db.ping(),
  };
}

// ── 用户管理 ────────────────────────────────────────────────────────────
async function listUsers({ keyword = '', status = '', role = '', page = 1, pageSize = 20 } = {}) {
  const where = [];
  const params = [];
  if (keyword) { where.push('(email LIKE ? OR nickname LIKE ? OR org LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (role) { where.push('role = ?'); params.push(role); }
  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db.query(`SELECT COUNT(*) AS c FROM app_user ${wsql}`, params);
  const p = Math.max(1, Number(page)), ps = Math.min(200, Math.max(1, Number(pageSize)));
  const rows = await db.query(
    `SELECT * FROM app_user ${wsql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, ps, (p - 1) * ps]
  );

  // 附带关注数
  const items = [];
  for (const u of rows) {
    const wc = await db.query(`SELECT COUNT(*) AS c FROM watch_item WHERE user_id = ?`, [u.id]);
    const ac = await db.query(`SELECT COUNT(*) AS c FROM alert_log WHERE user_id = ?`, [u.id]);
    items.push({ ...publicUser(u), watchCount: Number(wc[0].c), alertCount: Number(ac[0].c), deletedAt: u.deleted_at });
  }
  return { total: Number(total[0].c), page: p, pageSize: ps, items };
}

async function setUserStatus(admin, { userId, status }) {
  if (!['active', 'disabled', 'pending'].includes(status)) throw new ApiError(400, '状态不合法', 'BAD_STATUS');
  const rows = await db.query(`SELECT * FROM app_user WHERE id = ? LIMIT 1`, [userId]);
  const u = rows[0];
  if (!u) throw new ApiError(404, '用户不存在', 'NOT_FOUND');
  if (u.role === 'admin') throw new ApiError(400, '不能修改管理员状态', 'ADMIN_PROTECTED');
  await db.run(`UPDATE app_user SET status = ? WHERE id = ?`, [status, userId]);
  if (status === 'disabled') {
    await db.run(`UPDATE auth_token SET used_at = ? WHERE user_id = ? AND used_at IS NULL`, [db.formatDateTime(new Date()), userId]);
  }
  await audit(admin.id, admin.email, 'USER_STATUS_CHANGE', u.email, `${u.status} → ${status}`);
  return { ok: true, userId, status };
}

async function setUserRole(admin, { userId, role }) {
  if (!['user', 'researcher', 'gov', 'admin'].includes(role)) throw new ApiError(400, '角色不合法', 'BAD_ROLE');
  const rows = await db.query(`SELECT * FROM app_user WHERE id = ? LIMIT 1`, [userId]);
  const u = rows[0];
  if (!u) throw new ApiError(404, '用户不存在', 'NOT_FOUND');
  await db.run(`UPDATE app_user SET role = ? WHERE id = ?`, [role, userId]);
  await audit(admin.id, admin.email, 'USER_ROLE_CHANGE', u.email, `${u.role} → ${role}`);
  return { ok: true, userId, role };
}

/** 处理注销申请：彻底匿名化（合规留痕） */
async function purgeUser(admin, { userId }) {
  const rows = await db.query(`SELECT * FROM app_user WHERE id = ? LIMIT 1`, [userId]);
  const u = rows[0];
  if (!u) throw new ApiError(404, '用户不存在', 'NOT_FOUND');
  if (u.role === 'admin') throw new ApiError(400, '不能清除管理员账号', 'ADMIN_PROTECTED');
  await db.run(`DELETE FROM watch_item WHERE user_id = ?`, [userId]);
  await db.run(`DELETE FROM auth_token WHERE user_id = ?`, [userId]);
  await db.run(`UPDATE push_subscription SET enabled = 0 WHERE user_id = ?`, [userId]);
  await db.run(
    `UPDATE app_user SET email = ?, password_hash = ?, nickname = NULL, org = NULL, status = 'deleted', deleted_at = ?, push_enabled = 0 WHERE id = ?`,
    [`purged+${userId}@yujiacha.invalid`, 'purged', db.formatDateTime(new Date()), userId]
  );
  await audit(admin.id, admin.email, 'USER_PURGE', u.email, '管理员执行账号清除（匿名化留存）');
  return { ok: true, userId };
}

// ── 价格数据 ────────────────────────────────────────────────────────────
async function listPriceRows({ date = null, province = '', species = '', market = '', category = '', page = 1, pageSize = 50 } = {}) {
  const d = date || (await price.latestDate());
  const where = ['date = ?'];
  const params = [d];
  if (province) { where.push('province = ?'); params.push(province); }
  if (species) { where.push('species = ?'); params.push(species); }
  if (market) { where.push('market = ?'); params.push(market); }
  if (category) { where.push('category_l1 = ?'); params.push(category); }

  const total = await db.query(`SELECT COUNT(*) AS c FROM price_daily WHERE ${where.join(' AND ')}`, params);
  const p = Math.max(1, Number(page)), ps = Math.min(200, Math.max(1, Number(pageSize)));
  const rows = await db.query(
    `SELECT * FROM price_daily WHERE ${where.join(' AND ')} ORDER BY province, market, species LIMIT ? OFFSET ?`,
    [...params, ps, (p - 1) * ps]
  );
  return {
    date: d, total: Number(total[0].c), page: p, pageSize: ps,
    items: rows.map((r) => ({
      id: r.id, date: String(r.date).slice(0, 10), province: r.province, provinceCode: r.province_code,
      market: r.market, categoryL1: r.category_l1, categoryL2: r.category_l2, species: r.species,
      price: Number(r.price), unit: r.unit, spec: r.spec, sourceUrl: r.source_url,
      batchNo: r.batch_no, collectedAt: r.collected_at,
    })),
  };
}

/** 修正单条价格（留痕，可审计） */
async function correctPrice(admin, { id, price: newPrice, reason = '' }) {
  const rows = await db.query(`SELECT * FROM price_daily WHERE id = ? LIMIT 1`, [id]);
  const row = rows[0];
  if (!row) throw new ApiError(404, '记录不存在', 'NOT_FOUND');
  const p = Number(newPrice);
  if (!Number.isFinite(p) || p <= 0) throw new ApiError(400, '价格必须为正数', 'BAD_PRICE');
  await db.run(`UPDATE price_daily SET price = ? WHERE id = ?`, [p, id]);
  await audit(admin.id, admin.email, 'PRICE_CORRECT', `price_daily#${id}`,
    `${row.province}/${row.market}/${row.species}：${row.price} → ${p}${reason ? `；原因：${reason}` : ''}`);
  price.invalidateCache();
  return { ok: true, id, before: Number(row.price), after: p };
}

/** 快照列表（T+0 发布状态与批次审计） */
async function listSnapshots({ limit = 30 } = {}) {
  const rows = await db.query(
    `SELECT * FROM daily_snapshot ORDER BY date DESC LIMIT ?`, [Number(limit)]
  );
  return {
    items: rows.map((r) => ({
      date: String(r.date).slice(0, 10), status: r.status,
      marketCount: Number(r.market_count), provinceCount: Number(r.province_count),
      speciesCount: Number(r.species_count), recordCount: Number(r.record_count),
      batchNo: r.batch_no, publishedAt: r.published_at,
    })),
  };
}

// ── 关注阈值与推送配置 ─────────────────────────────────────────────────
async function listWatchConfig({ page = 1, pageSize = 30, keyword = '' } = {}) {
  const where = [];
  const params = [];
  if (keyword) { where.push('(w.species LIKE ? OR u.email LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db.query(
    `SELECT COUNT(*) AS c FROM watch_item w JOIN app_user u ON u.id = w.user_id ${wsql}`, params
  );
  const p = Math.max(1, Number(page)), ps = Math.min(200, Math.max(1, Number(pageSize)));
  const rows = await db.query(
    `SELECT w.*, u.email, u.nickname, u.role, u.push_enabled
       FROM watch_item w JOIN app_user u ON u.id = w.user_id ${wsql}
      ORDER BY w.created_at DESC LIMIT ? OFFSET ?`, [...params, ps, (p - 1) * ps]
  );
  return {
    total: Number(total[0].c), page: p, pageSize: ps,
    items: rows.map((r) => ({
      id: r.id, userId: r.user_id, email: r.email, nickname: r.nickname, role: r.role,
      species: r.species, province: r.province, scope: r.province || '全国',
      thresholdUp: r.threshold_up == null ? null : Number(r.threshold_up),
      thresholdDown: r.threshold_down == null ? null : Number(r.threshold_down),
      notifyChannel: r.notify_channel, userPushEnabled: !!r.push_enabled, createdAt: r.created_at,
    })),
  };
}

async function updateWatchConfig(admin, { id, thresholdUp, thresholdDown, notifyChannel }) {
  const rows = await db.query(`SELECT * FROM watch_item WHERE id = ? LIMIT 1`, [id]);
  const w = rows[0];
  if (!w) throw new ApiError(404, '关注项不存在', 'NOT_FOUND');
  const sets = [], params = [];
  if (thresholdUp !== undefined) { sets.push('threshold_up = ?'); params.push(thresholdUp); }
  if (thresholdDown !== undefined) { sets.push('threshold_down = ?'); params.push(thresholdDown); }
  if (notifyChannel !== undefined) { sets.push('notify_channel = ?'); params.push(notifyChannel); }
  if (!sets.length) return { ok: true };
  params.push(id);
  await db.run(`UPDATE watch_item SET ${sets.join(', ')} WHERE id = ?`, params);
  await audit(admin.id, admin.email, 'WATCH_CONFIG_UPDATE', `watch_item#${id}`, JSON.stringify({ thresholdUp, thresholdDown, notifyChannel }));
  return { ok: true };
}

/** 推送通道配置与统计 */
async function pushConfig() {
  const rows = await db.query(
    `SELECT notify_channel AS channel, COUNT(*) AS c FROM watch_item GROUP BY notify_channel`
  );
  const sent = await db.query(
    `SELECT channel, COUNT(*) AS c FROM alert_log WHERE pushed = 1 GROUP BY channel`
  );
  const subs = await db.query(
    `SELECT channel, COUNT(*) AS c FROM push_subscription WHERE enabled = 1 GROUP BY channel`
  );
  const cfg = await getConfig();
  return {
    channels: [
      { id: 'wechat_push', name: '微信订阅消息', target: '微信小程序', note: '需用户主动授权一次订阅' },
      { id: 'app_push', name: '系统推送', target: 'iOS APNs / Android FCM + 厂商通道', note: '需在移动端授权通知权限' },
      { id: 'web_push', name: '浏览器通知', target: 'Web / H5', note: '需在浏览器授权通知权限' },
      { id: 'inbox', name: '站内消息', target: '管理后台 / 客户端消息中心', note: '无需额外授权' },
    ],
    watchByChannel: rows.map((r) => ({ channel: r.channel, count: Number(r.c) })),
    sentByChannel: sent.map((r) => ({ channel: r.channel, count: Number(r.c) })),
    subscriptions: subs.map((r) => ({ channel: r.channel, count: Number(r.c) })),
    defaultThreshold: Number(cfg.alert_threshold || 5),
  };
}

// ── 审计日志 ────────────────────────────────────────────────────────────
async function listAudit({ action = '', keyword = '', page = 1, pageSize = 50 } = {}) {
  const where = [];
  const params = [];
  if (action) { where.push('action = ?'); params.push(action); }
  if (keyword) { where.push('(user_email LIKE ? OR target LIKE ? OR detail LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db.query(`SELECT COUNT(*) AS c FROM audit_log ${wsql}`, params);
  const p = Math.max(1, Number(page)), ps = Math.min(500, Math.max(1, Number(pageSize)));
  const rows = await db.query(
    `SELECT * FROM audit_log ${wsql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, ps, (p - 1) * ps]
  );
  const actions = await db.query(`SELECT action, COUNT(*) AS c FROM audit_log GROUP BY action ORDER BY c DESC`);
  return {
    total: Number(total[0].c), page: p, pageSize: ps,
    actionSummary: actions.map((a) => ({ action: a.action, count: Number(a.c) })),
    items: rows.map((r) => ({
      id: r.id, userId: r.user_id, userEmail: r.user_email, action: r.action,
      target: r.target, detail: r.detail, ip: r.ip, createdAt: r.created_at,
    })),
  };
}

// ── 系统设置 ────────────────────────────────────────────────────────────
async function getConfig() {
  const rows = await db.query(`SELECT * FROM sys_config`);
  return Object.fromEntries(rows.map((r) => [r.k, r.v]));
}

async function setConfig(admin, entries) {
  if (!entries || typeof entries !== 'object') throw new ApiError(400, '参数不合法', 'BAD_PARAMS');
  const allowed = ['site_name', 'announcement', 'alert_threshold', 'data_source', 't0_publish', 'hot_search'];
  for (const [k, v] of Object.entries(entries)) {
    if (!allowed.includes(k)) continue;
    const exist = await db.query(`SELECT k FROM sys_config WHERE k = ? LIMIT 1`, [k]);
    if (exist.length) {
      await db.run(`UPDATE sys_config SET v = ?, updated_at = ? WHERE k = ?`, [v, db.formatDateTime(new Date()), k]);
    } else {
      await db.run(`INSERT INTO sys_config (k, v) VALUES (?, ?)`, [k, v]);
    }
    await audit(admin.id, admin.email, 'CONFIG_UPDATE', k, String(v));
  }
  return { ok: true, config: await getConfig() };
}

// ── 品种申报处理 ────────────────────────────────────────────────────────
async function listRequests({ status = '', page = 1, pageSize = 30 } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  const wsql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db.query(`SELECT COUNT(*) AS c FROM species_request ${wsql}`, params);
  const p = Math.max(1, Number(page)), ps = Math.min(200, Number(pageSize) || 30);
  const rows = await db.query(`SELECT * FROM species_request ${wsql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, ps, (p - 1) * ps]);
  return { total: Number(total[0].c), page: p, pageSize: ps, items: rows };
}

async function handleRequest(admin, { id, status }) {
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new ApiError(400, '状态不合法', 'BAD_STATUS');
  const rows = await db.query(`SELECT * FROM species_request WHERE id = ? LIMIT 1`, [id]);
  if (!rows[0]) throw new ApiError(404, '申报不存在', 'NOT_FOUND');
  await db.run(`UPDATE species_request SET status = ? WHERE id = ?`, [status, id]);
  await audit(admin.id, admin.email, 'SPECIES_REQUEST_HANDLE', `species_request#${id}`, `${rows[0].name} → ${status}`);
  return { ok: true };
}

module.exports = {
  requireAdmin, dashboard, listUsers, setUserStatus, setUserRole, purgeUser,
  listPriceRows, correctPrice, listSnapshots,
  listWatchConfig, updateWatchConfig, pushConfig,
  listAudit, getConfig, setConfig,
  listRequests, handleRequest,
};
