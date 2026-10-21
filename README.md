# 渔价查 · 智慧渔业全国水产品价格日报系统

> 消费/展示层 + 管理后台，叠加在已有的「全国水产品价格日报自动化生成系统」之上。
> 一套后端接口服务**四端**：微信小程序 / 移动 App（iOS·Android）/ 管理后台（Web）/ Web(H5)。

依据《功能需求文档_智慧渔业水价App_v03》与《产品说明书_智慧渔业水价格日报自动化系统》实现，
覆盖 **F1–F14 全部功能点**，并提供可运行的四端交付物。

---

## 一、快速开始（本机，零 Docker 依赖）

```bash
cd yujiacha

# 1. 配置环境变量
cp .env.example .env
#    默认 DB_DRIVER=mysql，需填写 DB_PASSWORD；
#    若暂时没有 MySQL 密码，改为 DB_DRIVER=sqlite 即可用内置数据库跑通全部功能
#    ⚠️ 真实 .env 已在 .gitignore 中，不会被提交

# 2. 安装依赖（后端仅一个运行时依赖 mysql2）
cd server && npm install && cd ..

# 3. 建库建表
cd server
npm run init:db          # 建库建表（幂等）；加 --drop 可重建
npm run seed             # 生成演示数据（默认 22 个月完整规模）
cd ..

# 4. 启动服务
cd server && npm start
```

启动后访问：

| 端口/路径 | 说明 |
|---|---|
| `http://127.0.0.1:8787/` | 服务导航页（四端入口） |
| `http://127.0.0.1:8787/web/` | **Web 网站（H5）** —— 完整功能站点 |
| `http://127.0.0.1:8787/admin/` | **管理后台** —— 用户 / 价格 / 阈值 / 审计 / 设置 |
| `http://127.0.0.1:8787/mini/` | **微信小程序预览** —— 手机壳形态，UniApp H5 产物 |
| `http://127.0.0.1:8787/api/health` | 后端 API 健康检查 |

### 演示账号

| 角色 | 邮箱 | 密码 | 权限 |
|---|---|---|---|
| 运营 / 管理员 | `admin@yujiacha.local` | `Admin@2026` | 全部权限，可进管理后台 |
| 教研师生 | `teacher@shou.edu.cn` | `Demo@2026` | 可订阅、可导出 CSV / 长图 / PDF |
| 政府监测人员 | `gov@agri.local` | `Demo@2026` | 可订阅、可导出 |
| 普通用户 | `farmer@yujiacha.local` | `Demo@2026` | 可订阅，不可导出 |
| 普通用户 | `user@yujiacha.local` | `Demo@2026` | 可订阅，不可导出 |

> 游客（未登录）为只读模式：可浏览、搜索、看地图与日报，可本机保存关注，但不可云端订阅、不可接收推送、不可导出。

---

## 二、目录结构

```
yujiacha/
├── .env.example              环境变量模板（密钥走环境变量，不入库不写码）
├── shared/                   四端共用
│   ├── tokens.css            Design Token（配色 / 字体 / 版式 / 三套主题）
│   ├── api.js                API 客户端（JWT 自动续期、离线缓存）
│   └── ui.js                 自绘 SVG 图表库（折线 / sparkline / 条形 / 多线 / 环图 / 点位图）
├── server/                   后端（统一 REST API，服务四端）
│   ├── src/
│   │   ├── server.js         服务入口 + 静态资源托管 + 落地导航页
│   │   ├── config.js         配置中心（环境变量驱动）
│   │   ├── lib/
│   │   │   ├── http.js       零依赖 HTTP 框架（路由 / CORS / 静态 / 统一错误）
│   │   │   ├── db.js         数据库抽象层（MySQL ⇄ SQLite 同构）
│   │   │   └── crypto-util.js  scrypt 密码哈希 + HS256 JWT
│   │   ├── data/dictionary.js  基础数据字典（品类 / 品种 / 34 省 / 130 市场）
│   │   ├── services/
│   │   │   ├── price-service.js    F1/F2/F3/F5/F6/F11
│   │   │   ├── account-service.js  F4/F7/F13
│   │   │   ├── export-service.js   F8
│   │   │   └── admin-service.js    F14
│   │   └── routes/index.js   统一路由（含打印页渲染）
│   ├── sql/
│   │   ├── schema.sql        MySQL 表结构（10 张表 + 1 视图）
│   │   └── schema.sqlite.sql SQLite 等价表结构
│   └── scripts/
│       ├── init-db.js        建库建表
│       ├── seed.js           演示数据生成器
│       └── test-api.mjs      API 冒烟测试（88 项，覆盖 F1–F14）
├── web/                      Web 网站（H5，完整功能站点）
├── admin/                    管理后台（侧边栏 + 顶栏）
├── client/                   UniApp 客户端（小程序 / App 源码 + 预览）
│   ├── src/                  UniApp 源码（pages.json / 13 个页面 / 自绘图表组件）
│   └── preview/              小程序 H5 形态预览（手机壳）
└── docker/                   Docker 部署编排
    ├── docker-compose.yml    backend / admin / mysql / nginx（profiles 按需启用）
    ├── Dockerfile.backend
    ├── Dockerfile.admin
    └── nginx.conf            统一入口 + 限流 + HTTPS 模板
```

