// 鱼价查 · 小程序请求封装（原生 wx.request）
// 统一处理：sharecode 透传、JWT 附加、错误归一
const app = getApp();

function base() {
  return (app && app.globalData && app.globalData.baseUrl) || 'https://yujiacha.app.workbuddy.host';
}
function share() {
  return (app && app.globalData && app.globalData.sharecode) || '274LOJXASW';
}

// 给路径附加 sharecode（WorkBuddy 托管网关要求）
function attach(path) {
  let u = base() + path;
  if (u.indexOf('sharecode=') === -1) {
    u += (u.indexOf('?') === -1 ? '?' : '&') + 'sharecode=' + share();
  }
  return u;
}

function qs(o) {
  return Object.keys(o || {})
    .filter((k) => o[k] !== undefined && o[k] !== null && o[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(o[k]))
    .join('&');
}

function request(path, opt) {
  opt = opt || {};
  const method = opt.method || 'GET';
  const auth = opt.auth !== false;
  const url = attach(path);
  return new Promise((resolve, reject) => {
    let tried = 0;
    const attempt = () => {
      const header = { 'Content-Type': 'application/json' };
      let token = '';
      try { token = wx.getStorageSync('yjt_token'); } catch (e) {}
      if (auth && token) header.Authorization = 'Bearer ' + token;
      wx.request({
        url,
        method,
        data: opt.data || null,
        header,
        success(res) {
          const code = res.statusCode;
          const body = res.data;
          if (code === 401 && auth) {
            try {
              wx.removeStorageSync('yjt_token');
              wx.removeStorageSync('yjt_user');
            } catch (e) {}
          }
          if (code >= 200 && code < 300 && body && body.ok !== false) {
            resolve(body.data);
          } else if (tried < 1 && (code === 403 || code >= 500)) {
            // 托管网关偶发 403 / 5xx：重试一次
            tried++;
            attempt();
          } else {
            reject(new Error((body && body.error && body.error.message) || ('请求失败(' + code + ')')));
          }
        },
        fail() {
          if (tried < 1) {
            tried++;
            attempt();
          } else {
            reject(new Error('网络异常，请检查网络后重试'));
          }
        }
      });
    };
    attempt();
  });
}

const api = {
  meta: () => request('/api/meta', { auth: false }),
  species: (o) => request('/api/species?' + qs(o), { auth: false }),
  daily: (o) => request('/api/report/daily?' + qs(o), { auth: false }),
  movers: (o) => request('/api/movers?' + qs(o), { auth: false }),
  search: (kw, limit) => request('/api/search?' + qs({ q: kw, limit: limit || 30 }), { auth: false }),
  speciesDetail: (name, o) => request('/api/species/' + encodeURIComponent(name) + '?' + qs(o), { auth: false }),
  login: (b) => request('/api/auth/login', { method: 'POST', data: b, auth: false }),
  register: (b) => request('/api/auth/register', { method: 'POST', data: b, auth: false }),
  me: () => request('/api/auth/me'),
  watch: () => request('/api/watch'),
  addWatch: (b) => request('/api/watch', { method: 'POST', data: b }),
  removeWatch: (id) => request('/api/watch/' + id, { method: 'DELETE' }),
  alerts: (o) => request('/api/alerts?' + qs(o))
};

module.exports = { api, attach, base };
