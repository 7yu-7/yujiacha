/**
 * 诊断 + 补拍：小程序 / App 地图选省。
 * 直接调用省份 onclick()，并在调用后检查：navbar 是否出现返回键（push 已执行）、
 * #screen 内容是否包含 .mp（renderProvince 已渲染）。
 */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8787';
const OUT = 'C:/Users/岳思雨/OneDrive/桌面/鱼价查_四端功能截图';
const sleep = (p, ms) => p.waitForTimeout(ms);

async function shoot(base, dir) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1120 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + base, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-tab="map"]', { timeout: 20000 });
  await p.click('[data-tab="map"]');
  await p.waitForSelector('#mpMapHost .prov-shape', { timeout: 12000 });
  await sleep(p, 1200);

  const info = await p.evaluate(() => {
    const el = document.querySelector('#mpMapHost .prov-shape[data-province*="广东"]');
    const t = el ? typeof el.onclick : 'no-el';
    let err = null;
    try { if (t === 'function') el.onclick(); } catch (e) { err = e.message; }
    return { type: t, err };
  });
  await sleep(p, 2500);
  const after = await p.evaluate(() => {
    const nb = document.getElementById('navBack');
    const s = document.getElementById('screen');
    const nameEl = s && s.querySelector('span[style*="font-size:19px"]');
    return {
      hasNavBack: !!nb,
      screenLen: s ? s.innerHTML.length : 0,
      hasMp: !!document.querySelector('#screen .mp'),
      provinceName: nameEl ? nameEl.textContent : '',
      hasChartSvg: !!(s && s.querySelector('svg')),
      head: s ? s.innerHTML.slice(0, 120) : '',
    };
  });
  console.log(base, 'info=', JSON.stringify(info));
  console.log(base, 'after=', JSON.stringify(after));
  const el = p.locator('.phone').first();
  try { await el.scrollIntoViewIfNeeded(); } catch {}
  await sleep(p, 700);
  await el.screenshot({ path: `${dir}/06b_点击省份看趋势.png` });
  await ctx.close();
  await b.close();
}

(async () => {
  await shoot('/mini/', `${OUT}/mini`);
  await shoot('/app/', `${OUT}/app`);
  console.log('PATCH DONE');
})().catch((e) => { console.error('PATCH FAIL', e); process.exit(1); });
