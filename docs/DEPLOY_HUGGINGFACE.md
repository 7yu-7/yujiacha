# 鱼价查 · Hugging Face Spaces 部署指南（免绑卡）

后端是一个纯 Node 22 + 内置 `node:sqlite` 的 REST API，没有任何需要编译的原生依赖。
因此可以直接打包成 Docker 镜像，部署到 **Hugging Face Spaces（Docker 型）**——
**完全免费、无需信用卡、自动获得公网 https 地址**，供微信小程序 / App / Web 调用。

> 备选：仓库里也保留了 `render.yaml`（Render 蓝图），如果以后你愿意绑卡，Render 同样可用。

---

## 一、前置条件

- 一个 Hugging Face 账号：https://huggingface.co/join （用邮箱即可，免绑卡）
- 你的代码已在 GitHub：`https://github.com/7yu-7/yujiacha`（master 分支，已含根目录 `Dockerfile`）

---

## 二、创建 Space 并链接 GitHub（约 3 分钟）

1. 打开 https://huggingface.co/spaces → 点右上角 **Create new Space**（新建 Space）。
2. **Owner**：选你的账号 `7yu-7`；**Space name**：填 `yujiacha`（最终地址形如
   `https://7yu-7-yujiacha.hf.space`，名字可自定义）。
3. **SDK**：选择 **Docker**（不要选 Gradio / Streamlit）。
4. **Space 可见性**：选 **Public**（公开，才能被小程序公网访问）。
5. 先不要在本页写代码——翻到下方 **Repository** 区域，勾选
   **Link to a Git repository**（链接到 Git 仓库）→ 选 **GitHub** →
   授权后选中 `7yu-7/yujiacha`，分支填 `master`。
   - 链接后 HF 会从仓库**根目录**读取 `Dockerfile` 自动构建，构建命令/端口都不用填。
6. 点 **Create Space**。

> 若你更想手动管理：也可以不链接 GitHub，直接在本仓库里只放 `Dockerfile` 并提交，
> HF 同样会构建。链接 GitHub 的好处是「推送代码即自动重新部署」。

---

## 三、等待构建

- 进入 Space 页面后，顶部会显示 **Building…**（首次构建约 2–5 分钟：
  拉取 node:22-slim + 装依赖 + 生成 90 天演示数据）。
- 构建完成后状态变为 **Running**，页面顶部出现地址
  `https://7yu-7-yujiacha.hf.space`（以你实际命名为准）。
- 验证：浏览器打开 `https://<你的地址>/api/health`，应返回 `{"status":"ok"}`。
  再试 `https://<你的地址>/api/species`，应返回品种列表 JSON。

---

## 四、把小程序后端切到 HF 地址

拿到地址后，改一处即可（我也可以帮你改并重新提交）：

文件：`wechat-miniprogram/app.js`

```js
globalData: {
  baseUrl: 'https://7yu-7-yujiacha.hf.space', // ← 改成你的 HF 地址
  sharecode: '',                               // ← HF 不需要 sharecode，置空
  ...
}
```

---

## 五、微信小程序「request 合法域名」白名单

在 **微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名** 中添加：

```
https://7yu-7-yujiacha.hf.space
```

（把域名换成你实际的 Space 地址；只需加 https 那一条，wss/upload/download 暂不需要。）

> ⚠️ **关于备案的重要提示（个人主体必读）**
> 微信对**个人主体**小程序的 request 合法域名，要求该域名已完成 **ICP 备案**。
> `hf.space` 是境外域名，大概率**没有中国大陆 ICP 备案号**，因此在「正式提审发布」时
> 微信可能拒绝该域名；但在「微信开发者工具 → 详情 → 本地设置 → 勾选『不校验合法域名』」
> 的开发/预览阶段**完全正常可用**。
>
> 结论：HF 方案适合**开发、预览、演示、对外临时访问**；若要**正式上架发布**，
> 需要换一个已完成 ICP 备案的国内域名（例如 WorkBuddy 提供的
> `yujiacha.app.workbuddy.host`，或你自己的备案域名，或用备案过的云服务器）。
> 这一步等你要正式提审时再处理即可，不影响现在把功能跑通。

---

## 六、免费档说明

- HF 免费 Docker Space 在一段时间无访问后会**自动休眠**，首次访问约 **5–20 秒**冷启动，
  之后访问正常（和 Render 类似）。
- 休眠不会丢数据：演示数据已烤进镜像，每次唤醒都从完整数据启动。
- 如需常驻不休眠，可在 Space 设置里升级（付费，非必需）。

---

## 七、常见问题

- **构建失败 / 一直 Building**：检查仓库根目录确实有 `Dockerfile`、分支是 `master`、
  且 `server/` 目录完整。可在 Space 的 **Logs** 标签查看具体报错。
- **/api/health 返回 404**：说明服务没起来，看 Logs 里是否有 `node:sqlite` 报错
  （正常不应有，Node 22 内置）。
- **小程序一直「暂无数据」**：先确认浏览器能打开 `/api/species` 返回 JSON；
  再确认小程序里 `baseUrl` 已改成 HF 地址、`sharecode` 已置空、且开发者工具勾选了
  「不校验合法域名」（预览阶段必须勾）。
