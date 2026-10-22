# 鱼价查后端 · Hugging Face Spaces 部署指引（免绑卡）

当 Render 强制要求信用卡、而你只有银联/借记卡无法绑定时，用本方案。
Hugging Face Spaces **免费、无需信用卡、自带公网 https 域名**，小程序同样可调用。

## 原理
- 仓库根已提供 `Dockerfile` + `docker-start.sh`，基于 `node:22-slim` 运行原生 Node 后端（`node:sqlite` 零原生依赖，无需编译）。
- HF 会自动注入 `PORT`（默认 7860），服务端监听 `0.0.0.0:$PORT`。
- 演示数据在镜像构建阶段生成（约 30 秒），容器启动即秒级就绪；数据库若丢失会自动补种。

## 步骤（约 5 分钟）
1. 打开 https://huggingface.co → 用邮箱或 GitHub 注册/登录（**无需信用卡**）。
2. 右上角 **New → Space** → 填写：
   - **Name**：`yujiacha`
   - **SDK**：选 **Docker**
   - **Space 名/可见性**：Public（公开，才能被小程序公网访问）
   - 勾选同意条款 → **Create Space**。
3. 进入 Space 后，在 **Settings → Repository** 里选择 **Sync with GitHub**（关联你已授权的 `7yu-7/yujiacha` 仓库），或把本仓库的 `Dockerfile` / `docker-start.sh` / `server/` 目录内容直接推到 Space 的 git 仓库。
4. HF 自动按 `Dockerfile` 构建并启动（首次构建 2–4 分钟）。完成后页面显示形如
   `https://yujiacha.hf.space` 的地址。
5. 验证：浏览器打开 `https://yujiacha.hf.space/api/health`，应返回 `{"status":"ok"}`。

## 切换小程序后端
拿到 `https://yujiacha.hf.space` 后，把 `wechat-miniprogram/app.js` 里的：
```js
globalData: {
  baseUrl: 'https://yujiacha.hf.space',
  sharecode: ''   // HF 部署不需要 sharecode，留空
}
```
然后在 **微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名** 中加入
`https://yujiacha.hf.space` 即可正式对外。

## 注意事项
- HF Spaces 免费档在一段时间无访问后也会休眠，首次唤醒约 30–50 秒，之后正常（与 Render 类似）。
- 若需数据持久化（避免偶尔重建数据），可在 Space **Settings → Persistent Storage** 开启，并把 `docker-start.sh` 里的数据库路径改为 `/data/fish_price.db`（目前演示数据可随时重建，默认即可）。
