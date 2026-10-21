/**
 * 极简 HTTP 框架（零依赖）
 * 提供：路由（含路径参数）、JSON body 解析、CORS、静态文件、统一错误处理、
 *      请求上下文（含鉴权后的用户）、响应助手。
 *
 * 选择自研而非 Express 的原因：交付物需在最小环境依赖下可直接运行，
 * 且路由/中间件需求简单（REST + 静态资源），自研可完全掌控行为。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
};

class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }

  use(fn) { this.middlewares.push(fn); return this; }

  add(method, pattern, ...handlers) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern
        .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
        .replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })
        .replace(/\\\*/g, '.*') + '/?$'
    );
    this.routes.push({ method: method.toUpperCase(), regex, keys, handlers });
    return this;
  }

  get(p, ...h) { return this.add('GET', p, ...h); }
  post(p, ...h) { return this.add('POST', p, ...h); }
  put(p, ...h) { return this.add('PUT', p, ...h); }
  patch(p, ...h) { return this.add('PATCH', p, ...h); }
  delete(p, ...h) { return this.add('DELETE', p, ...h); }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method.toUpperCase()) continue;
      const m = r.regex.exec(pathname);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
    }
    return null;
  }
}

// ── 响应助手 ────────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
    this.details = details;
  }
}

function createApp({ corsOrigins = ['*'] } = {}) {
  const router = new Router();

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    // CORS
    const origin = req.headers.origin;
    const allowOrigin = corsOrigins.includes('*') ? (origin || '*') : (corsOrigins.includes(origin) ? origin : '');
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 请求上下文
    const ctx = {
      req, res, url, pathname, query: Object.fromEntries(url.searchParams), params: {},
      state: {},
      headers: req.headers,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '',

      json(status, data) {
        if (res.writableEnded) return;
        const body = JSON.stringify(data);
        res.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          'X-Response-Time': `${Date.now() - started}ms`,
        });
        res.end(body);
      },
      ok(data) { this.json(200, { ok: true, data, ts: Date.now() }); },
      created(data) { this.json(201, { ok: true, data, ts: Date.now() }); },
      fail(status, message, code, details) {
        this.json(status, { ok: false, error: { code: code || 'ERROR', message, details } });
      },
      text(status, body, contentType = 'text/plain; charset=utf-8') {
        if (res.writableEnded) return;
        res.writeHead(status, { 'Content-Type': contentType });
        res.end(body);
      },
      /** 读取并解析 JSON 请求体 */
      async body(limit = 2 * 1024 * 1024) {
        if (this._body !== undefined) return this._body;
        const chunks = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > limit) throw new ApiError(413, '请求体过大', 'PAYLOAD_TOO_LARGE');
          chunks.push(c);
        }
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw) { this._body = {}; return this._body; }
        try { this._body = JSON.parse(raw); } catch { throw new ApiError(400, '请求体不是合法 JSON', 'BAD_JSON'); }
        return this._body;
      },
    };

    try {
      for (const mw of router.middlewares) {
        await mw(ctx);
        if (res.writableEnded) return;
      }

      const hit = router.match(req.method, pathname);

      /**
       * 静态资源优先于 SPA fallback。
       *
       * 背景：各端注册了 `/web/*`、`/admin/*`、`/mini/*` 这类通配路由用于前端路由回退，
       * 其正则（`^/web/.*$`）同样会匹配 `/web/app.js` 这类真实资源请求，
       * 若先走路由就会把 index.html 当作 JS 返回（浏览器报 "Unexpected token '<'"）。
       *
       * 因此：带文件扩展名的请求、以及未命中路由的请求，都先尝试静态资源；
       * 而 `/api/*` 永不参与静态匹配，避免接口被同名文件遮蔽。
       */
      const isApi = pathname.startsWith('/api/');
      if (!isApi && (hasFileExt(pathname) || !hit)) {
        const served = await serveStatic(ctx);
        if (served) return;
      }

      if (!hit) {
        return ctx.fail(404, `接口不存在：${req.method} ${pathname}`, 'NOT_FOUND');
      }
      ctx.params = hit.params;
      for (const h of hit.route.handlers) {
        await h(ctx);
        if (res.writableEnded) return;
      }
      if (!res.writableEnded) ctx.fail(500, '处理器未产生响应', 'NO_RESPONSE');
    } catch (err) {
      if (res.writableEnded) return;
      if (err instanceof ApiError) {
        ctx.fail(err.status, err.message, err.code, err.details);
      } else {
        console.error(`[${req.method} ${pathname}]`, err);
        ctx.fail(500, err.message || '服务器内部错误', 'INTERNAL', process.env.NODE_ENV === 'production' ? undefined : { stack: err.stack });
      }
    }
  });

  return { server, router, app: { server, router } };
}

// ── 静态资源服务 ────────────────────────────────────────────────────────
const staticRoots = [];

/** 注册静态目录：prefix 形如 '/admin'，dir 为本地目录 */
function registerStatic(prefix, dir) {
  staticRoots.push({ prefix: prefix.replace(/\/$/, ''), dir: path.resolve(dir) });
}
// 默认注册 server/public（如存在）
registerStatic('', path.resolve(__dirname, '..', '..', 'public'));

async function serveStatic(ctx) {
  const { pathname, req, res } = ctx;
  for (const root of staticRoots) {
    // 最长前缀优先：先收集全部候选，再按 prefix 长度降序匹配
    if (root.prefix && !(pathname === root.prefix || pathname.startsWith(root.prefix + '/'))) continue;
    let rel = root.prefix ? pathname.slice(root.prefix.length) : pathname;
    if (!rel || rel === '/') rel = '/index.html';
    const target = path.resolve(path.join(root.dir, rel));
    if (!target.startsWith(root.dir)) continue;          // 阻断目录穿越
    try {
      const st = fs.statSync(target);
      if (st.isDirectory()) {
        const idx = path.join(target, 'index.html');
        if (fs.existsSync(idx)) return sendFile(res, idx);
        continue;
      }
      return sendFile(res, target);
    } catch { /* 继续尝试下一个 root */ }
  }
  return false;
}

/** 判断路径是否指向具体文件（带扩展名） */
function hasFileExt(pathname) {
  const last = pathname.split('/').pop() || '';
  return /\.[a-z0-9]{1,8}$/i.test(last);
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': /\.(html|htm)$/.test(ext) ? 'no-cache' : 'public, max-age=3600',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

module.exports = { createApp, Router, ApiError, registerStatic, serveStatic, hasFileExt, MIME };
