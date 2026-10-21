/* ============================================================================
   鱼价查 · 小程序 / App 客户端预览（UniApp 客户端的 H5 形态）
   5 个底部 Tab + 全部业务页面，与 client/src 下的 UniApp 源码一一对应
   ============================================================================ */
(function () {
  'use strict';
  const { api, Auth, LS, KEYS, LocalWatch, Theme, toast } = YJT;
  const U = YJT;

  const TABS = [
    { id: 'market', label: '行情', title: '行情' },
    { id: 'map', label: '地图', title: '每日渔价地图' },
    { id: 'watch', label: '关注', title: '我的关注' },
    { id: 'report', label: '日报', title: '全国渔价日报表' },
    { id: 'me', label: '我的', title: '我的' },
  ];

  const TAB_ICONS = {
    market: '<svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>',
    map: '<svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c-2.3 0-4.2 1.9-4.2 4.2 0 3.1 4.2 8.3 4.2 8.3s4.2-5.2 4.2-8.3c0-2.3-1.9-4.2-4.2-4.2zm0 5.7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>',
    watch: '<svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.6l2 4.1 4.5.6-3.3 3.2.8 4.5L8 11.9 4 14l.8-4.5L1.5 6.3 6 5.7z"/></svg>',
    report: '<svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="8" width="3" height="6.5" rx="1"/><rect x="6.5" y="4" width="3" height="10.5" rx="1"/><rect x="11.5" y="6" width="3" height="8.5" rx="1"/></svg>',
    me: '<svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14.5c0-3 2.7-5 6-5s6 2 6 5z"/></svg>',
  };

  const S = {
    tab: 'market',
    stack: [],          // 页面栈（简化模拟）
    meta: null,
    config: null,
    status: null,
    category: '',
    keyword: '',
    selectedProvince: null,
    mapData: null,
    watches: null,
    alerts: null,
    reportDim: 'province',
    navTitle: '行情',
    showBack: false,
  };

  const screen = () => document.getElementById('screen');
  const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };

  // ── 页面栈（模拟小程序导航）──────────────────────────────────────────
  function push(render, title) {
    S.stack.push({ render, title: title || '' });
    S.navTitle = title || S.navTitle;
    S.showBack = true;
    paintNav();
    render();
  }
  function back() {
    S.stack.pop();
    const cur = S.stack[S.stack.length - 1];
    S.showBack = S.stack.length > 1;
    if (cur) { S.navTitle = cur.title || S.baseTitle; paintNav(); cur.render(); }
    else goTab(S.tab);
  }
  function goTab(id) {
    S.tab = id;
    S.stack = [];
    const t = TABS.find((x) => x.id === id);
    S.navTitle = t.title;
    S.baseTitle = t.title;
    S.showBack = false;
    paintNav();
    paintTabbar();
    renderTab();
  }

  function paintNav() {
    const n = document.getElementById('navbar');
    n.innerHTML = `${S.showBack ? '<span class="back" id="navBack">‹</span>' : ''}${U.esc(S.navTitle)}<span class="caps">···</span>`;
    const b = document.getElementById('navBack');
    if (b) b.onclick = back;
  }

  function paintTabbar() {
    const wc = S.watches ? S.watches.total : LocalWatch.count();
    const unread = S.alerts ? S.alerts.unread : 0;
    document.getElementById('tabbar').innerHTML = TABS.map((t) => `
      <div class="tb ${S.tab === t.id ? 'on' : ''}" data-tab="${t.id}">
        ${TAB_ICONS[t.id]}<span>${t.label}</span>
        ${t.id === 'watch' && (wc || unread) ? `<span class="bd">${Math.min(99, wc + unread)}</span>` : ''}
      </div>`).join('');
    document.querySelectorAll('[data-tab]').forEach((el) => { el.onclick = () => goTab(el.dataset.tab); });
  }

  function renderTab() {
    switch (S.tab) {
      case 'market': return renderMarket();
      case 'map': return renderMap();
      case 'watch': return renderWatch();
      case 'report': return renderReport();
      case 'me': return renderMe();
    }
  }

  // ══ 行情（F1 + F2 + 涨跌榜）════════════════════════════════════════
  async function renderMarket() {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:120px;border-radius:12px"></div>
      <div class="sp-grid" style="margin-top:10px">${Array.from({ length: 6 }).map(() => '<div class="skeleton" style="height:104px;border-radius:12px"></div>').join('')}</div></div>`;

    let list, movers;
    try {
      [list, movers] = await Promise.all([
        api.species({ category: S.category, keyword: S.keyword, pageSize: 500 }),
        api.movers({ scope: 'species', limit: 5 }),
      ]);
    } catch (e) {
      screen().innerHTML = `<div class="mp"><div class="mp-notice warn"><span>⚠</span><span>数据加载失败：${U.esc(e.message)}</span></div></div>`;
      return;
    }

    const up = movers.topGainers && movers.topGainers[0];
    screen().innerHTML = `
      <div class="mp-hero">
        <div class="row1">
          <div>
            <div class="d">全国综合均价 · ${U.dateFull(list.date)}</div>
            <div class="v">${U.num(S.status ? S.status.recordCount ? list.items.reduce((a, b) => a + b.price, 0) / list.items.length : 0 : 0)}<span style="font-size:12px;font-weight:400"> 元/公斤</span></div>
            <div class="k">覆盖 34 个省级行政区 · 130 家批发市场 · T+0 当日发布</div>
          </div>
        </div>
        <div class="mp-search" id="mpSearch"><span>🔍</span><span style="flex:1">搜索品种：中文名 / 拼音首字母 / 别名</span></div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>涨跌榜 <span style="font-size:10.5px;color:var(--text-3);font-weight:400">较前日</span></h4></div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${(movers.topGainers || []).slice(0, 3).map((m) => `
            <div class="rank-row" data-sp="${U.esc(m.species)}">
              <span class="badge up" style="font-size:9.5px">▲</span>
              <span style="flex:1;font-weight:500">${U.esc(m.species)}</span>
              <span class="p">${U.num(m.avgPrice)}</span>
              <span style="width:62px;text-align:right">${U.delta(m.changePct)}</span>
            </div>`).join('')}
          ${(movers.topLosers || []).slice(0, 2).map((m) => `
            <div class="rank-row" data-sp="${U.esc(m.species)}">
              <span class="badge down" style="font-size:9.5px">▼</span>
              <span style="flex:1;font-weight:500">${U.esc(m.species)}</span>
              <span class="p">${U.num(m.avgPrice)}</span>
              <span style="width:62px;text-align:right">${U.delta(m.changePct)}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="sec" style="padding-bottom:14px">
        <div class="sec-t"><h4>全部品种 <span style="font-size:10.5px;color:var(--text-3);font-weight:400">${list.total} 个</span></h4></div>
        <div class="chips-s" id="mpCats">
          <span class="chip-s ${!S.category ? 'on' : ''}" data-cat="">全部</span>
          ${(list.tree || []).map((c) => `<span class="chip-s ${S.category === c.name ? 'on' : ''}" data-cat="${U.esc(c.name)}">${U.esc(c.name)} ${c.count}</span>`).join('')}
        </div>
        ${S.keyword ? `<div style="margin:7px 0"><span class="badge">搜索：${U.esc(S.keyword)}</span>
          <span class="badge gray" id="mpClearKw" style="margin-left:5px;cursor:pointer">清除 ✕</span></div>` : ''}
        ${list.items.length ? `<div class="sp-grid" style="margin-top:9px">
          ${list.items.map((s) => {
      const on = watched(s.species);
      return `<div class="sp-card">
              <span class="cat">${U.esc(s.category)}</span>
              <div class="nm" data-sp="${U.esc(s.species)}">${U.esc(s.species)}</div>
              <div class="spc">${U.esc(s.spec || '—')}</div>
              <div class="pr"><b>${U.num(s.price)}</b><span>元/公斤</span></div>
              <div style="margin-top:3px">${U.delta(s.changePct)}</div>
              <button class="sw ${on ? 'on' : ''}" data-watch="${U.esc(s.species)}">${on ? '★' : '☆'}</button>
            </div>`;
    }).join('')}</div>`
        : `<div class="empty-s">${U.emptyIllustration('search')}<h5>没有匹配的品种</h5>
            <p>试试其他关键词，或提交新品种申报</p></div>`}
      </div>`;

    document.getElementById('mpSearch').onclick = () => push(renderSearch, '搜索品种');
    document.querySelectorAll('[data-cat]').forEach((el) => {
      el.onclick = () => { S.category = el.dataset.cat; renderMarket(); };
    });
    const ck = document.getElementById('mpClearKw');
    if (ck) ck.onclick = () => { S.keyword = ''; renderMarket(); };
    bindSpeciesNav();
    bindWatchButtons(() => renderMarket());
  }

  function bindSpeciesNav() {
    document.querySelectorAll('[data-sp]').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.dataset.watch) return;
        const sp = el.dataset.sp;
        push(() => renderDetail(sp), sp);
      };
    });
  }

  function watched(species, province = null) {
    if (Auth.isLoggedIn && S.watches) return S.watches.items.some((w) => w.species === species && (w.province || null) === (province || null));
    return LocalWatch.has(species, province);
  }

  function bindWatchButtons(rerender) {
    document.querySelectorAll('[data-watch]').forEach((b) => {
      b.onclick = async (e) => {
        e.stopPropagation();
        const sp = b.dataset.watch;
        if (!Auth.isLoggedIn) {
          LocalWatch.has(sp) ? LocalWatch.remove(sp) : LocalWatch.add(sp);
          toast(LocalWatch.has(sp) ? `已关注 ${sp}` : `已取消关注 ${sp}`);
          paintTabbar();
          rerender();
          return;
        }
        try {
          const w = (S.watches.items || []).find((x) => x.species === sp && !x.province);
          if (w) { await api.removeWatch(w.id); toast('已取消关注'); }
          else { await api.addWatch({ species: sp, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'wechat_push' }); toast(`已关注 ${sp}，可设置异动提醒`); }
          S.watches = await api.watches();
          paintTabbar();
          rerender();
        } catch (err) { toast(err.message, 'err'); }
      };
    });
  }

  // ══ 搜索（F2）══════════════════════════════════════════════════════
  async function renderSearch() {
    const kw = S.keyword || '';
    screen().innerHTML = `
      <div style="padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:7px">
          <input id="sKw" placeholder="中文名 / 拼音首字母 / 别名" value="${U.esc(kw)}"
            style="flex:1;padding:9px 12px;border:1px solid var(--border-strong);border-radius:9px;font-size:13px;background:var(--bg);color:var(--text-1)">
          <button class="btn-s pri" id="sGo">搜索</button>
        </div>
        <div class="chips-s" style="margin-top:8px">
          <span style="font-size:11px;color:var(--text-3);align-self:center">热门：</span>
          ${((S.config && S.config.hotSearch) || []).map((h) => `<span class="chip-s" data-hot="${U.esc(h)}">${U.esc(h)}</span>`).join('')}
        </div>
      </div>
      <div id="sResult" class="mp" style="padding-top:12px"></div>`;

    const run = async (q) => {
      const host = document.getElementById('sResult');
      if (!q) { host.innerHTML = '<div class="empty-s">' + U.emptyIllustration('search') + '<h5>输入关键词开始搜索</h5><p>支持中文名、拼音首字母（如 jyx → 鲫鱼）与别名（如 虾姑 → 皮皮虾）</p></div>'; return; }
      host.innerHTML = '<div class="skeleton" style="height:70px;border-radius:10px;margin-bottom:8px"></div>'.repeat(4);
      const r = await api.search(q, 30);
      S.keyword = q;
      if (!r.items.length) {
        host.innerHTML = `<div class="empty-s">${U.emptyIllustration('search')}
          <h5>未找到「${U.esc(q)}」</h5><p>换一个关键词试试，或提交新品种申报</p>
          <button class="btn-s pri" id="sReport">申报新品种</button></div>`;
        const rb = document.getElementById('sReport');
        if (rb) rb.onclick = () => reportSpecies(q);
        return;
      }
      host.innerHTML = `
        <div style="font-size:11.5px;color:var(--text-2);margin-bottom:8px">找到 ${r.total} 个相关品种</div>
        ${r.items.map((s) => `<div class="mp-card" style="margin-bottom:8px;cursor:pointer" data-sp2="${U.esc(s.species)}">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:14px;font-weight:600">${U.esc(s.species)}
                <span style="font-size:10px;color:var(--text-3);font-weight:400">${U.esc(s.category)}</span></div>
              <div style="font-size:10.5px;color:var(--text-3);margin-top:2px">
                别名：${(s.alias || []).slice(0, 3).map((a) => U.esc(a)).join('、') || '—'} · ${U.esc(s.spec || '')}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:17px;font-weight:700;font-family:var(--font-num)">${U.num(s.price)}</div>
              ${U.delta(s.changePct)}
            </div>
          </div></div>`).join('')}`;
      host.querySelectorAll('[data-sp2]').forEach((el) => {
        el.onclick = () => push(() => renderDetail(el.dataset.sp2), el.dataset.sp2);
      });
    };

    document.getElementById('sGo').onclick = () => run(val('sKw').trim());
    const inp = document.getElementById('sKw');
    inp.onkeydown = (e) => { if (e.key === 'Enter') run(inp.value.trim()); };
    inp.oninput = () => { clearTimeout(inp._t); inp._t = setTimeout(() => run(inp.value.trim()), 320); };
    document.querySelectorAll('[data-hot]').forEach((h) => {
      h.onclick = () => { inp.value = h.dataset.hot; run(h.dataset.hot); };
    });
    if (kw) run(kw);
  }

  async function reportSpecies(name) {
    modal(`<div class="modal-head"><h3>申报新品种</h3><button class="modal-close" id="mClose">×</button></div>
      <p class="small muted">提交后我们会在 3 个工作日内评估是否纳入采集范围。</p>
      <div class="fld-s mt-3"><label>品种名称 *</label><input id="rName" value="${U.esc(name || '')}"></div>
      <div class="fld-s"><label>所在地区</label><input id="rProv" placeholder="如 江苏省南京市"></div>
      <div class="fld-s"><label>联系方式</label><input id="rContact" placeholder="邮箱或手机号"></div>
      <div class="row gap-2 mt-4">
        <button class="btn-s pri blk" id="rSend">提交</button>
        <button class="btn-s" data-close>取消</button></div>`, {
      onMount(mask, close) {
        mask.querySelector('#rSend').onclick = async () => {
          const n = mask.querySelector('#rName').value.trim();
          if (!n) return toast('请填写品种名称', 'warn');
          try {
            const r = await api.reportSpecies({ name: n, province: mask.querySelector('#rProv').value, contact: mask.querySelector('#rContact').value });
            toast(r.message || '申报已提交'); close();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  // ══ 品种详情（F6）══════════════════════════════════════════════════
  async function renderDetail(name) {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:180px;border-radius:12px"></div></div>`;
    let d;
    try { d = await api.speciesDetail(name, { days: 30 }); }
    catch (e) { screen().innerHTML = `<div class="mp"><div class="mp-notice warn">${U.esc(e.message)}</div></div>`; return; }

    const on = watched(d.species);
    screen().innerHTML = `
      <div style="background:var(--surface);padding:14px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div>
            <div style="font-size:20px;font-weight:700">${U.esc(d.species)}
              ${U.tierBadge(d.price.tier)}</div>
            <div style="font-size:11px;color:var(--text-2);margin-top:4px">
              ${U.esc(d.category)} / ${U.esc(d.subCategory)} · ${U.esc(d.spec)}</div>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:2px">
              别名：${(d.alias || []).join('、') || '—'}</div>
          </div>
          <button class="btn-s ${on ? '' : 'pri'} sm" id="dWatch">${on ? '★ 已关注' : '+ 关注'}</button>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:12px">
          <span style="font-size:31px;font-weight:700;font-family:var(--font-num)">${U.num(d.price.avg)}</span>
          <span style="font-size:11px;color:var(--text-2)">元/公斤</span>
          ${U.delta(d.price.changePct)}
        </div>
        <div style="font-size:10.5px;color:var(--text-3);margin-top:2px">
          约 ${U.num(d.price.avg / 2)} 元/斤 · 较前日 ${U.num(d.price.prev)}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">
        ${[['当日最低', U.num(d.price.min)], ['当日最高', U.num(d.price.max)],
        ['覆盖市场', d.coverage.marketCount + ' 家'], ['覆盖省份', d.coverage.provinceCount + ' 个'],
        ['记录条数', U.int(d.coverage.recordCount)], ['采集批次', (d.source.batchNo || '—').slice(-10)]]
        .map(([k, v]) => `<div style="background:var(--surface);padding:10px 8px;text-align:center">
            <div style="font-size:10px;color:var(--text-2)">${k}</div>
            <div style="font-size:13px;font-weight:700;font-family:var(--font-num);margin-top:3px">${v}</div>
          </div>`).join('')}
      </div>

      <div class="sec">
        <div class="sec-t"><h4>历史价格走势</h4>
          <div class="chips-s">
            <span class="chip-s on" id="d30">近 30 天</span>
          </div></div>
        <div class="mp-card" style="padding:8px">
          ${U.lineChart(d.history.map((h) => ({ date: h.date, price: h.avg })), { height: 168, color: 'var(--brand-2)', unit: '元/公斤', yTicks: 3 })}
        </div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>Top 8 品种报价</h4><span class="more">按价格降序</span></div>
        <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border)">
          <table class="mp-t"><thead><tr><th>品种</th><th>规格</th><th class="num">价格</th><th class="num">涨跌</th></tr></thead>
          <tbody>${d.quotes.slice(0, 8).map((q) => `<tr>
            <td><b>${U.esc(q.species)}</b></td>
            <td style="font-size:10px;color:var(--text-3)">${U.esc(q.spec || '—')}</td>
            <td class="num"><b>${U.num(q.price)}</b></td>
            <td class="num">${U.delta(null)}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>分省价格</h4><span class="more">${d.provinces.length} 个省份</span></div>
        <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border)">
          <table class="mp-t"><thead><tr><th>省份</th><th class="num">均价</th><th class="num">市场</th><th>档位</th></tr></thead>
          <tbody>${d.provinces.slice(0, 12).map((p) => `<tr>
            <td>${U.esc(p.name)}</td><td class="num"><b>${U.num(p.avgPrice)}</b></td>
            <td class="num">${p.marketCount}</td><td>${U.tierBadge(p.tier, { outline: true })}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <div class="sec" style="padding-bottom:16px">
        <div class="mp-notice">
          <span>✓</span>
          <span><b>数据可信：</b>来源 ${U.esc(d.source.name)}，采集批次号 <span style="font-family:var(--font-num)">${U.esc(d.source.batchNo || '—')}</span>，
          采集时间 ${U.dtText(d.coverage.collectedAt)}，每条报价均可回溯来源链接。</span>
        </div>
      </div>`;

    document.getElementById('dWatch').onclick = async () => {
      if (!Auth.isLoggedIn) {
        LocalWatch.has(d.species) ? LocalWatch.remove(d.species) : LocalWatch.add(d.species);
        toast(LocalWatch.has(d.species) ? '已关注（本机保存）' : '已取消关注');
        paintTabbar(); renderDetail(d.species); return;
      }
      try {
        const w = (S.watches.items || []).find((x) => x.species === d.species && !x.province);
        if (w) await api.removeWatch(w.id);
        else await api.addWatch({ species: d.species, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'wechat_push' });
        S.watches = await api.watches();
        toast(watched(d.species) ? '已关注' : '已取消关注');
        paintTabbar(); renderDetail(d.species);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  // ══ 地图（F3）══════════════════════════════════════════════════════
  async function renderMap() {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:300px;border-radius:12px"></div></div>`;
    let d;
    try { d = await api.mapProvinces({ days: 7 }); }
    catch (e) { screen().innerHTML = `<div class="mp"><div class="mp-notice warn">${U.esc(e.message)}</div></div>`; return; }
    S.mapData = d;
    if (!S.selectedProvince) S.selectedProvince = (d.maxProvince || {}).name || (d.provinces.find((p) => p.hasData) || {}).name;

    const tierCounts = { low: 0, mid: 0, high: 0, na: 0 };
    d.provinces.forEach((p) => { tierCounts[p.tier.tier] = (tierCounts[p.tier.tier] || 0) + 1; });

    screen().innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border)">
        ${[['全国综合均价', U.num(d.nationalAvg), '元/公斤', ''],
        ['上涨省份', d.upCount, '个', 'color:var(--up)'],
        ['下跌省份', d.downCount, '个', 'color:var(--down)'],
        ['最高均价', (d.maxProvince || {}).short || '—', '', 'color:var(--tier-high)']]
        .map(([k, v, u, st]) => `<div style="background:var(--surface);padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-2)">${k}</div>
            <div style="font-size:17px;font-weight:700;font-family:var(--font-num);margin-top:3px;${st}">${v}${u ? `<span style="font-size:9.5px;font-weight:400;color:var(--text-2)">${u}</span>` : ''}</div>
          </div>`).join('')}
      </div>

      <div style="padding:10px 12px 0">
        <div class="mp-card" style="padding:8px;position:relative">
          <div style="font-size:11.5px;color:var(--text-2);margin-bottom:5px">全国价格档位分布（按省界填色，颜色越红价格越高）</div>
          <div id="mpMapHost" style="border-radius:9px;overflow:hidden">
            ${U.provinceMap(d.provinces, { height: 300, focus: S.selectedProvince })}
          </div>
          <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:7px;font-size:10px;color:var(--text-2)">
            ${(d.tiers || []).map((t) => `<span style="display:flex;align-items:center;gap:4px">
              <span style="width:9px;height:9px;border-radius:2px;background:${t.color}"></span>
              ${t.label} ${t.min == null ? `≤${t.max}` : t.max == null ? `>${t.min}` : `${t.min}–${t.max}`}</span>`).join('')}
          </div>
          <div style="font-size:10px;color:var(--text-3);line-height:1.6;margin-top:6px">
            省界数据依据自然资源部标准地图服务体系的行政区划界线绘制，含台湾省、香港特别行政区、澳门特别行政区及南海诸岛。
          </div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>省份快速切换</h4><span class="more">共 ${d.provinces.length} 个</span></div>
        <div class="chips-s" id="mpProv">
          ${d.provinces.map((p) => `<span class="chip-s ${S.selectedProvince === p.name ? 'on' : ''}"
            data-pv="${U.esc(p.name)}" ${!p.hasData ? 'style="opacity:.5"' : ''}>${U.esc(p.short)}</span>`).join('')}
        </div>
      </div>

      <div class="sec" style="padding-bottom:16px">
        <div class="sec-t"><h4>省份价格排行</h4><span class="more">由高到低</span></div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${d.ranking.slice(0, 12).map((r) => `<div class="rank-row" data-pv2="${U.esc(r.name)}">
            <span class="rk ${r.rank === 1 ? 't1' : r.rank === 2 ? 't2' : r.rank === 3 ? 't3' : ''}">${r.rank}</span>
            <span style="flex:1;font-weight:500">${U.esc(r.short)}</span>
            <span class="p">${U.num(r.avgPrice)}</span>
            ${U.delta(r.changePct)}
          </div>`).join('')}
        </div>
      </div>`;

    document.querySelectorAll('#mpMapHost .prov-shape, #mpMapHost .prov-dot, [data-pv], [data-pv2]').forEach((el) => {
      el.onclick = () => {
        const name = el.dataset.province || el.dataset.pv || el.dataset.pv2;
        if (!name) return;
        S.selectedProvince = name;
        push(() => renderProvince(name), (S.meta.provinces.find((p) => p.name === name) || {}).short || name);
      };
    });
  }

  async function renderProvince(name) {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>`;
    let d;
    try { d = await api.province(name, { range: 7 }); }
    catch (e) { screen().innerHTML = `<div class="mp"><div class="mp-notice warn">${U.esc(e.message)}</div></div>`; return; }

    if (!d.header.hasData) {
      screen().innerHTML = `<div class="mp"><div class="empty-s">${U.emptyIllustration('map')}
        <h5>${U.esc(d.province.name)} 暂无当日数据</h5>
        <p>该省份当日尚未采集到报价数据，可能因休市或采集中断。系统以「—」占位并标注。</p></div></div>`;
      return;
    }

    screen().innerHTML = `
      <div style="background:var(--surface);padding:14px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:19px;font-weight:700">${U.esc(d.province.name)}</span>
          ${U.tierBadge(d.header.tier)}
          <span class="badge gray">${d.province.coast ? '沿海主产区' : '内陆'}</span>
        </div>
        <div style="font-size:11px;color:var(--text-2);margin-top:4px">
          覆盖 ${d.header.speciesCount} 个品种 · ${d.header.marketCount} 家市场 · ${U.int(d.header.recordCount)} 条记录</div>
        <div style="font-size:10.5px;color:var(--text-3)">数据截至 ${U.dtText(d.header.collectedAt)}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:11px">
          <span style="font-size:30px;font-weight:700;font-family:var(--font-num)">${U.num(d.header.avgPrice)}</span>
          <span style="font-size:11px;color:var(--text-2)">元/公斤</span>
          ${U.delta(d.header.changePct)}
        </div>
        <div style="font-size:10.5px;color:var(--text-3)">约 ${U.num(d.header.avgPrice / 2)} 元/斤 · 较前日</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">
        ${[['近 7 日最高', U.num(d.stats.max), U.dateShort(d.stats.maxDate)],
        ['近 7 日最低', U.num(d.stats.min), U.dateShort(d.stats.minDate)],
        ['7 日振幅', U.num(d.stats.amplitude) + '%', '波动幅度']]
        .map(([k, v, x]) => `<div style="background:var(--surface);padding:10px 8px;text-align:center">
            <div style="font-size:10px;color:var(--text-2)">${k}</div>
            <div style="font-size:15px;font-weight:700;font-family:var(--font-num);margin-top:3px">${v}</div>
            <div style="font-size:9.5px;color:var(--text-3)">${x}</div>
          </div>`).join('')}
      </div>

      <div class="sec">
        <div class="sec-t"><h4>近一周均价趋势</h4>
          <span class="more">${U.dateShort(d.trend[0] && d.trend[0].date)} — ${U.dateShort(d.trend[d.trend.length - 1] && d.trend[d.trend.length - 1].date)}</span></div>
        <div class="mp-card" style="padding:8px">
          ${U.lineChart(d.trend, { height: 168, color: 'var(--brand-2)', unit: '元/公斤', yTicks: 3 })}
        </div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>Top 8 品种报价</h4><span class="more">按价格降序</span></div>
        <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border)">
          <table class="mp-t"><thead><tr><th>品种</th><th>规格</th><th class="num">价格</th><th class="num">较前日</th></tr></thead>
          <tbody>${d.topSpecies.map((s) => `<tr data-sp3="${U.esc(s.species)}" style="cursor:pointer">
            <td><b>${U.esc(s.species)}</b><div style="font-size:9.5px;color:var(--text-3)">${U.esc(s.category)}</div></td>
            <td style="font-size:10px;color:var(--text-3)">${U.esc(s.spec || '—')}</td>
            <td class="num"><b>${U.num(s.price)}</b></td>
            <td class="num">${U.delta(s.changePct)}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>分批发市场均价</h4><span class="more">${d.markets.length} 家</span></div>
        <div class="mp-group">
          ${d.markets.map((m) => `<div class="mp-list-row" style="cursor:default">
            <span style="font-size:12px">${U.esc(m.market)}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <b style="font-family:var(--font-num)">${U.num(m.avgPrice)}</b>
              ${U.tierBadge(m.tier, { outline: true })}</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="sec" style="padding-bottom:16px">
        <button class="btn-s pri blk" id="pvWatch">订阅该省价格异动</button>
      </div>`;

    document.querySelectorAll('[data-sp3]').forEach((el) => {
      el.onclick = () => push(() => renderDetail(el.dataset.sp3), el.dataset.sp3);
    });
    const wb = document.getElementById('pvWatch');
    if (wb) wb.onclick = () => {
      if (!Auth.isLoggedIn) { toast('请先登录后订阅推送', 'warn'); return push(renderLogin, '登录'); }
      openWatchDialog(null, d.province.name);
    };
  }

  // ══ 关注（F4 + F7）═════════════════════════════════════════════════
  async function renderWatch() {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:120px;border-radius:12px"></div></div>`;
    const loggedIn = Auth.isLoggedIn;
    let items = [];

    if (loggedIn) {
      S.watches = await api.watches();
      items = S.watches.items;
      S.alerts = await api.alerts({ limit: 10 });
    } else {
      for (const w of LocalWatch.all()) {
        try {
          const d = await api.speciesDetail(w.species, { province: w.province, days: 7 });
          items.push({
            id: 'local_' + w.species + (w.province || ''),
            species: w.species, province: w.province, scope: w.province ? (S.meta.provinces.find((p) => p.name === w.province) || {}).short || w.province : '全国',
            price: d.price.avg, changePct: d.price.changePct,
            trend: (d.history || []).slice(-7).map((h) => ({ date: h.date, price: h.avg })),
            trendRange: (d.history || []).length ? `${U.dateShort(d.history[Math.max(0, d.history.length - 7)].date)} — ${U.dateShort(d.history[d.history.length - 1].date)}` : '',
            local: true,
          });
        } catch { /* 忽略 */ }
      }
    }
    paintTabbar();

    if (!items.length) {
      screen().innerHTML = `<div class="mp"><div class="empty-s">${U.emptyIllustration()}
        <h5>还没有关注任何品种</h5>
        <p>关注后可集中查看最新价、近一周走势与涨跌，<br>并设置价格异动提醒。</p>
        <button class="btn-s pri" id="wGo">前往全部品种 →</button></div></div>`;
      document.getElementById('wGo').onclick = () => goTab('market');
      return;
    }

    const upN = items.filter((i) => (i.changePct || 0) > 0).length;
    const downN = items.filter((i) => (i.changePct || 0) < 0).length;

    screen().innerHTML = `
      ${!loggedIn ? `<div style="padding:10px 12px"><div class="mp-notice">
        <span>ℹ</span><span>访客模式，关注列表保存在本机。登录后可云端同步并开启价格异动推送。</span></div></div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">
        ${[['关注品种', items.length, ''], ['今日上涨', upN, 'color:var(--up)'], ['今日下跌', downN, 'color:var(--down)']]
        .map(([k, v, st]) => `<div style="background:var(--surface);padding:11px;text-align:center">
            <div style="font-size:10px;color:var(--text-2)">${k}</div>
            <div style="font-size:19px;font-weight:700;font-family:var(--font-num);margin-top:3px;${st}">${v}</div>
          </div>`).join('')}
      </div>

      ${loggedIn && S.alerts && S.alerts.items.length ? `
      <div class="sec">
        <div class="sec-t"><h4>最近价格异动</h4>
          <span class="more" id="wAllAlerts">全部 ${S.alerts.unread ? `(${S.alerts.unread} 未读)` : ''} →</span></div>
        <div class="mp-group">
          ${S.alerts.items.slice(0, 3).map((a) => `<div class="mp-list-row" style="cursor:default;${a.isRead ? 'opacity:.62' : ''}">
            <div>
              <div style="font-size:12.5px"><b>${U.esc(a.species)}</b>
                <span style="font-size:10px;color:var(--text-3)">${U.esc(a.scope)}</span></div>
              <div style="font-size:10px;color:var(--text-3);margin-top:2px">${U.dateFull(a.date)} · ${U.num(a.prevPrice)} → ${U.num(a.currPrice)}</div>
            </div>
            <span class="badge ${a.direction === 'up' ? 'up' : 'down'}">${a.direction === 'up' ? '▲' : '▼'} ${U.num(Math.abs(a.changePct))}%</span>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="sec" style="padding-bottom:16px">
        <div class="sec-t"><h4>我的关注</h4><span class="more">${items.length} 个</span></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${items.map((w) => `<div class="mp-card" style="position:relative">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div>
                <div style="font-size:14.5px;font-weight:600" data-sp4="${U.esc(w.species)}">${U.esc(w.species)}</div>
                <div style="font-size:10.5px;color:var(--text-3)">${U.esc(w.scope)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:20px;font-weight:700;font-family:var(--font-num)">${U.num(w.price)}</div>
                ${U.delta(w.changePct)}
              </div>
            </div>
            <div style="margin-top:8px">
              ${U.sparkline(w.trend, { width: 300, height: 42 })}
              <div style="font-size:9.5px;color:var(--text-3);margin-top:2px">${U.esc(w.trendRange || '近 7 日')} 走势</div>
            </div>
            ${loggedIn ? `<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
              <span class="badge gray">涨阈值 ${w.thresholdUp == null ? 5 : w.thresholdUp}%</span>
              <span class="badge gray">跌阈值 ${w.thresholdDown == null ? -5 : w.thresholdDown}%</span>
              <span class="badge">${({ wechat_push: '微信订阅消息', app_push: 'App 推送', web_push: '浏览器通知', inbox: '站内消息', app: 'App 推送' }[w.notifyChannel] || w.notifyChannel)}</span>
              <button class="btn-s sm" data-editw="${U.esc(w.id)}" data-sp="${U.esc(w.species)}"
                data-up="${w.thresholdUp ?? ''}" data-down="${w.thresholdDown ?? ''}" data-ch="${U.esc(w.notifyChannel || '')}"
                style="margin-left:auto">设置阈值</button>
            </div>` : `<div style="margin-top:8px;text-align:right">
              <button class="btn-s sm" data-unw="${U.esc(w.id)}" data-sp="${U.esc(w.species)}" data-pv="${U.esc(w.province || '')}">取消关注</button>
            </div>`}
          </div>`).join('')}
        </div>
      </div>`;

    const wa = document.getElementById('wAllAlerts');
    if (wa) wa.onclick = () => push(renderAlerts, '价格异动提醒');
    document.querySelectorAll('[data-sp4]').forEach((el) => {
      el.onclick = () => push(() => renderDetail(el.dataset.sp4), el.dataset.sp4);
    });
    document.querySelectorAll('[data-unw]').forEach((b) => {
      b.onclick = async () => {
        try {
          const id = b.dataset.unw;
          if (String(id).startsWith('local_')) LocalWatch.remove(b.dataset.sp, b.dataset.pv || null);
          else await api.removeWatch(id);
          toast('已取消关注'); renderWatch();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
    document.querySelectorAll('[data-editw]').forEach((b) => {
      b.onclick = () => openWatchDialog({
        id: b.dataset.editw, species: b.dataset.sp,
        thresholdUp: b.dataset.up, thresholdDown: b.dataset.down, notifyChannel: b.dataset.ch,
      });
    });
  }

  async function renderAlerts() {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:80px;border-radius:10px"></div></div>`;
    let a;
    try { a = await api.alerts({ limit: 50 }); }
    catch (e) { screen().innerHTML = `<div class="mp"><div class="mp-notice warn">${U.esc(e.message)}</div></div>`; return; }
    S.alerts = a;

    screen().innerHTML = `
      ${a.items.length ? `<div style="padding:10px 12px 0;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11.5px;color:var(--text-2)">共 ${a.items.length} 条 · 未读 ${a.unread} 条</span>
        <button class="btn-s sm" id="alRead">全部已读</button></div>` : ''}
      <div class="mp" style="padding-top:10px">
        ${a.items.length ? a.items.map((x) => `<div class="mp-card" style="margin-bottom:8px;${x.isRead ? 'opacity:.62' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="badge ${x.direction === 'up' ? 'up' : 'down'}">${x.direction === 'up' ? '▲ 涨' : '▼ 跌'} ${U.num(Math.abs(x.changePct))}%</span>
            <span style="font-size:10px;color:var(--text-3)">${U.dateFull(x.date)}</span>
          </div>
          <div style="font-size:13.5px;font-weight:600;margin-top:7px">${U.esc(x.title || x.species)}</div>
          <div style="font-size:11.5px;color:var(--text-2);line-height:1.7;margin-top:4px">${U.esc(x.content || '')}</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:6px">
            通道：${({ wechat_push: '微信订阅消息', app_push: 'App 推送', web_push: '浏览器通知', inbox: '站内消息' }[x.channel] || x.channel)} · ${x.pushed ? '已推送' : '未推送'}</div>
        </div>`).join('') : `<div class="empty-s">${U.emptyIllustration()}
          <h5>暂无价格异动提醒</h5><p>当关注的品种涨跌幅超过设定阈值时，这里会显示提醒记录。</p></div>`}
      </div>`;

    const rb = document.getElementById('alRead');
    if (rb) rb.onclick = async () => { await api.readAlerts([]); toast('已全部标为已读'); renderAlerts(); };
  }

  // ══ 日报（F5）══════════════════════════════════════════════════════
  async function renderReport() {
    screen().innerHTML = `<div class="mp"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>`;
    const dim = S.reportDim;
    let d;
    try { d = await api.dailyReport({ dimension: dim }); }
    catch (e) { screen().innerHTML = `<div class="mp"><div class="mp-notice warn">${U.esc(e.message)}</div></div>`; return; }

    const o = d.overview;
    const rows = dim === 'species' ? (d.bySpecies || []) : d.rows;

    screen().innerHTML = `
      <div style="padding:11px 12px;background:var(--surface);border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-size:14.5px;font-weight:700">数据日期 ${U.dateFull(d.date)}</div>
            <div style="font-size:10.5px;color:var(--text-2);margin-top:3px">
              覆盖 ${d.filterBar.marketCount} 家市场 · ${U.int(d.filterBar.recordCount)} 条记录</div>
            <div style="font-size:10px;color:var(--text-3);font-family:var(--font-num)">
              批次 ${U.esc(d.filterBar.batchNo || '—')}</div>
          </div>
          <span class="badge ${d.status.status === 'published' ? 'down' : 'warn'}">${d.status.status === 'published' ? 'T+0 已发布' : '待发布'}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border)">
        ${[['全国综合均价', U.num(o.nationalAvg), '元/公斤', ''],
        ['上涨省份', o.upCount, '个', 'color:var(--up)'],
        ['下跌省份', o.downCount, '个', 'color:var(--down)'],
        ['最高均价省份', (o.maxProvince || {}).short || '—', '', 'color:var(--tier-high)'],
        ['最低均价省份', (o.minProvince || {}).short || '—', '', 'color:var(--tier-low)'],
        ['覆盖省级行政区', o.coveredProvinces, '个', '']]
        .map(([k, v, u, st]) => `<div style="background:var(--surface);padding:11px 10px;text-align:center">
            <div style="font-size:10px;color:var(--text-2)">${k}</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-num);margin-top:3px;${st}">${v}${u ? `<span style="font-size:9.5px;font-weight:400;color:var(--text-2)"> ${u}</span>` : ''}</div>
          </div>`).join('')}
      </div>

      <div class="sec" style="padding-bottom:16px">
        <div class="sec-t">
          <div class="chips-s">
            <span class="chip-s ${dim === 'province' ? 'on' : ''}" data-dim="province">按省份</span>
            <span class="chip-s ${dim === 'species' ? 'on' : ''}" data-dim="species">按品种</span>
          </div>
          <span class="more" id="rShare">分享 ↗</span>
        </div>
        <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border)">
          <table class="mp-t">
            <thead><tr><th style="width:30px">名次</th><th>${dim === 'province' ? '省级行政区' : '品种'}</th>
              <th class="num">均价</th><th class="num">较昨日</th><th style="width:44px">档位</th></tr></thead>
            <tbody>${rows.map((r) => `<tr ${dim === 'province' ? `data-pv3="${U.esc(r.province)}" style="cursor:pointer"` : `data-sp5="${U.esc(r.species)}" style="cursor:pointer"`}>
              <td><span class="rk ${r.rank === 1 ? 't1' : r.rank === 2 ? 't2' : r.rank === 3 ? 't3' : ''}">${r.rank}</span></td>
              <td><b>${U.esc(dim === 'province' ? r.short : r.species)}</b>
                ${dim === 'species' ? `<div style="font-size:9.5px;color:var(--text-3)">${U.esc(r.category)}</div>` : ''}
                ${dim === 'province' && r.leadUp ? `<div style="font-size:9.5px;color:var(--text-3)">领涨 ${U.esc(r.leadUp.species)} ▲${U.num(r.leadUp.changePct)}%</div>` : ''}</td>
              <td class="num"><b>${U.num(r.avgPrice)}</b><div style="font-size:9.5px;color:var(--text-3)">${U.num(r.avgPrice / 2)} 元/斤</div></td>
              <td class="num">${U.delta(r.changePct)}</td>
              <td>${U.tierBadge(r.tier, { outline: true })}</td></tr>`).join('')}
            </tbody></table>
        </div>
        <div style="font-size:10.5px;color:var(--text-2);line-height:1.75;background:var(--surface-2);border-radius:9px;padding:11px;margin-top:11px">
          <b>口径说明：</b>${U.esc(d.disclaimer)}</div>
      </div>`;

    document.querySelectorAll('[data-dim]').forEach((c) => {
      c.onclick = () => { S.reportDim = c.dataset.dim; renderReport(); };
    });
    document.querySelectorAll('[data-pv3]').forEach((el) => {
      el.onclick = () => push(() => renderProvince(el.dataset.pv3), (S.meta.provinces.find((p) => p.name === el.dataset.pv3) || {}).short || '省份');
    });
    document.querySelectorAll('[data-sp5]').forEach((el) => {
      el.onclick = () => push(() => renderDetail(el.dataset.sp5), el.dataset.sp5);
    });
    const sh = document.getElementById('rShare');
    if (sh) sh.onclick = async () => {
      if (!(Auth.user && Auth.user.permissions && Auth.user.permissions.export)) {
        return toast('分享长图需教研 / 政府 / 管理员权限', 'warn', 3000);
      }
      try {
        const r = await fetch(api.exportUrl('svg', { top: 15 }));
        const svg = await r.text();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `鱼价查_日报长图_${d.date}.svg`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('已生成分享长图');
      } catch (e) { toast('生成失败：' + e.message, 'err'); }
    };
  }

  // ══ 我的（F13）═════════════════════════════════════════════════════
  async function renderMe() {
    const user = Auth.user;
    if (!user) {
      screen().innerHTML = `
        <div class="mp" style="padding-top:22px;text-align:center">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--surface-2);margin:0 auto 12px;
                      display:flex;align-items:center;justify-content:center;font-size:26px">👤</div>
          <div style="font-size:15px;font-weight:600">尚未登录</div>
          <div style="font-size:11.5px;color:var(--text-2);margin-top:5px;line-height:1.75">
            登录后可云端保存关注品种、<br>接收价格异动推送，并解锁数据导出</div>
          <div style="display:flex;gap:9px;margin-top:18px">
            <button class="btn-s pri" style="flex:1" id="meLogin">登录</button>
            <button class="btn-s" style="flex:1" id="meReg">注册</button>
          </div>
        </div>

        <div class="sec">
          <div class="sec-t"><h4>访客可用功能</h4></div>
          <div class="mp-group">
            ${[['📊', '浏览全部品种行情', 'F1'], ['🔍', '搜索品种（拼音 / 别名）', 'F2'],
        ['🗺', '地图选省看趋势', 'F3'], ['⭐', '本机保存关注列表', 'F4'],
        ['📋', '查看全国日报表', 'F5'], ['🌓', '切换 3 套主题', 'F9']]
        .map(([i, t, c]) => `<div class="mp-list-row" style="cursor:default">
              <span class="l">${i}<span>${t}</span></span><span class="r">${c}</span></div>`).join('')}
          </div>
        </div>

        <div class="sec" style="padding-bottom:16px">
          <div class="mp-notice">
            <span>ℹ</span><span>游客为只读模式，不可订阅云端关注、不可接收推送、不可导出数据。登录后可解锁全部能力。</span>
          </div>
          <div class="sec-t" style="margin-top:14px"><h4>演示账号</h4></div>
          <div class="mp-group">
            ${[['普通用户', 'farmer@yujiacha.local', 'Demo@2026'],
        ['教研师生', 'teacher@shou.edu.cn', 'Demo@2026'],
        ['政府监测', 'gov@agri.local', 'Demo@2026']]
        .map(([n, e, p]) => `<div class="mp-list-row" data-fill2="${e}|${p}">
              <span class="l"><span>${n}</span></span>
              <span class="r" style="font-family:var(--font-num);font-size:10.5px">${e}</span></div>`).join('')}
          </div>
        </div>`;

      document.getElementById('meLogin').onclick = () => push(renderLogin, '登录');
      document.getElementById('meReg').onclick = () => push(renderRegister, '注册');
      document.querySelectorAll('[data-fill2]').forEach((el) => {
        el.onclick = () => push(() => renderLogin(el.dataset.fill2.split('|')), '登录');
      });
      return;
    }

    S.watches = await api.watches().catch(() => null);
    S.alerts = await api.alerts({ limit: 20 }).catch(() => null);
    paintTabbar();
    const perms = user.permissions || {};

    screen().innerHTML = `
      <div style="background:var(--surface);padding:16px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:13px">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--brand);color:#fff;font-size:19px;font-weight:700;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0">${U.initials(user)}</div>
        <div style="min-width:0">
          <div style="font-size:16px;font-weight:700">${U.esc(user.nickname || '用户')}</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(user.email)}</div>
          <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
            <span class="badge">${U.esc(user.roleLabel)}</span>
            ${user.emailVerified ? '<span class="badge down">邮箱已验证</span>' : '<span class="badge warn">邮箱待验证</span>'}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">
        ${[['关注品种', S.watches ? S.watches.total : 0, ''],
        ['未读提醒', S.alerts ? S.alerts.unread : 0, 'color:var(--warn)'],
        ['导出权限', perms.export ? '已开通' : '未开通', 'font-size:13px']]
        .map(([k, v, st]) => `<div style="background:var(--surface);padding:12px 8px;text-align:center">
            <div style="font-size:10px;color:var(--text-2)">${k}</div>
            <div style="font-size:17px;font-weight:700;font-family:var(--font-num);margin-top:3px;${st}">${v}</div>
          </div>`).join('')}
      </div>

      <div class="sec">
        <div class="mp-group">
          <div class="mp-list-row" id="meAlerts">
            <span class="l"><span>🔔</span><span>价格异动提醒</span></span>
            <span class="r">${S.alerts && S.alerts.unread ? `<span class="badge up">${S.alerts.unread} 未读</span>` : '查看'} ›</span>
          </div>
          <div class="mp-list-row" id="meCompare2">
            <span class="l"><span>📈</span><span>历史趋势对比</span></span><span class="r">›</span>
          </div>
          <div class="mp-list-row" id="meSettings">
            <span class="l"><span>⚙️</span><span>账户设置</span></span><span class="r">昵称 / 机构 / 主题 ›</span>
          </div>
          <div class="mp-list-row" id="meTheme">
            <span class="l"><span>🌓</span><span>主题切换</span></span>
            <span class="r">${Theme.labels[Theme.current]} ›</span>
          </div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-t"><h4>数据导出与分享</h4>
          <span class="more">${perms.export ? '已开通' : '需教研 / 政府权限'}</span></div>
        <div class="mp-group">
          ${[['日报 CSV', 'report'], ['关注列表 CSV', 'watch'], ['分享长图', 'svg']]
        .map(([t, k]) => `<div class="mp-list-row" data-exp="${k}">
              <span class="l"><span>📤</span><span>${t}</span></span><span class="r">${perms.export ? '导出 ›' : '🔒'}</span></div>`).join('')}
        </div>
        ${!perms.export ? `<div class="mp-notice warn" style="margin-top:9px">
          <span>⚠</span><span>当前角色「${U.esc(user.roleLabel)}」暂无导出权限。导出面向教研师生、政府监测人员与管理员开放。</span></div>` : ''}
      </div>

      <div class="sec">
        <div class="mp-group">
          <div class="mp-list-row" id="mePush">
            <span class="l"><span>🔕</span><span>推送授权</span></span>
            <span class="r">${user.pushEnabled ? '已开启 ›' : '已关闭 ›'}</span>
          </div>
          <div class="mp-list-row" id="meOut" style="color:var(--up)">
            <span class="l"><span>🚪</span><span>退出登录</span></span><span class="r"></span>
          </div>
        </div>
      </div>

      <div class="sec" style="padding-bottom:16px">
        <div style="text-align:center;font-size:10.5px;color:var(--text-3);line-height:1.9">
          鱼价查 v1.0.0 · 智慧渔业全国水产品价格日报系统<br>
          数据来源：农业农村部全国农产品价格信息系统 pfsc.agri.cn
        </div>
      </div>`;

    document.getElementById('meAlerts').onclick = () => push(renderAlerts, '价格异动提醒');
    document.getElementById('meCompare2').onclick = () => push(renderCompare, '历史趋势对比');
    document.getElementById('meSettings').onclick = () => push(renderSettings, '账户设置');
    document.getElementById('meTheme').onclick = async () => {
      const t = Theme.cycle();
      toast(`已切换为「${Theme.labels[t]}」主题`);
      api.updateProfile({ theme: t }).then((u) => Auth.setUser(u)).catch(() => { });
      renderMe();
    };
    document.getElementById('mePush').onclick = async () => {
      try {
        const u = await api.updateProfile({ pushEnabled: !user.pushEnabled });
        Auth.setUser(u); toast(u.pushEnabled ? '已开启推送' : '已关闭推送'); renderMe();
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('meOut').onclick = async () => {
      await api.logoutApi(LS.get(KEYS.refresh, null));
      Auth.logout(); S.watches = null; S.alerts = null;
      toast('已退出登录'); goTab('me');
    };
    document.querySelectorAll('[data-exp]').forEach((el) => {
      el.onclick = async () => {
        const k = el.dataset.exp;
        if (!perms.export) return toast('当前角色无导出权限', 'warn', 3000);
        try {
          if (k === 'svg') {
            const r = await fetch(api.exportUrl('svg', { top: 15 }));
            const blob = new Blob([await r.text()], { type: 'image/svg+xml' });
            download(blob, '鱼价查_日报长图.svg');
          } else {
            const { blob, filename } = await api.download(k, {});
            download(blob, filename);
          }
          toast('导出成功');
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  // ══ 登录 / 注册 ════════════════════════════════════════════════════
  function renderLogin(prefill) {
    const [pe, pp] = prefill || ['', ''];
    screen().innerHTML = `
      <div class="mp" style="padding-top:18px">
        <div style="text-align:center;margin-bottom:18px">
          <svg width="44" height="44" viewBox="0 0 32 32" style="margin:0 auto">
            <path d="M4 16c4-6 11-8 17-4l6-4-2 8 2 8-6-4c-6 4-13 2-17-4z" fill="#0A9396"/>
            <circle cx="11" cy="14" r="1.9" fill="#fff"/></svg>
          <div style="font-size:17px;font-weight:700;margin-top:9px">登录 鱼价查</div>
          <div style="font-size:11.5px;color:var(--text-2);margin-top:4px">登录后关注品种云端同步、接收异动提醒</div>
        </div>
        <div class="fld-s"><label>邮箱</label><input id="lgEmail" type="email" placeholder="you@example.com" value="${U.esc(pe)}"></div>
        <div class="fld-s"><label>密码</label><input id="lgPw" type="password" placeholder="请输入密码" value="${U.esc(pp)}"></div>
        <button class="btn-s pri blk" id="lgGo" style="padding:11px">登录</button>
        <div style="text-align:center;margin-top:12px;font-size:11.5px;color:var(--text-2)">
          还没有账号？<span style="color:var(--brand)" id="lgReg">立即注册</span></div>
        <div style="font-size:11px;color:var(--text-3);margin:16px 0 6px">快速体验演示账号：</div>
        <div class="chips-s">
          ${[['管理员', 'admin@yujiacha.local', 'Admin@2026'],
        ['教研', 'teacher@shou.edu.cn', 'Demo@2026'],
        ['政府', 'gov@agri.local', 'Demo@2026'],
        ['普通用户', 'farmer@yujiacha.local', 'Demo@2026']]
        .map(([n, e, p]) => `<span class="chip-s" data-fill3="${e}|${p}">${n}</span>`).join('')}
        </div>
        <div class="mp-notice" style="margin-top:14px"><span>ℹ</span>
          <span>App 端同样支持手机号一键登录与微信授权登录（需在 uni-app 中接入对应 SDK）。</span></div>
      </div>`;

    const doLogin = async () => {
      const b = document.getElementById('lgGo');
      const e = val('lgEmail').trim(), p = val('lgPw');
      if (!e || !p) return toast('请填写邮箱与密码', 'warn');
      b.disabled = true; b.textContent = '登录中 …';
      try {
        const r = await api.login({ email: e, password: p });
        if (r.user.role === 'admin') {
          toast('管理员请使用管理后台登录', 'warn', 3200);
          b.disabled = false; b.textContent = '登录'; return;
        }
        Auth.save(r);
        S.watches = await api.watches().catch(() => null);
        S.alerts = await api.alerts({ limit: 20 }).catch(() => null);
        toast(`欢迎回来，${r.user.nickname || r.user.email}`);
        goTab('watch');
      } catch (err) {
        toast(err.message, 'err');
        b.disabled = false; b.textContent = '登录';
      }
    };
    document.getElementById('lgGo').onclick = doLogin;
    document.getElementById('lgReg').onclick = () => push(renderRegister, '注册');
    document.querySelectorAll('[data-fill3]').forEach((c) => {
      c.onclick = () => {
        const [e, p] = c.dataset.fill3.split('|');
        document.getElementById('lgEmail').value = e;
        document.getElementById('lgPw').value = p;
      };
    });
  }

  function renderRegister() {
    screen().innerHTML = `
      <div class="mp" style="padding-top:16px">
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">注册新账号</div>
        <div style="font-size:11.5px;color:var(--text-2);margin-bottom:16px;line-height:1.75">
          注册需邮箱验证激活。请选择与您身份相符的角色，不同角色的数据权限不同。</div>
        <div class="fld-s"><label>邮箱 *</label><input id="rgEmail" type="email" placeholder="you@example.com"></div>
        <div class="fld-s"><label>密码 *（至少 6 位）</label><input id="rgPw" type="password"></div>
        <div class="fld-s"><label>确认密码 *</label><input id="rgPw2" type="password"></div>
        <div class="fld-s"><label>称呼</label><input id="rgNick" placeholder="如 老张 / 李老师"></div>
        <div class="fld-s"><label>角色</label>
          <select id="rgRole">
            <option value="user">普通用户（养殖户 / 消费者 / 批发商）</option>
            <option value="researcher">教研师生（可导出数据）</option>
            <option value="gov">政府监测人员（可导出数据）</option>
          </select></div>
        <div class="fld-s"><label>所属机构（教研 / 政府用户）</label>
          <input id="rgOrg" placeholder="如 上海海洋大学 水产与生命学院"></div>
        <button class="btn-s pri blk" id="rgGo" style="padding:11px">注册并发送验证邮件</button>
        <div style="text-align:center;margin-top:12px;font-size:11.5px;color:var(--text-2)">
          已有账号？<span style="color:var(--brand)" id="rgLogin">前往登录</span></div>
        <div class="mp-notice" style="margin-top:14px"><span>🔒</span>
          <span>密码使用 scrypt 加盐哈希存储，平台不保存明文密码。注册后需完成邮箱验证才能订阅推送。</span></div>
      </div>`;

    document.getElementById('rgGo').onclick = async () => {
      const b = document.getElementById('rgGo');
      const e = val('rgEmail').trim(), p = val('rgPw'), p2 = val('rgPw2');
      if (!e || !p) return toast('请填写邮箱与密码', 'warn');
      if (p !== p2) return toast('两次输入的密码不一致', 'warn');
      b.disabled = true; b.textContent = '提交中 …';
      try {
        const r = await api.register({ email: e, password: p, nickname: val('rgNick'), role: val('rgRole'), org: val('rgOrg') });
        modal(`<div class="modal-head"><h3>注册成功</h3><button class="modal-close" id="mClose">×</button></div>
          <div class="mp-notice"><span>✉</span><span>验证邮件已发送至 <b>${U.esc(r.email)}</b>，点击链接即可激活账号。</span></div>
          <div class="fld-s mt-4"><label>验证链接（演示环境直接提供）</label>
            <input value="${U.esc(r.verifyLink)}" readonly onclick="this.select()" style="font-size:10px"></div>
          <div class="row gap-2 mt-3">
            <button class="btn-s pri blk" id="vGo">立即验证并登录</button>
            <button class="btn-s" data-close>稍后</button></div>`, {
          onMount(mask, close) {
            mask.querySelector('#vGo').onclick = async () => {
              try {
                await api.verifyEmail(r.verifyToken);
                toast('邮箱验证成功，请登录'); close();
                push(() => renderLogin([r.email, p]), '登录');
              } catch (err) { toast(err.message, 'err'); }
            };
          },
        });
        b.disabled = false; b.textContent = '注册并发送验证邮件';
      } catch (err) {
        toast(err.message, 'err');
        b.disabled = false; b.textContent = '注册并发送验证邮件';
      }
    };
    document.getElementById('rgLogin').onclick = () => back();
  }

  // ══ 历史对比（F11）═════════════════════════════════════════════════
  async function renderCompare() {
    const preset = [];
    screen().innerHTML = `
      <div style="padding:11px 12px;background:var(--surface);border-bottom:1px solid var(--border)">
        <div style="font-size:11.5px;color:var(--text-2);margin-bottom:7px">选择最多 6 个品种进行对比</div>
        <div class="chips-s" id="cmpChips">
          ${(S.meta.species || []).map((s) => `<span class="chip-s" data-cmp2="${U.esc(s.name)}">${U.esc(s.name)}</span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:9px">
          <select id="cmpDays" style="flex:1;padding:8px 10px;border:1px solid var(--border-strong);border-radius:8px;font-size:12.5px;background:var(--surface);color:var(--text-1)">
            <option value="30">近 30 天</option><option value="90" selected>近 90 天</option>
            <option value="180">近 180 天</option><option value="365">近 365 天</option>
          </select>
          <button class="btn-s pri" id="cmpGo">开始对比</button>
        </div>
      </div>
      <div id="cmpResult" class="mp" style="padding-top:12px">
        <div class="empty-s">${U.emptyIllustration()}<h5>请选择品种</h5><p>选择 1–6 个品种后点击「开始对比」</p></div>
      </div>`;

    const sel = new Set(preset);
    document.querySelectorAll('[data-cmp2]').forEach((c) => {
      c.onclick = () => {
        const n = c.dataset.cmp2;
        if (sel.has(n)) { sel.delete(n); c.classList.remove('on'); }
        else if (sel.size < 6) { sel.add(n); c.classList.add('on'); }
        else toast('最多选择 6 个品种', 'warn');
      };
    });
    document.getElementById('cmpGo').onclick = async () => {
      const host = document.getElementById('cmpResult');
      if (!sel.size) return toast('请至少选择一个品种', 'warn');
      host.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px"></div>';
      try {
        const d = await api.compare([...sel], { days: Number(val('cmpDays')) });
        host.innerHTML = `
          <div class="mp-card">
            <div style="font-size:11.5px;color:var(--text-2);margin-bottom:6px">
              区间走势对比 · ${U.dateFull(d.from)} — ${U.dateFull(d.date)}</div>
            ${U.multiLine(d.series, { height: 210 })}
          </div>
          <div style="margin-top:11px;border-radius:12px;overflow:hidden;border:1px solid var(--border)">
            <table class="mp-t"><thead><tr><th>品种</th><th class="num">起价</th><th class="num">终价</th><th class="num">涨跌</th></tr></thead>
            <tbody>${d.series.map((s) => `<tr>
              <td><b>${U.esc(s.species)}</b></td>
              <td class="num">${U.num(s.base)}</td>
              <td class="num"><b>${U.num(s.last)}</b></td>
              <td class="num">${U.delta(s.changePct)}</td></tr>`).join('')}
            </tbody></table>
          </div>
          <div style="font-size:10.5px;color:var(--text-2);line-height:1.75;background:var(--surface-2);border-radius:9px;padding:11px;margin-top:11px">
            区间振幅 =（区间最高 − 区间最低）/ 区间最低，用于刻画价格波动剧烈程度。</div>`;
        U.bindChartTips(host);
      } catch (e) {
        host.innerHTML = `<div class="mp-notice warn">${U.esc(e.message)}</div>`;
      }
    };
  }

  // ══ 账户设置 ═══════════════════════════════════════════════════════
  function renderSettings() {
    const u = Auth.user;
    screen().innerHTML = `
      <div class="mp" style="padding-top:14px">
        <div class="fld-s"><label>昵称</label><input id="stNick" value="${U.esc(u.nickname || '')}"></div>
        <div class="fld-s"><label>所属机构</label><input id="stOrg" value="${U.esc(u.org || '')}" placeholder="如 上海海洋大学 水产与生命学院"></div>
        <div class="fld-s"><label>主题偏好（云端同步）</label>
          <select id="stTheme">
            ${['light', 'dark', 'academic'].map((t) => `<option value="${t}" ${Theme.current === t ? 'selected' : ''}>${Theme.labels[t]}</option>`).join('')}
          </select></div>
        <div class="fld-s"><label style="display:flex;align-items:center;gap:7px;cursor:pointer">
          <input type="checkbox" id="stPush" ${u.pushEnabled ? 'checked' : ''}>
          <span>接收价格异动推送</span></label></div>
        <button class="btn-s pri blk" id="stSave">保存设置</button>

        <div style="margin:20px 0 10px;font-size:13px;font-weight:600">推送通道授权</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button class="btn-s sm" id="stWx">微信订阅消息</button>
          <button class="btn-s sm" id="stApp">App 系统推送</button>
          <button class="btn-s sm" id="stWeb">浏览器通知</button>
        </div>
        <div class="mp-notice" style="margin-top:10px" id="stHint">
          <span>ℹ</span><span>小程序端通过 wx.requestSubscribeMessage 由用户确认授权；App 端通过系统通知权限引导；Web 端通过浏览器通知授权。</span></div>

        <div style="margin:20px 0 10px;font-size:13px;font-weight:600">修改密码</div>
        <div class="fld-s"><label>当前密码</label><input id="stOld" type="password"></div>
        <div class="fld-s"><label>新密码（至少 6 位）</label><input id="stNew" type="password"></div>
        <button class="btn-s blk" id="stPw">修改密码</button>

        <div style="margin:20px 0 10px;font-size:13px;font-weight:600;color:var(--up)">注销账号</div>
        <div style="font-size:11.5px;color:var(--text-2);line-height:1.75;margin-bottom:9px">
          注销后账号进入软删除状态，关注与订阅解绑，登录状态立即失效。</div>
        <button class="btn-s blk" id="stDel" style="color:var(--up);border-color:var(--up)">申请注销账号</button>
      </div>`;

    document.getElementById('stSave').onclick = async () => {
      try {
        const t = val('stTheme');
        Theme.apply(t);
        const nu = await api.updateProfile({
          nickname: val('stNick'), org: val('stOrg'), theme: t,
          pushEnabled: document.getElementById('stPush').checked,
        });
        Auth.setUser(nu); toast('设置已保存并同步到云端');
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('stPw').onclick = async () => {
      try {
        await api.changePassword({ oldPassword: val('stOld'), newPassword: val('stNew') });
        toast('密码修改成功');
        document.getElementById('stOld').value = ''; document.getElementById('stNew').value = '';
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('stWx').onclick = async () => {
      try {
        await api.subscribePush({ channel: 'wechat_push', endpoint: 'miniprogram:preview' });
        document.getElementById('stHint').innerHTML = '<span>✓</span><span>微信订阅消息已登记。真机环境将调用 wx.requestSubscribeMessage 引导用户确认授权。</span>';
        toast('已登记微信订阅消息');
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('stApp').onclick = async () => {
      try {
        await api.subscribePush({ channel: 'app_push', endpoint: 'app:preview-device' });
        document.getElementById('stHint').innerHTML = '<span>✓</span><span>App 推送已登记，将通过 APNs / FCM 与华为、小米、OPPO、vivo 厂商通道下发。</span>';
        toast('已登记 App 推送');
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('stWeb').onclick = async () => {
      try {
        await api.subscribePush({ channel: 'web_push', endpoint: 'web:preview' });
        document.getElementById('stHint').innerHTML = '<span>✓</span><span>浏览器通知已登记。</span>';
        toast('已登记浏览器通知');
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('stDel').onclick = () => {
      modal(`<div class="modal-head"><h3 style="color:var(--up)">申请注销账号</h3><button class="modal-close" id="mClose">×</button></div>
        <div class="mp-notice warn"><span>⚠</span><span>注销后账号将进入软删除状态且无法登录，全部关注与订阅将被解绑。此操作不可自助恢复。</span></div>
        <div class="fld-s mt-4"><label>请输入登录密码确认</label><input id="delPw" type="password"></div>
        <div class="row gap-2 mt-3">
          <button class="btn-s blk" id="delGo" style="background:var(--up);border-color:var(--up);color:#fff">确认注销</button>
          <button class="btn-s" data-close>取消</button></div>`, {
        onMount(mask, close) {
          mask.querySelector('#delGo').onclick = async () => {
            try {
              const r = await api.deactivate({ password: mask.querySelector('#delPw').value, reason: '用户在客户端申请注销' });
              toast(`账号已注销，解绑关注 ${r.unbindWatches} 条`);
              Auth.logout(); S.watches = null; S.alerts = null;
              close(); goTab('me');
            } catch (e) { toast(e.message, 'err'); }
          };
        },
      });
    };
  }

  // ══ 弹层（关注阈值）════════════════════════════════════════════════
  function openWatchDialog(item, presetProvince = null) {
    const species = item ? item.species : null;
    modal(`
      <div class="modal-head"><h3>${item ? '设置提醒阈值' : '新增关注'}</h3>
        <button class="modal-close" id="mClose">×</button></div>
      <div class="fld-s"><label>品种</label>
        ${species ? `<input value="${U.esc(species)}" disabled>` :
        `<select id="mwSp">${(S.meta.species || []).map((s) => `<option>${U.esc(s.name)}</option>`).join('')}</select>`}</div>
      <div class="fld-s"><label>地区维度</label>
        <select id="mwPv"><option value="">全国</option>
          ${(S.meta.provinces || []).map((p) => `<option ${presetProvince === p.name || (item && item.province === p.name) ? 'selected' : ''}>${U.esc(p.name)}</option>`).join('')}
        </select></div>
      <div style="display:flex;gap:9px">
        <div class="fld-s" style="flex:1"><label>涨阈值（%）</label>
          <input id="mwUp" type="number" step="0.5" value="${item && item.thresholdUp !== '' && item.thresholdUp != null ? item.thresholdUp : 5}"></div>
        <div class="fld-s" style="flex:1"><label>跌阈值（%）</label>
          <input id="mwDown" type="number" step="0.5" value="${item && item.thresholdDown !== '' && item.thresholdDown != null ? item.thresholdDown : -5}"></div>
      </div>
      <div class="fld-s"><label>推送通道</label>
        <select id="mwCh">
          <option value="wechat_push" ${item && item.notifyChannel === 'wechat_push' ? 'selected' : ''}>微信订阅消息（小程序）</option>
          <option value="app_push" ${item && item.notifyChannel === 'app_push' ? 'selected' : ''}>系统推送（App）</option>
          <option value="web_push" ${item && item.notifyChannel === 'web_push' ? 'selected' : ''}>浏览器通知（Web/H5）</option>
          <option value="inbox" ${item && item.notifyChannel === 'inbox' ? 'selected' : ''}>仅站内消息</option>
        </select></div>
      <div class="mp-notice"><span>ℹ</span>
        <span>阈值基于「该品种（或指定省份）当日均价较前一日」的涨跌幅触发，默认 ±5%。</span></div>
      <div class="row gap-2 mt-4">
        <button class="btn-s pri blk" id="mwSave">保存</button>
        <button class="btn-s" data-close>取消</button></div>`, {
      onMount(mask, close) {
        mask.querySelector('#mwSave').onclick = async () => {
          const sp = species || mask.querySelector('#mwSp').value;
          const pv = mask.querySelector('#mwPv').value || null;
          try {
            await api.addWatch({
              species: sp, province: pv,
              thresholdUp: Number(mask.querySelector('#mwUp').value),
              thresholdDown: Number(mask.querySelector('#mwDown').value),
              notifyChannel: mask.querySelector('#mwCh').value,
            });
            S.watches = await api.watches();
            toast('已保存关注与提醒设置');
            close(); paintTabbar();
            const cur = S.stack[S.stack.length - 1];
            if (cur) cur.render();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function modal(html, { onMount } = {}) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal" style="max-width:340px;padding:18px">${html}</div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.onclick = (e) => { if (e.target === mask) close(); };
    const c = mask.querySelector('#mClose'); if (c) c.onclick = close;
    mask.querySelectorAll('[data-close]').forEach((b) => b.onclick = close);
    if (onMount) onMount(mask, close);
  }

  // ══ 启动 ═══════════════════════════════════════════════════════════
  function tick() {
    const d = new Date();
    document.getElementById('clock').textContent =
      `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function boot() {
    Theme.apply(Theme.current);
    tick(); setInterval(tick, 20000);
    S.navTitle = '行情'; S.baseTitle = '行情';
    try {
      const [meta, cfg, status] = await Promise.all([
        api.meta(), api.publicConfig().catch(() => null), api.status().catch(() => null),
      ]);
      S.meta = meta; S.config = cfg; S.status = status;
    } catch (e) {
      screen().innerHTML = `<div class="mp" style="padding-top:40px"><div class="empty-s">
        <h5>无法连接后端服务</h5>
        <p>请先启动后端：<code style="font-size:10.5px">cd yujiacha/server &amp;&amp; npm start</code></p></div></div>`;
      return;
    }
    if (Auth.isLoggedIn) {
      S.watches = await api.watches().catch(() => null);
      S.alerts = await api.alerts({ limit: 20 }).catch(() => null);
    }
    paintNav(); paintTabbar(); renderTab();
    document.addEventListener('yjt:theme', () => { });
  }

  boot();
})();
