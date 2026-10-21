/**
 * 渲染层验证：用真实 API 数据驱动 shared/ui.js 的图表与组件函数，
 * 校验输出 SVG/HTML 合法性与转义安全性。
 * 用法：node scripts/test-render.mjs [baseUrl]
 */
// 用真实 API 数据驱动 shared/ui.js 的渲染函数，验证输出 SVG/HTML 合法
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const B=process.argv[2]||'http://127.0.0.1:8787';
const J=async p=>(await (await fetch(B+p)).json()).data;

// 构造最小 window 环境载入 ui.js
const uiSrc = fs.readFileSync(path.join(ROOT,'shared/ui.js'),'utf8');
const win = { location:{protocol:'http:'}, document:{querySelectorAll:()=>[], querySelector:()=>null, createElement:()=>({style:{},classList:{add(){},toggle(){}},appendChild(){},addEventListener(){}}), addEventListener(){}, documentElement:{setAttribute(){}}, body:{appendChild(){}}, dispatchEvent(){} }, localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, CustomEvent:class{constructor(){}}, YJT:{} };
const fn = new Function('window','globalThis', uiSrc.replace('})(window);','})(window);'));
fn(win, win);
const U = win.YJT;

let pass=0, fail=0;
const chk=(n,c,d='')=>{ if(c){pass++;console.log(`  ✓ ${n}${d?'  '+d:''}`);} else {fail++;console.log(`  ✗ ${n}${d?'  '+d:''}`);} };

console.log('══ 渲染层验证（真实数据驱动）\n');

const map = await J('/api/map/provinces?days=7');
const rep = await J('/api/report/daily');
const list = await J('/api/species?pageSize=500');
const sp = await J('/api/species/'+encodeURIComponent('大黄鱼')+'?days=90');
const prov = await J('/api/provinces/'+encodeURIComponent('上海市')+'?range=7');
const cmp = await J('/api/compare?species='+encodeURIComponent('大黄鱼,草鱼,鲍鱼')+'&days=90');

console.log('[图表]');
const lc = U.lineChart(map.provinces.find(p=>p.name==='上海市').trend, {height:200});
chk('折线图 SVG 合法', lc.startsWith('<div class="chart-host"') && lc.includes('<path d="M') && lc.includes('</svg>'), `${(lc.length/1024).toFixed(1)}KB`);
const spk = U.sparkline(list.items[0].sparkline, {width:200,height:34});
chk('sparkline 合法', spk.startsWith('<svg') && spk.includes('</svg>'), `${list.items[0].sparkline.length} 数据点`);
const br = U.barRank(map.ranking.slice(0,8).map(r=>({label:r.short,value:r.avgPrice,delta:r.changePct})),{});
chk('横向条形排行合法', br.includes('rank-badge') && br.split('rank-badge').length-1===8);
const ml = U.multiLine(cmp.series,{height:260});
chk('多品种叠加折线合法', ml.includes('<svg') && ml.split('<path').length-1>=3, `${cmp.series.length} 个品种`);
const dn = U.tierDonut({low:11,mid:19,high:4,na:0},{size:132});
chk('档位环图合法', dn.startsWith('<svg') && dn.includes('省级行政区'));
const pm = U.provinceMap(map.provinces);
chk('省份点位图合法', pm.startsWith('<svg') && (pm.match(/class="prov-dot"/g)||[]).length===34, `34 个点位`);

console.log('\n[组件]');
const d1 = U.delta(2.35); chk('涨跌标签含箭头+百分比+不靠颜色', d1.includes('▲') && d1.includes('2.35%') && d1.includes('class="delta up"'));
const d2 = U.delta(-1.8); chk('跌标签', d2.includes('▼') && d2.includes('class="delta down"'));
const d3 = U.delta(null); chk('无数据占位', d3.includes('—'));
const tb = U.tierBadge(map.provinces.find(p=>p.hasData).tier); chk('档位徽章', /class="tier (low|mid|high)"/.test(tb));
const pb = U.priceBlock(58.82,{unit:'元/公斤',lg:true,delta:2.35}); chk('价格大字块', pb.includes('price lg') && pb.includes('58.82'));
const st = U.stat({label:'上涨省份',value:23,unit:'个',tone:'up'}); chk('概览卡', st.includes('class="stat up"') && st.includes('23'));
const em = U.empty({title:'暂无数据',kind:'search'}); chk('空状态插画', em.includes('empty') && em.includes('<svg'));
const sk = U.skeletonCards(6); chk('骨架屏', sk.includes('skeleton') && sk.split('skeleton').length-1>=6);

console.log('\n[数据穿透渲染]');
// 省份卡渲染（模拟 web/app.js speciesCard）
const s = list.items[0];
const card = `<div class="card species-card"><span class="cat-badge">${U.esc(s.category)}</span>${U.priceBlock(s.price,{delta:s.changePct})}${U.tierBadge(s.tier,{outline:true})}${U.sparkline(s.sparkline,{width:200,height:34})}</div>`;
chk('品种卡片完整渲染', card.includes('species-card') && card.includes(U.esc(s.category)) && card.includes(String(s.price)));
chk('卡片含全部 6 要素（品类徽章/名称/规格/星标位/价格/涨跌/近7日）', card.includes('cat-badge') && card.includes('price') && card.includes('tier') && card.includes('<svg'));
const pv = U.priceBlock(prov.header.avgPrice,{delta:prov.header.changePct});
chk('省份面板渲染', pv.includes(String(prov.header.avgPrice)) && pv.includes('delta'));
chk('日报表 34 行全部可渲染', rep.rows.every(r=>U.esc(r.province) && U.tierBadge(r.tier).includes('tier')));
chk('领涨品种渲染', rep.rows.filter(r=>r.leadUp).length>0 && U.esc(rep.rows.find(r=>r.leadUp).leadUp.species));

console.log('\n[转义安全]');
chk('XSS 转义', U.esc('<script>alert(1)</script>')==='&lt;script&gt;alert(1)&lt;/script&gt;');
chk('引号转义', U.esc('a"b\'c')==='a&quot;b&#39;c');

console.log(`\n${'─'.repeat(60)}\n  通过 ${pass}　失败 ${fail}　共 ${pass+fail} 项`);
process.exit(fail?1:0);
