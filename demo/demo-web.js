/**
 * 鱼价查 · 网站功能演示（管理员 admin@yujiacha.local）—— 分段录制后合并
 * 覆盖网站每一个主要功能，节奏放慢、字幕条理清晰，重点突出「数据导出」。
 * 因 Playwright recordVideo 在 headless 下约 60s 会截断，故拆为 3 段分别录制再合并。
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8787';
const VIDEO_DIR = path.resolve(__dirname, 'videos');
const DL_DIR = path.resolve(__dirname, 'downloads');
const W = 1280, H = 800;
const wait = (p, ms) => p.waitForTimeout(ms);
const FF = 'C:/Users/岳思雨/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const downloads = [];

function latestPageWebm() {
  const files = fs.readdirSync(VIDEO_DIR)
    .filter((f) => f.endsWith('.webm') && f.startsWith('page@'))
    .sort((a, b) => fs.statSync(path.join(VIDEO_DIR, a)).mtimeMs - fs.statSync(path.join(VIDEO_DIR, b)).mtimeMs);
  return files.length ? path.join(VIDEO_DIR, files[files.length - 1]) : null;
}

async function caption(page, text, top = 76) {
  await page.evaluate(({ t, top }) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      el.style.cssText = `position:fixed;left:50%;top:${top}px;transform:translateX(-50%);z-index:2147483647;` +
        'background:rgba(10,110,120,.95);color:#fff;padding:11px 22px;border-radius:999px;' +
        'font:600 15px/1.5 "PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.3);' +
        'max-width:92vw;text-align:center;white-space:pre-line;letter-spacing:.3px';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, { t: text, top });
}

async function newCtx(browser) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: VIDEO_DIR, size: { width: W, height: H } },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.on('download', async (d) => {
    try { await d.saveAs(path.join(DL_DIR, d.suggestedFilename())); } catch {}
    downloads.push(d.suggestedFilename());
  });
  return { ctx, page };
}

async function login(page) {
  await page.goto(BASE + '/web/#/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#lEmail', { timeout: 20000 });
  await page.fill('#lEmail', 'admin@yujiacha.local');
  await page.fill('#lPw', 'Admin@2026');
  await page.click('#lSubmit');
  await page.waitForSelector('a.tab[href="#/market"]', { timeout: 10000 });
}

async function closeAndName(ctx, partName) {
  await ctx.close();
  const src = latestPageWebm();
  if (src) {
    const dst = path.join(VIDEO_DIR, partName);
    if (src !== dst) fs.renameSync(src, dst);
  }
}

(async () => {
  const browser = await chromium.launch();

  // ════════ 第 1 段：开场 + 登录 + 行情 + 搜索 + 详情 + 关注 + 品种导出 ════════
  {
    const { ctx, page } = await newCtx(browser);
    await login(page);
    await wait(page, 1000);
    await caption(page, '鱼价查 · 网站功能演示（管理员视角）\n覆盖 行情/搜索/详情/地图/日报/关注/对比/导出/主题', 120);
    await wait(page, 3200);
    await caption(page, '① 管理员登录成功，进入网站主界面（顶部「鱼价查」品牌）');
    await wait(page, 2400);
    await caption(page, '② 行情首页（F1）：全国水产品价格行情\n顶部搜索 · 地区/品类/排序筛选 · 右侧涨跌榜 · 品种卡片');
    await page.waitForSelector('#marketBody .species-grid', { timeout: 12000 });
    await wait(page, 2800);
    const chip = await page.$('#catChips .chip');
    if (chip) { await chip.click(); await caption(page, '按品类快捷筛选，列表实时刷新'); await wait(page, 2300); }
    const ap = await page.$('#fApply');
    if (ap) { await page.selectOption('#fSort', 'changePct').catch(() => {}); await ap.click(); await caption(page, '切换排序维度（涨跌幅），快速定位异动品种'); await wait(page, 2300); }
    await caption(page, '③ 智能搜索（F2）：输入品种名，实时联想下拉');
    await page.click('#topSearch');
    await page.type('#topSearch', '大黄鱼', { delay: 110 });
    await page.waitForSelector('.suggest-item', { timeout: 8000 });
    await wait(page, 2000);
    await caption(page, '支持中文名 / 拼音首字母 / 别名；点击联想项进入详情');
    await wait(page, 1800);
    await page.click('.suggest-item');
    await page.waitForSelector('#spBody', { timeout: 12000 });
    await caption(page, '④ 品种详情（F6）：规格 / 历史走势 / 分省价格 / 市场报价 / 来源');
    await wait(page, 2900);
    const d30 = await page.$('[data-days="30"]');
    if (d30) { await d30.click(); await caption(page, '可切换时间区间（7/30/90/180/365天）查看长期走势'); await wait(page, 2600); }
    const sw = await page.$('#spWatch');
    if (sw) { await sw.click(); await caption(page, '一键关注品种，登录后云端多端同步'); await wait(page, 2400); }
    const se = await page.$('#spExport');
    if (se) {
      await se.scrollIntoViewIfNeeded().catch(() => {});
      await caption(page, '⑤ 数据导出（F8）：详情页一键导出「品种明细 CSV」');
      await wait(page, 1900);
      await se.click();
      await wait(page, 2200);
      await caption(page, '✓ 已导出品种明细 CSV（含来源 URL 与采集批次号，可审计）');
      await wait(page, 2000);
    }
    await closeAndName(ctx, 'web-demo-part1.webm');
  }

  // ════════ 第 2 段：地图 + 日报表 + 三种导出 ════════
  {
    const { ctx, page } = await newCtx(browser);
    await login(page);
    await wait(page, 800);
    await page.click('a.tab[href="#/map"]');
    await page.waitForSelector('#mapCanvas .prov-shape', { timeout: 12000 });
    await caption(page, '⑥ 每日渔价地图（F3）：中国地图按价格档位着色\n红=高价 · 蓝=低价（沿海主产区），含南海诸岛与海岸线');
    await wait(page, 3000);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('#mapCanvas .prov-shape')]
        .find((e) => (e.getAttribute('data-province') || '').includes('广东'));
      if (el && el.onclick) el.onclick();
    });
    await caption(page, '点击省份（如广东）查看近一周趋势 + 省份对比 + 市场明细');
    await wait(page, 2800);
    const mt = await page.$('#mapModeToggle');
    if (mt) {
      await mt.click();
      await caption(page, '地图可切换「列表模式」，按省份均价排序横向对比');
      await wait(page, 2400);
      await mt.click();
      await wait(page, 1100);
    }
    await page.click('a.tab[href="#/report"]');
    await page.waitForSelector('table.data', { timeout: 15000 });
    await caption(page, '⑦ 全国渔价日报表（F5）：T+0 每日生成\n省份均价排序 + 较昨日涨跌 + 领涨品种 + 数据日期/市场数/记录条数');
    await wait(page, 2900);
    const ds = await page.$('[data-dim="species"]');
    if (ds) {
      await ds.click();
      await caption(page, '日报支持切换「品种维度」，查看各品种全国均价与覆盖');
      await wait(page, 2400);
      const dp = await page.$('[data-dim="province"]');
      if (dp) { await dp.click(); await wait(page, 1100); }
    }
    await caption(page, '⑧ 数据导出（F8，重点）：管理员可在日报页一键导出三种格式');
    await wait(page, 2000);
    const ec = await page.$('#exportCsv');
    if (ec) {
      await ec.scrollIntoViewIfNeeded().catch(() => {});
      await caption(page, '导出「全国日报表 CSV」—— Excel 直接打开（带 BOM）');
      await ec.click(); await wait(page, 2200);
      await caption(page, '✓ 日报 CSV 已导出（含数据日期 / 覆盖市场 / 记录条数）');
      await wait(page, 2000);
    }
    const es = await page.$('#exportSvg');
    if (es) {
      await es.scrollIntoViewIfNeeded().catch(() => {});
      await caption(page, '导出「分享长图 SVG」—— 用于汇报 / 朋友圈 / 公众号');
      await es.click(); await wait(page, 2200);
      await caption(page, '✓ 分享长图已导出（标准 A4 比例，含品牌与批次号）');
      await wait(page, 2000);
    }
    const ep = await page.$('#exportPrint');
    if (ep) {
      await ep.scrollIntoViewIfNeeded().catch(() => {});
      const pop = await page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
      await caption(page, '导出「PDF（打印友好页）」—— 浏览器打印另存为 PDF');
      await ep.click();
      if (pop) {
        await pop.waitForLoadState('load').catch(() => {});
        await wait(pop, 2400);
        await caption(page, '✓ 打印友好页已打开，可「另存为 PDF」永久留存');
        await wait(page, 2200);
        await pop.close().catch(() => {});
      }
      await wait(page, 900);
    }
    await closeAndName(ctx, 'web-demo-part2.webm');
  }

  // ════════ 第 3 段：关注 + 历史对比 + 主题切换 + 收尾 ════════
  {
    const { ctx, page } = await newCtx(browser);
    await login(page);
    await wait(page, 800);
    await page.click('a.tab[href="#/watch"]');
    await page.waitForSelector('#watchBody', { timeout: 12000 });
    await caption(page, '⑨ 我的关注（F4）：集中查看关注品种实时价 / 近一周走势 / 异动\n（刚才关注的「大黄鱼」已云端同步出现）');
    await wait(page, 2800);
    const ew = await page.$('#exportWatch');
    if (ew) {
      await ew.scrollIntoViewIfNeeded().catch(() => {});
      await caption(page, '关注列表同样可导出 CSV，便于线下分析与归档');
      await ew.click(); await wait(page, 2200);
      await caption(page, '✓ 关注列表 CSV 已导出');
      await wait(page, 2000);
    }
    await page.goto(BASE + '/web/#/compare', { waitUntil: 'networkidle' });
    await page.waitForSelector('#cmpChips .chip', { timeout: 12000 });
    await caption(page, '⑩ 历史趋势对比（F11）：选 1–6 个品种，对比走势与区间涨跌幅');
    await wait(page, 2400);
    const cs = await page.$$('#cmpChips .chip');
    for (let i = 0; i < Math.min(3, cs.length); i++) { await cs[i].click(); await wait(page, 400); }
    await caption(page, '已选择多个品种，点击「开始对比」');
    await wait(page, 1700);
    const run = await page.$('#cmpRun');
    if (run) {
      await run.click();
      await page.waitForSelector('#cmpBody svg, #cmpBody table', { timeout: 12000 });
      await caption(page, '对比图展示各品种价格曲线 + 区间统计（起/终/涨跌/振幅）');
      await wait(page, 2800);
    }
    await page.goto(BASE + '/web/#/market', { waitUntil: 'networkidle' });
    await page.waitForSelector('#themeBtn', { timeout: 10000 });
    await caption(page, '⑪ 主题切换（F9）：浅色 / 深色 / 学术白底 三套');
    await wait(page, 2000);
    await page.click('#themeBtn'); await wait(page, 1400);
    await caption(page, '切换为「深色」主题，护眼模式');
    await wait(page, 2000);
    await page.click('#themeBtn'); await wait(page, 1400);
    await caption(page, '再切换为「学术白底」主题，适合报告与投屏');
    await wait(page, 2000);
    await page.click('#themeBtn'); await wait(page, 1400);
    await caption(page, '切回「浅色」默认主题');
    await wait(page, 1600);
    await caption(page, '网站功能演示结束 · 管理员拥有数据导出与后台治理的完整权限\n下一站可进入「管理后台」做用户 / 价格 / 审计治理', 120);
    await wait(page, 2400);
    await closeAndName(ctx, 'web-demo-part3.webm');
  }

  await browser.close();

  // ── 合并三段 ──
  const parts = ['web-demo-part1.webm', 'web-demo-part2.webm', 'web-demo-part3.webm']
    .map((f) => path.join(VIDEO_DIR, f));
  const out = path.join(VIDEO_DIR, 'web-demo.webm');
  if (parts.every((p) => fs.existsSync(p))) {
    const list = path.join(VIDEO_DIR, 'concat-list.txt');
    fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    try {
      if (fs.existsSync(out)) fs.unlinkSync(out);
      execSync(`"${FF}" -f concat -safe 0 -i "${list}" -c copy "${out}"`, { stdio: 'inherit' });
      console.log('MERGED ->', out);
      // 清理中间文件
      parts.forEach((p) => fs.unlinkSync(p));
      fs.unlinkSync(list);
    } catch (e) {
      console.error('MERGE FAIL', e.message);
    }
  } else {
    console.error('部分片段缺失，无法合并：', parts.map((p) => fs.existsSync(p)));
  }
  console.log('downloads(' + downloads.length + '):', downloads);
})().catch((e) => { console.error('WEB DEMO ERROR', e); process.exit(1); });