---

## 三、功能实现对照（F1–F14）

| 编号 | 功能 | 实现位置 | 说明 |
|---|---|---|---|
| **F1** | 查看所有品种 | `/api/species` | 「大类 → 小类 → 品种」三级树 + 平铺卡片双视图；地区/市场/大类/小类筛选；价格、涨跌、名称排序；近 7 日 sparkline |
| **F2** | 搜索某一品种 | `/api/search`、`/api/search/suggest` | 支持中文名、拼音首字母（`jyx` → 鲫鱼）、拼音全拼、别名（`虾姑` → 皮皮虾）；智能联想；空结果给近似品种 + 「申报新品种」入口 |
| **F3** | 每日渔价 + 地图选省 | `/api/map/provinces`、`/api/provinces/:name` | 34 省级行政区按「低/中/高」三档着色；省份详情含 5 个功能区（省名头、关键指标小卡、7 日折线、Top8 品种表、周维度刻度）；无数据省份灰显并提示 |
| **F4** | 我的关注品种 | `/api/watch` | 品种 + 地区双维度订阅；最新价、近一周迷你趋势、较前日涨跌；云端保存多端同步；游客态走 localStorage（`yjt_watchlist`） |
| **F5** | 全国渔价日报表 | `/api/report/daily` | 省份均价从高到低排序；表头含名次/省份/均价/较昨日/覆盖品种数/覆盖市场数/领涨品种/价格档位；五张概览卡；可切换按品种维度；顶部显示数据日期、覆盖市场数、记录条数、采集批次号 |
| **F6** | 品种详情页 | `/api/species/:name` | 规格、单位、来源 URL（跳转 pfsc）、采集批次号、时间戳、历史曲线、分省价格、市场报价明细 |
| **F7** | 异动提醒 + 推送 | `/api/alerts`、`/api/admin/alerts/scan` | 用户设涨跌阈值（默认 ±5%）；扫描后按端推送——小程序微信订阅消息 / App 系统推送 / Web 浏览器通知 / 管理后台站内 |
| **F8** | 导出与分享 | `/api/export/*` | 日报与榜单导出 CSV（带 BOM，Excel 直开）、自绘 SVG 分享长图、打印友好页导出 PDF；按角色门禁（教研/政府/管理员） |
| **F9** | 主题切换 | `shared/tokens.css` | 浅色 / 深色 / 学术白底三套，云端同步偏好 |
| **F10** | 离线可用 | `shared/api.js`、`client/src/utils/api.js` | 弱网降级展示缓存；首页显式「最近更新：YYYY-MM-DD HH:mm，覆盖 X 市场 / Y 条」 |
| **F11** | 历史趋势对比 | `/api/compare` | 最多 6 个品种叠加折线 + 区间统计（起价/终价/涨跌/最低/最高/振幅） |
| **F12** | AI 周报 / 日预报 | —— | 按 PRD 归入 M4 里程碑（说明书 6.2），本期不在范围内 |
| **F13** | 完整账号体系 | `/api/auth/*` | 注册（邮箱+验证）、登录（JWT + 刷新令牌轮换）、忘记密码（邮件重置令牌）、资料修改、注销（软删除 + 解绑关注/订阅）、多端同步 |
| **F14** | 管理后台 | `/api/admin/*` | 用户管理（查看/禁用/改角色/处理注销）、价格数据（查看/修正留痕）、日报与采集批次、关注阈值与推送配置、品种申报审批、操作审计日志、系统设置 |

