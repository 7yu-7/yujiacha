/**
 * 账户服务（F13 完整账号体系 + F4 关注订阅 + F7 异动提醒）
 * 注册（邮箱+验证） / 登录（JWT+刷新令牌轮换） / 忘记密码 / 资料修改 / 注销（软删除）
 * 关注品种、阈值、主题偏好云端保存、多端同步（冲突以最后写入为准）
 */
const db = require('../lib/db');
const config = require('../config');
const { hashPassword, verifyPassword, signJwt, verifyJwt, randomToken } = require('../lib/crypto-util');
const { ApiError } = require('../lib/http');
const { invalidateCache, normalizeProvince, provinceShort } = require('./price-service');

const ROLE_LABELS = {
  user: '普通用户',
  researcher: '教研师生',
  gov: '政府监测人员',
  admin: '运营 / 管理员',
};

// 角色权限：对应 PRD 2「权限差异」表
const ROLE_PERMS = {
  guest: { read: true, watch: false, export: false, push: false, admin: false },
  user: { read: true, watch: true, export: false, push: true, admin: false },
  researcher: { read: true, watch: true, export: true, push: true, admin: false },
  gov: { read: true, watch: true, export: true, push: true, admin: false },
  admin: { read: true, watch: true, export: true, push: true, admin: true },
};

// ── 邮件（开发环境落盘到站内取件箱）──────────────────────────────────────
const fs = require('fs');
const path = require('path');

