/* ============================================================================
   鱼价查 · 管理后台（F14）
   登录 / 数据概览 / 用户管理 / 价格数据（日报·品种·趋势·修正）/ 关注阈值与推送
   配置 / 品种申报 / 审计日志 / 系统设置
   ============================================================================ */
(function () {
  'use strict';
  const { api, Auth, LS, KEYS, Theme, toast } = YJT;
  const U = YJT;

  const MENU = [
    { id: 'dashboard', label: '数据概览', icon: '📊' },
    { grp: '业务运营' },
    { id: 'users', label: '用户管理', icon: '👥' },
    { id: 'prices', label: '价格数据', icon: '💴' },
    { id: 'snapshots', label: '日报与采集', icon: '📅' },
    { id: 'requests', label: '品种申报', icon: '📝', badgeKey: 'requestPending' },
    { grp: '触达配置' },
    { id: 'watch', label: '关注阈值', icon: '⭐' },
    { id: 'push', label: '推送配置', icon: '🔔' },
    { grp: '治理' },
    { id: 'audit', label: '审计日志', icon: '📜' },
    { id: 'config', label: '系统设置', icon: '⚙️' },
  ];

  const S = {
    route: 'dashboard',
    dash: null,
    meta: null,
    users: null, usersQ: { keyword: '', status: '', role: '', page: 1 },
    prices: null, pricesQ: { province: '', species: '', category: '', page: 1 },
    audits: null, auditsQ: { action: '', keyword: '', page: 1 },
    watches: null, watchesQ: { keyword: '', page: 1 },
    requests: null, requestsQ: { status: '', page: 1 },
    snaps: null, cfg: null, push: null,
  };

  const app = () => document.getElementById('app');
  const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };

  // ── 登录页 ────────────────────────────────────────────────────────────
  function renderLogin(err = '') {
    app().innerHTML = `<div class="login-wrap"><div class="login-card">
      <div style="text-align:center;margin-bottom:18px">
        <svg width="46" height="46" viewBox="0 0 32 32" style="margin:0 auto">
          <path d="M4 16c4-6 11-8 17-4l6-4-2 8 2 8-6-4c-6 4-13 2-17-4z" fill="#0A9396"/>
          <circle cx="11" cy="14" r="1.9" fill="#fff"/></svg>
      </div>
      <h1>鱼价查 · 管理后台</h1>
      <div class="sub">智慧渔业全国水产品价格日报系统　<span class="env-tag">仅管理员可登录</span></div>
      ${err ? `<div class="notice err mb-4"><span>⚠</span><span>${U.esc(err)}</span></div>` : ''}
      <div class="field"><label>管理员邮箱</label>
        <input class="input" id="aEmail" type="email" placeholder="admin@yujiacha.local" value="admin@yujiacha.local"></div>
      <div class="field"><label>密码</label>
        <input class="input" id="aPw" type="password" placeholder="请输入密码" value="Admin@2026"></div>
      <button class="btn primary block lg" id="aLogin">登录管理后台</button>
      <div class="hint mt-3">演示账号：admin@yujiacha.local / Admin@2026　（生产环境请立即更换）</div>
      <div class="divider"></div>
      <a class="btn block" href="/web/">← 返回鱼价查前台</a>
    </div></div>`;

    const doLogin = async () => {
      const b = document.getElementById('aLogin');
      b.disabled = true; b.textContent = '登录中 …';
      try {
        const r = await api.login({ email: val('aEmail'), password: val('aPw') });
        if (r.user.role !== 'admin') {
          renderLogin('该账号不是管理员，无法进入管理后台。请使用前台站点登录。');
          return;
        }
        Auth.save(r);
        boot();
      } catch (e) {
        b.disabled = false; b.textContent = '登录管理后台';
        renderLogin(e.message);
      }
    };
    document.getElementById('aLogin').onclick = doLogin;
    app().addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  }

  // ── 外壳 ──────────────────────────────────────────────────────────────
  function shell(inner) {
    const user = Auth.user;
    const badge = S.dash && S.dash.request ? S.dash.request.pending : 0;
    app().innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <svg width="26" height="26" viewBox="0 0 32 32"><path d="M4 16c4-6 11-8 17-4l6-4-2 8 2 8-6-4c-6 4-13 2-17-4z" fill="#7FE3E8"/><circle cx="11" cy="14" r="1.9" fill="#005F73"/></svg>
          <div><div class="nm">鱼价查</div><div class="sub">管理后台 v1.0.0</div></div>
        </div>
        <nav class="nav">
          ${MENU.map((m) => m.grp ? `<div class="grp">${m.grp}</div>` :
      `<a href="#/${m.id}" class="${S.route === m.id ? 'on' : ''}">
              <span style="width:16px;display:inline-block;text-align:center">${m.icon}</span>
              <span>${m.label}</span>
              ${m.badgeKey && badge ? `<span class="n">${badge}</span>` : ''}
            </a>`).join('')}
        </nav>
        <div class="foot">
          <div>数据源：pfsc.agri.cn</div>
          <div>T+0 当日发布 · 采集批次可审计</div>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <h2 id="topTitle"></h2>
          <div class="grow"></div>
          <div class="tiny faint" id="topMeta"></div>
          <button class="btn sm ghost" id="themeBtn" title="切换主题">${Theme.labels[Theme.current]}</button>
          <a class="btn sm ghost" href="/web/" target="_blank">前台站点 ↗</a>
          <div class="row center gap-2">
            <span class="small">${U.esc(user.nickname || user.email)}</span>
            <span class="badge">管理员</span>
          </div>
          <button class="btn sm" id="logoutBtn">退出</button>
        </div>
        <div class="content" id="content">${inner || ''}</div>
      </div>
    </div>`;

    document.getElementById('logoutBtn').onclick = async () => {
      await api.logoutApi(LS.get(KEYS.refresh, null));
      Auth.logout(); renderLogin();
    };
    document.getElementById('themeBtn').onclick = () => { Theme.cycle(); shell(); route(); };
  }

  function setContent(html, title, meta) {
    const c = document.getElementById('content');
    if (c) c.innerHTML = html;
    const t = document.getElementById('topTitle');
    if (t && title) t.textContent = title;
    const m = document.getElementById('topMeta');
    if (m) m.textContent = meta || '';
  }

  // ── 数据概览 ──────────────────────────────────────────────────────────
  async function pageDashboard() {
    setContent(U.skeletonTable(8), '数据概览');
    S.dash = await api.admin.dashboard();
    const d = S.dash;
    const st = d.status;
    setContent(`
      <div class="page-note">
        <b>数据状态：</b>最新数据日期 <b class="mono">${U.dateFull(st.date)}</b>　·　
        发布状态 <span class="badge ${st.status === 'published' ? 'down' : 'warn'}">${st.status === 'published' ? '已发布（T+0）' : '待发布'}</span>　·　
        采集批次号 <span class="mono">${U.esc(st.batchNo || '—')}</span><br>
        覆盖 <b>${st.marketCount}</b> 家批发市场 / <b>${st.provinceCount}</b> 个省级行政区 / <b>${st.speciesCount}</b> 个品种，
        当日记录 <b>${U.int(st.recordCount)}</b> 条　·　数据库：<span class="mono">${U.esc(d.dbInfo.driver === 'mysql' ? 'MySQL ' + d.dbInfo.database : 'SQLite')}</span>
      </div>

      <div class="kpi-grid mb-6">
        <div class="kpi"><div class="k">用户总数（未注销）</div><div class="v">${U.int(d.users.total)}</div>
          <div class="x">活跃 ${d.users.active} · 待验证 ${d.users.pending}</div></div>
        <div class="kpi ${d.users.disabled ? 'warn' : ''}"><div class="k">禁用账号</div><div class="v">${d.users.disabled}</div>
          <div class="x">已注销（软删除）${d.users.deleted}</div></div>
        <div class="kpi"><div class="k">关注订阅总数</div><div class="v">${U.int(d.watch.total)}</div>
          <div class="x">品种 × 地区 维度</div></div>
        <div class="kpi up"><div class="k">异动告警累计</div><div class="v">${U.int(d.alert.total)}</div>
          <div class="x">未读 ${d.alert.unread} 条</div></div>
        <div class="kpi ${d.request.pending ? 'warn' : ''}"><div class="k">待处理品种申报</div><div class="v">${d.request.pending}</div>
          <div class="x">需运营评估</div></div>
      </div>

      <div class="grid" style="grid-template-columns:1.4fr 1fr;gap:var(--s-4)">
        <div class="card">
          <div class="card-head"><h3 class="card-title">近 14 日采集记录量</h3>
            <span class="tiny faint">每日记录条数 · 覆盖市场数</span></div>
          ${U.lineChart(d.trend.map((t) => ({ date: t.date, price: t.recordCount })), {
      height: 230, color: 'var(--brand-2)', unit: '条', yTicks: 4,
    })}
          <div class="table-wrap mt-3" style="max-height:210px;overflow:auto">
            <table class="data compact"><thead><tr>
              <th>日期</th><th class="right">记录数</th><th class="right">市场数</th><th class="right">品种数</th><th>采集批次号</th></tr></thead>
            <tbody>${[...d.trend].reverse().map((t) => `<tr>
              <td class="mono">${U.dateFull(t.date)}</td>
              <td class="right mono">${U.int(t.recordCount)}</td>
              <td class="right mono">${t.marketCount}</td>
              <td class="right mono">${t.speciesCount}</td>
              <td class="mono tiny">${U.esc(t.batchNo || '—')}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">用户角色分布</h3></div>
          ${U.barRank(d.users.byRole.map((r) => ({
      label: ({ user: '普通用户', researcher: '教研师生', gov: '政府监测', admin: '管理员' }[r.role] || r.role),
      value: r.count, color: 'var(--brand)',
    })), { labelWidth: 76 })}
          <div class="divider"></div>
          <div class="card-head"><h3 class="card-title">快捷操作</h3></div>
          <div class="row gap-2 wrap">
            <button class="btn sm primary" id="qScan">手动触发阈值扫描</button>
            <a class="btn sm" href="#/prices">查看价格数据</a>
            <a class="btn sm" href="#/audit">查看审计日志</a>
            <button class="btn sm" id="qExport">导出日报 CSV</button>
          </div>
          <div class="hint mt-3">阈值扫描会遍历全部有效关注项，检查当日与前一日均价涨跌幅是否触发用户设定阈值，并按通道生成告警。</div>
        </div>
      </div>`);

    document.getElementById('qScan').onclick = async () => {
      try {
        const r = await api.admin.scanAlerts();
        toast(`扫描 ${r.scanned} 条关注，新增 ${r.created} 条告警`);
        pageDashboard();
      } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('qExport').onclick = async () => {
      try {
        const { blob, filename } = await api.download('report', {});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        toast('已导出 ' + filename);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  // ── 用户管理 ──────────────────────────────────────────────────────────
  async function pageUsers() {
    setContent(U.skeletonTable(8), '用户管理');
    S.users = await api.admin.users({ ...S.usersQ, pageSize: 20 });
    const q = S.usersQ;
    setContent(`
      <div class="page-note">
        <b>用户治理：</b>可查看全部注册用户、调整角色权限、禁用异常账号，以及处理已申请注销的账号。
        所有写操作均会写入审计日志。<br>
        <b>角色权限：</b>普通用户可订阅关注但不可导出；教研师生与政府监测人员可导出 CSV / 长图 / PDF；管理员拥有全部权限。
      </div>

      <div class="toolbar">
        <div class="field"><label>关键词</label>
          <input class="input" id="uKw" placeholder="邮箱 / 昵称 / 机构" value="${U.esc(q.keyword)}"></div>
        <div class="field"><label>状态</label>
          <select class="input" id="uStatus">
            <option value="">全部</option>
            ${[['active', '活跃'], ['pending', '待验证'], ['disabled', '已禁用'], ['deleted', '已注销']]
        .map(([v, n]) => `<option value="${v}" ${q.status === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select></div>
        <div class="field"><label>角色</label>
          <select class="input" id="uRole">
            <option value="">全部</option>
            ${[['user', '普通用户'], ['researcher', '教研师生'], ['gov', '政府监测'], ['admin', '管理员']]
        .map(([v, n]) => `<option value="${v}" ${q.role === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select></div>
        <button class="btn primary" id="uApply">查询</button>
        <button class="btn" id="uReset">重置</button>
      </div>

      <div class="card">
        <div class="card-head"><h3 class="card-title">用户列表</h3>
          <span class="tiny faint">共 ${S.users.total} 个用户　·　第 ${S.users.page} 页</span></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th style="width:54px">ID</th><th>用户</th><th>角色</th><th>状态</th>
              <th class="right">关注数</th><th class="right">告警数</th><th>注册时间</th><th>最近登录</th><th style="width:250px">操作</th>
            </tr></thead>
            <tbody>${S.users.items.map((u) => `<tr>
              <td class="mono tiny">${u.id}</td>
              <td><b class="small">${U.esc(u.nickname || '—')}</b>
                <div class="tiny faint">${U.esc(u.email)}</div>
                ${u.org ? `<div class="tiny faint">${U.esc(u.org)}</div>` : ''}</td>
              <td><span class="badge ${u.role === 'admin' ? '' : 'gray'}">${U.esc(u.roleLabel)}</span></td>
              <td>${statusBadge(u.status, u.emailVerified)}</td>
              <td class="right mono">${u.watchCount}</td>
              <td class="right mono">${u.alertCount}</td>
              <td class="mono tiny">${U.dtText(u.createdAt)}</td>
              <td class="mono tiny">${u.lastLoginAt ? U.dtText(u.lastLoginAt) : '—'}</td>
              <td>
                <div class="row gap-1 wrap">
                  ${u.role === 'admin' ? '<span class="tiny faint">管理员账号受保护</span>' : `
                    <select class="input" style="width:106px;padding:4px 7px;font-size:12px" data-role-sel="${u.id}">
                      ${[['user', '普通用户'], ['researcher', '教研师生'], ['gov', '政府监测'], ['admin', '管理员']]
          .map(([v, n]) => `<option value="${v}" ${u.role === v ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                    <button class="btn sm" data-role-set="${u.id}">改角色</button>
                    ${u.status === 'disabled'
          ? `<button class="btn sm" data-enable="${u.id}">启用</button>`
          : `<button class="btn sm danger" data-disable="${u.id}">禁用</button>`}
                    ${u.status === 'deleted' ? `<button class="btn sm danger" data-purge="${u.id}">清除数据</button>` : ''}
                  `}
                </div>
              </td></tr>`).join('')}
            </tbody></table>
        </div>
        <div class="pager">
          <button class="btn sm" id="uPrev" ${S.users.page <= 1 ? 'disabled' : ''}>← 上一页</button>
          <span class="small muted">第 ${S.users.page} / ${Math.max(1, Math.ceil(S.users.total / 20))} 页</span>
          <button class="btn sm" id="uNext" ${S.users.page * 20 >= S.users.total ? 'disabled' : ''}>下一页 →</button>
        </div>
      </div>`);

    const apply = () => {
      S.usersQ.keyword = val('uKw'); S.usersQ.status = val('uStatus');
      S.usersQ.role = val('uRole'); S.usersQ.page = 1; pageUsers();
    };
    document.getElementById('uApply').onclick = apply;
    document.getElementById('uKw').onkeydown = (e) => { if (e.key === 'Enter') apply(); };
    document.getElementById('uReset').onclick = () => {
      S.usersQ = { keyword: '', status: '', role: '', page: 1 }; pageUsers();
    };
    const pv = document.getElementById('uPrev'); if (pv) pv.onclick = () => { S.usersQ.page--; pageUsers(); };
    const nx = document.getElementById('uNext'); if (nx) nx.onclick = () => { S.usersQ.page++; pageUsers(); };

    document.querySelectorAll('[data-role-set]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.roleSet;
        const sel = document.querySelector(`[data-role-sel="${id}"]`);
        try { await api.admin.setUserRole(Number(id), sel.value); toast('角色已更新'); pageUsers(); }
        catch (e) { toast(e.message, 'err'); }
      };
    });
    document.querySelectorAll('[data-disable]').forEach((b) => {
      b.onclick = () => confirmDialog('禁用账号', '禁用后该用户将无法登录，其全部登录令牌立即失效。是否继续？', async () => {
        try { await api.admin.setUserStatus(Number(b.dataset.disable), 'disabled'); toast('已禁用该账号'); pageUsers(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    document.querySelectorAll('[data-enable]').forEach((b) => {
      b.onclick = async () => {
        try { await api.admin.setUserStatus(Number(b.dataset.enable), 'active'); toast('已启用该账号'); pageUsers(); }
        catch (e) { toast(e.message, 'err'); }
      };
    });
    document.querySelectorAll('[data-purge]').forEach((b) => {
      b.onclick = () => confirmDialog('清除账号数据', '将彻底匿名化该账号的邮箱与资料，并删除其关注与令牌记录，仅保留审计痕迹。此操作不可撤销。', async () => {
        try { await api.admin.purgeUser(Number(b.dataset.purge)); toast('账号数据已清除'); pageUsers(); }
        catch (e) { toast(e.message, 'err'); }
      }, true);
    });
  }

  function statusBadge(status, verified) {
    const m = {
      active: ['down', '活跃'], pending: ['warn', '待验证'],
      disabled: ['up', '已禁用'], deleted: ['gray', '已注销'],
    }[status] || ['gray', status];
    return `<span class="badge ${m[0]}">${m[1]}</span>
      ${status === 'active' && !verified ? '<div class="tiny faint">邮箱未验证</div>' : ''}`;
  }

  // ── 价格数据 ──────────────────────────────────────────────────────────
  async function pagePrices() {
    setContent(U.skeletonTable(10), '价格数据');
    const q = S.pricesQ;
    S.prices = await api.admin.prices({ ...q, pageSize: 30 });
    const d = S.prices;

    setContent(`
      <div class="page-note">
        <b>price_daily 明细：</b>展示每日各批发市场各品种的报价记录，字段与自动化采集系统一致（日期 / 地区 / 批发市场 / 大类 / 小类 / 品种 / 价格 / 单位 / 规格 / 来源URL / 采集批次号 / 时间戳）。
        如需修正异常报价，点击「修正」并填写原因，系统会记录变更前后值与操作人。
      </div>

      <div class="toolbar">
        <div class="field"><label>省份</label>
          <select class="input" id="pProv"><option value="">全部</option>
            ${(S.meta.provinces || []).map((p) => `<option value="${U.esc(p.name)}" ${q.province === p.name ? 'selected' : ''}>${U.esc(p.short)}</option>`).join('')}
          </select></div>
        <div class="field"><label>品种</label>
          <select class="input" id="pSp"><option value="">全部</option>
            ${(S.meta.species || []).map((s) => `<option value="${U.esc(s.name)}" ${q.species === s.name ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>大类</label>
          <select class="input" id="pCat"><option value="">全部</option>
            ${(S.meta.categories || []).map((c) => `<option value="${U.esc(c.name)}" ${q.category === c.name ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}
          </select></div>
        <button class="btn primary" id="pApply">查询</button>
        <button class="btn" id="pReset">重置</button>
      </div>

      <div class="card">
        <div class="card-head"><h3 class="card-title">价格明细（${U.dateFull(d.date)}）</h3>
          <span class="tiny faint">共 ${U.int(d.total)} 条　·　第 ${d.page} 页</span></div>
        <div class="table-wrap" style="max-height:600px;overflow:auto">
          <table class="data compact">
            <thead><tr>
              <th style="width:50px">ID</th><th>省份</th><th>批发市场</th><th>大类 / 小类</th><th>品种</th>
              <th class="right">价格</th><th>规格</th><th>单位</th><th>采集批次号</th><th>采集时间</th><th>来源</th><th style="width:74px">操作</th>
            </tr></thead>
            <tbody>${d.items.map((r) => `<tr>
              <td class="mono tiny">${r.id}</td>
              <td class="small">${U.esc(r.province)}</td>
              <td class="small">${U.esc(r.market)}</td>
              <td class="tiny">${U.esc(r.categoryL1)}<div class="faint">${U.esc(r.categoryL2 || '')}</div></td>
              <td class="small bold">${U.esc(r.species)}</td>
              <td class="right mono bold" style="font-size:13.5px">${U.num(r.price)}</td>
              <td class="tiny">${U.esc(r.spec || '—')}</td>
              <td class="tiny">${U.esc(r.unit)}</td>
              <td class="mono tiny">${U.esc(r.batchNo || '—')}</td>
              <td class="mono tiny">${U.dtText(r.collectedAt)}</td>
              <td><a href="${U.esc(r.sourceUrl)}" target="_blank" rel="noopener" class="tiny">pfsc ↗</a></td>
              <td><button class="btn sm" data-edit-price="${r.id}" data-cur="${r.price}"
                data-desc="${U.esc(r.province + ' / ' + r.market + ' / ' + r.species)}">修正</button></td>
            </tr>`).join('')}
            </tbody></table>
        </div>
        <div class="pager">
          <button class="btn sm" id="pPrev" ${d.page <= 1 ? 'disabled' : ''}>← 上一页</button>
          <span class="small muted">第 ${d.page} / ${Math.max(1, Math.ceil(d.total / 30))} 页</span>
          <button class="btn sm" id="pNext" ${d.page * 30 >= d.total ? 'disabled' : ''}>下一页 →</button>
        </div>
      </div>`);

    const apply = () => {
      S.pricesQ.province = val('pProv'); S.pricesQ.species = val('pSp');
      S.pricesQ.category = val('pCat'); S.pricesQ.page = 1; pagePrices();
    };
    document.getElementById('pApply').onclick = apply;
    document.getElementById('pReset').onclick = () => {
      S.pricesQ = { province: '', species: '', category: '', page: 1 }; pagePrices();
    };
    const pv = document.getElementById('pPrev'); if (pv) pv.onclick = () => { S.pricesQ.page--; pagePrices(); };
    const nx = document.getElementById('pNext'); if (nx) nx.onclick = () => { S.pricesQ.page++; pagePrices(); };

    document.querySelectorAll('[data-edit-price]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.editPrice, cur = b.dataset.cur, desc = b.dataset.desc;
        modal(`
          <div class="modal-head"><h3>修正价格</h3><button class="modal-close" id="mClose">×</button></div>
          <div class="small muted mb-3">${desc}</div>
          <div class="field"><label>当前价格（元/公斤）</label><input class="input mono" value="${cur}" disabled></div>
          <div class="field"><label>修正为（元/公斤）*</label><input class="input mono" type="number" step="0.01" id="cPrice" value="${cur}"></div>
          <div class="field"><label>修正原因 *</label>
            <input class="input" id="cReason" placeholder="如 采集源数据录入错误 / 单位换算修正"></div>
          <div class="row gap-2 mt-4">
            <button class="btn primary block" id="cSave">保存修正</button>
            <button class="btn" data-close>取消</button>
          </div>
          <div class="hint">修正会记录变更前后值与操作人，可在审计日志中追溯。</div>`, {
          onMount(mask, close) {
            mask.querySelector('#cSave').onclick = async () => {
              const p = mask.querySelector('#cPrice').value;
              const reason = mask.querySelector('#cReason').value.trim();
              if (!reason) return toast('请填写修正原因', 'warn');
              try {
                const r = await api.admin.correctPrice(Number(id), Number(p), reason);
                toast(`已修正：${r.before} → ${r.after} 元/公斤`);
                close(); pagePrices();
              } catch (e) { toast(e.message, 'err'); }
            };
          },
        });
      };
    });
  }

  // ── 日报与采集 ────────────────────────────────────────────────────────
  async function pageSnapshots() {
    setContent(U.skeletonTable(10), '日报与采集');
    S.snaps = await api.admin.snapshots({ limit: 40 });
    const items = S.snaps.items;
    setContent(`
      <div class="page-note">
        <b>T+0 发布与批次审计：</b>每日采集完成后生成当日快照并标记为已发布，四端即可拉取。
        采集批次号（如 PFSC-20261016-01）用于复现与审计，可与自动化采集系统的日志一一对应。
      </div>
      <div class="stat-grid mb-4">
        ${U.stat({ label: '最新数据日期', value: U.dateFull(items[0] ? items[0].date : ''), sub: items[0] ? (items[0].status === 'published' ? '已发布（T+0）' : '待发布') : '—' })}
        ${U.stat({ label: '当日覆盖市场', value: items[0] ? items[0].marketCount : '—', unit: '家' })}
        ${U.stat({ label: '当日覆盖省份', value: items[0] ? items[0].provinceCount : '—', unit: '个' })}
        ${U.stat({ label: '当日记录条数', value: items[0] ? U.int(items[0].recordCount) : '—', sub: '采集批次可审计' })}
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">每日快照与采集批次</h3>
          <span class="tiny faint">最近 ${items.length} 天</span></div>
        <div class="table-wrap" style="max-height:600px;overflow:auto">
          <table class="data compact">
            <thead><tr><th>数据日期</th><th>状态</th><th class="right">市场数</th><th class="right">省份数</th>
              <th class="right">品种数</th><th class="right">记录条数</th><th>采集批次号</th><th>发布时间</th></tr></thead>
            <tbody>${items.map((s) => `<tr>
              <td class="mono">${U.dateFull(s.date)}</td>
              <td><span class="badge ${s.status === 'published' ? 'down' : 'warn'}">${s.status === 'published' ? '已发布' : '待发布'}</span></td>
              <td class="right mono">${s.marketCount}</td>
              <td class="right mono">${s.provinceCount}</td>
              <td class="right mono">${s.speciesCount}</td>
              <td class="right mono">${U.int(s.recordCount)}</td>
              <td class="mono tiny">${U.esc(s.batchNo || '—')}</td>
              <td class="mono tiny">${U.dtText(s.publishedAt)}</td></tr>`).join('')}
            </tbody></table>
        </div>
      </div>`);
  }

  // ── 品种申报 ──────────────────────────────────────────────────────────
  async function pageRequests() {
    setContent(U.skeletonTable(6), '品种申报');
    S.requests = await api.admin.requests({ ...S.requestsQ, pageSize: 30 });
    const d = S.requests;
    setContent(`
      <div class="page-note">
        <b>品种申报：</b>前台搜索无结果时用户可提交新品种申报。运营评估通过后可将其纳入采集范围。
      </div>
      <div class="toolbar">
        <div class="field"><label>状态</label>
          <select class="input" id="rqStatus">
            <option value="">全部</option>
            ${[['pending', '待处理'], ['approved', '已通过'], ['rejected', '已拒绝']]
        .map(([v, n]) => `<option value="${v}" ${S.requestsQ.status === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select></div>
        <button class="btn primary" id="rqApply">筛选</button>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">申报列表</h3>
          <span class="tiny faint">共 ${d.total} 条</span></div>
        <div class="table-wrap">
          <table class="data"><thead><tr>
            <th style="width:54px">ID</th><th>品种名称</th><th>所在地区</th><th>联系方式</th><th>说明</th>
            <th>提交时间</th><th>状态</th><th style="width:150px">操作</th></tr></thead>
            <tbody>${d.items.map((r) => `<tr>
              <td class="mono tiny">${r.id}</td>
              <td class="bold small">${U.esc(r.name)}</td>
              <td class="small">${U.esc(r.province || '—')}</td>
              <td class="tiny">${U.esc(r.contact || '—')}</td>
              <td class="tiny" style="max-width:220px">${U.esc(r.remark || '—')}</td>
              <td class="mono tiny">${U.dtText(r.created_at)}</td>
              <td>${({ pending: '<span class="badge warn">待处理</span>', approved: '<span class="badge down">已通过</span>', rejected: '<span class="badge gray">已拒绝</span>' }[r.status]) || r.status}</td>
              <td><div class="row gap-1">
                ${r.status !== 'approved' ? `<button class="btn sm" data-req="${r.id}" data-st="approved">通过</button>` : ''}
                ${r.status !== 'rejected' ? `<button class="btn sm danger" data-req="${r.id}" data-st="rejected">拒绝</button>` : ''}
              </div></td></tr>`).join('')}
            </tbody></table>
        </div>
      </div>`);

    document.getElementById('rqApply').onclick = () => { S.requestsQ.status = val('rqStatus'); pageRequests(); };
    document.querySelectorAll('[data-req]').forEach((b) => {
      b.onclick = async () => {
        try { await api.admin.handleRequest(Number(b.dataset.req), b.dataset.st); toast('已更新申报状态'); pageRequests(); }
        catch (e) { toast(e.message, 'err'); }
      };
    });
  }

  // ── 关注阈值 ──────────────────────────────────────────────────────────
  async function pageWatch() {
    setContent(U.skeletonTable(8), '关注阈值配置');
    S.watches = await api.admin.watchConfig({ ...S.watchesQ, pageSize: 30 });
    const d = S.watches;
    setContent(`
      <div class="page-note">
        <b>阈值与推送配置：</b>用户可对「品种 × 地区」维度设置涨跌阈值（默认 ±5%）。当均价日环比触发阈值时，
        系统按所选通道推送提醒。管理员可在此统一查看与调整。
      </div>
      <div class="toolbar">
        <div class="field"><label>关键词</label>
          <input class="input" id="wKw" placeholder="品种 / 用户邮箱" value="${U.esc(S.watchesQ.keyword)}"></div>
        <button class="btn primary" id="wApply">查询</button>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">关注订阅与阈值</h3>
          <span class="tiny faint">共 ${d.total} 条</span></div>
        <div class="table-wrap" style="max-height:560px;overflow:auto">
          <table class="data compact"><thead><tr>
            <th style="width:54px">ID</th><th>用户</th><th>品种</th><th>地区维度</th>
            <th class="right">涨阈值</th><th class="right">跌阈值</th><th>推送通道</th><th>创建时间</th><th style="width:80px">操作</th></tr></thead>
            <tbody>${d.items.map((w) => `<tr>
              <td class="mono tiny">${w.id}</td>
              <td class="small">${U.esc(w.nickname || '—')}
                <div class="tiny faint">${U.esc(w.email)}</div></td>
              <td class="bold small">${U.esc(w.species)}</td>
              <td>${w.scope === '全国' ? '<span class="badge gray">全国</span>' : U.esc(w.scope)}</td>
              <td class="right mono text-up">${w.thresholdUp == null ? '默认 5' : '+' + w.thresholdUp + '%'}</td>
              <td class="right mono text-down">${w.thresholdDown == null ? '默认 -5' : w.thresholdDown + '%'}</td>
              <td><span class="badge gray">${U.esc(channelLabel(w.notifyChannel))}</span></td>
              <td class="mono tiny">${U.dtText(w.createdAt)}</td>
              <td><button class="btn sm" data-edit-watch="${w.id}" data-up="${w.thresholdUp ?? ''}"
                data-down="${w.thresholdDown ?? ''}" data-ch="${U.esc(w.notifyChannel)}">调整</button></td>
            </tr>`).join('')}
            </tbody></table>
        </div>
      </div>`);

    const apply = () => { S.watchesQ.keyword = val('wKw'); S.watchesQ.page = 1; pageWatch(); };
    document.getElementById('wApply').onclick = apply;
    document.getElementById('wKw').onkeydown = (e) => { if (e.key === 'Enter') apply(); };

    document.querySelectorAll('[data-edit-watch]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.editWatch;
        modal(`
          <div class="modal-head"><h3>调整关注阈值</h3><button class="modal-close" id="mClose">×</button></div>
          <div class="row gap-3">
            <div class="field grow"><label>涨阈值（%）</label>
              <input class="input mono" type="number" step="0.5" id="ewUp" value="${b.dataset.up || 5}"></div>
            <div class="field grow"><label>跌阈值（%）</label>
              <input class="input mono" type="number" step="0.5" id="ewDown" value="${b.dataset.down || -5}"></div>
          </div>
          <div class="field"><label>推送通道</label>
            <select class="input" id="ewCh">
              ${[['wechat_push', '微信订阅消息'], ['app_push', '系统推送（App）'], ['web_push', '浏览器通知'], ['inbox', '站内消息']]
            .map(([v, n]) => `<option value="${v}" ${b.dataset.ch === v ? 'selected' : ''}>${n}</option>`).join('')}
            </select></div>
          <div class="row gap-2 mt-4">
            <button class="btn primary block" id="ewSave">保存</button>
            <button class="btn" data-close>取消</button>
          </div>`, {
          onMount(mask, close) {
            mask.querySelector('#ewSave').onclick = async () => {
              try {
                await api.admin.updateWatch(Number(id), {
                  thresholdUp: Number(mask.querySelector('#ewUp').value),
                  thresholdDown: Number(mask.querySelector('#ewDown').value),
                  notifyChannel: mask.querySelector('#ewCh').value,
                });
                toast('阈值配置已更新'); close(); pageWatch();
              } catch (e) { toast(e.message, 'err'); }
            };
          },
        });
      };
    });
  }

  const channelLabel = (c) => ({ wechat_push: '微信订阅消息', app_push: 'App 推送', web_push: '浏览器通知', inbox: '站内消息', app: 'App 推送' }[c] || c);

  // ── 推送配置 ──────────────────────────────────────────────────────────
  async function pagePush() {
    setContent(U.skeletonTable(6), '推送配置');
    S.push = await api.admin.pushConfig();
    const p = S.push;
    setContent(`
      <div class="page-note">
        <b>多端推送通道（F7）：</b>同一套告警逻辑按端分发。小程序走微信订阅消息（需用户主动授权一次），
        App 走系统推送（APNs / FCM + 厂商通道），Web 走浏览器通知，管理后台走站内消息。
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--s-4)">
        <div class="card">
          <div class="card-head"><h3 class="card-title">通道配置</h3>
            <span class="tiny faint">默认阈值 ±${p.defaultThreshold}%</span></div>
          <div class="table-wrap"><table class="data compact">
            <thead><tr><th>通道</th><th>适用端</th><th>授权要求</th></tr></thead>
            <tbody>${p.channels.map((c) => `<tr>
              <td class="bold small">${U.esc(c.name)}</td>
              <td class="small">${U.esc(c.target)}</td>
              <td class="tiny muted">${U.esc(c.note)}</td></tr>`).join('')}
            </tbody></table></div>
          <div class="notice mt-3"><span>ℹ</span>
            <span>微信订阅消息为一次性授权，每次推送需用户确认；建议在用户设置关注时同步引导授权。</span></div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">通道使用统计</h3></div>
          <div class="card-head"><h4 class="card-title" style="font-size:14px">关注订阅分布</h4></div>
          ${U.barRank(p.watchByChannel.map((x) => ({ label: channelLabel(x.channel), value: x.count, color: 'var(--brand)' })), { labelWidth: 104 })}
          <div class="divider"></div>
          <div class="card-head"><h4 class="card-title" style="font-size:14px">已推送告警</h4></div>
          ${p.sentByChannel.length ? U.barRank(p.sentByChannel.map((x) => ({ label: channelLabel(x.channel), value: x.count, color: 'var(--warn)' })), { labelWidth: 104 }) : '<div class="tiny faint">暂无推送记录</div>'}
          <div class="divider"></div>
          <div class="card-head"><h4 class="card-title" style="font-size:14px">设备订阅登记</h4></div>
          ${p.subscriptions.length ? U.barRank(p.subscriptions.map((x) => ({ label: channelLabel(x.channel), value: x.count, color: 'var(--down)' })), { labelWidth: 104 }) : '<div class="tiny faint">暂无设备登记</div>'}
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-head"><h3 class="card-title">按通道推送（手动触发）</h3></div>
        <div class="row gap-2 wrap">
          ${['wechat_push', 'app_push', 'web_push', 'inbox'].map((ch) => `<button class="btn sm" data-push-all="${ch}">向「${channelLabel(ch)}」订阅者推送</button>`).join('')}
        </div>
        <div class="hint mt-3">点击后执行一次阈值扫描，仅生成通道为所选值的告警记录。生产环境应由采集完成后的定时任务自动触发。</div>
      </div>`);

    document.querySelectorAll('[data-push-all]').forEach((b) => {
      b.onclick = async () => {
        try {
          const r = await api.admin.scanAlerts();
          toast(`阈值扫描完成：扫描 ${r.scanned} 条，新增 ${r.created} 条告警（目标通道：${channelLabel(b.dataset.pushAll)}）`);
          pagePush();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  }

  // ── 审计日志 ──────────────────────────────────────────────────────────
  async function pageAudit() {
    setContent(U.skeletonTable(10), '审计日志');
    S.audits = await api.admin.audit({ ...S.auditsQ, pageSize: 40 });
    const d = S.audits;
    setContent(`
      <div class="page-note">
        <b>操作审计：</b>记录登录、用户治理、价格修正、阈值与推送配置变更、系统设置等全部写操作，
        含操作人、对象、变更详情与时间，满足运营治理与合规追溯要求。
      </div>
      <div class="toolbar">
        <div class="field"><label>动作类型</label>
          <select class="input" id="atAction"><option value="">全部</option>
            ${d.actionSummary.map((a) => `<option value="${U.esc(a.action)}" ${S.auditsQ.action === a.action ? 'selected' : ''}>${U.esc(a.action)}（${a.count}）</option>`).join('')}
          </select></div>
        <div class="field"><label>关键词</label>
          <input class="input" id="atKw" placeholder="邮箱 / 对象 / 详情" value="${U.esc(S.auditsQ.keyword)}"></div>
        <button class="btn primary" id="atApply">查询</button>
        <button class="btn" id="atReset">重置</button>
      </div>

      <div class="card mb-4">
        <div class="card-head"><h3 class="card-title">动作分布</h3>
          <span class="tiny faint">共 ${d.total} 条日志</span></div>
        ${U.barRank(d.actionSummary.map((a) => ({ label: a.action, value: a.count, color: 'var(--brand-2)' })), { labelWidth: 168 })}
      </div>

      <div class="card">
        <div class="card-head"><h3 class="card-title">日志明细</h3>
          <span class="tiny faint">第 ${d.page} 页</span></div>
        <div class="table-wrap" style="max-height:560px;overflow:auto">
          <table class="data compact"><thead><tr>
            <th style="width:54px">ID</th><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th><th>IP</th></tr></thead>
            <tbody>${d.items.map((r) => `<tr>
              <td class="mono tiny">${r.id}</td>
              <td class="mono tiny">${U.dtText(r.createdAt)}</td>
              <td class="small">${U.esc(r.userEmail || '—')}</td>
              <td><span class="badge gray">${U.esc(r.action)}</span></td>
              <td class="tiny">${U.esc(r.target || '—')}</td>
              <td class="tiny" style="max-width:340px">${U.esc(r.detail || '—')}</td>
              <td class="mono tiny">${U.esc(r.ip || '—')}</td></tr>`).join('')}
            </tbody></table>
        </div>
        <div class="pager">
          <button class="btn sm" id="atPrev" ${d.page <= 1 ? 'disabled' : ''}>← 上一页</button>
          <span class="small muted">第 ${d.page} / ${Math.max(1, Math.ceil(d.total / 40))} 页</span>
          <button class="btn sm" id="atNext" ${d.page * 40 >= d.total ? 'disabled' : ''}>下一页 →</button>
        </div>
      </div>`);

    const apply = () => {
      S.auditsQ.action = val('atAction'); S.auditsQ.keyword = val('atKw'); S.auditsQ.page = 1; pageAudit();
    };
    document.getElementById('atApply').onclick = apply;
    document.getElementById('atReset').onclick = () => { S.auditsQ = { action: '', keyword: '', page: 1 }; pageAudit(); };
    const pv = document.getElementById('atPrev'); if (pv) pv.onclick = () => { S.auditsQ.page--; pageAudit(); };
    const nx = document.getElementById('atNext'); if (nx) nx.onclick = () => { S.auditsQ.page++; pageAudit(); };
  }

  // ── 系统设置 ──────────────────────────────────────────────────────────
  async function pageConfig() {
    setContent(U.skeletonTable(4), '系统设置');
    S.cfg = await api.admin.config();
    const c = S.cfg;
    setContent(`
      <div class="page-note">
        <b>系统设置：</b>站点名称、前台公告、默认异动阈值、数据来源说明与热门搜索快捷键。修改后立即对四端生效。
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--s-4)">
        <div class="card">
          <h3 class="card-title mb-4">基础配置</h3>
          <div class="field"><label>站点名称</label><input class="input" id="cfgName" value="${U.esc(c.site_name || '')}"></div>
          <div class="field"><label>默认异动阈值（%）</label>
            <input class="input mono" type="number" step="0.5" id="cfgThreshold" value="${U.esc(c.alert_threshold || '5')}"></div>
          <div class="field"><label>热门搜索快捷键（英文逗号分隔，最多 6 个）</label>
            <input class="input" id="cfgHot" value="${U.esc(c.hot_search || '')}"></div>
          <div class="field"><label>数据来源说明</label><input class="input" id="cfgSource" value="${U.esc(c.data_source || '')}"></div>
          <div class="field"><label>T+0 当日发布</label>
            <select class="input" id="cfgT0">
              <option value="true" ${c.t0_publish === 'true' ? 'selected' : ''}>开启（当日数据当日发布）</option>
              <option value="false" ${c.t0_publish !== 'true' ? 'selected' : ''}>关闭</option>
            </select></div>
          <button class="btn primary block mt-3" id="cfgSave">保存配置</button>
        </div>

        <div class="card">
          <h3 class="card-title mb-4">前台公告</h3>
          <div class="field"><label>公告内容（显示在四端顶部）</label>
            <textarea class="input" id="cfgAnn" rows="5">${U.esc(c.announcement || '')}</textarea></div>
          <div class="notice"><span>ℹ</span><span>公告留空则不显示公告条。</span></div>

          <div class="divider"></div>
          <h3 class="card-title mb-3">运行信息</h3>
          <div class="table-wrap"><table class="data compact"><tbody>
            <tr><td class="faint" style="width:110px">应用名称</td><td>鱼价查 · 智慧渔业全国水产品价格日报系统</td></tr>
            <tr><td class="faint">版本</td><td class="mono">v1.0.0</td></tr>
            <tr><td class="faint">数据库驱动</td><td class="mono">${U.esc(S.dash && S.dash.dbInfo ? S.dash.dbInfo.driver : '—')}</td></tr>
            <tr><td class="faint">数据规模</td><td>34 省 × 130 市场 × ${S.meta ? S.meta.species.length : 28} 品种</td></tr>
            <tr><td class="faint">历史时序</td><td>22 个月+（支撑 F11 历史对比）</td></tr>
            <tr><td class="faint">发布时效</td><td>T+0 当日发布</td></tr>
          </tbody></table></div>
          <div class="notice warn mt-3"><span>⚠</span>
            <span>生产环境请务必通过环境变量注入数据库密码与 JWT 密钥，不要在代码或界面中留存明文凭据。</span></div>
        </div>
      </div>`);

    document.getElementById('cfgSave').onclick = async () => {
      try {
        await api.admin.saveConfig({
          site_name: val('cfgName'), announcement: val('cfgAnn'),
          alert_threshold: val('cfgThreshold'), hot_search: val('cfgHot'),
          data_source: val('cfgSource'), t0_publish: val('cfgT0'),
        });
        toast('系统配置已保存');
        pageConfig();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  // ── 通用弹层 ──────────────────────────────────────────────────────────
  function modal(html, { onMount } = {}) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.onclick = (e) => { if (e.target === mask) close(); };
    const c = mask.querySelector('#mClose'); if (c) c.onclick = close;
    mask.querySelectorAll('[data-close]').forEach((b) => b.onclick = close);
    if (onMount) onMount(mask, close);
  }

  function confirmDialog(title, desc, onOk, danger = false) {
    modal(`
      <div class="modal-head"><h3 ${danger ? 'style="color:var(--up)"' : ''}>${U.esc(title)}</h3>
        <button class="modal-close" id="mClose">×</button></div>
      <p class="small muted" style="line-height:1.8">${desc}</p>
      <div class="row gap-2 mt-4">
        <button class="btn ${danger ? 'danger' : 'primary'} block" id="cfOk">确认执行</button>
        <button class="btn" data-close>取消</button>
      </div>`, {
      onMount(mask, close) {
        mask.querySelector('#cfOk').onclick = async () => { await onOk(); close(); };
      },
    });
  }

  // ── 路由 ──────────────────────────────────────────────────────────────
  async function route() {
    const id = (location.hash || '#/dashboard').replace(/^#\/?/, '') || 'dashboard';
    S.route = id;
    shell();
    try {
      switch (id) {
        case 'users': await pageUsers(); break;
        case 'prices': await pagePrices(); break;
        case 'snapshots': await pageSnapshots(); break;
        case 'requests': await pageRequests(); break;
        case 'watch': await pageWatch(); break;
        case 'push': await pagePush(); break;
        case 'audit': await pageAudit(); break;
        case 'config': await pageConfig(); break;
        default: await pageDashboard();
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403) { Auth.logout(); renderLogin('登录状态已失效，请重新登录。'); return; }
      setContent(U.empty({ title: '页面加载失败', desc: U.esc(e.message), action: '<button class="btn primary" onclick="location.reload()">重新加载</button>' }), '加载失败');
    }
  }
  window.addEventListener('hashchange', route);

  // ── 启动 ──────────────────────────────────────────────────────────────
  async function boot() {
    Theme.apply(Theme.current);
    if (!Auth.isLoggedIn || !Auth.user || Auth.user.role !== 'admin') return renderLogin();
    try {
      S.meta = await api.meta();
    } catch (e) {
      return renderLogin(`无法连接后端服务：${e.message}`);
    }
    route();
  }

  boot();
})();
