/* ============================================================================
   鱼价查 · 前端 API 客户端（四端共用）
   - 统一 REST 调用、JWT 自动附加、401 自动刷新令牌
   - 离线缓存（localStorage，F10）
   - 请求失败降级到缓存
   ============================================================================ */

(function (global) {
  'use strict';

  const LS = {
    get(k, dflt) {
      try { const v = localStorage.getItem(k); return v == null ? dflt : JSON.parse(v); }
      catch { return dflt; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch { return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch { } },
  };

  const KEYS = {
    token: 'yjt_token',
    refresh: 'yjt_refresh',
    user: 'yjt_user',
    theme: 'yjt_theme',
    watchlist: 'yjt_watchlist',
    offline: 'yjt_offline_',
    prefs: 'yjt_prefs',
  };

  // ── 基础请求 ──────────────────────────────────────────────────────────
  const API_BASE = (() => {
    // 同源部署时为空；独立部署时可通过 window.YJT_API_BASE 覆盖
    if (global.YJT_API_BASE) return global.YJT_API_BASE;
    if (location.protocol === 'file:') return 'http://localhost:8787';
    return '';
  })();

  let refreshing = null;

  async function request(path, { method = 'GET', body = null, auth = true, retry = true, timeout = 20000 } = {}) {
    const url = path.startsWith('http') ? path : API_BASE + path;
    const headers = {};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (auth) {
      const t = LS.get(KEYS.token, null);
      if (t) headers.Authorization = `Bearer ${t}`;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(url, {
        method, headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const err = new Error(e.name === 'AbortError' ? '请求超时，请检查网络' : '网络连接失败');
      err.offline = true;
      throw err;
    }
    clearTimeout(timer);

    // 401：尝试用刷新令牌续期一次
    if (res.status === 401 && auth && retry) {
      const rt = LS.get(KEYS.refresh, null);
      if (rt) {
        try {
          if (!refreshing) {
            refreshing = (async () => {
              const r = await fetch(API_BASE + '/api/auth/refresh', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: rt }),
              });
              const j = await r.json();
              if (j && j.ok && j.data && j.data.token) {
                LS.set(KEYS.token, j.data.token);
                LS.set(KEYS.refresh, j.data.refreshToken);
                LS.set(KEYS.user, j.data.user);
                return true;
              }
              return false;
            })().finally(() => { refreshing = null; });
          }
          const ok = await refreshing;
          if (ok) return request(path, { method, body, auth, retry: false, timeout });
        } catch { /* 续期失败，走登出 */ }
      }
      Auth.clear();
    }

    let json = null;
    try { json = await res.json(); } catch { /* 非 JSON 响应 */ }

    if (!res.ok || (json && json.ok === false)) {
      const e = new Error((json && json.error && json.error.message) || `请求失败（HTTP ${res.status}）`);
      e.status = res.status;
      e.code = json && json.error ? json.error.code : 'HTTP_' + res.status;
      e.details = json && json.error ? json.error.details : undefined;
      if (res.status === 403 && e.code === 'EXPORT_FORBIDDEN') e.exportForbidden = true;
      throw e;
    }
    return json ? json.data : null;
  }

  /** 带离线缓存的 GET（F10 弱网降级展示） */
  async function cachedGet(path, { ttl = 300, key = null, auth = true } = {}) {
    const ck = KEYS.offline + (key || path);
    try {
      const data = await request(path, { auth });
      LS.set(ck, { at: Date.now(), data });
      return { data, fromCache: false };
    } catch (e) {
      const cached = LS.get(ck, null);
      if (cached && cached.data) {
        return { data: cached.data, fromCache: true, cachedAt: cached.at, error: e };
      }
      throw e;
    }
  }

  // ── 认证 ──────────────────────────────────────────────────────────────
  const Auth = {
    get token() { return LS.get(KEYS.token, null); },
    get user() { return LS.get(KEYS.user, null); },
    get isLoggedIn() { return !!LS.get(KEYS.token, null); },

    save(d) {
      LS.set(KEYS.token, d.token);
      LS.set(KEYS.refresh, d.refreshToken);
      LS.set(KEYS.user, d.user);
      return d.user;
    },
    setUser(u) { LS.set(KEYS.user, u); },
    clear() {
      LS.del(KEYS.token); LS.del(KEYS.refresh); LS.del(KEYS.user);
    },
    logout() { Auth.clear(); },
  };

  // ── API 分组 ──────────────────────────────────────────────────────────
  const api = {
    LS, KEYS, API_BASE, request, cachedGet, Auth,

    // 元数据 / 状态
    health: () => request('/api/health', { auth: false }),
    meta: () => request('/api/meta', { auth: false }),
    status: () => request('/api/status', { auth: false }),
    publicConfig: () => request('/api/config/public', { auth: false }),

    // F1 全品种
    species: (q = {}) => request('/api/species?' + toQuery(q), { auth: false }),
    // F2 搜索
    search: (q, limit = 20) => request('/api/search?' + toQuery({ q, limit }), { auth: false }),
    suggest: (q) => request('/api/search/suggest?' + toQuery({ q }), { auth: false }),
    reportSpecies: (b) => request('/api/species/request', { method: 'POST', body: b }),
    // F3 地图
    mapProvinces: (q = {}) => request('/api/map/provinces?' + toQuery(q), { auth: false }),
    province: (name, q = {}) => request(`/api/provinces/${encodeURIComponent(name)}?` + toQuery(q), { auth: false }),
    movers: (q = {}) => request('/api/movers?' + toQuery(q), { auth: false }),
    // F5 日报
    dailyReport: (q = {}) => request('/api/report/daily?' + toQuery(q), { auth: false }),
    // F6 详情 / F11 对比
    speciesDetail: (name, q = {}) => request(`/api/species/${encodeURIComponent(name)}?` + toQuery(q), { auth: false }),
    compare: (species, q = {}) => request('/api/compare?' + toQuery({ species: Array.isArray(species) ? species.join(',') : species, ...q }), { auth: false }),

    // F13 账户
    register: (b) => request('/api/auth/register', { method: 'POST', body: b, auth: false }),
    login: (b) => request('/api/auth/login', { method: 'POST', body: b, auth: false }),
    verifyEmail: (token) => request('/api/auth/verify-email?token=' + encodeURIComponent(token), { auth: false }),
    forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
    resetPassword: (b) => request('/api/auth/reset-password', { method: 'POST', body: b, auth: false }),
    me: () => request('/api/auth/me'),
    updateProfile: (b) => request('/api/auth/profile', { method: 'PUT', body: b }),
    changePassword: (b) => request('/api/auth/change-password', { method: 'POST', body: b }),
    deactivate: (b) => request('/api/auth/deactivate', { method: 'POST', body: b }),
    logoutApi: (refreshToken) => request('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => null),
    outbox: () => request('/api/auth/outbox', { auth: false }),

    // F4 关注
    watches: () => request('/api/watch'),
    addWatch: (b) => request('/api/watch', { method: 'POST', body: b }),
    removeWatch: (id) => request('/api/watch/' + id, { method: 'DELETE' }),

    // F7 告警
    alerts: (q = {}) => request('/api/alerts?' + toQuery(q)),
    readAlerts: (ids) => request('/api/alerts/read', { method: 'POST', body: { ids } }),
    subscribePush: (b) => request('/api/push/subscribe', { method: 'POST', body: b }),

    // F8 导出
    exportUrl: (kind, q = {}) => API_BASE + ({ report: '/api/export/report.csv', species: '/api/export/species.csv', watch: '/api/export/watch.csv', svg: '/api/export/report.svg', print: '/api/export/print' }[kind]) + '?' + toQuery(q),

    /** 带鉴权的文件下载（导出接口需要 JWT，故用 fetch 取 blob） */
    async download(kind, q = {}) {
      const url = api.exportUrl(kind, q);
      const t = LS.get(KEYS.token, null);
      const res = await fetch(url, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!res.ok) {
        let msg = `导出失败（HTTP ${res.status}）`;
        try { const j = await res.json(); if (j.error) msg = j.error.message; } catch { }
        const e = new Error(msg);
        e.status = res.status;
        if (res.status === 403) e.exportForbidden = true;
        throw e;
      }
      const blob = await res.blob();
      let filename = 'yujiacha-export';
      const cd = res.headers.get('Content-Disposition');
      if (cd && /filename\*?=(?:UTF-8'')?"?([^";]+)/i.test(cd)) {
        filename = decodeURIComponent(RegExp.$1);
      } else {
        filename += (kind === 'svg' ? '.svg' : '.csv');
      }
      return { blob, filename };
    },

    // F14 管理后台
    admin: {
      dashboard: () => request('/api/admin/dashboard'),
      users: (q = {}) => request('/api/admin/users?' + toQuery(q)),
      setUserStatus: (id, status) => request(`/api/admin/users/${id}/status`, { method: 'PUT', body: { status } }),
      setUserRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PUT', body: { role } }),
      purgeUser: (id) => request('/api/admin/users/' + id, { method: 'DELETE' }),
      prices: (q = {}) => request('/api/admin/prices?' + toQuery(q)),
      correctPrice: (id, price, reason) => request(`/api/admin/prices/${id}`, { method: 'PUT', body: { price, reason } }),
      snapshots: (q = {}) => request('/api/admin/snapshots?' + toQuery(q)),
      watchConfig: (q = {}) => request('/api/admin/watch-config?' + toQuery(q)),
      updateWatch: (id, b) => request(`/api/admin/watch-config/${id}`, { method: 'PUT', body: b }),
      pushConfig: () => request('/api/admin/push-config'),
      scanAlerts: (date) => request('/api/admin/alerts/scan', { method: 'POST', body: { date } }),
      audit: (q = {}) => request('/api/admin/audit?' + toQuery(q)),
      config: () => request('/api/admin/config'),
      saveConfig: (b) => request('/api/admin/config', { method: 'PUT', body: b }),
      requests: (q = {}) => request('/api/admin/species-requests?' + toQuery(q)),
      handleRequest: (id, status) => request(`/api/admin/species-requests/${id}`, { method: 'PUT', body: { status } }),
    },
  };

  function toQuery(o) {
    return Object.entries(o || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  // ── 本地关注列表（游客态，登录后云端同步）────────────────────────────
  const LocalWatch = {
    all() { return LS.get(KEYS.watchlist, []) || []; },
    has(species, province = null) {
      return LocalWatch.all().some((w) => w.species === species && (w.province || null) === (province || null));
    },
    add(species, province = null) {
      const list = LocalWatch.all();
      if (!list.some((w) => w.species === species && (w.province || null) === (province || null))) {
        list.push({ species, province: province || null, createdAt: Date.now() });
        LS.set(KEYS.watchlist, list);
      }
      return list;
    },
    remove(species, province = null) {
      const list = LocalWatch.all().filter((w) => !(w.species === species && (w.province || null) === (province || null)));
      LS.set(KEYS.watchlist, list);
      return list;
    },
    clear() { LS.set(KEYS.watchlist, []); },
    count() { return LocalWatch.all().length; },
  };

  global.YJT = global.YJT || {};
  Object.assign(global.YJT, { api, Auth, LS, KEYS, LocalWatch, toQuery, request });
})(window);
