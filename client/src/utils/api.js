/**
 * 鱼价查 · UniApp 请求封装
 * 统一处理：JWT 附加、401 自动刷新令牌、多端存储适配、错误提示、离线缓存
 */
import { apiBase, TOKEN_KEY, REFRESH_KEY, USER_KEY, THEME_KEY, WATCH_KEY } from './config';

// ── 多端存储 ────────────────────────────────────────────────────────────
export const store = {
  get(key, dflt = null) {
    try {
      const v = uni.getStorageSync(key);
      return v === '' || v === undefined || v === null ? dflt : v;
    } catch { return dflt; }
  },
  set(key, val) {
    try { uni.setStorageSync(key, val); return true; } catch { return false; }
  },
  del(key) { try { uni.removeStorageSync(key); } catch { } },
};

// ── 令牌 ────────────────────────────────────────────────────────────────
export const auth = {
  get token() { return store.get(TOKEN_KEY); },
  get refreshToken() { return store.get(REFRESH_KEY); },
  get user() { return store.get(USER_KEY); },
  get isLoggedIn() { return !!store.get(TOKEN_KEY); },
  save(d) {
    store.set(TOKEN_KEY, d.token);
    store.set(REFRESH_KEY, d.refreshToken);
    store.set(USER_KEY, d.user);
    return d.user;
  },
  setUser(u) { store.set(USER_KEY, u); },
  clear() { store.del(TOKEN_KEY); store.del(REFRESH_KEY); store.del(USER_KEY); },
};

// ── 基础请求 ────────────────────────────────────────────────────────────
let refreshing = null;