async function sendMail({ to, subject, text, link }) {
  const dir = config.mail.outboxDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${randomToken(4)}.json`);
  const payload = { to, from: config.mail.from, subject, text, link, at: db.formatDateTime(new Date()) };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  // 开发环境控制台可见，便于直接点击
  console.log(`\n[MAIL] → ${to}\n  主题：${subject}\n  内容：${text}${link ? `\n  链接：${link}` : ''}\n`);
  return { file, ...payload };
}

/** 读取站内取件箱（仅开发/演示用途，便于无 SMTP 时完成邮箱验证流程） */
function readOutbox(limit = 20) {
  const dir = config.mail.outboxDir;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return { file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }; }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.file.localeCompare(a.file))
    .slice(0, limit);
}

// ── 令牌 ────────────────────────────────────────────────────────────────
async function issueToken(userId, type, ttlSeconds) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + ttlSeconds * 1000);
  await db.run(
    `INSERT INTO auth_token (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)`,
    [userId, type, token, db.formatDateTime(expires)]
  );
  return token;
}

async function consumeToken(token, type) {
  const rows = await db.query(
    `SELECT * FROM auth_token WHERE token = ? AND type = ? LIMIT 1`, [token, type]
  );
  const t = rows[0];
  if (!t) throw new ApiError(400, '令牌无效', 'TOKEN_INVALID');
  if (t.used_at) throw new ApiError(400, '该令牌已被使用', 'TOKEN_USED');
  const exp = new Date(String(t.expires_at).replace(' ', 'T'));
  if (exp.getTime() < Date.now()) throw new ApiError(400, '令牌已过期，请重新获取', 'TOKEN_EXPIRED');
  return t;
}

async function markUsed(id) {
  await db.run(`UPDATE auth_token SET used_at = ? WHERE id = ?`, [db.formatDateTime(new Date()), id]);
}

// ── 用户视图 ────────────────────────────────────────────────────────────
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  nickname: u.nickname,
  role: u.role,
  roleLabel: ROLE_LABELS[u.role] || u.role,
  org: u.org,
  status: u.status,
  emailVerified: !!u.email_verified,
  theme: u.theme,
  pushEnabled: !!u.push_enabled,
  lastLoginAt: u.last_login_at,
  createdAt: u.created_at,
  permissions: ROLE_PERMS[u.role === 'admin' ? 'admin' : (u.role || 'user')],
});

async function findById(id) {
  const r = await db.query(`SELECT * FROM app_user WHERE id = ? LIMIT 1`, [id]);
  return r[0] || null;
}
async function findByEmail(email) {
  const r = await db.query(`SELECT * FROM app_user WHERE email = ? LIMIT 1`, [String(email || '').toLowerCase().trim()]);
  return r[0] || null;
}

// ── 注册 ────────────────────────────────────────────────────────────────
async function register({ email, password, nickname, role = 'user', org = null }) {
  const mail = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ApiError(400, '邮箱格式不正确', 'BAD_EMAIL');
  if (!password || String(password).length < 6) throw new ApiError(400, '密码至少 6 位', 'BAD_PASSWORD');
  if (!['user', 'researcher', 'gov'].includes(role)) throw new ApiError(400, '角色不合法', 'BAD_ROLE');

  const exist = await findByEmail(mail);
  if (exist) throw new ApiError(409, '该邮箱已注册', 'EMAIL_EXISTS');

  const encrypted = hashPassword(password);
  const { insertId } = await db.run(
    `INSERT INTO app_user (email, password_hash, nickname, role, org, status, email_verified, theme)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, 'light')`,
    [mail, encrypted, nickname || mail.split('@')[0], role, org]
  );

  const token = await issueToken(insertId, 'verify_email', config.auth.verifyTtl);
  const link = `${config.app.baseUrl}/verify-email?token=${token}`;
  await sendMail({
    to: mail,
    subject: `【${config.app.name}】请验证您的邮箱`,
    text: `您好，感谢注册${config.app.name}。请在 24 小时内点击下方链接完成邮箱验证。`,
    link,
  });

  await audit(insertId, mail, 'USER_REGISTER', mail, `注册角色：${ROLE_LABELS[role] || role}`);
  return { userId: insertId, email: mail, verifyToken: token, verifyLink: link, mailSent: true };
}

// ── 邮箱验证 ────────────────────────────────────────────────────────────
async function verifyEmail(token) {
  const t = await consumeToken(token, 'verify_email');
  await markUsed(t.id);
  await db.run(`UPDATE app_user SET email_verified = 1, status = 'active' WHERE id = ?`, [t.user_id]);
  const user = await findById(t.user_id);
  await audit(t.user_id, user.email, 'EMAIL_VERIFIED', user.email, '邮箱验证通过');
  return publicUser(user);
}

// ── 登录（JWT + 刷新令牌轮换）───────────────────────────────────────────
async function login({ email, password }) {
  const user = await findByEmail(email);
  if (!user) throw new ApiError(401, '邮箱或密码不正确', 'BAD_CREDENTIALS');
  if (user.status === 'deleted') throw new ApiError(403, '该账号已注销', 'ACCOUNT_DELETED');
  if (user.status === 'disabled') throw new ApiError(403, '该账号已被禁用，请联系管理员', 'ACCOUNT_DISABLED');
  if (!verifyPassword(password, user.password_hash)) {
    await audit(user.id, user.email, 'LOGIN_FAILED', user.email, '密码错误');
    throw new ApiError(401, '邮箱或密码不正确', 'BAD_CREDENTIALS');
  }

  await db.run(`UPDATE app_user SET last_login_at = ? WHERE id = ?`, [db.formatDateTime(new Date()), user.id]);

  const accessToken = signJwt({ uid: user.id, role: user.role, typ: 'access' }, config.auth.jwtSecret, config.auth.accessTtl);
  const refreshToken = await issueToken(user.id, 'refresh', config.auth.refreshTtl);
  await audit(user.id, user.email, 'LOGIN', user.email, '登录成功');

  return {
    token: accessToken,
    refreshToken,
    expiresIn: config.auth.accessTtl,
    user: publicUser(user),
    emailVerified: !!user.email_verified,
    needVerify: !user.email_verified,
  };
}

/** 刷新令牌轮换：旧刷新令牌一次性作废，签发新的一对 */
async function refresh(refreshToken) {
  const t = await consumeToken(refreshToken, 'refresh');
  await markUsed(t.id);
  const user = await findById(t.user_id);
  if (!user || user.status === 'deleted') throw new ApiError(403, '账号不可用', 'ACCOUNT_UNAVAILABLE');
  const accessToken = signJwt({ uid: user.id, role: user.role, typ: 'access' }, config.auth.jwtSecret, config.auth.accessTtl);
  const newRefresh = await issueToken(user.id, 'refresh', config.auth.refreshTtl);
  return { token: accessToken, refreshToken: newRefresh, expiresIn: config.auth.accessTtl, user: publicUser(user) };
}

function authenticate(token) {
  const r = verifyJwt(token, config.auth.jwtSecret);
  if (!r.ok) return null;
  if (r.payload.typ !== 'access') return null;
  return r.payload;
}

async function currentUser(uid) {
  const u = await findById(uid);
  if (!u || u.status === 'deleted') throw new ApiError(401, '登录状态已失效', 'UNAUTHORIZED');
  return publicUser(u);
}

// ── 忘记密码 / 重置 ─────────────────────────────────────────────────────
async function forgotPassword(email) {
  const user = await findByEmail(email);
  const generic = { sent: true, message: '若该邮箱已注册，重置链接已发送，请查收邮件。' };
  if (!user) return generic;   // 不暴露邮箱是否注册
  const token = await issueToken(user.id, 'reset_password', config.auth.resetTtl);
  const link = `${config.app.baseUrl}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: `【${config.app.name}】重置您的登录密码`,
    text: `您好，我们收到了重置密码的请求。请在 2 小时内点击下方链接设置新密码；如非本人操作请忽略本邮件。`,
    link,
  });
  await audit(user.id, user.email, 'PASSWORD_RESET_REQUEST', user.email, '申请重置密码');
  return { ...generic, resetToken: token, resetLink: link };
}

