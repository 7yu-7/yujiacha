/**
 * 鱼价查 · 微信小程序功能演示（普通用户 farmer@yujiacha.local）
 * 通过 Playwright 驱动 UniApp 的 H5 预览页并录制视频，自带分步字幕讲解。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8787';
const VIDEO_DIR = path.resolve(__dirname, 'videos');
const W = 940, H = 900;
const wait = (p, ms) => p.waitForTimeout(ms);

async function caption(page, text, top = 16) {
  await page.evaluate(({ t, top }) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      el.style.cssText = `position:fixed;left:50%;top:${top}px;transform:translateX(-50%);z-index:2147483647;` +
        'background:rgba(10,110,120,.94);color:#fff;padding:10px 20px;border-radius:999px;' +
        'font:600 15px/1.45 "PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);' +
        'max-width:92vw;text-align:center;white-space:pre-line;letter-spacing:.3px';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, { t: text, top });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: VIDEO_DIR, size: { width: W, height: H } },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const downloads = [];
  page.on('download', async (d) => {
    try { await d.saveAs(path.join(__dirname, 'downloads', d.suggestedFilename())); } catch {}
    downloads.push(d.suggestedFilename());
  });

  await page.goto(BASE + '/mini/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#tabbar [data-tab="market"]', { timeout: 20000 });
  await wait(page, 1200);

  await caption(page, '鱼价查 · 微信小程序功能演示\n（普通用户 farmer@yujiacha.local）');
  await wait(page, 3600);

  await caption(page, '① 行情首页：全国水产品实时均价、涨跌与分类浏览');
  await page.waitForSelector('.sp-card', { timeout: 10000 });
  await wait(page, 3000);

  // ② 搜索
  await page.click('#mpSearch');
  await page.waitForSelector('#sKw', { timeout: 8000 });
  await caption(page, '② 全局搜索：支持中文名 / 拼音首字母 / 别名');
  await wait(page, 1500);
  await page.type('#sKw', '草鱼', { delay: 90 });
  await page.waitForSelector('#sResult [data-sp2]', { timeout: 8000 });
  await caption(page, '输入「草鱼」搜索，展示全国各市场行情');
  await wait(page, 2800);

  // ③ 详情
  await page.click('#sResult [data-sp2]');
  await page.waitForSelector('#screen .mp', { timeout: 8000 });
  await caption(page, '③ 品种详情：价格走势、各省对比与批发市场');
  await wait(page, 3200);
  if (await page.$('#navBack')) { await page.click('#navBack'); await wait(page, 900); }

  // ④ 我的 + 登录
  await page.click('[data-tab="me"]');
  await page.waitForSelector('#meLogin', { timeout: 8000 });
  await caption(page, '④ 我的：登录解锁云端同步与更多能力');
  await wait(page, 1800);
  await page.click('#meLogin');
  await page.waitForSelector('#lgEmail', { timeout: 8000 });
  await caption(page, '以普通用户身份登录');
  await wait(page, 1200);
  await page.fill('#lgEmail', 'farmer@yujiacha.local');
  await page.fill('#lgPw', 'Demo@2026');
  await page.click('#lgGo');
  await page.waitForSelector('[data-tab="watch"]', { timeout: 10000 });
  await wait(page, 900);
  await caption(page, '✓ 登录成功：farmer@yujiacha.local（普通用户）');
  await wait(page, 2200);

  // ⑤ 关注
  await page.click('[data-tab="market"]');
  await page.waitForSelector('[data-watch]', { timeout: 10000 });
  await caption(page, '⑤ 我的关注：在行情页点击 ☆ 一键关注品种');
  await wait(page, 1200);
  await page.click('[data-watch]');
  await wait(page, 1500);
  await caption(page, '关注成功，品种已加入云端关注列表');
  await wait(page, 1800);
  await page.click('[data-tab="watch"]');
  await page.waitForSelector('#screen', { timeout: 8000 });
  await caption(page, '关注列表自动同步，可接收价格异动提醒');
  await wait(page, 2600);

  // ⑥ 地图
  await page.click('[data-tab="map"]');
  await page.waitForSelector('#mpMapHost .prov-shape', { timeout: 12000 });
  await caption(page, '⑥ 每日渔价地图：中国地图按价格档位着色（红=高价）');
  await wait(page, 2800);
  const gd = await page.$('#mpMapHost .prov-shape[data-province*="广东"]');
  if (gd) await gd.click(); else await page.click('#mpMapHost .prov-shape');
  await page.waitForSelector('#screen .mp', { timeout: 8000 });
  await caption(page, '点击省份（如广东），查看近一周价格趋势');
  await wait(page, 3200);
  if (await page.$('#navBack')) { await page.click('#navBack'); await wait(page, 900); }

  // ⑦ 日报
  await page.click('[data-tab="report"]');
  await page.waitForSelector('#screen table', { timeout: 12000 });
  await caption(page, '⑦ 全国渔价日报表：T+0 每日生成，可按省 / 品种维度查看');
  await wait(page, 3200);

  await caption(page, '小程序演示结束 · 同一套 UniApp 源码可打包为 iOS / Android App');
  await wait(page, 2500);

  await context.close();
  await browser.close();

  const files = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
    .sort((a, b) => fs.statSync(path.join(VIDEO_DIR, a)).mtimeMs - fs.statSync(path.join(VIDEO_DIR, b)).mtimeMs);
  if (files.length) {
    const src = path.join(VIDEO_DIR, files[files.length - 1]);
    const dst = path.join(VIDEO_DIR, 'mini-demo.webm');
    if (src !== dst) fs.renameSync(src, dst);
    console.log('MINI VIDEO:', dst);
  }
  console.log('downloads:', downloads);
})().catch((e) => { console.error('MINI DEMO ERROR', e); process.exit(1); });