export function request(path, { method = 'GET', data = null, auth: needAuth = true, retry = true } = {}) {
  const url = path.startsWith('http') ? path : apiBase() + path;
  const header = { 'Content-Type': 'application/json' };
  if (needAuth && auth.token) header.Authorization = `Bearer ${auth.token}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url, method, data, header,
      success: async (res) => {
        const { statusCode: code, data: body } = res;

        // 401：用刷新令牌续期一次
        if (code === 401 && needAuth && retry && auth.refreshToken) {
          try {
            const ok = await doRefresh();
            if (ok) return resolve(await request(path, { method, data, auth: needAuth, retry: false }));
          } catch { /* 续期失败，走登出 */ }
          auth.clear();
        }

        if (code >= 200 && code < 300 && body && body.ok !== false) return resolve(body.data);

        const err = new Error((body && body.error && body.error.message) || `请求失败（HTTP ${code}）`);
        err.status = code;
        err.code = body && body.error ? body.error.code : 'HTTP_' + code;
        err.exportForbidden = code === 403 && err.code === 'EXPORT_FORBIDDEN';
        reject(err);
      },
      fail: (e) => {
        const err = new Error('网络连接失败，请检查网络后重试');
        err.offline = true;
        err.cause = e;
        reject(err);
      },
    });
  });
}

function doRefresh() {
  if (refreshing) return refreshing;
  refreshing = new Promise((resolve) => {
    uni.request({
      url: apiBase() + '/api/auth/refresh',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { refreshToken: auth.refreshToken },
      success: (res) => {
        const b = res.data;
        if (res.statusCode === 200 && b && b.ok && b.data && b.data.token) {
          store.set(TOKEN_KEY, b.data.token);
          store.set(REFRESH_KEY, b.data.refreshToken);
          store.set(USER_KEY, b.data.user);
          resolve(true);
        } else resolve(false);
      },
      fail: () => resolve(false),
      complete: () => { refreshing = null; },
    });
  });
  return refreshing;
}

/** 带离线缓存的 GET（F10 弱网降级） */
export async function cachedGet(path, { key = null, ttl = 300 } = {}) {
  const ck = 'cache_' + (key || path);
  const cached = store.get(ck);
  const fresh = cached && cached.at && (Date.now() - cached.at) / 1000 < ttl;
  if (fresh) return { data: cached.data, fromCache: true };
  try {
    const data = await request(path, { auth: false });
    store.set(ck, { at: Date.now(), data });
    return { data, fromCache: false };
  } catch (e) {
    if (cached && cached.data) return { data: cached.data, fromCache: true, error: e };
    throw e;
  }
}

// ── API ─────────────────────────────────────────────────────────────────
const q = (o) => {
  const s = Object.entries(o || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return s ? '?' + s : '';
};

export const api = {
  meta: () => request('/api/meta', { auth: false }),
  status: () => request('/api/status', { auth: false }),
  publicConfig: () => request('/api/config/public', { auth: false }),

  // F1 / F2
  species: (o = {}) => request('/api/species' + q(o), { auth: false }),
  search: (kw, limit = 30) => request('/api/search' + q({ q: kw, limit }), { auth: false }),
  suggest: (kw) => request('/api/search/suggest' + q({ q: kw }), { auth: false }),
  reportSpecies: (b) => request('/api/species/request', { method: 'POST', data: b }),
  // F3
  mapProvinces: (o = {}) => request('/api/map/provinces' + q(o), { auth: false }),
  province: (name, o = {}) => request(`/api/provinces/${encodeURIComponent(name)}${q(o)}`, { auth: false }),
  movers: (o = {}) => request('/api/movers' + q(o), { auth: false }),
  // F5
  dailyReport: (o = {}) => request('/api/report/daily' + q(o), { auth: false }),
  // F6 / F11
  speciesDetail: (name, o = {}) => request(`/api/species/${encodeURIComponent(name)}${q(o)}`, { auth: false }),
  compare: (list, o = {}) => request('/api/compare' + q({ species: Array.isArray(list) ? list.join(',') : list, ...o }), { auth: false }),

  // F13
  login: (b) => request('/api/auth/login', { method: 'POST', data: b, auth: false }),
  register: (b) => request('/api/auth/register', { method: 'POST', data: b, auth: false }),
  verifyEmail: (token) => request('/api/auth/verify-email' + q({ token }), { auth: false }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', data: { email }, auth: false }),
  resetPassword: (b) => request('/api/auth/reset-password', { method: 'POST', data: b, auth: false }),
  me: () => request('/api/auth/me'),
  updateProfile: (b) => request('/api/auth/profile', { method: 'PUT', data: b }),
  changePassword: (b) => request('/api/auth/change-password', { method: 'POST', data: b }),
  deactivate: (b) => request('/api/auth/deactivate', { method: 'POST', data: b }),
  logout: () => request('/api/auth/logout', { method: 'POST', data: { refreshToken: auth.refreshToken }, auth: false }).catch(() => null),

  // F4
  watches: () => request('/api/watch'),
  addWatch: (b) => request('/api/watch', { method: 'POST', data: b }),
  removeWatch: (id) => request('/api/watch/' + id, { method: 'DELETE' }),

  // F7
  alerts: (o = {}) => request('/api/alerts' + q(o)),
  readAlerts: (ids) => request('/api/alerts/read', { method: 'POST', data: { ids } }),
  subscribePush: (b) => request('/api/push/subscribe', { method: 'POST', data: b }),

  exportUrl: (kind, o = {}) => apiBase() + ({
    report: '/api/export/report.csv', species: '/api/export/species.csv',
    watch: '/api/export/watch.csv', svg: '/api/export/report.svg', print: '/api/export/print',
  }[kind]) + q(o),
};

// ── 本地关注（游客态）──────────────────────────────────────────────────
export const localWatch = {
  all() { return store.get(WATCH_KEY, []) || []; },
  has(species, province = null) {
    return localWatch.all().some((w) => w.species === species && (w.province || null) === (province || null));
  },
  add(species, province = null) {
    const list = localWatch.all();
    if (!list.some((w) => w.species === species && (w.province || null) === (province || null))) {
      list.push({ species, province: province || null, createdAt: Date.now() });
      store.set(WATCH_KEY, list);
    }
    return list;
  },
  remove(species, province = null) {
    const list = localWatch.all().filter((w) => !(w.species === species && (w.province || null) === (province || null)));
    store.set(WATCH_KEY, list);
    return list;
  },
  count() { return localWatch.all().length; },
};

// ── 工具 ────────────────────────────────────────────────────────────────
export const fmt = {
  num: (v, d = 2) => (v == null || isNaN(Number(v)) ? '—' : Number(v).toFixed(d)),
  int: (v) => (v == null ? '—' : Number(v).toLocaleString('zh-CN')),
  date: (d) => (d ? String(d).slice(0, 10) : '—'),
  dateShort: (d) => (d ? String(d).slice(5, 10) : ''),
  dt: (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '—'),
  deltaText: (v) => (v == null ? '—' : `${v > 0 ? '▲' : v < 0 ? '▼' : '—'} ${Math.abs(v).toFixed(2)}%`),
  deltaClass: (v) => (v == null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down'),
};

export const toast = (msg, icon = 'none', ms = 2200) => uni.showToast({ title: msg, icon, duration: ms });

/** 主题应用（H5 端通过 CSS 变量；小程序 / App 端由各页面 style 绑定） */
export function applyTheme(theme) {
  const t = theme || store.get(THEME_KEY) || 'light';
  store.set(THEME_KEY, t);
  // #ifdef H5
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
  // #endif
  return t;
}