async function resetPassword({ token, password }) {
  if (!password || String(password).length < 6) throw new ApiError(400, '密码至少 6 位', 'BAD_PASSWORD');
  const t = await consumeToken(token, 'reset_password');
  await markUsed(t.id);
  await db.run(`UPDATE app_user SET password_hash = ? WHERE id = ?`, [hashPassword(password), t.user_id]);
  // 重置密码后作废该用户的全部刷新令牌（安全实践）
  await db.run(`UPDATE auth_token SET used_at = ? WHERE user_id = ? AND type = 'refresh' AND used_at IS NULL`, [db.formatDateTime(new Date()), t.user_id]);
  const user = await findById(t.user_id);
  await audit(t.user_id, user.email, 'PASSWORD_RESET', user.email, '密码重置成功');
  return { ok: true, email: user.email };
}

async function changePassword({ uid, oldPassword, newPassword }) {
  if (!newPassword || String(newPassword).length < 6) throw new ApiError(400, '新密码至少 6 位', 'BAD_PASSWORD');
  const user = await findById(uid);
  if (!verifyPassword(oldPassword, user.password_hash)) throw new ApiError(400, '原密码不正确', 'BAD_OLD_PASSWORD');
  await db.run(`UPDATE app_user SET password_hash = ? WHERE id = ?`, [hashPassword(newPassword), uid]);
  await audit(uid, user.email, 'PASSWORD_CHANGE', user.email, '修改密码');
  return { ok: true };
}

