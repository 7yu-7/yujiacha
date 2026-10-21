const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport:{width:940,height:900}, recordVideo:{dir:'demo/videos', size:{width:940,height:900}} });
  const p = await c.newPage();
  await p.goto('http://localhost:8787/mini/', { waitUntil:'networkidle' });
  await p.waitForSelector('#tabbar [data-tab="market"]', { timeout:20000 });
  await p.waitForSelector('.sp-card', { timeout:10000 });
  await p.screenshot({ path:'demo/smoke.png' });
  console.log('SMOKE OK, title=', await p.title());
  await c.close(); await b.close();
  console.log('SMOKE DONE');
})().catch(e => { console.error('SMOKE FAIL', e); process.exit(1); });