---

## 四、关键实现说明

### 1. 技术栈落地说明（重要）

PRD 3.2/3.3 指定 **Spring Boot（Java）+ UniApp + Vue3 + MySQL + Docker**。
本机环境实测为 **Java 8（无 Maven 编译链）、无 Docker、MySQL 5.7 已装、Node 22 可用**，
无法在本机编译运行 Spring Boot 工程。

因此本交付采用 **Node 22 实现后端**，并严格保持与 PRD 的接口契约一致：

- **API 路径、字段名、响应结构、JWT 鉴权、四端权限分级** 全部按 PRD 设计；
- 数据库 **直连 PRD 指定的 `fish_price.price_daily`** 表结构（13 字段完全对齐）；
- 迁移到 Spring Boot 时，只需按同一份接口契约重写 controller/service，
  前端四端与数据库 **无需改动**。

如需 Spring Boot 版本源码工程，可在现有契约基础上平移，或补充 Maven/Docker 环境后构建。

### 2. 数据库双驱动同构

`server/src/lib/db.js` 抽象了 MySQL 与 SQLite 两种驱动，业务 SQL 完全相同：

- 日期区间由 JS 计算后传参，不使用 `DATE_SUB` / `CURDATE` 等方言函数；
- Upsert 走「先查后写」通用实现，避开 `ON DUPLICATE KEY` / `ON CONFLICT` 差异；
- 因此 `DB_DRIVER=sqlite` 可在没有 MySQL 密码时完整跑通全部功能。

**生产环境请使用 MySQL**（`DB_DRIVER=mysql`），SQLite 仅作本地回退与演示。

### 3. 价格数据模型

演示数据按可复现的种子生成，价格模型为：

```
价格 = 品种基准价 × 区域校准系数 × 市场系数 × 季节因子 × 周内因子 × 趋势因子 × 品种-省份日内冲击 × 市场噪声
```

校准以**最新日期**为基准，使各省综合均价精确落在说明书 3.1.1 的三档区间：

| 档位 | 阈值（元/斤） | 覆盖省份 |
|---|---|---|
| 低位 | ≤ 26 | 山东、辽宁、福建、广东、海南、浙江、广西、江苏、河北、天津、上海（11 个沿海主产区） |
| 中位 | 26–36 | 湖北、湖南、安徽、江西、河南、四川、重庆、陕西、吉林、黑龙江、北京、山西、贵州、台湾省、云南、内蒙古、宁夏、澳门、中国香港（19 个） |
| 高位 | > 36 | 甘肃、新疆、青海、西藏（4 个内陆高原与西部边远地区，运输与冷链成本系统性上升） |

**品种-省份日内冲击**是让数据真实的关键：同一省份内各市场对同一品种同步涨跌（产地集货价统一），
不同省份之间相互独立（区域供需差异），从而使各省日环比自然分化，避免「全国省份同涨同跌」的失真结果。

### 4. 涨跌色约定

全站统一 **红涨绿跌**（国内约定），且**始终配合 ▲/▼ 箭头与文字**，不单靠颜色区分
（呼应 PRD 8.2 说明与 6「可访问性」）。

| 语义 | 浅色 | 深色 | 学术白底 |
|---|---|---|---|
| 涨 / 高位 | `#E5484D` | `#FF6B70` | `#C0392B` |
| 跌 / 低位 | `#30A46C` | `#3FC77F` | `#1E8E5A` |
| 持平 | `#8595AC` | `#8595AC` | `#7B8794` |

### 5. 零依赖纯 SVG 图表

呼应说明书「创新三：零依赖的纯 SVG 前端」，`shared/ui.js` 自绘全套图表：
折线图（含渐变面积、数据点、悬停 Tooltip）、sparkline、横向条形排行、多品种叠加折线、
档位分布环图、省份点位图。**不依赖 ECharts / D3 / Chart.js 任何图表库。**

UniApp 端（`client/src/components/trend-line.vue`）用条件编译双实现：
H5/App 走 SVG，微信小程序走 `canvas`（小程序不支持 SVG 标签），两端行为一致。

### 6. 地图合规

省界比色与点位数据**自维护**（`server/src/data/dictionary.js` 中的省级经纬度），
不依赖任何第三方数据源；底图按合规要求使用腾讯位置服务。
港澳台均按国家标准标注为中国香港特别行政区 / 中国澳门特别行政区 / 台湾省。

