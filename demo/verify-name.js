const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8787/web/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const webInfo = await p.evaluate(() => ({
    title: document.title,
    brand: (document.querySelector('.brand, .logo, [class*="brand"]') || {}).innerText || '(无)',
    hasNew: document.body.innerText.includes('鱼价查'),
    hasOld: document.body.innerText.includes('渔价查'),
  }));
  await p.screenshot({ path: 'demo/verify-web.png' });
  await p.goto('http://localhost:8787/admin/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const adminInfo = await p.evaluate(() => ({
    title: document.title,
    hasNew: document.body.innerText.includes('鱼价查'),
    hasOld: document.body.innerText.includes('渔价查'),
  }));
  console.log('WEB:', JSON.stringify(webInfo));
  console.log('ADMIN:', JSON.stringify(adminInfo));
  await b.close();
})().catch(e => { console.error('VERIFY FAIL', e); process.exit(1); });
