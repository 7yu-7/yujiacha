/* ============================================================================
   鱼价查 · Web 网站主应用
   底部/顶部 5 大 Tab：行情 / 地图 / 关注 / 日报 / 我的
   全功能：F1 全品种 F2 搜索 F3 地图选省 F4 关注 F5 日报表 F6 详情
          F7 异动提醒 F8 导出 F9 主题 F10 离线 F11 历史对比 F13 账户
   ============================================================================ */
(function () {
  'use strict';
  const { api, Auth, LS, KEYS, LocalWatch, Theme, toast } = YJT;
  const U = YJT;

  const TABS = [
    { id: 'market', label: '行情', hash: '#/market', icon: 'grid' },
    { id: 'map', label: '地图', hash: '#/map', icon: 'map' },
    { id: 'watch', label: '关注', hash: '#/watch', icon: 'star' },
    { id: 'report', label: '日报', hash: '#/report', icon: 'chart' },
    { id: 'me', label: '我的', hash: '#/me', icon: 'user' },
  ];

  const ICONS = {
    grid: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>',
    map: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c-2.3 0-4.2 1.9-4.2 4.2 0 3.1 4.2 8.3 4.2 8.3s4.2-5.2 4.2-8.3c0-2.3-1.9-4.2-4.2-4.2zm0 5.7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>',
    star: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.6l2 4.1 4.5.6-3.3 3.2.8 4.5L8 11.9 4 14l.8-4.5L1.5 6.3 6 5.7z"/></svg>',
    chart: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="8" width="3" height="6.5" rx="1"/><rect x="6.5" y="4" width="3" height="10.5" rx="1"/><rect x="11.5" y="6" width="3" height="8.5" rx="1"/></svg>',
    user: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14.5c0-3 2.7-5 6-5s6 2 6 5z"/></svg>',
    search: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6L14 14" stroke-linecap="round"/></svg>',
    fish: '<svg width="22" height="22" viewBox="0 0 32 32"><path d="M4 16c4-6 11-8 17-4l6-4-2 8 2 8-6-4c-6 4-13 2-17-4z" fill="#7FE3E8" opacity=".95"/><circle cx="11" cy="14" r="1.9" fill="#005F73"/></svg>',
    bell: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a4 4 0 00-4 4v3L2.5 11h11L12 8.5v-3a4 4 0 00-4-4zM6.3 12.2a1.8 1.8 0 003.4 0z"/></svg>',
    sun: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3.2"/><path d="M8 .8v2M8 13.2v2M.8 8h2M13.2 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M7 1.5h2v6.2l2.4-2.4 1.4 1.4L8 11.5 3.2 6.7l1.4-1.4L7 7.7z"/><rect x="2" y="12.5" width="12" height="2" rx="1"/></svg>',
    share: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1.5l3 3-3 3V6H7a3 3 0 00-3 3v3H2V9a5 5 0 015-5h4.5z"/></svg>',
    star_off: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.9l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.7 4.2 13.7l.7-4.3-3.1-3 4.3-.6z" stroke-linejoin="round"/></svg>',
    star_on: '<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.9l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.7 4.2 13.7l.7-4.3-3.1-3 4.3-.6z"/></svg>',
  };

  // ── 全局状态 ──────────────────────────────────────────────────────────
  const S = {
    meta: null,
    config: null,
    status: null,
    route: { name: 'market', params: {} },
    speciesList: null,
    filters: { province: '', market: '', category: '', sort: 'category', order: '', keyword: '' },
    mapData: null,
    selectedProvince: null,
    reportDimension: 'province',
    alerts: null,
    watches: null,
    offline: false,
  };

  const app = () => document.getElementById('app');

  // ── 路由 ──────────────────────────────────────────────────────────────
  function parseHash() {
    const h = (location.hash || '#/market').replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const seg = path.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    if (seg.length === 0) return { name: 'market', params: {}, query };
    if (seg[0] === 'species' && seg[1]) return { name: 'species', params: { name: decodeURIComponent(seg[1]) }, query };
    return { name: seg[0], params: seg[1] ? { id: decodeURIComponent(seg[1]) } : {}, query };
  }
  const go = (hash) => { if (location.hash !== hash) location.hash = hash; else render(); };
  window.addEventListener('hashchange', render);

  // ── 头部 + Tab ────────────────────────────────────────────────────────
  function headerHtml() {
    const st = S.status;
    const user = Auth.user;
    const unread = S.alerts ? S.alerts.unread : 0;
    const watchCount = Auth.isLoggedIn ? (S.watches ? S.watches.total : 0) : LocalWatch.count();

    return `
    <header class="app-header">
      <div class="inner">
        <a class="logo" href="#/market">
          ${ICONS.fish}
          <span>鱼价查</span>
        </a>
        <div class="header-search">
          <span class="ico">${ICONS.search}</span>
          <input id="topSearch" type="search" placeholder="搜索品种：中文名 / 拼音首字母（如 jyx → 鲫鱼）/ 别名"
                 autocomplete="off" value="${U.esc(S.filters.keyword)}">
          <div id="suggestBox"></div>
        </div>
        <div class="header-meta">
          <span class="hide-sm">
            <span class="dot live"></span>
            ${st ? `最近更新：${U.dateFull(st.date)}` : '加载中…'}
          </span>
          <button class="btn sm ghost" id="themeBtn" title="切换主题（浅色 / 深色 / 学术白底）" style="color:rgba(255,255,255,.88)">
            ${ICONS.sun}<span class="hide-sm">${Theme.labels[Theme.current]}</span>
          </button>
          <button class="avatar-btn" id="avatarBtn" title="${user ? U.esc(user.nickname || user.email) : '未登录'}">
            ${user ? U.initials(user) : ICONS.user}
            ${unread ? `<span class="badge-dot">${unread > 99 ? '99+' : unread}</span>` : ''}
          </button>
        </div>
      </div>
    </header>
    <nav class="app-tabs">
      <div class="inner">
        ${TABS.map((t) => `<a class="tab ${S.route.name === t.id ? 'active' : ''}" href="${t.hash}">
          ${ICONS[t.icon]}<span>${t.label}</span>
          ${t.id === 'watch' && watchCount ? `<span class="badge-dot">${watchCount > 99 ? '99+' : watchCount}</span>` : ''}
          ${t.id === 'watch' && unread ? `<span class="badge-dot" style="background:var(--warn)">${unread}</span>` : ''}
        </a>`).join('')}
      </div>
    </nav>`;
  }

  function footHtml() {
    return `<footer class="app-foot">
      <div><b>鱼价查</b> · 智慧渔业全国水产品价格日报系统　v${S.meta ? S.meta.app.version : '1.0.0'}</div>
      <div>数据来源：农业农村部全国农产品价格信息系统 pfsc.agri.cn　·　T+0 当日发布　·　覆盖 34 个省级行政区 / 130 家批发市场</div>
      <div style="margin-top:6px" class="faint">教学可用 · 科研可用 · 产业可用 · 政府可用　|　涨跌色遵循国内「红涨绿跌」约定，并同时以 ▲▼ 箭头与文字标注</div>
    </footer>`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  渲染入口
  // ═══════════════════════════════════════════════════════════════════════
  async function render() {
    S.route = parseHash();
    app().innerHTML = `${headerHtml()}<main id="pageHost" class="page">
      ${U.skeletonTable(6)}
    </main>${footHtml()}`;
    bindGlobal();

    try {
      switch (S.route.name) {
        case 'market': await renderMarket(); break;
        case 'map': await renderMap(); break;
        case 'watch': await renderWatch(); break;
        case 'report': await renderReport(); break;
        case 'me': await renderMe(); break;
        case 'species': await renderSpecies(); break;
        case 'compare': await renderCompare(); break;
        case 'login': case 'register': case 'forgot': case 'reset': case 'verify':
          renderAuth(); return;   // 认证页不使用主布局
        default: await renderMarket();
      }
    } catch (e) {
      document.getElementById('pageHost').innerHTML = U.empty({
        title: '加载失败', desc: U.esc(e.message || '请稍后重试'),
        action: `<button class="btn primary" onclick="location.reload()">重新加载</button>`,
      });
    }
    U.bindChartTips();
  }

  function setPage(html) { document.getElementById('pageHost').innerHTML = html; }

  // ── 全局交互绑定 ──────────────────────────────────────────────────────
  function bindGlobal() {
    const tb = document.getElementById('themeBtn');
    if (tb) tb.onclick = () => {
      const t = Theme.cycle();
      toast(`已切换为「${Theme.labels[t]}」主题`);
      render();
    };

    const ab = document.getElementById('avatarBtn');
    if (ab) ab.onclick = (e) => { e.stopPropagation(); toggleAvatarMenu(); };

    const si = document.getElementById('topSearch');
    if (si) {
      let timer = null;
      si.oninput = () => {
        clearTimeout(timer);
        const q = si.value.trim();
        timer = setTimeout(() => showSuggest(q), 180);
      };
      si.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const q = si.value.trim();
          hideSuggest();
          if (S.route.name !== 'market') go('#/market');
          S.filters.keyword = q;
          renderMarket();
        }
        if (e.key === 'Escape') hideSuggest();
      };
      si.onfocus = () => { if (si.value.trim()) showSuggest(si.value.trim()); };
      document.addEventListener('click', hideSuggest);
    }
  }

  async function showSuggest(q) {
    const box = document.getElementById('suggestBox');
    if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    try {
      const r = await api.suggest(q);
      const hot = (S.config && S.config.hotSearch) || [];
      let inner = '';
      if (r.suggestions && r.suggestions.length) {
        inner = `<div class="suggest">${r.suggestions.map((s) => `
          <div class="suggest-item" data-species="${U.esc(s.species)}">
            <span class="sn">${hl(s.species, q)}<span class="sa">${U.esc(s.category)}</span></span>
            <span class="row center gap-2">
              <span class="mono bold">${U.num(s.price)}</span>
              ${U.delta(s.changePct)}
            </span>
          </div>`).join('')}</div>`;
      } else if (hot.length) {
        inner = `<div class="suggest"><div style="padding:8px 11px" class="tiny faint">未找到「${U.esc(q)}」，试试热门品种：</div>
          ${hot.map((h2) => `<div class="suggest-item" data-species="${U.esc(h2)}"><span class="sn">${U.esc(h2)}</span><span class="tiny faint">热门</span></div>`).join('')}</div>`;
      }
      box.innerHTML = inner;
      box.querySelectorAll('.suggest-item').forEach((el) => {
        el.onclick = (ev) => {
          ev.stopPropagation();
          hideSuggest();
          go('#/species/' + encodeURIComponent(el.dataset.species));
        };
      });
    } catch { box.innerHTML = ''; }
  }
  function hideSuggest() { const b = document.getElementById('suggestBox'); if (b) b.innerHTML = ''; }
  function hl(text, q) {
    const i = text.toLowerCase().indexOf(String(q).toLowerCase());
    if (i < 0) return U.esc(text);
    return U.esc(text.slice(0, i)) + `<mark style="background:var(--warn);color:#3A2600;border-radius:3px;padding:0 2px">${U.esc(text.slice(i, i + q.length))}</mark>` + U.esc(text.slice(i + q.length));
  }

  function toggleAvatarMenu() {
    const exist = document.querySelector('.dropdown');
    if (exist) { exist.remove(); return; }
    const user = Auth.user;
    const wrap = document.getElementById('avatarBtn');
    const holder = document.createElement('div');
    holder.style.position = 'relative';
    wrap.parentNode.insertBefore(holder, wrap);
    holder.appendChild(wrap);
    const d = document.createElement('div');
    d.className = 'dropdown';
    d.innerHTML = user ? `
      <div class="dd-head">
        <div class="bold small">${U.esc(user.nickname || '用户')}</div>
        <div class="tiny faint">${U.esc(user.email)}</div>
        <div style="margin-top:5px"><span class="badge">${U.esc(user.roleLabel)}</span></div>
      </div>
      <a class="dd-item" href="#/me">${ICONS.user} 我的账户</a>
      <a class="dd-item" href="#/watch">${ICONS.star} 我的关注</a>
      <button class="dd-item" id="ddAlert">${ICONS.bell} 消息提醒
        ${S.alerts && S.alerts.unread ? `<span class="badge-dot" style="margin-left:auto">${S.alerts.unread}</span>` : ''}</button>
      <div class="dd-sep"></div>
      <button class="dd-item danger" id="ddLogout">退出登录</button>`
      : `<div class="dd-head"><div class="bold small">尚未登录</div>
           <div class="tiny faint">登录后可订阅关注、接收价格异动提醒</div></div>
         <a class="dd-item" href="#/login">登录</a>
         <a class="dd-item" href="#/register">注册新账号</a>`;
    holder.appendChild(d);
    d.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => d.remove()));
    const lo = d.querySelector('#ddLogout');
    if (lo) lo.onclick = async () => {
      const rt = LS.get(KEYS.refresh, null);
      await api.logoutApi(rt);
      Auth.logout(); d.remove(); toast('已退出登录'); render();
    };
    const al = d.querySelector('#ddAlert');
    if (al) al.onclick = () => { d.remove(); openAlertsDrawer(); };
    setTimeout(() => document.addEventListener('click', function close(ev) {
      if (!d.contains(ev.target)) { d.remove(); document.removeEventListener('click', close); }
    }), 0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Tab 1：行情（F1 全品种 + F2 搜索入口 + 涨跌榜）
  // ═══════════════════════════════════════════════════════════════════════
  async function renderMarket() {
    setPage(`<div class="page-head">
      <div><h2 class="page-title">全部品种行情</h2>
        <p class="page-sub">按「大类 → 小类 → 品种」三级浏览，支持地区、市场筛选与价格排序</p></div>
      <div class="row gap-2" id="marketTools"></div>
    </div><div id="marketBody">${U.skeletonCards(8)}</div>`);

    const f = S.filters;
    const [list, movers] = await Promise.all([
      api.species({ province: f.province, market: f.market, category: f.category, sort: f.sort, order: f.order, keyword: f.keyword, pageSize: 500 }),
      api.movers({ scope: 'species', limit: 6 }),
    ]);
    S.speciesList = list;

    const provOpts = ['<option value="">全部地区</option>', ...(S.meta.provinces || []).map((p) =>
      `<option value="${U.esc(p.name)}" ${f.province === p.name ? 'selected' : ''}>${U.esc(p.short)}</option>`)].join('');
    const catOpts = ['<option value="">全部大类</option>', ...(S.meta.categories || []).map((c) =>
      `<option value="${U.esc(c.name)}" ${f.category === c.name ? 'selected' : ''}>${U.esc(c.name)}</option>`)].join('');
    const marketOpts = ['<option value="">全部市场</option>', ...(S.meta.markets || []).filter((m) => !f.province || m.province === (S.meta.provinces.find((p) => p.name === f.province) || {}).short)
      .slice(0, 200).map((m) => `<option value="${U.esc(m.name)}" ${f.market === m.name ? 'selected' : ''}>${U.esc(m.name)}</option>`)].join('');

    document.getElementById('marketTools').innerHTML = `
      <button class="btn sm" id="cmpBtn">多品种对比</button>
      ${S.filters.keyword ? `<button class="btn sm" id="clearKw">清除搜索「${U.esc(S.filters.keyword)}」</button>` : ''}`;

    document.getElementById('marketBody').innerHTML = `
      <div class="card mb-4">
        <div class="filter-bar">
          <div class="field"><label>地区（省）</label><select class="input" id="fProv">${provOpts}</select></div>
          <div class="field"><label>批发市场</label><select class="input" id="fMkt">${marketOpts}</select></div>
          <div class="field"><label>大类</label><select class="input" id="fCat">${catOpts}</select></div>
          <div class="field"><label>排序</label>
            <select class="input" id="fSort">
              <option value="category" ${f.sort === 'category' ? 'selected' : ''}>按品类</option>
              <option value="price" ${f.sort === 'price' ? 'selected' : ''}>按价格（高→低）</option>
              <option value="change" ${f.sort === 'change' ? 'selected' : ''}>按涨跌幅（大→小）</option>
              <option value="name" ${f.sort === 'name' ? 'selected' : ''}>按名称</option>
            </select></div>
          <div class="field grow" style="min-width:200px">
            <label>关键词（中文名 / 拼音首字母 / 别名）</label>
            <div class="search-box">${ICONS.search}
              <input class="input" id="fKw" placeholder="如 大黄鱼 / dhy / 虾姑" value="${U.esc(f.keyword)}">
            </div>
          </div>
          <div class="field"><button class="btn primary" id="fApply">筛选</button></div>
          <div class="field"><button class="btn" id="fReset">重置</button></div>
        </div>
        <div class="row between center mt-3" style="gap:var(--s-3);flex-wrap:wrap">
          <div class="tiny faint">
            数据日期 <b class="mono">${U.dateFull(list.date)}</b>　·　共 <b class="mono">${list.total}</b> 个品种
            ${S.offline ? '　·　<span class="badge warn">离线缓存</span>' : ''}
          </div>
          <div class="chips">
            <span class="tiny faint" style="align-self:center">价格档位：</span>
            ${(S.meta.priceTiers || []).map((t) => U.tierBadge({ tier: t.tier, label: t.label })).join('')}
          </div>
        </div>
      </div>

      ${movers.topGainers && movers.topGainers.length ? `
      <div class="grid mb-4" style="grid-template-columns:1fr 1fr;gap:var(--s-4)">
        <div class="card">
          <div class="card-head"><h3 class="card-title">涨幅榜 <span class="tiny faint">较前日</span></h3><span class="badge up">▲ 涨</span></div>
          <div class="rank-list">${movers.topGainers.map((m, i) => `
            <a class="rank-item" href="#/species/${encodeURIComponent(m.species)}" style="text-decoration:none;color:inherit">
              <span class="rank-badge ${i === 0 ? 'top1' : ''}">${i + 1}</span>
              <span class="grow small bold">${U.esc(m.species)}</span>
              <span class="p">${U.num(m.avgPrice)}</span>
              <span style="width:74px;text-align:right">${U.delta(m.changePct)}</span>
            </a>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">跌幅榜 <span class="tiny faint">较前日</span></h3><span class="badge down">▼ 跌</span></div>
          <div class="rank-list">${movers.topLosers.map((m, i) => `
            <a class="rank-item" href="#/species/${encodeURIComponent(m.species)}" style="text-decoration:none;color:inherit">
              <span class="rank-badge">${i + 1}</span>
              <span class="grow small bold">${U.esc(m.species)}</span>
              <span class="p">${U.num(m.avgPrice)}</span>
              <span style="width:74px;text-align:right">${U.delta(m.changePct)}</span>
            </a>`).join('')}</div>
        </div>
      </div>` : ''}

      <div class="mb-3 row between center">
        <h3 class="card-title" style="font-size:16px">品种列表
          <span class="tiny faint" style="font-weight:400">（${list.items.length} 项${list.items.length < list.total ? `，已展示前 ${list.items.length} 项` : ''}）</span>
        </h3>
        <div class="chips" id="catChips">
          <span class="chip ${!f.category ? 'active' : ''}" data-cat="">全部</span>
          ${(list.tree || []).map((c) => `<span class="chip ${f.category === c.name ? 'active' : ''}" data-cat="${U.esc(c.name)}">${U.esc(c.name)} <span class="faint">${c.count}</span></span>`).join('')}
        </div>
      </div>

      ${list.items.length ? `<div class="species-grid">${list.items.map(speciesCard).join('')}</div>`
        : U.empty({
          title: '没有匹配的品种', kind: 'search',
          desc: `未找到与「${U.esc(f.keyword || '当前筛选条件')}」匹配的品种。可尝试更换关键词，或提交新品种申报。`,
          action: `<button class="btn primary" id="reportSpecies">申报新品种</button>`,
        })}`;

    // 事件
    const reload = () => renderMarket();
    const apply = () => {
      S.filters.province = val('fProv'); S.filters.market = val('fMkt');
      S.filters.category = val('fCat'); S.filters.sort = val('fSort') || 'category';
      S.filters.keyword = val('fKw');
      S.filters.order = S.filters.sort === 'price' ? 'desc' : 'asc';
      renderMarket();
    };
    ['fProv', 'fMkt', 'fCat', 'fSort'].forEach((id) => { const e = document.getElementById(id); if (e) e.onchange = apply; });
    const kwEl = document.getElementById('fKw');
    if (kwEl) kwEl.onkeydown = (e) => { if (e.key === 'Enter') apply(); };
    const ap = document.getElementById('fApply'); if (ap) ap.onclick = apply;
    const rs = document.getElementById('fReset'); if (rs) rs.onclick = () => {
      S.filters = { province: '', market: '', category: '', sort: 'category', order: '', keyword: '' };
      const top = document.getElementById('topSearch'); if (top) top.value = '';
      reload();
    };
    document.querySelectorAll('#catChips .chip').forEach((c) => {
      c.onclick = () => { S.filters.category = c.dataset.cat; reload(); };
    });
    const ck = document.getElementById('clearKw'); if (ck) ck.onclick = () => {
      S.filters.keyword = ''; const top = document.getElementById('topSearch'); if (top) top.value = ''; reload();
    };
    const cb = document.getElementById('cmpBtn'); if (cb) cb.onclick = openComparePicker;
    const rp = document.getElementById('reportSpecies'); if (rp) rp.onclick = openSpeciesReport;
    bindWatchButtons();
  }
  const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };

  function speciesCard(s) {
    const isWatched = isWatchedNow(s.species);
    const wide = false;
    return `<div class="card species-card hoverable ${wide ? 'wide' : ''}">
      <span class="cat-badge">${U.esc(s.category)}</span>
      <div class="name-row">
        <a class="name" href="#/species/${encodeURIComponent(s.species)}" style="color:inherit">${U.esc(s.species)}</a>
        <span class="spec">${U.esc(s.spec || '')}</span>
      </div>
      <button class="star ${isWatched ? 'on' : ''}" data-species="${U.esc(s.species)}"
        title="${isWatched ? '取消关注' : '加入关注'}">${isWatched ? ICONS.star_on : ICONS.star_off}</button>
      <div class="price-row">
        <div>
          <span class="price">${U.num(s.price)}</span>
          <span class="price-unit">元/公斤</span>
        </div>
        ${U.delta(s.changePct)}
      </div>
      <div class="row gap-2 center" style="flex-wrap:wrap">
        ${U.tierBadge(s.tier, { outline: true })}
        <span class="tiny faint">覆盖 ${s.marketCount} 市场 / ${s.provinceCount} 省</span>
      </div>
      <div class="spark">
        ${U.sparkline(s.sparkline, { width: 200, height: 34 })}
        <div class="spark-label">近 7 日走势</div>
      </div>
    </div>`;
  }

  function isWatchedNow(species, province = null) {
    if (Auth.isLoggedIn && S.watches) {
      return S.watches.items.some((w) => w.species === species && (w.province || null) === (province || null));
    }
    return LocalWatch.has(species, province);
  }

  function bindWatchButtons() {
    document.querySelectorAll('.star[data-species]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const species = btn.dataset.species;
        if (!Auth.isLoggedIn) {
          LocalWatch.has(species) ? LocalWatch.remove(species) : LocalWatch.add(species);
          toast(LocalWatch.has(species) ? `已关注 ${species}（本地保存，登录后可多端同步）` : `已取消关注 ${species}`);
          const on = LocalWatch.has(species);
          btn.classList.toggle('on', on);
          btn.innerHTML = on ? ICONS.star_on : ICONS.star_off;
          refreshWatchBadge();
          return;
        }
        try {
          const w = (S.watches.items || []).find((x) => x.species === species && !x.province);
          if (w) { await api.removeWatch(w.id); toast(`已取消关注 ${species}`); }
          else { await api.addWatch({ species, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'web_push' }); toast(`已关注 ${species}，异动将提醒您`); }
          S.watches = await api.watches();
          const on = isWatchedNow(species);
          btn.classList.toggle('on', on);
          btn.innerHTML = on ? ICONS.star_on : ICONS.star_off;
          refreshWatchBadge();
        } catch (err) { toast(err.message, 'err'); }
      };
    });
  }
  function refreshWatchBadge() { const t = document.querySelector('.tab[href="#/watch"]'); if (t && S.route.name !== 'watch') render(); }

  // ═══════════════════════════════════════════════════════════════════════
  //  Tab 2：地图（F3 省界比色 + 近一周趋势）
  // ═══════════════════════════════════════════════════════════════════════
  async function renderMap() {
    setPage(`<div class="page-head">
      <div><h2 class="page-title">每日渔价地图</h2>
        <p class="page-sub">34 个省级行政区当日综合均价按「低 / 中 / 高」三档颜色编码，点击省份查看近一周趋势</p></div>
      <div class="row gap-2">
        <div class="chips">
          <span class="chip" id="mapModeToggle">切换到列表模式</span>
        </div>
      </div>
    </div><div id="mapBody">${U.skeletonTable(8)}</div>`);

    const data = await api.mapProvinces({ days: 7 });
    S.mapData = data;
    if (!S.selectedProvince) {
      S.selectedProvince = (data.maxProvince && data.maxProvince.name) ||
        (data.provinces.find((p) => p.hasData) || {}).name;
    }

    const tierCounts = { low: 0, mid: 0, high: 0, na: 0 };
    data.provinces.forEach((p) => { tierCounts[p.tier.tier] = (tierCounts[p.tier.tier] || 0) + 1; });

    document.getElementById('mapBody').innerHTML = `
      <div class="stat-grid mb-4" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        ${U.stat({ label: '全国综合均价', value: U.num(data.nationalAvg), unit: '元/公斤', sub: `数据日期 ${U.dateFull(data.date)}` })}
        ${U.stat({ label: '上涨省份', value: data.upCount, unit: '个', tone: 'up', sub: '▲ 价格上行' })}
        ${U.stat({ label: '下跌省份', value: data.downCount, unit: '个', tone: 'down', sub: '▼ 价格下行' })}
        ${U.stat({ label: '最高均价', value: data.maxProvince ? U.num(data.maxProvince.avgPrice) : '—', unit: '元/公斤', tone: 'warn', sub: data.maxProvince ? U.esc(data.maxProvince.short) : '—' })}
        ${U.stat({ label: '最低均价', value: data.minProvince ? U.num(data.minProvince.avgPrice) : '—', unit: '元/公斤', sub: data.minProvince ? U.esc(data.minProvince.short) : '—' })}
      </div>

      <div class="map-layout">
        <div>
          <div class="card">
            <div class="card-head">
              <h3 class="card-title">全国价格分布</h3>
              <div class="tiny faint">按省界填色 · 颜色越红价格越高</div>
            </div>
            <div id="mapHost" class="map-host">
              <div class="map-canvas" id="mapCanvas">${U.provinceMap(data.provinces, { focus: S.selectedProvince })}</div>
            </div>
            <div class="map-legend-row">
              ${(data.tiers || []).map((t) => `<span class="lg-item"><span class="sw" style="background:${t.color}"></span>
                ${U.esc(t.label)} ${t.min == null ? `≤${t.max}` : t.max == null ? `>${t.min}` : `${t.min}–${t.max}`} 元/斤</span>`).join('')}
            </div>
            <div class="map-hint mt-3" id="mapNote">
              提示：点击地图上的省份或下方芯片查看该省详情。省界数据依据自然资源部标准地图服务体系的行政区划界线绘制，
              含台湾省、香港特别行政区、澳门特别行政区及南海诸岛。
            </div>
          </div>

          <div class="card mt-4">
            <div class="card-head"><h3 class="card-title">省份快速切换</h3>
              <span class="tiny faint">共 ${data.provinces.length} 个省级行政区</span></div>
            <div class="chips scroll" id="provChips">
              ${data.provinces.map((p) => `<span class="chip chip-map ${S.selectedProvince === p.name ? 'active' : ''}"
                data-prov="${U.esc(p.name)}" ${!p.hasData ? 'style="opacity:.55"' : ''}>${U.esc(p.short)}</span>`).join('')}
            </div>
            ${data.noDataProvinces && data.noDataProvinces.length ? `<div class="notice warn mt-3">
              <span>⚠</span><span>以下省份当日暂无采集数据，已灰显：${data.noDataProvinces.map((n) => U.esc(n)).join('、')}</span></div>` : ''}
          </div>

          <div class="card mt-4">
            <div class="card-head"><h3 class="card-title">价格档位分布</h3></div>
            <div class="row gap-6 center wrap">
              ${U.tierDonut(tierCounts, { size: 132 })}
              <div class="grow">
                ${['low', 'mid', 'high', 'na'].map((k) => {
      const map = { low: '低位（沿海主产区）', mid: '中位（中部与一般内陆）', high: '高位（内陆高原与西部边远）', na: '暂无数据' };
      const col = U.TIER_HEX[k];
      return `<div class="row between center" style="padding:6px 0;border-bottom:1px solid var(--border)">
                    <span class="row center gap-2"><span class="dot" style="background:${col};width:10px;height:10px"></span>
                      <span class="small">${map[k]}</span></span>
                    <b class="mono">${tierCounts[k] || 0}</b>
                  </div>`;
    }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div id="provPanel">${U.skeletonTable(6)}</div>
      </div>`;

    bindMapInteractions();
    await renderProvincePanel(S.selectedProvince);
  }

  function bindMapInteractions() {
    // 省界多边形（.prov-shape）与省份芯片都可用于切换省份
    document.querySelectorAll('#mapCanvas .prov-shape, #mapCanvas .prov-dot, #provChips .chip').forEach((el) => {
      // 键盘可达性：省界可 Tab 聚焦、回车/空格选中
      if (el.classList.contains('prov-shape')) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        };
      }
      el.onclick = () => {
        const name = el.dataset.province || el.dataset.prov;
        if (!name) return;
        S.selectedProvince = name;
        document.querySelectorAll('#provChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.prov === name));
        // 高亮当前选中省份：重绘地图（描边加粗）
        const canvas = document.getElementById('mapCanvas');
        if (canvas && canvas.dataset.mode !== 'list' && S.mapData) {
          canvas.innerHTML = U.provinceMap(S.mapData.provinces, { focus: name });
          bindMapInteractions();
        }
        renderProvincePanel(name);
        const host = document.getElementById('mapHost');
        if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    });
    const t = document.getElementById('mapModeToggle');
    if (t) t.onclick = () => {
      const canvas = document.getElementById('mapCanvas');
      const isList = canvas.dataset.mode === 'list';
      if (isList) {
        canvas.dataset.mode = 'map';
        canvas.innerHTML = U.provinceMap(S.mapData.provinces, { focus: S.selectedProvince });
        bindMapInteractions();
        t.textContent = '切换到列表模式';
      } else {
        canvas.dataset.mode = 'list';
        const rows = [...S.mapData.provinces].sort((a, b) => (b.avgPrice || 0) - (a.avgPrice || 0));
        canvas.innerHTML = `<div style="height:560px;overflow-y:auto;padding:10px">
          <table class="data compact"><thead><tr><th>省份</th><th class="right">均价</th><th class="right">较前日</th><th>档位</th></tr></thead>
          <tbody>${rows.map((p) => `<tr style="cursor:pointer" data-prov-row="${U.esc(p.name)}">
            <td>${U.esc(p.short)}</td><td class="right mono bold">${p.hasData ? U.num(p.avgPrice) : '—'}</td>
            <td class="right">${p.hasData ? U.delta(p.changePct) : '—'}</td>
            <td>${p.hasData ? U.tierBadge(p.tier, { outline: true }) : '<span class="tiny faint">无数据</span>'}</td></tr>`).join('')}
          </tbody></table></div>`;
        canvas.querySelectorAll('[data-prov-row]').forEach((tr) => {
          tr.onclick = () => {
            S.selectedProvince = tr.dataset.provRow;
            document.querySelectorAll('#provChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.prov === S.selectedProvince));
            renderProvincePanel(S.selectedProvince);
          };
        });
        t.textContent = '切换到地图模式';
      }
    };
  }

  async function renderProvincePanel(name) {
    const host = document.getElementById('provPanel');
    if (!host || !name) return;
    host.innerHTML = U.skeletonTable(6);
    let d;
    try { d = await api.province(name, { range: 7 }); }
    catch (e) { host.innerHTML = U.empty({ title: '省份数据加载失败', desc: U.esc(e.message) }); return; }

    host.innerHTML = `
      <div class="card">
        <div class="prov-panel-head">
          <div>
            <div class="row center gap-2">
              <h3 class="card-title" style="font-size:20px">${U.esc(d.province.name)}</h3>
              ${U.tierBadge(d.header.tier)}
              ${d.province.coast ? '<span class="badge gray">沿海主产区</span>' : '<span class="badge gray">内陆</span>'}
            </div>
            <div class="tiny faint mt-2">
              覆盖 <b class="mono">${d.header.speciesCount}</b> 个品种 ·
              <b class="mono">${d.header.marketCount}</b> 家市场 ·
              <b class="mono">${U.int(d.header.recordCount)}</b> 条记录
            </div>
            <div class="tiny faint">数据截至 ${U.dtText(d.header.collectedAt)}</div>
          </div>
        </div>

        ${d.header.hasData ? `
        <div class="mt-4">
          <div class="price-wrap">
            <span class="price lg">${U.num(d.header.avgPrice)}</span>
            <span class="price-unit">元/公斤</span>
            ${U.delta(d.header.changePct)}
          </div>
          <div class="tiny faint">较前日（${U.dateFull(d.prevDate)}）　约 ${U.num(d.header.avgPrice / 2)} 元/斤</div>
        </div>

        <div class="mini-stat-row mt-3">
          <div class="mini-stat"><div class="k">近 7 日最高</div><div class="v">${U.num(d.stats.max)}</div><div class="tiny faint">${U.dateShort(d.stats.maxDate)}</div></div>
          <div class="mini-stat"><div class="k">近 7 日最低</div><div class="v">${U.num(d.stats.min)}</div><div class="tiny faint">${U.dateShort(d.stats.minDate)}</div></div>
          <div class="mini-stat"><div class="k">7 日振幅</div><div class="v">${U.num(d.stats.amplitude)}%</div><div class="tiny faint">波动幅度</div></div>
        </div>

        <div class="divider"></div>
        <div class="card-head"><h4 class="card-title" style="font-size:15px">近一周均价趋势</h4>
          <span class="tiny faint">${U.dateShort(d.trend[0] && d.trend[0].date)} — ${U.dateShort(d.trend[d.trend.length - 1] && d.trend[d.trend.length - 1].date)}</span></div>
        ${U.lineChart(d.trend, { height: 200, color: 'var(--brand-2)', unit: '元/公斤' })}

        <div class="divider"></div>
        <div class="card-head"><h4 class="card-title" style="font-size:15px">Top 8 品种报价</h4>
          <span class="tiny faint">按价格降序</span></div>
        <div class="table-wrap">
          <table class="data compact"><thead><tr>
            <th>品种</th><th>规格</th><th class="right">价格</th><th class="right">较前日</th></tr></thead>
          <tbody>${d.topSpecies.map((s) => `<tr>
            <td><a href="#/species/${encodeURIComponent(s.species)}">${U.esc(s.species)}</a>
              <div class="tiny faint">${U.esc(s.category)}</div></td>
            <td class="tiny">${U.esc(s.spec || '—')}</td>
            <td class="right mono bold">${U.num(s.price)}</td>
            <td class="right">${U.delta(s.changePct)}</td></tr>`).join('')}
          </tbody></table>
        </div>

        ${d.markets.length > 1 ? `<div class="divider"></div>
        <div class="card-head"><h4 class="card-title" style="font-size:15px">分批发市场均价</h4>
          <span class="tiny faint">${d.markets.length} 家</span></div>
        <div class="table-wrap" style="max-height:250px;overflow-y:auto">
          <table class="data compact"><thead><tr><th>批发市场</th><th class="right">均价</th><th>档位</th></tr></thead>
          <tbody>${d.markets.map((m) => `<tr>
            <td class="small">${U.esc(m.market)}</td>
            <td class="right mono">${U.num(m.avgPrice)}</td>
            <td>${U.tierBadge(m.tier, { outline: true })}</td></tr>`).join('')}
          </tbody></table>
        </div>` : ''}

        <div class="row gap-2 mt-4">
          <button class="btn sm primary" data-watch-prov="${U.esc(d.province.name)}">订阅该省异动</button>
          <a class="btn sm" href="#/report">查看全国日报表</a>
        </div>
        ` : U.empty({ title: `${U.esc(d.province.name)} 暂无当日数据`, kind: 'map', desc: '该省份当日尚未采集到报价数据，可能因休市或采集中断。系统会以「—」占位并标注，待数据补齐后自动更新。' })}
      </div>`;

    const wb = host.querySelector('[data-watch-prov]');
    if (wb) wb.onclick = () => openWatchDialog(null, wb.dataset.watchProv);
    U.bindChartTips(host);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Tab 3：我的关注（F4）
  // ═══════════════════════════════════════════════════════════════════════
  async function renderWatch() {
    setPage(`<div class="page-head">
      <div><h2 class="page-title">我的关注品种</h2>
        <p class="page-sub">关注品种与地区维度的价格走势、涨跌与异动提醒，登录后多端同步</p></div>
      <div class="row gap-2">
        <a class="btn sm" href="#/market">前往全部品种 →</a>
        ${Auth.isLoggedIn ? `<button class="btn sm" id="exportWatch">导出关注</button>` : ''}
      </div>
    </div><div id="watchBody">${U.skeletonCards(4)}</div>`);

    const loggedIn = Auth.isLoggedIn;
    let items = [];

    if (loggedIn) {
      S.watches = await api.watches();
      items = S.watches.items;
    } else {
      // 游客：本地关注，价格实时查询
      const local = LocalWatch.all();
      for (const w of local) {
        try {
          const d = await api.speciesDetail(w.species, { province: w.province, days: 7 });
          items.push({
            id: 'local_' + w.species + (w.province || ''),
            species: w.species, province: w.province, scope: w.province || '全国',
            price: d.price.avg, prevPrice: d.price.prev, changePct: d.price.changePct,
            trend: (d.history || []).slice(-7).map((h) => ({ date: h.date, price: h.avg })),
            trendRange: (d.history || []).length ? `${U.dateShort(d.history[Math.max(0, d.history.length - 7)].date)} — ${U.dateShort(d.history[d.history.length - 1].date)}` : '',
            local: true,
          });
        } catch { /* 跳过查询失败的项 */ }
      }
    }

    const host = document.getElementById('watchBody');
    if (!items.length) {
      host.innerHTML = `<div class="card">${U.empty({
        title: '还没有关注任何品种', kind: 'default',
        desc: '关注后可在本页集中查看最新价、近一周走势与涨跌，并可设置异动提醒。<br>点击品种卡片右上角的星标即可添加。',
        action: '<a class="btn primary" href="#/market">前往全部品种 →</a>',
      })}</div>`;
      bindExportWatch();
      return;
    }

    // 概览
    const upN = items.filter((i) => (i.changePct || 0) > 0).length;
    const downN = items.filter((i) => (i.changePct || 0) < 0).length;
    const alerts = loggedIn ? (S.alerts = await api.alerts({ limit: 8 })) : null;

    host.innerHTML = `
      ${!loggedIn ? `<div class="notice mb-4"><span>ℹ</span>
        <span>当前为访客模式，关注列表保存在本机浏览器（localStorage: yjt_watchlist）。
        <a href="#/login">登录</a> 后可云端保存并多端同步，同时开启价格异动推送。</span></div>` : ''}

      <div class="stat-grid mb-4">
        ${U.stat({ label: '关注品种数', value: items.length, unit: '个' })}
        ${U.stat({ label: '今日上涨', value: upN, unit: '个', tone: 'up', sub: '▲' })}
        ${U.stat({ label: '今日下跌', value: downN, unit: '个', tone: 'down', sub: '▼' })}
        ${loggedIn ? U.stat({ label: '未读提醒', value: alerts.unread, unit: '条', tone: 'warn', sub: '异动阈值触发' })
        : U.stat({ label: '推送提醒', value: '未开启', sub: '登录后可开启' })}
      </div>

      ${loggedIn && alerts.items.length ? `<div class="card mb-4">
        <div class="card-head"><h3 class="card-title">最近价格异动提醒</h3>
          <button class="btn sm ghost" id="readAll">全部标为已读</button></div>
        <div class="rank-list">${alerts.items.slice(0, 4).map((a) => `
          <div class="rank-item" style="${a.isRead ? 'opacity:.62' : ''}">
            <span class="badge ${a.direction === 'up' ? 'up' : 'down'}">${a.direction === 'up' ? '▲ 涨' : '▼ 跌'}</span>
            <span class="grow small"><b>${U.esc(a.species)}</b> <span class="faint">${U.esc(a.scope)}</span>
              <div class="tiny faint">${U.dateFull(a.date)}　${U.num(a.prevPrice)} → ${U.num(a.currPrice)} 元/公斤</div></span>
            ${U.delta(a.changePct)}
          </div>`).join('')}</div>
      </div>` : ''}

      <div class="species-grid">
        ${items.map((w) => `
          <div class="card species-card hoverable wide">
            <span class="cat-badge">${U.esc(w.scope)}</span>
            <div class="name-row" style="padding-right:110px">
              <a class="name" href="#/species/${encodeURIComponent(w.species)}?province=${encodeURIComponent(w.province || '')}" style="color:inherit">${U.esc(w.species)}</a>
            </div>
            <button class="star on" data-unwatch="${U.esc(w.id)}" data-species="${U.esc(w.species)}" data-prov="${U.esc(w.province || '')}"
              title="取消关注" style="top:44px">${ICONS.star_on}</button>
            <div class="price-row">
              <div><span class="price">${U.num(w.price)}</span><span class="price-unit">元/公斤</span></div>
              ${U.delta(w.changePct)}
            </div>
            <div class="row gap-2 center wrap">
              ${w.thresholdUp != null ? `<span class="badge gray">涨阈值 ${w.thresholdUp}%</span>` : ''}
              ${w.thresholdDown != null ? `<span class="badge gray">跌阈值 ${w.thresholdDown}%</span>` : ''}
              ${w.notifyChannel ? `<span class="badge">${notifyLabel(w.notifyChannel)}</span>` : ''}
            </div>
            <div class="spark">
              ${U.sparkline(w.trend, { width: 264, height: 42 })}
              <div class="spark-label">${U.esc(w.trendRange || '近 7 日')} 走势</div>
            </div>
            ${loggedIn ? `<div class="row gap-2 mt-2">
              <button class="btn sm" data-editwatch="${U.esc(w.id)}" data-species="${U.esc(w.species)}"
                data-up="${w.thresholdUp ?? ''}" data-down="${w.thresholdDown ?? ''}" data-ch="${U.esc(w.notifyChannel || 'app')}">设置阈值</button>
            </div>` : ''}
          </div>`).join('')}
      </div>`;

    // 取消关注
    document.querySelectorAll('[data-unwatch]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.unwatch;
        try {
          if (String(id).startsWith('local_')) LocalWatch.remove(b.dataset.species, b.dataset.prov || null);
          else await api.removeWatch(id);
          toast('已取消关注');
          renderWatch();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
    // 设置阈值
    document.querySelectorAll('[data-editwatch]').forEach((b) => {
      b.onclick = () => openWatchDialog({
        id: b.dataset.editwatch, species: b.dataset.species,
        thresholdUp: b.dataset.up, thresholdDown: b.dataset.down, notifyChannel: b.dataset.ch,
      });
    });
    const ra = document.getElementById('readAll');
    if (ra) ra.onclick = async () => { await api.readAlerts([]); toast('已全部标为已读'); renderWatch(); };
    bindExportWatch();
  }

  function notifyLabel(c) {
    return { wechat_push: '微信订阅消息', app_push: 'App 推送', web_push: '浏览器通知', inbox: '站内消息', app: 'App 推送' }[c] || c;
  }

  function bindExportWatch() {
    const b = document.getElementById('exportWatch');
    if (b) b.onclick = () => doExport('watch', {});
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Tab 4：全国渔价日报表（F5）
  // ═══════════════════════════════════════════════════════════════════════
  async function renderReport() {
    setPage(`<div class="page-head">
      <div><h2 class="page-title">全国渔价日报表</h2>
        <p class="page-sub">34 个省级行政区当日综合均价，按价格从高到低排序　·　T+0 当日发布</p></div>
      <div class="row gap-2" id="reportTools"></div>
    </div><div id="reportBody">${U.skeletonTable(10)}</div>`);

    const dim = S.reportDimension;
    const rep = await api.dailyReport({ dimension: dim });

    document.getElementById('reportTools').innerHTML = `
      <div class="chips">
        <span class="chip ${dim === 'province' ? 'active' : ''}" data-dim="province">按省份</span>
        <span class="chip ${dim === 'species' ? 'active' : ''}" data-dim="species">按品种</span>
      </div>
      <button class="btn sm" id="exportCsv">导出 CSV</button>
      <button class="btn sm" id="exportSvg">分享长图</button>
      <button class="btn sm" id="exportPrint">导出 PDF</button>`;

    const o = rep.overview;
    const rows = dim === 'species' ? (rep.bySpecies || []) : rep.rows;

    document.getElementById('reportBody').innerHTML = `
      <div class="notice warn mb-4">
        <span>⏱</span>
        <span>数据日期 <b>${U.dateFull(rep.date)}</b>　·　覆盖市场 <b>${rep.filterBar.marketCount}</b> 家　·　记录 <b>${U.int(rep.filterBar.recordCount)}</b> 条　·　
        采集批次号 <span class="mono">${U.esc(rep.filterBar.batchNo || '—')}</span>（可审计）　·　发布状态：<span class="badge ${rep.status.status === 'published' ? 'down' : 'warn'}">${rep.status.status === 'published' ? '已发布' : '待发布'}</span></span>
      </div>

      <div class="stat-grid mb-4">
        ${U.stat({ label: '当日全国综合均价', value: U.num(o.nationalAvg), unit: '元/公斤', sub: `约 ${U.num(o.nationalAvg / 2)} 元/斤` })}
        ${U.stat({ label: '上涨省份', value: o.upCount, unit: '个', tone: 'up', sub: '▲ 价格上行，需关注' })}
        ${U.stat({ label: '下跌省份', value: o.downCount, unit: '个', tone: 'down', sub: '▼ 价格下行，存机会' })}
        ${U.stat({ label: '最高均价省份', value: o.maxProvince ? o.maxProvince.short : '—', sub: o.maxProvince ? `${U.num(o.maxProvince.avgPrice)} 元/公斤` : '—', tone: 'warn' })}
        ${U.stat({ label: '最低均价省份', value: o.minProvince ? o.minProvince.short : '—', sub: o.minProvince ? `${U.num(o.minProvince.avgPrice)} 元/公斤` : '—' })}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="card-title">${dim === 'province' ? '省级行政区价格排行' : '品种价格排行'}</h3>
          <span class="tiny faint">共 ${rows.length} 项　·　排序：价格由高到低</span>
        </div>
        <div class="table-wrap" style="max-height:620px;overflow:auto">
          <table class="data">
            <thead><tr>
              <th style="width:52px">名次</th>
              <th>${dim === 'province' ? '省级行政区' : '品种'}</th>
              <th class="right">当日综合均价</th>
              <th class="right">较昨日</th>
              <th class="right">覆盖品种</th>
              <th class="right">覆盖市场</th>
              <th>领涨品种</th>
              <th>价格档位</th>
              <th style="width:112px">近 7 日</th>
            </tr></thead>
            <tbody>${rows.map((r) => {
      const isUp = r.changePct > 0;
      const isDown = r.changePct < 0;
      return `<tr>
                <td><span class="rank-badge ${r.rank === 1 ? 'top1' : r.rank === 2 ? 'top2' : r.rank === 3 ? 'top3' : ''}">${r.rank}</span></td>
                <td>${dim === 'province'
          ? `<a href="#/species/大黄鱼?province=${encodeURIComponent(r.province)}" class="bold" style="color:inherit" data-prov-link="${U.esc(r.province)}">${U.esc(r.province)}</a>`
          : `<a href="#/species/${encodeURIComponent(r.species)}" class="bold" style="color:inherit">${U.esc(r.species)}</a>
                     <div class="tiny faint">${U.esc(r.category)}</div>`}</td>
                <td class="right"><b class="mono" style="font-size:15px">${U.num(r.avgPrice)}</b>
                  <div class="tiny faint">${U.num(r.avgPrice / 2)} 元/斤</div></td>
                <td class="right">${U.delta(r.changePct)}</td>
                <td class="right mono">${dim === 'province' ? r.speciesCount : r.provinceCount}</td>
                <td class="right mono">${r.marketCount}</td>
                <td>${r.leadUp ? `<span class="small">${U.esc(r.leadUp.species)}</span>
                    <div class="tiny"><span class="text-up">▲ ${U.num(r.leadUp.changePct)}%</span></div>` : '<span class="faint">—</span>'}</td>
                <td>${U.tierBadge(r.tier, { outline: true })}</td>
                <td>${U.sparkline(r.trend || [], { width: 100, height: 26 })}</td>
              </tr>`;
    }).join('')}
            </tbody>
          </table>
        </div>
        <div class="tbl-note">
          <b>口径说明：</b>${U.esc(rep.disclaimer)}<br>
          <b>数据来源：</b>${U.esc(rep.status.source || '农业农村部全国农产品价格信息系统 pfsc.agri.cn')}　·　
          <b>更新时效：</b>T+0 当日发布，采集批次号可用于复现与审计。
        </div>
        ${o.maxChangeProvince ? `<div class="notice mt-4"><span>📈</span>
          <span>当日价格波动最大的省份为 <b>${U.esc(o.maxChangeProvince.short)}</b>，
          较昨日 ${o.maxChangeProvince.changePct > 0 ? '上涨' : '下跌'} <b>${U.num(Math.abs(o.maxChangeProvince.changePct))}%</b>
          （${U.num(o.maxChangeProvince.prevPrice)} → ${U.num(o.maxChangeProvince.avgPrice)} 元/公斤）。</span></div>` : ''}
      </div>`;

    // 省份行跳转到地图页
    document.querySelectorAll('[data-prov-link]').forEach((a) => {
      a.onclick = (e) => { e.preventDefault(); S.selectedProvince = a.dataset.provLink; go('#/map'); };
    });
    document.querySelectorAll('[data-dim]').forEach((c) => {
      c.onclick = () => { S.reportDimension = c.dataset.dim; renderReport(); };
    });
    const ec = document.getElementById('exportCsv'); if (ec) ec.onclick = () => doExport('report', { dimension: dim });
    const es = document.getElementById('exportSvg'); if (es) es.onclick = () => doExport('svg', { top: 12 });
    const ep = document.getElementById('exportPrint'); if (ep) ep.onclick = () => openPrint(rep);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Tab 5：我的（F13 账户 + F7 提醒 + F9 主题 + F8 导出）
  // ═══════════════════════════════════════════════════════════════════════
  async function renderMe() {
    const user = Auth.user;
    const st = S.status;

    if (!user) {
      setPage(`
        <div class="page-head"><div><h2 class="page-title">我的</h2>
          <p class="page-sub">登录后可云端保存关注品种、设置价格异动提醒，并解锁导出能力</p></div></div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--s-4)">
          <div class="card lg">
            <h3 class="card-title mb-3">访客模式可用功能</h3>
            <ul class="small" style="line-height:2.1;padding-left:18px;margin:0;color:var(--text-2)">
              <li>浏览全部 28 个品种行情（F1）</li>
              <li>搜索品种，支持拼音首字母与别名（F2）</li>
              <li>地图选省查看近一周趋势（F3）</li>
              <li>本机保存关注列表（F4，localStorage）</li>
              <li>查看全国渔价日报表（F5）</li>
              <li>切换浅色 / 深色 / 学术白底主题（F9）</li>
            </ul>
            <div class="notice mt-4"><span>ℹ</span><span>游客为只读模式，不可订阅云端关注、不可接收推送、不可导出数据。</span></div>
            <div class="row gap-2 mt-4">
              <a class="btn primary" href="#/login">立即登录</a>
              <a class="btn" href="#/register">注册新账号</a>
            </div>
          </div>
          <div class="card lg">
            <h3 class="card-title mb-3">登录后解锁</h3>
            <ul class="small" style="line-height:2.1;padding-left:18px;margin:0;color:var(--text-2)">
              <li>关注品种多端同步（网站 / 小程序 / App 一致）</li>
              <li>价格异动提醒推送（F7：微信订阅消息 / 系统推送 / 浏览器通知）</li>
              <li>教研 / 政府 / 管理员可导出 CSV、长图、PDF（F8）</li>
              <li>历史多品种对比分析（F11）</li>
              <li>完整账户：邮箱验证、忘记密码、资料修改、注销（F13）</li>
            </ul>
            <div class="divider"></div>
            <div class="tiny faint mb-2">演示账号（可直接体验各角色权限）：</div>
            <div class="table-wrap"><table class="data compact">
              <thead><tr><th>角色</th><th>邮箱</th><th>密码</th></tr></thead>
              <tbody>
                <tr><td>管理员</td><td class="mono tiny">admin@yujiacha.local</td><td class="mono tiny">Admin@2026</td></tr>
                <tr><td>教研师生</td><td class="mono tiny">teacher@shou.edu.cn</td><td class="mono tiny">Demo@2026</td></tr>
                <tr><td>政府监测</td><td class="mono tiny">gov@agri.local</td><td class="mono tiny">Demo@2026</td></tr>
                <tr><td>普通用户</td><td class="mono tiny">farmer@yujiacha.local</td><td class="mono tiny">Demo@2026</td></tr>
              </tbody></table></div>
          </div>
        </div>`);
      return;
    }

    const alerts = S.alerts = await api.alerts({ limit: 20 });
    const watches = S.watches = await api.watches();
    const perms = user.permissions || {};

    setPage(`
      <div class="page-head">
        <div class="row center gap-4">
          <div class="avatar-btn" style="width:56px;height:56px;font-size:20px;background:var(--brand);border-color:var(--brand)">${U.initials(user)}</div>
          <div>
            <h2 class="page-title">${U.esc(user.nickname || '用户')}</h2>
            <p class="page-sub">${U.esc(user.email)}　·　<span class="badge">${U.esc(user.roleLabel)}</span>
              ${user.emailVerified ? '<span class="badge down">邮箱已验证</span>' : '<span class="badge warn">邮箱待验证</span>'}</p>
          </div>
        </div>
        <button class="btn" id="logoutBtn">退出登录</button>
      </div>

      <div class="stat-grid mb-4">
        ${U.stat({ label: '关注品种', value: watches.total, unit: '个', sub: '云端同步' })}
        ${U.stat({ label: '未读提醒', value: alerts.unread, unit: '条', tone: 'warn', sub: '价格异动' })}
        ${U.stat({ label: '数据日期', value: U.dateFull(st ? st.date : ''), sub: 'T+0 当日发布' })}
        ${U.stat({ label: '导出权限', value: perms.export ? '已开通' : '未开通', sub: perms.export ? 'CSV / 长图 / PDF' : '教研·政府·管理员可导出' })}
      </div>

      <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--s-4)">
        <div class="card">
          <div class="card-head"><h3 class="card-title">价格异动提醒</h3>
            ${alerts.unread ? `<button class="btn sm ghost" id="meReadAll">全部已读</button>` : ''}</div>
          ${alerts.items.length ? `<div class="rank-list" style="max-height:320px;overflow-y:auto">
            ${alerts.items.slice(0, 12).map((a) => `<div class="rank-item" style="${a.isRead ? 'opacity:.6' : ''}">
              <span class="badge ${a.direction === 'up' ? 'up' : 'down'}">${a.direction === 'up' ? '▲' : '▼'}</span>
              <span class="grow small"><b>${U.esc(a.species)}</b> <span class="faint tiny">${U.esc(a.scope)}</span>
                <div class="tiny faint">${U.dateFull(a.date)} · ${notifyLabel(a.channel || 'inbox')}</div></span>
              <span style="text-align:right">${U.delta(a.changePct)}
                <div class="tiny faint">${U.num(a.currPrice)}</div></span>
            </div>`).join('')}</div>`
        : U.empty({ title: '暂无价格异动', desc: '当您关注的品种涨跌幅超过设定阈值时，这里会显示提醒记录。' })}
        </div>

        <div class="card">
          <h3 class="card-title mb-3">账户设置</h3>
          <div class="field"><label>昵称</label><input class="input" id="pNick" value="${U.esc(user.nickname || '')}"></div>
          <div class="field"><label>所属机构（教研 / 政府用户）</label><input class="input" id="pOrg" value="${U.esc(user.org || '')}" placeholder="如 上海海洋大学 水产与生命学院"></div>
          <div class="field"><label>主题偏好（云端同步）</label>
            <div class="theme-swatch" id="themeSwatch">
              ${['light', 'dark', 'academic'].map((t) => `<button data-theme="${t}" class="${Theme.current === t ? 'on' : ''}">${Theme.labels[t]}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label class="row center gap-2" style="cursor:pointer">
              <input type="checkbox" id="pPush" ${user.pushEnabled ? 'checked' : ''}>
              <span>接收价格异动推送</span>
            </label>
            <div class="hint">开启后，关注品种触发阈值时将按所选通道提醒。小程序需订阅消息授权，Web 需浏览器通知授权。</div>
          </div>
          <button class="btn primary block" id="saveProfile">保存设置</button>

          <div class="divider"></div>
          <h3 class="card-title mb-3">修改密码</h3>
          <div class="field"><label>当前密码</label><input class="input" type="password" id="oldPw" autocomplete="current-password"></div>
          <div class="field"><label>新密码（至少 6 位）</label><input class="input" type="password" id="newPw" autocomplete="new-password"></div>
          <button class="btn block" id="changePw">修改密码</button>

          <div class="divider"></div>
          <h3 class="card-title mb-3">推送通道授权</h3>
          <div class="row gap-2 wrap">
            <button class="btn sm" id="pushWeb">开启浏览器通知</button>
            <button class="btn sm" id="pushWechat">登记微信订阅消息</button>
            <button class="btn sm" id="pushApp">登记 App 推送</button>
          </div>
          <div class="hint" id="pushHint">授权状态将在上方登记后生效。</div>
        </div>

        <div class="card">
          <h3 class="card-title mb-3">数据导出与分享（F8）</h3>
          <div class="row gap-2 wrap">
            <button class="btn sm" data-export="report">日报 CSV</button>
            <button class="btn sm" data-export="svgg">分享长图</button>
            <button class="btn sm" data-export="print">PDF（打印）</button>
            <button class="btn sm" data-export="watch">关注列表 CSV</button>
          </div>
          ${!perms.export ? `<div class="notice warn mt-3"><span>⚠</span>
            <span>当前角色「${U.esc(user.roleLabel)}」暂无导出权限。导出功能面向教研师生、政府监测人员与管理员开放。</span></div>` : ''}
          <div class="hint mt-3">
            导出文件包含数据日期、覆盖市场数、记录条数与采集批次号，可直接用于教学案例、研究数据或汇报材料。
          </div>
        </div>

        <div class="card">
          <h3 class="card-title mb-3">历史对比分析（F11）</h3>
          <p class="small muted">选择多个品种，对比其历史价格走势与区间涨跌幅，用于价格传导、季节性分析等研究。</p>
          <button class="btn primary mt-3" id="meCompare">开始对比</button>
        </div>

        <div class="card">
          <h3 class="card-title mb-3" style="color:var(--up)">注销账号</h3>
          <p class="small muted">注销后账号进入软删除状态，关注与订阅将解绑，登录状态立即失效。数据归属按平台隐私政策处理。</p>
          <button class="btn danger mt-3" id="deactivateBtn">申请注销账号</button>
        </div>
      </div>`);

    // 事件
    document.getElementById('logoutBtn').onclick = async () => {
      await api.logoutApi(LS.get(KEYS.refresh, null));
      Auth.logout(); toast('已退出登录'); go('#/market'); render();
    };
    document.getElementById('saveProfile').onclick = async () => {
      try {
        const u = await api.updateProfile({
          nickname: val('pNick'), org: val('pOrg'),
          pushEnabled: document.getElementById('pPush').checked,
          theme: Theme.current,
        });
        Auth.setUser(u); toast('设置已保存并同步到云端'); render();
      } catch (e) { toast(e.message, 'err'); }
    };
    document.querySelectorAll('#themeSwatch button').forEach((b) => {
      b.onclick = () => {
        Theme.apply(b.dataset.theme);
        document.querySelectorAll('#themeSwatch button').forEach((x) => x.classList.toggle('on', x === b));
        api.updateProfile({ theme: b.dataset.theme }).then((u) => Auth.setUser(u)).catch(() => { });
        toast(`已切换为「${Theme.labels[b.dataset.theme]}」主题`);
      };
    });
    document.getElementById('changePw').onclick = async () => {
      try {
        await api.changePassword({ oldPassword: val('oldPw'), newPassword: val('newPw') });
        toast('密码修改成功'); document.getElementById('oldPw').value = ''; document.getElementById('newPw').value = '';
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('pushWeb').onclick = async () => {
      if (!('Notification' in window)) return toast('当前浏览器不支持通知', 'warn');
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          await api.subscribePush({ channel: 'web_push', endpoint: 'web:' + navigator.userAgent.slice(0, 120) });
          document.getElementById('pushHint').textContent = '浏览器通知已授权并登记。';
          toast('浏览器通知已开启');
        } else {
          document.getElementById('pushHint').textContent = '浏览器通知被拒绝，可在浏览器设置中重新授权。';
          toast('通知授权被拒绝', 'warn');
        }
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('pushWechat').onclick = async () => {
      try {
        await api.subscribePush({ channel: 'wechat_push', endpoint: 'miniprogram:demo' });
        document.getElementById('pushHint').textContent = '微信订阅消息已登记。实际推送需在小程序内调用 wx.requestSubscribeMessage 由用户确认授权。';
        toast('已登记微信订阅消息');
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('pushApp').onclick = async () => {
      try {
        await api.subscribePush({ channel: 'app_push', endpoint: 'app:demo-device' });
        document.getElementById('pushHint').textContent = 'App 推送已登记。移动端将通过 APNs / FCM 与厂商通道下发。';
        toast('已登记 App 推送');
      } catch (e) { toast(e.message, 'err'); }
    };
    document.querySelectorAll('[data-export]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.export;
        if (k === 'svgg') doExport('svg', { top: 15 });
        else if (k === 'print') openPrint(null);
        else doExport(k, {});
      };
    });
    const mc = document.getElementById('meCompare'); if (mc) mc.onclick = openComparePicker;
    const meR = document.getElementById('meReadAll');
    if (meR) meR.onclick = async () => { await api.readAlerts([]); toast('已全部标为已读'); renderMe(); };
    const db = document.getElementById('deactivateBtn');
    if (db) db.onclick = openDeactivate;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  F6 品种详情页
  // ═══════════════════════════════════════════════════════════════════════
  async function renderSpecies() {
    const name = S.route.params.name;
    const province = S.route.query.province || null;
    const days = Number(S.route.query.days || 30);

    setPage(`<div class="page-head">
      <div><a class="btn sm" href="#/market">← 返回列表</a></div>
    </div><div id="spBody">${U.skeletonTable(8)}</div>`);

    const d = await api.speciesDetail(name, { province, days });
    const isWatched = isWatchedNow(d.species, province);

    document.getElementById('spBody').innerHTML = `
      <div class="card lg mb-4">
        <div class="row between center wrap gap-4">
          <div>
            <div class="row center gap-3 wrap">
              <h2 class="page-title" style="font-size:26px">${U.esc(d.species)}</h2>
              ${U.tierBadge(d.price.tier)}
              <span class="badge gray">${U.esc(d.category)} / ${U.esc(d.subCategory)}</span>
            </div>
            <div class="small muted mt-2">
              别名：${(d.alias || []).map((a) => U.esc(a)).join('、') || '—'}　·　拼音：<span class="mono">${U.esc(d.pinyin)}</span>　·　代表规格：${U.esc(d.spec)}
            </div>
            <div class="tiny faint mt-1">口径：${U.esc(d.province)}　·　数据日期 ${U.dateFull(d.date)}</div>
          </div>
          <div class="row gap-2">
            <button class="btn ${isWatched ? '' : 'primary'}" id="spWatch">
              ${isWatched ? '★ 已关注' : '+ 关注该品种'}</button>
            <button class="btn" id="spAlert">设置异动提醒</button>
            <button class="btn" onclick="location.hash='#/compare?species=${encodeURIComponent(d.species)}'">历史对比</button>
          </div>
        </div>

        <div class="divider"></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          <div>
            <div class="tiny faint">当日均价</div>
            <div class="price-wrap mt-2"><span class="price lg">${U.num(d.price.avg)}</span><span class="price-unit">元/公斤</span></div>
            <div class="mt-2">${U.delta(d.price.changePct)} <span class="tiny faint">较前日 ${U.num(d.price.prev)}</span></div>
          </div>
          ${U.stat({ label: '当日最低价', value: U.num(d.price.min), unit: '元/公斤' })}
          ${U.stat({ label: '当日最高价', value: U.num(d.price.max), unit: '元/公斤' })}
          ${U.stat({ label: '覆盖省份', value: d.coverage.provinceCount, unit: '个' })}
          ${U.stat({ label: '覆盖市场', value: d.coverage.marketCount, unit: '家' })}
          ${U.stat({ label: '记录条数', value: U.int(d.coverage.recordCount), sub: '当日' })}
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-head">
          <h3 class="card-title">历史价格走势</h3>
          <div class="chips">
            ${[7, 30, 90, 180, 365].map((n) => `<span class="chip ${days === n ? 'active' : ''}" data-days="${n}">近 ${n} 天</span>`).join('')}
          </div>
        </div>
        ${U.lineChart(d.history.map((h) => ({ date: h.date, price: h.avg })), { height: 240, color: 'var(--brand-2)', unit: '元/公斤' })}
        <div class="row gap-6 mt-3 tiny faint">
          <span>区间均价 <b class="mono">${U.num(d.history.length ? d.history.reduce((a, b) => a + b.avg, 0) / d.history.length : null)}</b></span>
          <span>区间最低 <b class="mono">${U.num(d.history.length ? Math.min(...d.history.map((h) => h.avg)) : null)}</b></span>
          <span>区间最高 <b class="mono">${U.num(d.history.length ? Math.max(...d.history.map((h) => h.avg)) : null)}</b></span>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--s-4)">
        <div class="card">
          <div class="card-head"><h3 class="card-title">分省价格（当日）</h3>
            <span class="tiny faint">按价格降序</span></div>
          <div class="table-wrap" style="max-height:340px;overflow-y:auto">
            <table class="data compact"><thead><tr><th>省份</th><th class="right">均价</th><th class="right">市场数</th><th>档位</th></tr></thead>
            <tbody>${d.provinces.map((p) => `<tr>
              <td>${U.esc(p.name)}</td><td class="right mono bold">${U.num(p.avgPrice)}</td>
              <td class="right mono">${p.marketCount}</td><td>${U.tierBadge(p.tier, { outline: true })}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">可信度与可审计信息（F6）</h3></div>
          <div class="table-wrap"><table class="data compact">
            <tbody>
              <tr><td class="faint" style="width:104px">数据来源</td><td>${U.esc(d.source.name)}</td></tr>
              <tr><td class="faint">来源链接</td><td><a href="${U.esc(d.source.url)}" target="_blank" rel="noopener" class="tiny">${U.esc(d.source.url)}</a></td></tr>
              <tr><td class="faint">采集批次号</td><td class="mono tiny">${U.esc(d.source.batchNo || '—')}</td></tr>
              <tr><td class="faint">采集时间</td><td class="mono tiny">${U.dtText(d.coverage.collectedAt)}</td></tr>
              <tr><td class="faint">计价单位</td><td>${U.esc(d.unit)}（约 ${U.num(d.price.avg / 2)} 元/斤）</td></tr>
              <tr><td class="faint">代表规格</td><td>${U.esc(d.spec)}</td></tr>
              <tr><td class="faint">更新时效</td><td>T+0 当日发布</td></tr>
            </tbody></table></div>
          <div class="notice mt-3"><span>✓</span>
            <span>每条报价均保留来源 URL 与采集批次号，可用于复现与审计，满足科研与政府场景的数据可信要求。</span></div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-head"><h3 class="card-title">市场报价明细</h3>
          <span class="tiny faint">最多展示 50 条 · 按价格降序</span></div>
        <div class="table-wrap" style="max-height:420px;overflow:auto">
          <table class="data compact"><thead><tr>
            <th>省份</th><th>批发市场</th><th class="right">价格</th><th>规格</th><th>单位</th>
            <th>采集批次号</th><th>采集时间</th><th>来源</th></tr></thead>
          <tbody>${d.quotes.map((q) => `<tr>
            <td>${U.esc(q.province)}</td><td class="small">${U.esc(q.market)}</td>
            <td class="right mono bold">${U.num(q.price)}</td>
            <td class="tiny">${U.esc(q.spec || '—')}</td><td class="tiny">${U.esc(q.unit)}</td>
            <td class="mono tiny">${U.esc(q.batchNo || '—')}</td><td class="mono tiny">${U.dtText(q.collectedAt)}</td>
            <td><a href="${U.esc(q.sourceUrl)}" target="_blank" rel="noopener" class="tiny">pfsc ↗</a></td></tr>`).join('')}
          </tbody></table>
        </div>
        ${permsCanExport() ? `<div class="row gap-2 mt-3">
          <button class="btn sm" id="spExport">导出该品种明细 CSV</button></div>` : ''}
      </div>`;

    // 事件
    document.querySelectorAll('[data-days]').forEach((c) => {
      c.onclick = () => { location.hash = `#/species/${encodeURIComponent(d.species)}?days=${c.dataset.days}${province ? `&province=${encodeURIComponent(province)}` : ''}`; };
    });
    document.getElementById('spWatch').onclick = async () => {
      if (!Auth.isLoggedIn) {
        LocalWatch.has(d.species, province) ? LocalWatch.remove(d.species, province) : LocalWatch.add(d.species, province);
        toast(LocalWatch.has(d.species, province) ? '已关注（本机保存）' : '已取消关注');
        return renderSpecies();
      }
      try {
        const w = (S.watches && S.watches.items || []).find((x) => x.species === d.species && (x.province || null) === (province || null));
        if (w) await api.removeWatch(w.id); else await api.addWatch({ species: d.species, province, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'web_push' });
        S.watches = await api.watches();
        toast(isWatchedNow(d.species, province) ? '已关注' : '已取消关注');
        renderSpecies();
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('spAlert').onclick = () => {
      if (!Auth.isLoggedIn) return toast('请先登录以设置异动提醒', 'warn'), void (location.hash = '#/login');
      openWatchDialog({ species: d.species, thresholdUp: 5, thresholdDown: -5, notifyChannel: 'web_push' });
    };
    const se = document.getElementById('spExport');
    if (se) se.onclick = () => doExport('species', { species: d.species, province: province || '', days });
  }

  const permsCanExport = () => {
    const u = Auth.user;
    return !!(u && u.permissions && u.permissions.export);
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  F11 历史对比
  // ═══════════════════════════════════════════════════════════════════════
  async function renderCompare() {
    const preset = (S.route.query.species || '').split(',').filter(Boolean);
    setPage(`<div class="page-head">
      <div><h2 class="page-title">历史趋势对比</h2>
        <p class="page-sub">选择最多 6 个品种，对比历史价格走势与区间涨跌幅</p></div>
      <a class="btn sm" href="#/market">← 返回行情</a>
    </div>
    <div class="card mb-4">
      <div class="field"><label>品种（可多选，最多 6 个）</label>
        <div class="chips" id="cmpChips">
          ${(S.meta.species || []).map((s) => `<span class="chip ${preset.includes(s.name) ? 'active' : ''}" data-cmp="${U.esc(s.name)}">${U.esc(s.name)}</span>`).join('')}
        </div>
      </div>
      <div class="row gap-3 items-center wrap">
        <div class="field" style="margin-bottom:0"><label>区间</label>
          <select class="input" id="cmpDays">
            <option value="30">近 30 天</option><option value="90" selected>近 90 天</option>
            <option value="180">近 180 天</option><option value="365">近 365 天</option>
          </select></div>
        <div class="field" style="margin-bottom:0"><label>地区</label>
          <select class="input" id="cmpProv"><option value="">全国</option>
            ${(S.meta.provinces || []).map((p) => `<option value="${U.esc(p.name)}">${U.esc(p.short)}</option>`).join('')}
          </select></div>
        <button class="btn primary" id="cmpRun" style="align-self:flex-end">开始对比</button>
      </div>
    </div>
    <div id="cmpBody">${preset.length ? U.skeletonTable(6) : U.empty({ title: '请选择品种', desc: '在上方选择 1–6 个品种后点击「开始对比」' })}</div>`);

    const sel = new Set(preset);
    document.querySelectorAll('#cmpChips .chip').forEach((c) => {
      c.onclick = () => {
        const n = c.dataset.cmp;
        if (sel.has(n)) { sel.delete(n); c.classList.remove('active'); }
        else if (sel.size < 6) { sel.add(n); c.classList.add('active'); }
        else toast('最多选择 6 个品种', 'warn');
      };
    });
    document.getElementById('cmpRun').onclick = () => runCompare([...sel]);

    if (preset.length) runCompare(preset);
  }

  async function runCompare(list) {
    const host = document.getElementById('cmpBody');
    if (!list.length) { host.innerHTML = U.empty({ title: '请选择品种' }); return; }
    host.innerHTML = U.skeletonTable(6);
    const days = Number(val('cmpDays') || 90);
    const province = val('cmpProv') || null;
    try {
      const d = await api.compare(list, { days, province });
      host.innerHTML = `
        <div class="card">
          <div class="card-head"><h3 class="card-title">区间走势对比</h3>
            <span class="tiny faint">${U.dateFull(d.from)} — ${U.dateFull(d.date)} · ${U.esc(d.province)}</span></div>
          ${U.multiLine(d.series, { height: 280 })}
        </div>
        <div class="card mt-4">
          <div class="card-head"><h3 class="card-title">区间统计</h3></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>品种</th><th class="right">区间起价</th><th class="right">区间终价</th>
              <th class="right">区间涨跌</th><th class="right">区间最低</th><th class="right">区间最高</th><th class="right">振幅</th></tr></thead>
            <tbody>${d.series.map((s) => `<tr>
              <td class="bold">${U.esc(s.species)}</td>
              <td class="right mono">${U.num(s.base)}</td>
              <td class="right mono bold">${U.num(s.last)}</td>
              <td class="right">${U.delta(s.changePct)}</td>
              <td class="right mono">${U.num(s.min)}</td>
              <td class="right mono">${U.num(s.max)}</td>
              <td class="right mono">${s.min ? U.num(((s.max - s.min) / s.min) * 100) + '%' : '—'}</td>
            </tr>`).join('')}</tbody>
          </table></div>
          <div class="tbl-note">对比基于全国（或所选省份）当日各市场均价的日均值。区间振幅 =（区间最高 − 区间最低）/ 区间最低，可用于刻画价格波动剧烈程度。</div>
        </div>`;
      U.bindChartTips(host);
    } catch (e) {
      host.innerHTML = U.empty({ title: '对比失败', desc: U.esc(e.message) });
    }
  }

  function openComparePicker() { go('#/compare'); }

  // ═══════════════════════════════════════════════════════════════════════
  //  弹层：设置关注阈值 / 申报品种 / 注销 / 打印
  // ═══════════════════════════════════════════════════════════════════════
  function modal(html, { wide = false, onMount } = {}) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.onclick = (e) => { if (e.target === mask) close(); };
    const c = mask.querySelector('#mClose'); if (c) c.onclick = close;
    mask.querySelectorAll('[data-close]').forEach((b) => b.onclick = close);
    if (onMount) onMount(mask, close);
    return { mask, close };
  }

  function openWatchDialog(item, presetProvince = null) {
    const species = item ? item.species : null;
    const all = (S.meta.species || []).map((s) => s.name);
    const provs = (S.meta.provinces || []).map((p) => p.name);
    modal(`
      <div class="modal-head"><h3>${item ? '设置提醒阈值' : '新增关注'}</h3>
        <button class="modal-close" id="mClose">×</button></div>
      <div class="field"><label>品种</label>
        ${species ? `<input class="input" value="${U.esc(species)}" disabled>` :
        `<select class="input" id="wSpecies">${all.map((s) => `<option>${U.esc(s)}</option>`).join('')}</select>`}</div>
      <div class="field"><label>地区维度（可选，留空为全国）</label>
        <select class="input" id="wProv"><option value="">全国</option>
          ${provs.map((p) => `<option ${(presetProvince === p || (item && item.province === p)) ? 'selected' : ''}>${U.esc(p)}</option>`).join('')}</select></div>
      <div class="row gap-3">
        <div class="field grow"><label>涨阈值（%）</label>
          <input class="input num" type="number" step="0.5" id="wUp" value="${item && item.thresholdUp !== '' && item.thresholdUp != null ? item.thresholdUp : 5}"></div>
        <div class="field grow"><label>跌阈值（%）</label>
          <input class="input num" type="number" step="0.5" id="wDown" value="${item && item.thresholdDown !== '' && item.thresholdDown != null ? item.thresholdDown : -5}"></div>
      </div>
      <div class="field"><label>推送通道</label>
        <select class="input" id="wChannel">
          <option value="web_push" ${item && item.notifyChannel === 'web_push' ? 'selected' : ''}>浏览器通知（Web / H5）</option>
          <option value="wechat_push" ${item && item.notifyChannel === 'wechat_push' ? 'selected' : ''}>微信订阅消息（小程序）</option>
          <option value="app_push" ${item && item.notifyChannel === 'app_push' ? 'selected' : ''}>系统推送（App）</option>
          <option value="inbox" ${item && item.notifyChannel === 'inbox' ? 'selected' : ''}>仅站内消息</option>
        </select>
        <div class="hint">阈值基于「该品种（或指定省份）当日均价较前一日」的涨跌幅触发。默认 ±5%。</div></div>
      <div class="row gap-2 mt-4">
        <button class="btn primary block" id="wSave">保存</button>
        <button class="btn" data-close>取消</button>
      </div>`, {
      onMount(mask, close) {
        mask.querySelector('#wSave').onclick = async () => {
          const sp = species || mask.querySelector('#wSpecies').value;
          const pv = mask.querySelector('#wProv').value || null;
          const up = Number(mask.querySelector('#wUp').value);
          const down = Number(mask.querySelector('#wDown').value);
          const ch = mask.querySelector('#wChannel').value;
          try {
            await api.addWatch({ species: sp, province: pv, thresholdUp: up, thresholdDown: down, notifyChannel: ch });
            toast('已保存关注与提醒设置');
            close();
            S.watches = await api.watches();
            if (S.route.name === 'watch') renderWatch(); else render();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function openSpeciesReport() {
    modal(`
      <div class="modal-head"><h3>申报新品种</h3><button class="modal-close" id="mClose">×</button></div>
      <p class="small muted">未找到需要的品种？提交申报后我们会在 3 个工作日内评估并决定是否纳入采集范围。</p>
      <div class="field mt-3"><label>品种名称 *</label><input class="input" id="rName" placeholder="如 鳜鱼 / 河豚"></div>
      <div class="field"><label>所在地区</label><input class="input" id="rProv" placeholder="如 江苏省南京市"></div>
      <div class="field"><label>联系方式（可选）</label><input class="input" id="rContact" placeholder="邮箱或手机号，便于反馈结果"></div>
      <div class="field"><label>说明（可选）</label><textarea class="input" id="rRemark" rows="3" placeholder="该品种的主要产地、交易市场、常见规格等"></textarea></div>
      <div class="row gap-2 mt-4">
        <button class="btn primary block" id="rSubmit">提交申报</button>
        <button class="btn" data-close>取消</button>
      </div>`, {
      onMount(mask, close) {
        mask.querySelector('#rSubmit').onclick = async () => {
          const name = mask.querySelector('#rName').value.trim();
          if (!name) return toast('请填写品种名称', 'warn');
          try {
            const r = await api.reportSpecies({
              name, province: mask.querySelector('#rProv').value,
              contact: mask.querySelector('#rContact').value,
              remark: mask.querySelector('#rRemark').value,
            });
            toast(r.message || '申报已提交');
            close();
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function openDeactivate() {
    modal(`
      <div class="modal-head"><h3 style="color:var(--up)">申请注销账号</h3><button class="modal-close" id="mClose">×</button></div>
      <div class="notice err"><span>⚠</span>
        <span>注销后：账号将进入软删除状态并无法登录；全部关注品种与订阅关系将被解绑；推送授权将停用。此操作不可自助恢复。</span></div>
      <div class="field mt-4"><label>请输入登录密码以确认</label>
        <input class="input" type="password" id="dPw" autocomplete="current-password"></div>
      <div class="field"><label>注销原因（可选）</label>
        <textarea class="input" id="dReason" rows="2" placeholder="帮助我们改进，例如：不再需要价格监测"></textarea></div>
      <div class="row gap-2 mt-4">
        <button class="btn danger block" id="dConfirm">确认注销</button>
        <button class="btn" data-close>取消</button>
      </div>`, {
      onMount(mask, close) {
        mask.querySelector('#dConfirm').onclick = async () => {
          try {
            const r = await api.deactivate({ password: mask.querySelector('#dPw').value, reason: mask.querySelector('#dReason').value });
            toast(`账号已注销，解绑关注 ${r.unbindWatches} 条`);
            Auth.logout(); close(); go('#/market');
          } catch (e) { toast(e.message, 'err'); }
        };
      },
    });
  }

  function openPrint(rep) {
    const url = api.exportUrl('print', { date: rep ? rep.date : '', dimension: S.reportDimension });
    const w = window.open(url, '_blank');
    if (!w) return toast('浏览器拦截了新窗口，请允许弹出窗口后重试', 'warn');
    toast('已打开打印页，按 Ctrl/Cmd + P 可另存为 PDF');
  }

  // ── 消息抽屉 ──────────────────────────────────────────────────────────
  async function openAlertsDrawer() {
    const mask = document.createElement('div');
    mask.className = 'drawer-mask';
    const d = document.createElement('div');
    d.className = 'drawer';
    d.innerHTML = `<div class="drawer-head"><h3 style="margin:0;font-size:17px">消息提醒</h3>
        <button class="modal-close" id="dClose">×</button></div>
      <div class="drawer-body" id="dBody">${U.skeletonTable(6)}</div>`;
    document.body.append(mask, d);
    const close = () => { mask.remove(); d.remove(); };
    mask.onclick = close;
    d.querySelector('#dClose').onclick = close;

    let alerts;
    try { alerts = await api.alerts({ limit: 50 }); }
    catch { d.querySelector('#dBody').innerHTML = U.empty({ title: '请先登录', desc: '登录后可查看价格异动提醒记录。' }); return; }

    d.querySelector('#dBody').innerHTML = alerts.items.length
      ? `<div class="row between center mb-3">
           <span class="small muted">共 ${alerts.items.length} 条，未读 ${alerts.unread} 条</span>
           <button class="btn sm ghost" id="dReadAll">全部已读</button></div>
         ${alerts.items.map((a) => `<div class="card tight mb-2" style="${a.isRead ? 'opacity:.6' : ''}">
           <div class="row between center">
             <span class="badge ${a.direction === 'up' ? 'up' : 'down'}">${a.direction === 'up' ? '▲ 涨' : '▼ 跌'} ${U.num(Math.abs(a.changePct))}%</span>
             <span class="tiny faint">${U.dateFull(a.date)}</span>
           </div>
           <div class="small bold mt-2">${U.esc(a.title || a.species)}</div>
           <div class="tiny muted mt-1">${U.esc(a.content || '')}</div>
           <div class="tiny faint mt-1">通道：${notifyLabel(a.channel || 'inbox')}　·　${a.pushed ? '已推送' : '未推送'}</div>
         </div>`).join('')}`
      : U.empty({ title: '暂无提醒', desc: '当关注的品种触发阈值时会在此显示。' });

    const ra = d.querySelector('#dReadAll');
    if (ra) ra.onclick = async () => { await api.readAlerts([]); toast('已全部标为已读'); close(); render(); };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════════
  async function doExport(kind, query) {
    if (!permsCanExport()) {
      toast('当前角色无导出权限（教研 / 政府 / 管理员可导出）', 'warn', 3400);
      return;
    }
    try {
      if (kind === 'svgg' || kind === 'svg') { openPrint(null); }
      const { blob, filename } = await api.download(kind === 'svgg' ? 'svg' : kind, query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast(`已导出：${filename}`);
    } catch (e) {
      if (e.exportForbidden) toast('当前角色无导出权限（教研 / 政府 / 管理员可导出）', 'warn', 3400);
      else toast(e.message || '导出失败', 'err');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  F13 认证页面（登录 / 注册 / 找回 / 重置 / 验证）
  // ═══════════════════════════════════════════════════════════════════════
  function renderAuth() {
    const r = S.route;
    const q = r.query || {};
    const shell = (title, sub, body) => `
      <header class="app-header"><div class="inner">
        <a class="logo" href="#/market">${ICONS.fish}<span>鱼价查</span></a>
        <div class="grow"></div>
        <a class="btn sm ghost" href="#/market" style="color:rgba(255,255,255,.9)">← 返回站点</a>
      </div></header>
      <div class="page" style="max-width:520px">
        <div class="card lg">
          <h2 class="page-title mb-2" style="font-size:22px">${title}</h2>
          <p class="page-sub mb-6">${sub}</p>
          ${body}
        </div>
        <div class="center mt-4 tiny faint">
          ${r.name === 'login' ? `还没有账号？<a href="#/register">注册新账号</a>` : ''}
          ${r.name === 'register' ? `已有账号？<a href="#/login">前往登录</a>` : ''}
          ${r.name === 'forgot' ? `<a href="#/login">← 返回登录</a>` : ''}
        </div>
      </div>${footHtml()}`;

    app().innerHTML = (() => {
      if (r.name === 'login') {
        return shell('登录 鱼价查', '登录后关注品种云端同步、接收价格异动提醒，教研 / 政府 / 管理员可导出数据。', `
          <div class="field"><label>邮箱</label><input class="input" id="lEmail" type="email" placeholder="you@example.com" autocomplete="username"></div>
          <div class="field"><label>密码</label><input class="input" id="lPw" type="password" placeholder="请输入密码" autocomplete="current-password"></div>
          <div class="row between center mb-4">
            <label class="row center gap-2 small" style="cursor:pointer"><input type="checkbox" id="lRemember" checked><span>保持登录</span></label>
            <a class="small" href="#/forgot">忘记密码？</a>
          </div>
          <button class="btn primary block lg" id="lSubmit">登录</button>
          <div class="divider"></div>
          <div class="tiny faint mb-2">快速体验演示账号：</div>
          <div class="chips">
            ${[['admin@yujiacha.local', 'Admin@2026', '管理员'],
            ['teacher@shou.edu.cn', 'Demo@2026', '教研'],
            ['gov@agri.local', 'Demo@2026', '政府'],
            ['farmer@yujiacha.local', 'Demo@2026', '普通用户']]
            .map(([e, p, n]) => `<span class="chip" data-fill="${e}|${p}">${n}</span>`).join('')}
          </div>`);
      }
      if (r.name === 'register') {
        return shell('注册新账号', '注册需邮箱验证激活。请选择与您身份相符的角色，不同角色的数据权限不同。', `
          <div class="field"><label>邮箱 *</label><input class="input" id="rEmail" type="email" placeholder="you@example.com"></div>
          <div class="field"><label>密码 *（至少 6 位）</label><input class="input" id="rPw" type="password" autocomplete="new-password"></div>
          <div class="field"><label>确认密码 *</label><input class="input" id="rPw2" type="password" autocomplete="new-password"></div>
          <div class="field"><label>称呼</label><input class="input" id="rNick" placeholder="如 老张 / 李老师"></div>
          <div class="field"><label>角色</label>
            <select class="input" id="rRole">
              <option value="user">普通用户（养殖户 / 消费者 / 批发商）</option>
              <option value="researcher">教研师生（可导出数据）</option>
              <option value="gov">政府监测人员（可导出数据）</option>
            </select></div>
          <div class="field"><label>所属机构（教研 / 政府用户填写）</label><input class="input" id="rOrg" placeholder="如 上海海洋大学 水产与生命学院"></div>
          <button class="btn primary block lg" id="rSubmit">注册并发送验证邮件</button>
          <div class="hint">注册即表示同意平台的数据使用与隐私政策。密码使用加盐哈希存储，平台不保存明文密码。</div>`);
      }
      if (r.name === 'forgot') {
        return shell('找回密码', '输入注册邮箱，我们会发送一封包含重置链接的邮件，链接 2 小时内有效。', `
          <div class="field"><label>注册邮箱</label><input class="input" id="fEmail" type="email" placeholder="you@example.com"></div>
          <button class="btn primary block lg" id="fSubmit">发送重置邮件</button>
          <div id="fResult" class="mt-4"></div>`);
      }
      if (r.name === 'reset') {
        return shell('重置密码', '请设置一个新密码。重置成功后，所有设备的登录状态将失效，需重新登录。', `
          <div class="field"><label>新密码（至少 6 位）</label><input class="input" id="rpPw" type="password" autocomplete="new-password"></div>
          <div class="field"><label>确认新密码</label><input class="input" id="rpPw2" type="password" autocomplete="new-password"></div>
          <button class="btn primary block lg" id="rpSubmit">确认重置</button>
          <div id="rpResult" class="mt-4"></div>`);
      }
      // verify
      return shell('邮箱验证', '正在验证您的邮箱 …', `<div id="vResult">${U.skeletonTable(2)}</div>`);
    })();

    const foot = app().querySelector('.app-foot');
    if (foot) foot.remove();

    // 绑定
    const loginBtn = document.getElementById('lSubmit');
    if (loginBtn) {
      document.querySelectorAll('[data-fill]').forEach((c) => {
        c.onclick = () => {
          const [e, p] = c.dataset.fill.split('|');
          document.getElementById('lEmail').value = e;
          document.getElementById('lPw').value = p;
        };
      });
      const doLogin = async () => {
        const e = val('lEmail').trim(), p = val('lPw');
        if (!e || !p) return toast('请填写邮箱与密码', 'warn');
        loginBtn.disabled = true; loginBtn.textContent = '登录中 …';
        try {
          const r2 = await api.login({ email: e, password: p });
          Auth.save(r2);
          toast(`欢迎回来，${r2.user.nickname || r2.user.email}`);
          S.watches = null; S.alerts = null;
          go('#/market'); render();
        } catch (err) {
          toast(err.message, 'err');
          loginBtn.disabled = false; loginBtn.textContent = '登录';
        }
      };
      loginBtn.onclick = doLogin;
      app().addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doLogin(); });
    }

    const regBtn = document.getElementById('rSubmit');
    if (regBtn) regBtn.onclick = async () => {
      const e = val('rEmail').trim(), p = val('rPw'), p2 = val('rPw2');
      if (!e || !p) return toast('请填写邮箱与密码', 'warn');
      if (p !== p2) return toast('两次输入的密码不一致', 'warn');
      regBtn.disabled = true; regBtn.textContent = '提交中 …';
      try {
        const res = await api.register({ email: e, password: p, nickname: val('rNick'), role: val('rRole'), org: val('rOrg') });
        modal(`
          <div class="modal-head"><h3>注册成功，请验证邮箱</h3><button class="modal-close" id="mClose">×</button></div>
          <div class="notice"><span>✉</span><span>验证邮件已发送至 <b>${U.esc(res.email)}</b>。点击邮件中的链接即可激活账号。</span></div>
          <div class="field mt-4"><label>验证链接（演示环境直接提供，便于联调）</label>
            <input class="input mono tiny" value="${U.esc(res.verifyLink)}" readonly onclick="this.select()"></div>
          <div class="row gap-2 mt-3">
            <button class="btn primary block" id="goVerify">立即验证并登录</button>
            <button class="btn" data-close>稍后验证</button>
          </div>
          <div class="hint">生产环境该链接仅通过邮件下发，不会在页面上显示。</div>`, {
          onMount(mask, close) {
            mask.querySelector('#goVerify').onclick = async () => {
              try {
                await api.verifyEmail(res.verifyToken);
                toast('邮箱验证成功，请登录');
                close(); go('#/login');
              } catch (err) { toast(err.message, 'err'); }
            };
          },
        });
        regBtn.disabled = false; regBtn.textContent = '注册并发送验证邮件';
      } catch (err) {
        toast(err.message, 'err');
        regBtn.disabled = false; regBtn.textContent = '注册并发送验证邮件';
      }
    };

    const fBtn = document.getElementById('fSubmit');
    if (fBtn) fBtn.onclick = async () => {
      const e = val('fEmail').trim();
      if (!e) return toast('请输入邮箱', 'warn');
      fBtn.disabled = true;
      try {
        const r2 = await api.forgotPassword(e);
        document.getElementById('fResult').innerHTML = `
          <div class="notice"><span>✉</span><span>${U.esc(r2.message)}</span></div>
          ${r2.resetLink ? `<div class="field mt-3"><label>重置链接（演示环境直接提供）</label>
            <input class="input mono tiny" value="${U.esc(r2.resetLink)}" readonly onclick="this.select()"></div>
          <a class="btn primary block mt-2" href="#/reset?token=${encodeURIComponent(r2.resetToken)}">前往重置密码</a>` : ''}`;
      } catch (err) { toast(err.message, 'err'); }
      fBtn.disabled = false;
    };

    const rpBtn = document.getElementById('rpSubmit');
    if (rpBtn) rpBtn.onclick = async () => {
      const p = val('rpPw'), p2 = val('rpPw2');
      if (!p || p.length < 6) return toast('新密码至少 6 位', 'warn');
      if (p !== p2) return toast('两次输入的密码不一致', 'warn');
      if (!q.token) return toast('缺少重置令牌，请从邮件链接进入', 'err');
      rpBtn.disabled = true;
      try {
        const r2 = await api.resetPassword({ token: q.token, password: p });
        toast('密码重置成功，请使用新密码登录');
        setTimeout(() => go('#/login'), 900);
      } catch (err) { toast(err.message, 'err'); rpBtn.disabled = false; }
    };

    if (r.name === 'verify') {
      (async () => {
        const host = document.getElementById('vResult');
        if (!q.token) { host.innerHTML = `<div class="notice err"><span>⚠</span><span>缺少验证令牌，请从邮件链接进入。</span></div>`; return; }
        try {
          const u = await api.verifyEmail(q.token);
          host.innerHTML = `<div class="notice"><span>✓</span><span>邮箱 <b>${U.esc(u.email)}</b> 验证成功，账号已激活。</span></div>
            <a class="btn primary block mt-4" href="#/login">前往登录</a>`;
        } catch (e) {
          host.innerHTML = `<div class="notice err"><span>⚠</span><span>${U.esc(e.message)}</span></div>
            <a class="btn block mt-4" href="#/login">返回登录</a>`;
        }
      })();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  启动
  // ═══════════════════════════════════════════════════════════════════════
  async function boot() {
    Theme.apply(Theme.current);
    try {
      const [meta, cfg] = await Promise.all([api.meta(), api.publicConfig().catch(() => null)]);
      S.meta = meta; S.config = cfg; S.status = meta.status;
    } catch (e) {
      app().innerHTML = `<div class="page" style="max-width:640px;padding-top:80px">
        ${U.empty({
        title: '无法连接后端服务', kind: 'map',
        desc: `请确认后端已启动。当前尝试地址：<code class="mono">${U.esc(api.API_BASE || location.origin)}</code><br>
              启动命令：<code class="mono">cd yujiacha/server &amp;&amp; npm start</code><br>错误信息：${U.esc(e.message)}`,
        action: `<button class="btn primary" onclick="location.reload()">重试</button>`,
      })}</div>`;
      return;
    }
    // 后台预取关注/提醒（用于角标）
    if (Auth.isLoggedIn) {
      api.alerts({ limit: 20 }).then((a) => { S.alerts = a; render(); }).catch(() => { });
      api.watches().then((w) => { S.watches = w; render(); }).catch(() => { });
    }
    render();
  }

  // 离线状态提示（F10）
  window.addEventListener('online', () => { S.offline = false; toast('网络已恢复'); });
  window.addEventListener('offline', () => { S.offline = true; toast('网络已断开，将展示缓存数据', 'warn'); });

  boot();
})();