// ── 资料修改 / 主题 / 注销 ──────────────────────────────────────────────
async function updateProfile({ uid, nickname, org, theme, pushEnabled, email }) {
  const user = await findById(uid);
  const sets = [], params = [];
  if (nickname !== undefined) { sets.push('nickname = ?'); params.push(nickname); }
  if (org !== undefined) { sets.push('org = ?'); params.push(org); }
  if (theme !== undefined) {
    if (!['light', 'dark', 'academic'].includes(theme)) throw new ApiError(400, '主题不合法', 'BAD_THEME');
    sets.push('theme = ?'); params.push(theme);
  }
  if (pushEnabled !== undefined) { sets.push('push_enabled = ?'); params.push(pushEnabled ? 1 : 0); }
  if (email !== undefined) {
    const mail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ApiError(400, '邮箱格式不正确', 'BAD_EMAIL');
    if (mail !== user.email) {
      const dup = await findByEmail(mail);
      if (dup) throw new ApiError(409, '该邮箱已被占用', 'EMAIL_EXISTS');
      sets.push('email = ?', 'email_verified = 0', 'status = ?');
      params.push(mail, 'pending');
      const token = await issueToken(uid, 'verify_email', config.auth.verifyTtl);
      await sendMail({
        to: mail,
        subject: `【${config.app.name}】请验证您的新邮箱`,
        text: '请在 24 小时内点击下方链接完成新邮箱验证。',
        link: `${config.app.baseUrl}/verify-email?token=${token}`,
      });
    }
  }
  if (!sets.length) return publicUser(user);
  params.push(uid);
  await db.run(`UPDATE app_user SET ${sets.join(', ')} WHERE id = ?`, params);
  await audit(uid, user.email, 'PROFILE_UPDATE', user.email, `更新字段：${sets.join(', ')}`);
  invalidateCache('user:');
  return publicUser(await findById(uid));
}

/** 注销账号：软删除 + 数据归属处理（解除关注/订阅绑定） */
async function deactivate({ uid, password, reason = null }) {
  const user = await findById(uid);
  if (!verifyPassword(password, user.password_hash)) throw new ApiError(400, '密码不正确', 'BAD_PASSWORD');
  if (user.role === 'admin') throw new ApiError(400, '管理员账号不支持自助注销', 'ADMIN_PROTECTED');

  const now = db.formatDateTime(new Date());
  const watches = await db.query(`SELECT COUNT(*) AS c FROM watch_item WHERE user_id = ?`, [uid]);

  await db.run(
    `UPDATE app_user SET status = 'deleted', deleted_at = ?, email = ?, nickname = NULL, org = NULL WHERE id = ?`,
    [now, `deleted+${uid}@yujiacha.invalid`, uid]
  );
  // 关注/订阅解绑；推送订阅停用
  await db.run(`DELETE FROM watch_item WHERE user_id = ?`, [uid]);
  await db.run(`UPDATE push_subscription SET enabled = 0 WHERE user_id = ?`, [uid]);
  await db.run(`UPDATE auth_token SET used_at = ? WHERE user_id = ? AND used_at IS NULL`, [now, uid]);
  await audit(uid, user.email, 'ACCOUNT_DEACTIVATED', user.email,
    `注销账号；解绑关注 ${Number(watches[0]?.c || 0)} 条${reason ? `；原因：${reason}` : ''}`);

  return { ok: true, unbindWatches: Number(watches[0]?.c || 0), deletedAt: now };
}

// ── F4 关注订阅 ─────────────────────────────────────────────────────────
async function listWatches(uid) {
  const rows = await db.query(`SELECT * FROM watch_item WHERE user_id = ? ORDER BY created_at DESC`, [uid]);
  const { latestDate, prevDate } = require('./price-service');
  const date = await latestDate();
  const prev = await prevDate(date);

  const out = [];
  for (const w of rows) {
    const where = ['date = ?', 'species = ?'];
    const params = [date, w.species];
    if (w.province) { where.push('province = ?'); params.push(w.province); }
    const cur = await db.query(`SELECT AVG(price) AS a FROM price_daily WHERE ${where.join(' AND ')}`, params);
    const pwhere = ['date = ?', 'species = ?'];
    const pparams = [prev, w.species];
    if (w.province) { pwhere.push('province = ?'); pparams.push(w.province); }
    const pv = prev ? await db.query(`SELECT AVG(price) AS a FROM price_daily WHERE ${pwhere.join(' AND ')}`, pparams) : [];

    const avg = cur[0] && cur[0].a != null ? round2(cur[0].a) : null;
    const prevAvg = pv[0] && pv[0].a != null ? round2(pv[0].a) : null;

    // 近 7 日迷你趋势
    const from = new Date(date); from.setDate(from.getDate() - 6);
    const trend = await db.query(
      `SELECT date, AVG(price) AS a FROM price_daily
        WHERE species = ?${w.province ? ' AND province = ?' : ''} AND date >= ? AND date <= ?
        GROUP BY date ORDER BY date`,
      w.province ? [w.species, w.province, db.formatDate(from), date] : [w.species, db.formatDate(from), date]
    );

    out.push({
      id: w.id,
      species: w.species,
      province: w.province,
      scope: w.province ? provinceShort(w.province) : '全国',
      thresholdUp: w.threshold_up == null ? null : Number(w.threshold_up),
      thresholdDown: w.threshold_down == null ? null : Number(w.threshold_down),
      notifyChannel: w.notify_channel,
      createdAt: w.created_at,
      price: avg,
      prevPrice: prevAvg,
      changePct: avg != null && prevAvg ? round2(((avg - prevAvg) / prevAvg) * 100) : null,
      trend: trend.map((t) => ({ date: String(t.date).slice(0, 10), price: round2(t.a) })),
      trendRange: trend.length ? `${String(trend[0].date).slice(5, 10)} — ${String(trend[trend.length - 1].date).slice(5, 10)}` : '',
    });
  }
  return { date, prevDate: prev, total: out.length, items: out };
}

