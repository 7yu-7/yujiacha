/**
 * 鱼价查 · 四端「每一个小功能」独立截图
 * 用 Playwright 驱动四端，逐功能导航并截取高清图（deviceScaleFactor=2），
 * 按端分文件夹输出到桌面：鱼价查_四端功能截图/{web,admin,mini,app}/
 *
 * 导航与选择器复用 demo/demo-mini.js、demo/demo-web.js 的已验证经验。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:8787';
const OUT = 'C:/Users/岳思雨/OneDrive/桌面/鱼价查_四端功能截图';
const sleep = (p, ms) => p.waitForTimeout(ms);
const mk = (d) => fs.mkdirSync(d, { recursive: true });

async function step(name, fn) {
  try { await fn(); console.log('  ✓', name); }
  catch (e) { console.warn('  ✗ FAIL', name, '-', e.message); }
}

async function webFlow(browser) {
  console.log('== Web 网站（管理员）==');
  const dir = `${OUT}/web`; mk(dir);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + '/web/#/login', { waitUntil: 'networkidle' });
  await p.waitForSelector('#lEmail', { timeout: 20000 }); await sleep(p, 1200);
  await step('登录页', () => p.screenshot({ path: `${dir}/01_登录页.png` }));
  await p.fill('#lEmail', 'admin@yujiacha.local'); await p.fill('#lPw', 'Admin@2026');
  await p.click('#lSubmit');
  await p.waitForSelector('a.tab[href="#/market"]', { timeout: 10000 }); await sleep(p, 1200);
  await step('行情首页', async () => {
    await p.evaluate(() => (location.hash = '#/market'));
    await p.waitForSelector('#topSearch', { timeout: 10000 }); await sleep(p, 2000);
    await p.screenshot({ path: `${dir}/02_行情首页.png` });
  });
  await step('智能搜索联想', async () => {
    await p.click('#topSearch'); await p.type('#topSearch', '大黄鱼', { delay: 70 });
    await p.waitForSelector('.suggest-item', { timeout: 8000 }); await sleep(p, 1200);
    await p.screenshot({ path: `${dir}/03_搜索联想.png` });
  });
  await step('品种详情', async () => {
    await p.click('.suggest-item'); await p.waitForSelector('#spWatch', { timeout: 10000 }); await sleep(p, 1800);
    await p.screenshot({ path: `${dir}/04_品种详情.png` });
  });
  await step('渔价地图（中国地图）', async () => {
    await p.evaluate(() => (location.hash = '#/map'));
    await p.waitForSelector('#mapCanvas .prov-shape', { timeout: 12000 }); await sleep(p, 1600);
    await p.screenshot({ path: `${dir}/05_渔价地图.png` });
  });
  await step('地图选省看趋势', async () => {
    const gd = await p.$('#mapCanvas .prov-shape[data-province*="广东"]');
    if (gd) await gd.click(); await sleep(p, 1800);
    await p.screenshot({ path: `${dir}/06_点击省份看趋势.png` });
  });
  await step('全国日报表', async () => {
    await p.evaluate(() => (location.hash = '#/report'));
    await p.waitForSelector('table.data', { timeout: 15000 }); await sleep(p, 1500);
    await p.screenshot({ path: `${dir}/07_全国日报表.png` });
  });
  await step('数据导出与分享', async () => {
    await p.evaluate(() => (location.hash = '#/me'));
    await p.waitForSelector('[data-export="report"]', { timeout: 12000 }); await sleep(p, 1200);
    await p.screenshot({ path: `${dir}/08_数据导出.png` });
  });
  await ctx.close();
}

async function adminFlow(browser) {
  console.log('== 管理后台（管理员）==');
  const dir = `${OUT}/admin`; mk(dir);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
  await p.waitForSelector('#aLogin', { timeout: 20000 }); await sleep(p, 1000);
  await step('登录页', () => p.screenshot({ path: `${dir}/01_登录页.png` }));
  await p.fill('#aEmail', 'admin@yujiacha.local'); await p.fill('#aPw', 'Admin@2026');
  await p.click('#aLogin');
  await p.waitForSelector('a.btn[href="#/prices"]', { timeout: 15000 }); await sleep(p, 1800);
  await step('数据概览', () => p.screenshot({ path: `${dir}/02_数据概览.png` }));
  const go = async (h, sel) => {
    await p.evaluate((x) => (location.hash = '#/' + x), h);
    await p.waitForSelector(sel, { timeout: 12000 }); await sleep(p, 1400);
  };
  await step('用户管理', async () => { await go('users', '#uApply'); await p.screenshot({ path: `${dir}/03_用户管理.png` }); });
  await step('价格数据', async () => { await go('prices', '#pApply'); await p.screenshot({ path: `${dir}/04_价格数据.png` }); });
  await step('关注阈值与推送', async () => { await go('watch', '#wApply'); await p.screenshot({ path: `${dir}/05_关注阈值推送.png` }); });
  await step('审计日志', async () => { await go('audit', '#atApply'); await p.screenshot({ path: `${dir}/06_审计日志.png` }); });
  await step('系统设置', async () => { await go('config', '#cfgSave'); await p.screenshot({ path: `${dir}/07_系统设置.png` }); });
  await ctx.close();
}

async function clientFlow(browser, { base, dir, label }) {
  console.log(`== ${label} ==`);
  mk(dir);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1120 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + base, { waitUntil: 'networkidle' });
  await p.waitForSelector('#tabbar [data-tab="market"]', { timeout: 20000 }); await sleep(p, 1000);
  const phone = async (name) => {
    const el = p.locator('.phone').first();
    try { await el.scrollIntoViewIfNeeded(); } catch {}
    await sleep(p, 700);
    await el.screenshot({ path: `${dir}/${name}.png` });
  };
  await step('行情首页', async () => {
    await p.waitForSelector('.sp-card', { timeout: 10000 }); await sleep(p, 1500);
    await phone('01_行情首页');
  });
  await step('全局搜索', async () => {
    await p.click('#mpSearch'); await p.waitForSelector('#sKw', { timeout: 8000 }); await sleep(p, 700);
    await p.type('#sKw', '草鱼', { delay: 70 });
    await p.waitForSelector('#sResult [data-sp2]', { timeout: 8000 }); await sleep(p, 1200);
    await phone('02_全局搜索');
  });
  await step('品种详情', async () => {
    await p.click('#sResult [data-sp2]'); await p.waitForSelector('#screen .mp', { timeout: 8000 }); await sleep(p, 1500);
    await phone('03_品种详情');
    if (await p.$('#navBack')) await p.click('#navBack'); await sleep(p, 700);
  });
  await step('我的与登录', async () => {
    await p.click('[data-tab="me"]'); await p.waitForSelector('#meLogin', { timeout: 8000 }); await sleep(p, 1000);
    await phone('04_我的与登录');
  });
  await step('登录 + 关注列表', async () => {
    await p.click('#meLogin'); await p.waitForSelector('#lgEmail', { timeout: 8000 });
    await p.fill('#lgEmail', 'farmer@yujiacha.local'); await p.fill('#lgPw', 'Demo@2026');
    await p.click('#lgGo'); await p.waitForSelector('[data-tab="watch"]', { timeout: 10000 }); await sleep(p, 1200);
    await phone('05_我的关注');
  });
  await step('渔价地图', async () => {
    await p.click('[data-tab="map"]'); await p.waitForSelector('#mpMapHost .prov-shape', { timeout: 12000 }); await sleep(p, 1200);
    await phone('06_渔价地图');
  });
  await step('地图选省看趋势', async () => {
    // 直接调用省份 onclick，避免不规则多边形边界框中心落空；成功态详情无 .mp 类，改为校验省份名卡片 + 趋势 SVG
    await p.evaluate(() => {
      const el = document.querySelector('#mpMapHost .prov-shape[data-province*="广东"]');
      if (el && typeof el.onclick === 'function') el.onclick();
    });
    await p.waitForFunction(() => {
      const s = document.getElementById('screen');
      return s && s.querySelector('span[style*="font-size:19px"]') && s.querySelector('svg');
    }, { timeout: 8000 }).catch(() => {});
    await phone('06b_点击省份看趋势');
    if (await p.$('#navBack')) await p.click('#navBack'); await sleep(p, 600);
  });
  await step('全国日报表', async () => {
    await p.click('[data-tab="report"]'); await p.waitForSelector('#screen table', { timeout: 12000 }); await sleep(p, 1500);
    await phone('07_全国日报表');
  });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await webFlow(browser);
  await adminFlow(browser);
  await clientFlow(browser, { base: '/mini/', dir: `${OUT}/mini`, label: '微信小程序（普通用户）' });
  await clientFlow(browser, { base: '/app/', dir: `${OUT}/app`, label: '移动 App（普通用户）' });
  await browser.close();
  console.log('ALL FEATURE SHOTS DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
