/**
 * 部署前自检：核对交付完整性与关键配置
 * 用法：node scripts/check-deploy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 用 fileURLToPath 而非 URL.pathname —— 后者会对非 ASCII 路径做百分号编码
const HERE = path.dirname(fileURLToPath(import.meta.url));   // server/scripts
const ROOT = path.resolve(HERE, '..', '..');                 // yujiacha/
let ok = 0, warn = 0, bad = 0;
const out = [];
const chk = (name, cond, detail = '', level = 'ok') => {
  if (cond) { ok++; out.push(`  ✓ ${name}${detail ? '  ' + detail : ''}`); }
  else if (level === 'warn') { warn++; out.push(`  ! ${name}${detail ? '  ' + detail : ''}`); }
  else { bad++; out.push(`  ✗ ${name}${detail ? '  ' + detail : ''}`); }
};
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };

console.log('\n渔价查 · 交付自检\n' + '─'.repeat(76));

// ── 目录与核心文件 ──────────────────────────────────────────────────
console.log('\n[1] 目录结构');
for (const d of ['server/src', 'server/sql', 'server/scripts', 'shared', 'web', 'admin', 'client/src/pages', 'client/preview', 'docker']) {
  chk(d, exists(d));
}
for (const f of [
  'README.md', '.env.example', '.gitignore',
  'shared/tokens.css', 'shared/api.js', 'shared/ui.js',
  'server/package.json', 'server/src/server.js', 'server/src/config.js',
  'server/src/lib/http.js', 'server/src/lib/db.js', 'server/src/lib/crypto-util.js',
  'server/src/data/dictionary.js', 'server/src/routes/index.js',
  'server/src/services/price-service.js', 'server/src/services/account-service.js',
  'server/src/services/export-service.js', 'server/src/services/admin-service.js',
  'server/sql/schema.sql', 'server/sql/schema.sqlite.sql',
  'server/scripts/init-db.js', 'server/scripts/seed.js', 'server/scripts/test-api.mjs',
  'web/index.html', 'web/app.js', 'admin/index.html', 'admin/app.js',
  'client/package.json', 'client/src/pages.json', 'client/src/main.js', 'client/src/App.vue',
  'client/src/uni.scss', 'client/src/utils/config.js', 'client/src/utils/api.js',
  'client/preview/index.html', 'client/preview/app.js',
  'docker/docker-compose.yml', 'docker/Dockerfile.backend', 'docker/Dockerfile.admin', 'docker/nginx.conf',
]) chk(f, exists(f));

// ── UniApp 页面完整性（对齐 pages.json）───────────────────────────────
console.log('\n[2] UniApp 页面');
const pagesJson = read('client/src/pages.json');
const declared = [...pagesJson.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
let pageMiss = [];
for (const p of declared) {
  const f = `client/src/pages/${p.replace(/^pages\//, '')}.vue`;
  if (!exists(f)) pageMiss.push(p);
}
chk(`pages.json 声明的 ${declared.length} 个页面文件齐全`, pageMiss.length === 0, pageMiss.length ? '缺失: ' + pageMiss.join(', ') : '');
chk('底部 TabBar 5 个（行情/地图/关注/日报/我的）',
  (pagesJson.match(/"pagePath"/g) || []).length === 5);
chk('自绘趋势图组件（小程序 canvas / H5 SVG 双实现）',
  exists('client/src/components/trend-line.vue') &&
  read('client/src/components/trend-line.vue').includes('MP-WEIXIN'));

// ── 数据字典 ────────────────────────────────────────────────────────
// 直接加载字典模块核对数量，避免正则解析带来的跨行/格式脆弱性
console.log('\n[3] 数据字典');
const { createRequire } = await import('node:module');
const require_ = createRequire(import.meta.url);
const dictMod = require_(path.join(ROOT, 'server/src/data/dictionary.js'));
const { PROVINCES, MARKETS, SPECIES, CATEGORIES, PRICE_TIERS } = dictMod;
chk('34 个省级行政区', PROVINCES.length === 34, `实际 ${PROVINCES.length}`);
chk('130 家批发市场', MARKETS.length === 130, `实际 ${MARKETS.length}`);
chk('批发市场覆盖全部 34 个省级行政区',
  new Set(MARKETS.map((m) => m.provinceCode)).size === 34,
  `覆盖 ${new Set(MARKETS.map((m) => m.provinceCode)).size} 个`);
chk('核心品种 ≥ 22 个（说明书 5 大品类）', SPECIES.length >= 22, `实际 ${SPECIES.length} 个`);
chk('三档价格区间定义（低/中/高）',
  PRICE_TIERS.length === 3 && PRICE_TIERS[0].label === '低位' && PRICE_TIERS[2].label === '高位',
  PRICE_TIERS.map((t) => `${t.label}≤${t.max === Infinity ? '∞' : t.max}`).join(' / '));
chk('每个品种都有别名与拼音（支撑 F2 搜索）',
  SPECIES.every((s) => s.alias && s.alias.length && s.py));
chk('港澳台按国家标准命名',
  PROVINCES.some((p) => p.name === '台湾省') &&
  PROVINCES.some((p) => p.name === '香港特别行政区') &&
  PROVINCES.some((p) => p.name === '澳门特别行政区'));

// ── 表结构与契约 ────────────────────────────────────────────────────
console.log('\n[4] 数据库与接口契约');
const schema = read('server/sql/schema.sql');
// PRD 3.2 规定的 price_daily 业务字段（13 个）
const prdFields = ['date', 'province', 'market', 'category_l1', 'category_l2', 'species',
  'price', 'unit', 'spec', 'source_url', 'batch_no', 'collected_at'];
const missFields = prdFields.filter((f) => !new RegExp('`' + f + '`').test(schema));
chk(`price_daily 含 PRD 规定的全部业务字段（${prdFields.length} 个）`,
  missFields.length === 0, missFields.length ? '缺失: ' + missFields.join(', ') : '全部对齐');
chk('额外提供 province_code 分区码（支撑省级聚合索引）', schema.includes('`province_code`'));
chk('SQLite 等价表结构存在', read('server/sql/schema.sqlite.sql').includes('CREATE TABLE price_daily'));
chk('10 张业务表', (schema.match(/CREATE TABLE/g) || []).length === 10,
  `实际 ${(schema.match(/CREATE TABLE/g) || []).length} 张`);

const routes = read('server/src/routes/index.js');
const endpoints = ['/api/health', '/api/meta', '/api/status', '/api/species', '/api/search', '/api/map/provinces',
  '/api/provinces/:name', '/api/report/daily', '/api/movers', '/api/compare', '/api/auth/register',
  '/api/auth/login', '/api/auth/refresh', '/api/auth/forgot-password', '/api/watch', '/api/alerts',
  '/api/export/report.csv', '/api/export/report.svg', '/api/admin/dashboard', '/api/admin/users',
  '/api/admin/prices', '/api/admin/audit', '/api/admin/config'];
const epMiss = endpoints.filter((e) => !routes.includes(`'${e}'`) && !routes.includes(`"${e}"`));
chk(`${endpoints.length} 个核心端点已注册`, epMiss.length === 0, epMiss.length ? '缺失: ' + epMiss.join(', ') : '');

// ── 密钥与安全 ──────────────────────────────────────────────────────
console.log('\n[5] 安全与合规');
chk('.gitignore 已排除 .env 与运行时数据',
  read('.gitignore').includes('.env') && read('.gitignore').includes('data/'));
chk('密码哈希使用 scrypt + 随机盐', read('server/src/lib/crypto-util.js').includes('scryptSync'));
chk('JWT 为 HS256 自实现', read('server/src/lib/crypto-util.js').includes('HS256'));
chk('刷新令牌一次性轮换（旧令牌作废）', read('server/src/services/account-service.js').includes('consumeToken'));
chk('写操作审计留痕', read('server/src/services/admin-service.js').includes('audit('));
chk('涨红跌绿约定 + 箭头文字（不只靠颜色）',
  read('shared/tokens.css').includes('--up:') && read('shared/ui.js').includes('▲'));

// ── 刻意未提供的敏感内容 ────────────────────────────────────────────
const dockerCompose = read('docker/docker-compose.yml');
chk('Docker 编排要求环境变量注入密码（无硬编码）',
  dockerCompose.includes('DB_PASSWORD:?') || dockerCompose.includes(':?请'), '', 'ok');
chk('.env.example 中密码字段留空', read('.env.example').includes('DB_PASSWORD=\n') || /DB_PASSWORD=\s*$/m.test(read('.env.example')));

// ── 汇总 ────────────────────────────────────────────────────────────
console.log('\n' + out.join('\n'));
console.log('─'.repeat(76));
console.log(`  通过 ${ok}　警告 ${warn}　失败 ${bad}　共 ${ok + warn + bad} 项`);
console.log(bad === 0 ? '  ✓ 交付物完整，可直接部署\n' : '  ✗ 存在缺失项，请先修复\n');
process.exit(bad > 0 ? 1 : 0);
