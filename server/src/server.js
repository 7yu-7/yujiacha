/**
 * 渔价查 · 后端服务入口
 * 一套服务四端：微信小程序 / 移动 App / 管理后台 / Web(H5)
 */
const path = require('path');
const { createApp, registerStatic } = require('./lib/http');
const { registerRoutes } = require('./routes');
const config = require('./config');
const db = require('./lib/db');

// 静态资源：四端构建产物
registerStatic('/web', path.resolve(config.root, 'web'));                 // Web 网站（H5）
registerStatic('/admin', path.resolve(config.root, 'admin'));             // 管理后台（Vue3 风格）
registerStatic('/mini', path.resolve(config.root, 'client', 'preview'));  // 小程序预览（UniApp H5 产物 + 手机壳）
registerStatic('/app', path.resolve(config.root, 'client', 'app-preview'));// 移动 App 预览（原生手机外壳）
registerStatic('/shared', path.resolve(config.root, 'shared'));           // 共享 Design Token / 组件库

const { server, router, app } = createApp({ corsOrigins: config.cors.origins });
registerRoutes(router);

// 根路径 → 落地导航页
router.get('/', (ctx) => {
  ctx.text(200, landingPage(), 'text/html; charset=utf-8');
});

// 未匹配的页面路由回退到相应端首页（支持前端 hash/history 路由）
const fsx = require('fs');
function fallback(rel) {
  return (ctx) => {
    try {
      ctx.text(200, fsx.readFileSync(path.resolve(config.root, rel), 'utf8'), 'text/html; charset=utf-8');
    } catch {
      ctx.fail(404, '页面不存在', 'NOT_FOUND');
    }
  };
}
router.get('/web/*', fallback('web/index.html'));
router.get('/admin/*', fallback('admin/index.html'));
router.get('/mini/*', fallback('client/preview/index.html'));
router.get('/app/*', fallback('client/app-preview/index.html'));

function landingPage() {
  const ok = 'display:block;padding:18px 22px;border:1px solid #D8E3E4;border-radius:12px;text-decoration:none;color:#1F2933;background:#fff;';
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>鱼价查 · 服务导航</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#F7FAFA;color:#1F2933;}
  .wrap{max-width:820px;margin:0 auto;padding:56px 24px;}
  h1{font-size:28px;margin:0 0 8px;color:#005F73;}
  p.lead{color:#6B7280;margin:0 0 32px;font-size:14.5px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  a:hover{border-color:#0A9396;box-shadow:0 4px 16px rgba(10,147,150,.12);}
  .t{font-weight:700;font-size:16px;margin-bottom:6px;color:#0A9396;}
  .d{font-size:13px;color:#6B7280;line-height:1.6;}
  .api{margin-top:32px;padding:18px 22px;background:#0B1F24;border-radius:12px;color:#B8E4E8;font-size:13px;line-height:1.9;}
  code{color:#7FE3E8;}
  @media (max-width:700px){.grid{grid-template-columns:1fr;}}
</style></head>
<body><div class="wrap">
  <h1>鱼价查</h1>
  <p class="lead">智慧渔业全国水产品价格日报系统 · 统一后端服务（小程序 / 移动 App / 管理后台 / Web-H5 四端共用）</p>
  <div class="grid">
    <a style="${ok}" href="/web/"><div class="t">Web 网站（H5）→</div><div class="d">完整功能站点：行情浏览、搜索、地图选省、我的关注、全国日报表</div></a>
    <a style="${ok}" href="/admin/"><div class="t">管理后台 →</div><div class="d">用户管理、价格数据查看与修正、阈值与推送配置、审计日志</div></a>
    <a style="${ok}" href="/mini/"><div class="t">微信小程序 →</div><div class="d">UniApp 编译产物预览（H5 形态），可导入 HBuilderX 编译为微信小程序</div></a>
    <a style="${ok}" href="/app/"><div class="t">移动 App（iOS / Android）→</div><div class="d">同套 UniApp 源码的原生 App 预览，可云打包为 .apk / .ipa</div></a>
  </div>
  <div class="api">
    <div>健康检查：<code>GET /api/health</code></div>
    <div>元数据：<code>GET /api/meta</code>　·　数据状态：<code>GET /api/status</code></div>
    <div>全品种：<code>GET /api/species</code>　·　搜索：<code>GET /api/search?q=jyx</code></div>
    <div>地图省份：<code>GET /api/map/provinces</code>　·　日报表：<code>GET /api/report/daily</code></div>
  </div>
</div></body></html>`;
}

async function start() {
  try {
    await db.connect();
    const info = await db.ping();
    console.log('═'.repeat(72));
    console.log(` 渔价查 · 智慧渔业全国水产品价格日报系统  v${config.app.version}`);
    console.log('═'.repeat(72));
    console.log(` 数据库：${info.driver === 'mysql' ? `MySQL ${info.database}` : `SQLite ${info.file}`}`);
    console.log(` 静态资源：/web（网站）  /admin（管理后台）  /mini（小程序）  /app（移动 App）`);
  } catch (e) {
    console.error('\n✗ 数据库连接失败：', e.message);
    console.error('  服务仍会启动，但数据接口将不可用。请检查 .env 配置或先执行 npm run init:db && npm run seed');
  }

  server.listen(config.server.port, config.server.host, () => {
    const base = `http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}`;
    console.log(` 服务地址：${base}`);
    console.log(` 网站：${base}/web/   管理后台：${base}/admin/   小程序：${base}/mini/   移动App：${base}/app/`);
    console.log('─'.repeat(72));
    console.log(' 演示账号（密码见下）：');
    console.log('   管理员   admin@yujiacha.local   / Admin@2026');
    console.log('   教研用户 teacher@shou.edu.cn    / Demo@2026');
    console.log('   政府用户 gov@agri.local         / Demo@2026');
    console.log('   普通用户 farmer@yujiacha.local  / Demo@2026');
    console.log('═'.repeat(72));
  });
}

// 优雅退出
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`\n收到 ${sig}，正在关闭 …`);
    server.close();
    await db.close().catch(() => {});
    process.exit(0);
  });
}

start();