---

## 五、API 一览

统一响应体：

```jsonc
// 成功
{ "ok": true, "data": { }, "ts": 1792158529448 }
// 失败
{ "ok": false, "error": { "code": "BAD_CREDENTIALS", "message": "邮箱或密码不正确" } }
```

鉴权：`Authorization: Bearer <accessToken>`

### 公开接口（游客可访问）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/meta` | 元数据（品类 / 品种 / 省份 / 市场 / 档位 / 主题） |
| GET | `/api/status` | 数据状态（日期 / 覆盖数 / 记录数 / 批次号 / T+0） |
| GET | `/api/config/public` | 公开配置（公告 / 热门搜索 / 默认阈值） |
| GET | `/api/species` | F1 品种列表（`province` `market` `category` `subCategory` `keyword` `sort` `order` `page` `pageSize`） |
| GET | `/api/search` | F2 搜索（`q` `limit`） |
| GET | `/api/search/suggest` | F2 智能联想 |
| GET | `/api/map/provinces` | F3 省级数据（`date` `days`） |
| GET | `/api/provinces/:name` | F3 省份详情（`range` `market`） |
| GET | `/api/movers` | 涨跌榜（`scope=province\|species`） |
| GET | `/api/report/daily` | F5 日报表（`date` `dimension=province\|species`） |
| GET | `/api/species/:name` | F6 品种详情（`province` `days`） |
| GET | `/api/compare` | F11 对比（`species=逗号分隔` `days` `province`） |
| POST | `/api/species/request` | F2 申报新品种 |

### 账户接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册（邮箱 + 密码 + 角色） |
| GET | `/api/auth/verify-email?token=` | 邮箱验证 |
| POST | `/api/auth/login` | 登录（返回 accessToken + refreshToken） |
| POST | `/api/auth/refresh` | 刷新令牌（轮换，旧令牌作废） |
| POST | `/api/auth/forgot-password` | 发送重置邮件 |
| POST | `/api/auth/reset-password` | 重置密码 |
| GET | `/api/auth/me` | 当前用户 |
| PUT | `/api/auth/profile` | 资料 / 主题 / 推送开关 |
| POST | `/api/auth/change-password` | 修改密码 |
| POST | `/api/auth/deactivate` | 注销（软删除 + 解绑） |
| POST | `/api/auth/logout` | 登出 |

### 需登录

| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST / DELETE | `/api/watch`、`/api/watch/:id` | F4 关注订阅 |
| GET | `/api/alerts` | F7 提醒列表 |
| POST | `/api/alerts/read` | 标记已读 |
| POST | `/api/push/subscribe` | 推送通道登记 |

### 需导出权限（教研 / 政府 / 管理员）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/export/report.csv` | 日报 CSV |
| GET | `/api/export/species.csv` | 品种明细 CSV（含来源 URL 与批次号） |
| GET | `/api/export/watch.csv` | 关注列表 CSV |
| GET | `/api/export/report.svg` | 分享长图 SVG |
| GET | `/api/export/print` | 打印友好页（另存 PDF） |

### 需管理员

`/api/admin/dashboard`、`/api/admin/users`、`/api/admin/prices`、`/api/admin/snapshots`、
`/api/admin/watch-config`、`/api/admin/push-config`、`/api/admin/alerts/scan`、
`/api/admin/audit`、`/api/admin/config`、`/api/admin/species-requests`

---

## 六、单元/集成测试

```bash
cd server
node scripts/test-api.mjs            # 默认 http://127.0.0.1:8787
node scripts/test-api.mjs http://其他地址:端口
```

覆盖 **88 项断言**，横跨 F1–F14 与权限门禁，包括：

- 数据规模校验（34 省 / 130 市场 / 品种数 / 三档区间）
- F2 拼音首字母与别名识别
- F5 省份排序、涨跌分化、审计字段完整性
- F13 全流程（注册 → 验证 → 登录 → 刷新轮换 → 忘记密码 → 重置 → 改资料 → 改密码 → 注销 → 旧令牌失效）
- 权限矩阵（游客 / 普通用户 / 教研 / 管理员）
- 静态资源四端可达性、Design Token 三套主题与涨跌色约定

---

## 七、Docker 部署

