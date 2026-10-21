const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));

  await p.goto('http://localhost:8787/admin/', { waitUntil: 'networkidle' });
  await p.waitForSelector('#aEmail', { timeout: 15000 });

  // 显式填写管理员账号密码
  await p.fill('#aEmail', 'admin@yujiacha.local');
  await p.fill('#aPw', 'Admin@2026');
  await p.click('#aLogin');

  // 登录后登录框消失即视为跳转成功
  await p.waitForFunction(() => {
    const btn = document.querySelector('#aLogin');
    return !btn || btn.offsetParent === null;
  }, { timeout: 15000 });
  await p.waitForTimeout(2500); // 等图表/卡片渲染

  const state = await p.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasOverview: t.includes('数据概览') || t.includes('概览'),
      hasUserManage: t.includes('用户管理'),
      hasError: t.includes('登录失败') || t.includes('账号或密码'),
      textHead: t.slice(0, 120),
    };
  });
  console.log('登录状态:', JSON.stringify(state), '页面错误数:', errors.length);

  await p.screenshot({ path: 'demo/admin-dashboard.png', fullPage: false });
  await b.close();
  console.log('DASHBOARD SHOT DONE');
})().catch(e => { console.error('LOGIN FAIL', e); process.exit(1); });
