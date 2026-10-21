// 精准替换：将用户可见品牌名「渔价查」改为「鱼价查」
// 仅改显示名与品牌标识，不动功能逻辑、数据库结构、Docker、文档、测试数据。
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/岳思雨/WorkBuddy/2026-10-16-21-24-30/yujiacha';

// 要改的文件：四端 UI + 共用库 + 前端读取的产品名 + 导出相关可见标题 + 种子组织名 + 录制/截图脚本
const files = [
  // 四端 UI（可见品牌名）
  'shared/ui.js', 'shared/api.js', 'shared/tokens.css',
  'web/index.html', 'web/app.js',
  'admin/index.html', 'admin/app.js',
  'client/preview/index.html', 'client/preview/app.js',
  'client/app-preview/index.html',
  'client/src/pages.json', 'client/src/pages/login/index.vue', 'client/src/pages/me/index.vue',
  'client/src/utils/config.js', 'client/src/utils/api.js', 'client/src/uni.scss',
  // 前端读取的产品名
  'server/src/config.js',
  // 导出 / 打印页可见标题
  'server/src/routes/index.js', 'server/src/services/export-service.js',
  // 后台可见的组织名（种子）
  'server/scripts/seed.js',
  // 录制 / 截图脚本（保持视频、截图、桌面文件夹名一致）
  'demo/demo-web.js', 'demo/demo-mini.js', 'demo/features.js', 'demo/shots.js', 'demo/stitch.py',
];

let total = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('SKIP(不存在):', f); continue; }
  const s = fs.readFileSync(p, 'utf8');
  const n = (s.match(/渔价查/g) || []).length;
  if (n === 0) continue;
  fs.writeFileSync(p, s.replace(/渔价查/g, '鱼价查'), 'utf8');
  total += n;
  console.log(`改 ${n} 处 → ${f}`);
}
console.log('合计替换', total, '处');
