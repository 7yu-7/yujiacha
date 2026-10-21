/**
 * 加密与令牌工具（零外部依赖）
 *  - 密码：scrypt + 每用户随机盐，格式 scrypt$N$r$p$salt$hash
 *  - JWT：HS256 自实现（header.payload.signature），支持 exp / iat / typ
 *  - 随机令牌：crypto.randomBytes
 * 对应 PRD 6「密码加盐哈希 / JWT + refresh token 轮换 / 找回令牌时效限制」
 */
const crypto = require('crypto');

// ── 密码哈希 ────────────────────────────────────────────────────────────
const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  const calc = crypto.scryptSync(String(password), salt, KEYLEN, { N: Number(N), r: Number(r), p: Number(p) }).toString('hex');
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── JWT（HS256）─────────────────────────────────────────────────────────
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return { ok: false, error: 'missing_token' };
  const seg = token.split('.');
  if (seg.length !== 3) return { ok: false, error: 'malformed' };
  const [h, p, s] = seg;
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
  const a = Buffer.from(s), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: 'bad_signature' };
  let payload;
  try { payload = JSON.parse(b64urlDecode(p).toString('utf8')); } catch { return { ok: false, error: 'bad_payload' }; }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, error: 'expired' };
  return { ok: true, payload };
}

// ── 随机令牌 ────────────────────────────────────────────────────────────
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** 生成匿名访问的访客标识（游客只读，不落库） */
const guestId = () => 'guest_' + crypto.randomBytes(6).toString('hex');

module.exports = { hashPassword, verifyPassword, signJwt, verifyJwt, randomToken, guestId };