async function addWatch(uid, { species, province = null, thresholdUp = null, thresholdDown = null, notifyChannel = 'app' }) {
  if (!species) throw new ApiError(400, '请指定品种', 'BAD_SPECIES');
  if (province) province = normalizeProvince(province);
  const exist = await db.query(
    `SELECT id FROM watch_item WHERE user_id = ? AND species = ? AND ${province ? 'province = ?' : 'province IS NULL'} LIMIT 1`,
    province ? [uid, species, province] : [uid, species]
  );
  if (exist.length) {
    await db.run(
      `UPDATE watch_item SET threshold_up = ?, threshold_down = ?, notify_channel = ? WHERE id = ?`,
      [thresholdUp, thresholdDown, notifyChannel, exist[0].id]
    );
    return { id: exist[0].id, updated: true };
  }
  const { insertId } = await db.run(
    `INSERT INTO watch_item (user_id, species, province, threshold_up, threshold_down, notify_channel)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid, species, province, thresholdUp, thresholdDown, notifyChannel]
  );
  await audit(uid, null, 'WATCH_ADD', `${species}/${province || '全国'}`, '新增关注');
  return { id: insertId, updated: false };
}

async function removeWatch(uid, id) {
  const r = await db.run(`DELETE FROM watch_item WHERE id = ? AND user_id = ?`, [id, uid]);
  if (!r.affectedRows) throw new ApiError(404, '关注项不存在', 'NOT_FOUND');
  return { ok: true };
}

// ── F7 异动提醒 ─────────────────────────────────────────────────────────
async function listAlerts(uid, { unreadOnly = false, limit = 50 } = {}) {
  const where = ['user_id = ?'];
  const params = [uid];
  if (unreadOnly) where.push('is_read = 0');
  const rows = await db.query(
    `SELECT * FROM alert_log WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC LIMIT ?`,
    [...params, Number(limit)]
  );
  const unread = await db.query(`SELECT COUNT(*) AS c FROM alert_log WHERE user_id = ? AND is_read = 0`, [uid]);
  return {
    unread: Number(unread[0]?.c || 0),
    items: rows.map((r) => ({
      id: r.id, species: r.species, province: r.province, scope: r.province || '全国',
      date: String(r.date).slice(0, 10),
      prevPrice: round2(r.prev_price), currPrice: round2(r.curr_price),
      changePct: round2(r.change_pct), direction: r.direction,
      channel: r.channel, pushed: !!r.pushed, isRead: !!r.is_read,
      title: r.title, content: r.content, createdAt: r.created_at,
    })),
  };
}

async function readAlerts(uid, ids = null) {
  if (ids && ids.length) {
    await db.run(`UPDATE alert_log SET is_read = 1 WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [uid, ...ids]);
  } else {
    await db.run(`UPDATE alert_log SET is_read = 1 WHERE user_id = ?`, [uid]);
  }
  return { ok: true };
}

