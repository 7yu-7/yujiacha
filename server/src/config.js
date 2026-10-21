/**
 * 配置中心
 * 所有密钥/连接信息走环境变量（呼应 PRD 6「root 密码等密钥走环境变量，不入库不写码」）
 */
const path = require('path');
const fs = require('fs');

// 轻量 .env 解析（零依赖）
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const ROOT = path.resolve(__dirname, '..', '..');          // → yujiacha/
const envFile = loadEnvFile(path.join(ROOT, '.env'));       // yujiacha/.env
const localEnv = loadEnvFile(path.join(process.cwd(), '.env')); // server/.env（就近覆盖）
const merged = { ...envFile, ...localEnv, ...process.env };

function bool(v, dflt = false) {
  if (v === undefined || v === null || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(String(v));
}

const config = {
  root: ROOT,

  server: {
    port: Number(merged.PORT || 8787),
    host: merged.HOST || '127.0.0.1',
  },

  // 数据库：mysql | sqlite（sqlite 为无密码回退方案，表结构与 MySQL 完全一致）
  db: {
    driver: (merged.DB_DRIVER || 'mysql').toLowerCase(),
    mysql: {
      host: merged.DB_HOST || '127.0.0.1',
      port: Number(merged.DB_PORT || 3306),
      user: merged.DB_USER || 'root',
      password: merged.DB_PASSWORD || '',
      database: merged.DB_NAME || 'fish_price',
      connectionLimit: Number(merged.DB_POOL || 10),
      charset: 'utf8mb4',
      timezone: '+08:00',
      decimalNumbers: true,
    },
    sqlite: {
      file: merged.SQLITE_FILE || path.join(ROOT, 'data', 'fish_price.db'),
    },
  },

  auth: {
    // JWT 签名密钥（生产必须由环境变量注入）
    jwtSecret: merged.JWT_SECRET || 'yujiacha-dev-secret-change-me-in-production',
    accessTtl: Number(merged.JWT_ACCESS_TTL || 2 * 60 * 60),        // 2h
    refreshTtl: Number(merged.JWT_REFRESH_TTL || 30 * 24 * 3600),   // 30d
    verifyTtl: Number(merged.EMAIL_VERIFY_TTL || 24 * 3600),        // 24h
    resetTtl: Number(merged.PASSWORD_RESET_TTL || 2 * 3600),        // 2h
  },

  // 邮件：开发环境走「站内取件箱」，把验证/重置链接直接落盘并可由接口读取
  mail: {
    outboxDir: merged.MAIL_OUTBOX_DIR || path.join(ROOT, 'data', 'mail'),
    from: merged.MAIL_FROM || 'noreply@yujiacha.local',
    // smtp 配置存在时走真实 SMTP（此处仅登记，不引入额外依赖）
    smtp: merged.SMTP_HOST
      ? { host: merged.SMTP_HOST, port: Number(merged.SMTP_PORT || 465), user: merged.SMTP_USER, pass: merged.SMTP_PASS }
      : null,
  },

  // 缓存：热点查询（日报、省份榜）本地缓存 TTL
  cache: {
    ttl: Number(merged.CACHE_TTL || 60), // 秒
  },

  app: {
    name: '鱼价查',
    fullName: '智慧渔业全国水产品价格日报系统',
    version: '1.0.0',
    baseUrl: merged.APP_BASE_URL || 'http://localhost:8787',
    // 演示数据规模：historyDays 决定历史时序长度
    demo: {
      historyDays: Number(merged.DEMO_HISTORY_DAYS || 0) || null, // null = 22 个月完整规模
    },
  },

  cors: {
    origins: (merged.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  },

  isProd: /^prod/i.test(merged.NODE_ENV || ''),
};

config.usingSqlite = config.db.driver === 'sqlite';

module.exports = config;
