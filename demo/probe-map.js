const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:1280,height:1120}, deviceScaleFactor:1 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8787/mini/', { waitUntil:'networkidle' });
  await p.waitForSelector('[data-tab="map"]',{timeout:20000});
  await p.click('[data-tab="map"]');
  await p.waitForSelector('#mpMapHost .prov-shape',{timeout:12000});
  await p.waitForTimeout(1200);
  const gd = await p.$('#mpMapHost .prov-shape[data-province*="广东"]');
  console.log('found 广东 shape:', !!gd);
  if(gd) await gd.click();
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const mp = document.querySelector('#screen .mp');
    const sel = document.querySelectorAll('#mpMapHost .prov-shape');
    let selected=null;
    sel.forEach(s=>{ if(s.getAttribute('data-selected')==='true'||s.classList.contains('selected')) selected=s.getAttribute('data-province'); });
    return {
      hasScreenMp: !!mp,
      screenMpHtmlLen: mp ? mp.innerHTML.length : 0,
      selectedProvince: selected,
      screenInnerLen: (document.querySelector('#screen')||{}).innerHTML?.length||0,
      hasNavBack: !!document.querySelector('#navBack'),
    };
  });
  console.log(JSON.stringify(r,null,2));
  await b.close();
})().catch(e=>{console.error('PROBE FAIL',e);process.exit(1);});