/**
 * 阈值扫描：为所有有效关注项检查当日异动，生成告警并按通道推送
 * 由定时任务或管理后台手动触发（对应 F7 + F14 推送配置）
 */
async function scanAlerts({ date = null } = {}) {
  const { latestDate, prevDate } = require('./price-service');
  const d = date || (await latestDate());
  const prev = await prevDate(d);
  if (!prev) return { date: d, created: 0, message: '前一日无数据，跳过扫描' };

  const watches = await db.query(`SELECT w.*, u.push_enabled, u.email, u.role FROM watch_item w JOIN app_user u ON u.id = w.user_id WHERE u.status = 'active'`);
  let created = 0;
  const delivered = [];

  for (const w of watches) {
    if (!w.push_enabled) continue;
    const filter = w.province ? ' AND province = ?' : '';
    const fp = w.province ? [w.province] : [];
    const cur = await db.query(`SELECT AVG(price) AS a FROM price_daily WHERE date = ? AND species = ?${filter}`, [d, w.species, ...fp]);
    const pv = await db.query(`SELECT AVG(price) AS a FROM price_daily WHERE date = ? AND species = ?${filter}`, [prev, w.species, ...fp]);
    const a = cur[0] && cur[0].a != null ? Number(cur[0].a) : null;
    const b = pv[0] && pv[0].a != null ? Number(pv[0].a) : null;
    if (a == null || b == null || b === 0) continue;
    const chg = round2(((a - b) / b) * 100);

    const upT = w.threshold_up == null ? 5 : Number(w.threshold_up);
    const downT = w.threshold_down == null ? -5 : Number(w.threshold_down);
    const hit = (chg >= upT && upT > 0) || (chg <= downT && downT < 0);
    if (!hit) continue;

    const dir = chg > 0 ? 'up' : 'down';
    const scope = w.province || '全国';
    const title = `${w.species}${dir === 'up' ? '价格上涨' : '价格下跌'}提醒`;
    const content = `${scope}${w.species} 均价 ${round2(a)} 元/公斤，较前日${dir === 'up' ? '上涨' : '下跌'} ${Math.abs(chg)}%，已触发您设置的阈值（涨 ≥${upT}% / 跌 ≤${downT}%）。`;

    // 防止重复推送同一天同一条目
    const dup = await db.query(
      `SELECT id FROM alert_log WHERE user_id = ? AND species = ? AND date = ? AND direction = ? LIMIT 1`,
      [w.user_id, w.species, d, dir]
    );
    if (dup.length) continue;

    await db.run(
      `INSERT INTO alert_log (user_id, species, province, date, prev_price, curr_price, change_pct, direction, channel, pushed, is_read, title, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      [w.user_id, w.species, w.province, d, round2(b), round2(a), chg, dir, w.notify_channel, title, content]
    );
    created += 1;
    delivered.push({ user: w.email, channel: w.notify_channel, species: w.species, scope, changePct: chg, title });
  }

  if (created) await audit(null, 'system', 'ALERT_SCAN', d, `生成 ${created} 条异动告警`);
  return { date: d, prevDate: prev, scanned: watches.length, created, delivered };
}

// ── 审计 ────────────────────────────────────────────────────────────────
async function audit(userId, userEmail, action, target, detail, ip = null) {
  try {
    await db.run(
      `INSERT INTO audit_log (user_id, user_email, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, userEmail || null, action, target || null, detail || null, ip]
    );
  } catch (e) { /* 审计失败不阻断主流程 */ }
}

const round2 = (n) => (n == null ? null : Math.round(Number(n) * 100) / 100);

module.exports = {
  ROLE_LABELS, ROLE_PERMS, publicUser,
  register, verifyEmail, login, refresh, authenticate, currentUser,
  forgotPassword, resetPassword, changePassword,
  updateProfile, deactivate,
  listWatches, addWatch, removeWatch,
  listAlerts, readAlerts, scanAlerts,
  audit, readOutbox, sendMail,
  findById, findByEmail,
};
