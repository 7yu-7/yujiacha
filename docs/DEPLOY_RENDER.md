# 鱼价查 · 云端部署指南（Render）

本仓库后端采用 **Node 22 内置 `node:sqlite`**，零外部依赖、无需编译原生模块，可一键部署到 [Render](https://render.com) 免费档，获得一个对外可访问、稳定的 HTTPS 地址，供四端（Web-H5 / Admin / 微信小程序 / App）调用。

## 1. 准备

- 一个 GitHub 账号，且本仓库已推送（`7yu-7/yujiacha`）。
- 一个 Render 账号（免费注册，支持 GitHub 登录，无需信用卡即可用免费档）。

## 2. 部署步骤

1. 打开 <https://dashboard.render.com> → 右上角 **New +** → **Web Service**。
2. 选择 **Connect a repository** → 授权 GitHub → 选中 `yujiacha` 仓库。
3. 在配置页确认 / 填写：
   - **Name**：`yujiacha`
   - **Region**：`Oregon`（离中国更近可改 `Singapore` 或 `Frankfurt`）
   - **Branch**：`master`
   - **Runtime**：`Node`
   - **Build Command**：
     ```
     cd server && npm install && mkdir -p ../data && node scripts/init-db.js && node scripts/seed.js --days 90
     ```
   - **Start Command**：
     ```
     cd server && node scripts/init-db.js && ([ -f ../data/fish_price.db ] || node scripts/seed.js --days 90) && node src/server.js
     ```
   - **Plan**：`Free`
4. 展开 **Advanced → Environment Variables**，添加：
   | Key | Value |
   |-----|-------|
   | `DB_DRIVER` | `sqlite` |
   | `HOST` | `0.0.0.0` |
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `22.x` |
   | `SEED_DAYS` | `90` |
   > 注意：`PORT` 由 Render 自动注入，不要手动设置。

   （以上变量也已写进仓库根目录的 `render.yaml`，用「Blueprint」方式导入可自动带出。）
5. 点击 **Create Web Service**。首次构建会安装依赖并生成约 90 天演示数据（约 30 秒），随后自动启动。
6. 部署完成后，Render 会分配形如 `https://yujiacha.onrender.com` 的地址。**进入该地址 `/api/health` 应返回 `{"status":"ok",...}`**。

## 3. 让四端指向新地址

部署拿到地址后，需要把前端写死的 API 域名改掉：

- **微信小程序**：编辑 `wechat-miniprogram/app.js`，将 `globalData.baseUrl` 改为
  `https://<你的render地址>`（如 `https://yujiacha.onrender.com`）。
- **Web-H5 / Admin / App**：若同样写死域名，按各自配置替换 `VUE_APP_API_BASE` / 后端 `APP_BASE_URL` 等。
- 改完重新构建 / 上传小程序即可。

## 4. 小程序「合法域名」白名单（上线必做）

微信小程序正式版要求 request 域名在公众平台备案：

1. 登录 <https://mp.weixin.qq.com> → 你的小程序 → **开发 → 开发管理 → 开发设置 → 服务器域名**。
2. **request 合法域名** 添加：`https://yujiacha.onrender.com`（换成你的真实地址）。
3. 开发调试阶段可临时开启开发者工具「**不校验合法域名、web-view…**」跳过校验。

## 5. 免费档注意事项

- 免费 Web Service 在 **15 分钟无访问后会休眠**，首次请求约需 30–50 秒唤醒；之后正常。
- 休眠/重启不会丢失数据库（同一部署实例文件系统保留）；重新部署（新提交）会重新构建并重新生成演示数据。
- 如需常驻（不休眠），在 Render 将 Plan 升级为 **Starter** 即可。

## 6. 可选调优

- 想加快构建：将 `SEED_DAYS` 调小（如 `30`）。
- 想换地区降低延迟：Region 选 `Singapore`。
- 想用真实 MySQL：在 Render 创建一个 PostgreSQL/MySQL 实例，设置 `DB_DRIVER=mysql` 及相关 `DB_*` 变量即可（代码已兼容）。