```bash
cd docker
cp .env.example .env
#  ⚠️ 必须修改：DB_PASSWORD、JWT_SECRET（用 openssl rand -hex 32 生成）
#  生产环境请使用专用数据库账号，不要用 root

# 连宿主机 MySQL
docker compose up -d

# 或启用容器化 MySQL（首次自动执行 schema.sql 建表）
docker compose --profile db up -d

# 启用管理后台独立服务 + Nginx 统一入口
docker compose --profile admin --profile proxy up -d

docker compose logs -f backend
```

要点：

- 密钥与数据库密码**全部走环境变量**，镜像内不含任何凭据；
- 容器以**非 root 用户**（`node`）运行；
- 内置 `HEALTHCHECK`（30s 间隔），`nginx.conf` 含认证接口限流（5 r/s）防暴力破解；
- `nginx.conf` 内附 HTTPS + HSTS 配置模板，取消注释并挂载证书即可启用。

---

## 八、编译为真机小程序 / App

```bash
cd client
npm install          # 安装 UniApp 依赖

npm run dev:mp-weixin   # 编译微信小程序 → 用微信开发者工具打开 dist/dev/mp-weixin
npm run dev:app         # 编译 App → 用 HBuilderX 运行到手机模拟器 / 真机
npm run dev:h5          # 编译 H5（与 /mini 预览对应）
```

或用 **HBuilderX** 直接打开 `yujiacha/client` → 运行 → 运行到小程序模拟器 / 手机模拟器。

**上线前必须配置**：

1. `client/src/utils/config.js` 中的 `BASES['mp-weixin']` / `BASES.app` 改为你的生产 API 域名；
2. 微信公众平台配置 `request` 合法域名（微信要求 HTTPS）；
3. 苹果 / 安卓推送需接入 APNs / FCM 与厂商通道，并在 `pages/login` 与 `pages/settings` 中对接相应 SDK。

---

## 九、安全与合规

| 项 | 实现 |
|---|---|
| 密码存储 | scrypt + 每用户随机盐（`scrypt$N$r$p$salt$hash`），不存明文 |
| 令牌 | JWT HS256；access 2h / refresh 30d；**刷新令牌一次性轮换**，旧令牌立即作废；改密/注销后作废该用户全部刷新令牌 |
| 密钥管理 | `JWT_SECRET`、数据库密码等全部走环境变量，`.env` 已在 `.gitignore` |
| 权限模型 | 游客 / 普通用户 / 教研师生 / 政府监测 / 管理员五级；后端逐接口校验，前端仅作展示 |
| 审计 | 登录、用户治理、价格修正、阈值与推送配置变更、系统设置等写操作全量留痕（含操作人、对象、变更前后值、IP、时间） |
| 数据可追溯 | 每条报价保留来源 URL 与采集批次号，可按批次复现 |
| 隐私 | 注销采用软删除并匿名化邮箱等身份字段，同时解绑关注与订阅 |
| 地图合规 | 点位数据自维护；港澳台按国家标准标注；底图使用合规地图服务 |

---

## 十、已知边界与后续里程碑

**本期不在范围**（对齐 PRD 0 与说明书 6.2）：

- 爬虫与解密脚本、数据库建库与备份脚本 —— 属已有「自动化采集系统 V1.0」，本产品叠加在其之上；
- **F12 AI 周报 / 日预报** —— 归入 M4 里程碑；
- App 的 APNs / FCM 与厂商推送通道真实对接 —— 需开发者证书与厂商账号，代码已预留通道；
- 微信订阅消息 `wx.requestSubscribeMessage` 真实授权 —— 需小程序 AppID 与真机环境。

**生产上线前待办**：

1. 用专用数据库账号替换 root，并配置 `JWT_SECRET`；
2. 配置 HTTPS 与域名，更新 `APP_BASE_URL` 与 CORS 白名单；
3. 接入真实 SMTP（`.env` 中配置 `SMTP_HOST` 等），关闭 `/api/auth/outbox` 取件箱接口（生产环境已自动 404）；
4. 配置采集完成后的定时任务触发 `/api/admin/alerts/scan`，实现 T+0 自动推送；
5. 按需启用 `nginx` / `admin` profile 做独立部署与统一入口。

**性能基线**（PRD 6 非功能性需求）：数据规模 34 省 × 130 市场 × 29 品种 × 22 个月
（约 **113 万行**），热点查询走内存缓存（TTL 60s），日报与省份榜命中缓存后 < 100ms。
