/**
 * 鱼价查 · 四端功能展示截图
 * 用 Playwright 驱动 Chromium，对四端分别截取高清图（deviceScaleFactor=2），
 * 存到 demo/shots/ 供 stitch.py 拼接。
 * 手机端（mini/app）打开宽视口后仅截取 .phone 手机壳元素，避免说明文档干扰。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:8787';
const OUT = 'demo/shots';
fs.mkdirSync(OUT, { recursive: true });

const wait = (p, ms) => p.waitForTimeout(ms);

async function shot(browser, { name, url, viewport, waitFor, prep, element }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  if (waitFor) { try { await p.waitForSelector(waitFor, { timeout: 15000 }); } catch (e) {} }
  if (prep) await prep(p);
  await wait(p, 2600);
  if (element) {
    const el = p.locator(element).first();
    try { await el.scrollIntoViewIfNeeded(); } catch (e) {}
    await wait(p, 800);
    await el.screenshot({ path: `${OUT}/${name}.png` });
  } else {
    await p.screenshot({ path: `${OUT}/${name}.png` });
  }
  await ctx.close();
  console.log('shot:', name);
}

(async () => {
  const browser = await chromium.launch();

  // ① Web 网站（H5）— 行情首页（公开，含搜索/分类/涨跌榜单）
  await shot(browser, {
    name: 'web', url: `${BASE}/web/`,
    viewport: { width: 1280, height: 820 },
    waitFor: '#topSearch',
  });

  // ② 管理后台 — 管理员登录后数据概览
  await shot(browser, {
    name: 'admin', url: `${BASE}/admin/`,
    viewport: { width: 1280, height: 900 },
    waitFor: '#aLogin',
    prep: async (p) => {
      await p.fill('#aEmail', 'admin@yujiacha.local');
      await p.fill('#aPw', 'Admin@2026');
      await p.click('#aLogin');
      try { await p.waitForSelector('text=数据概览', { timeout: 15000 }); } catch (e) {}
      await wait(p, 1800);
    },
  });

  // ③ 微信小程序 — 手机壳元素
  await shot(browser, {
    name: 'mini', url: `${BASE}/mini/`,
    viewport: { width: 1280, height: 1000 },
    waitFor: '.sp-card',
    element: '.phone',
  });

  // ④ 移动 App（iOS/Android）— 手机壳元素
  await shot(browser, {
    name: 'app', url: `${BASE}/app/`,
    viewport: { width: 1280, height: 1000 },
    waitFor: '.sp-card',
    element: '.phone',
  });

  await browser.close();
  console.log('SHOTS DONE');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
