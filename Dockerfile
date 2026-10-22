# ============================================================================
# 鱼价查 · Hugging Face Spaces (Docker) 部署镜像
# 仅承载统一 REST API（微信小程序 / 移动 App / 管理后台 / Web-H5 四端共用）
#
# Hugging Face Docker Spaces 约定：
#   1) 应用必须监听 0.0.0.0，端口取环境变量 PORT（HF 固定注入 7860）
#   2) Dockerfile 必须位于仓库根目录（链接 GitHub 仓库时从根读取）
#   3) 构建阶段在本镜像内完成「建表 + 生成演示数据」，启动秒级、无需重复播种
# ============================================================================
FROM node:22-slim

WORKDIR /app

# ── 依赖层（仅 mysql2；sqlite 模式不加载，node:sqlite 为 Node 22 内置）────
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

# ── 应用代码（保持 server/ 完整，路径解析依赖 server/scripts→根 的关系）──
COPY server/src    ./server/src
COPY server/sql    ./server/sql
COPY server/scripts ./server/scripts

# ── 运行时数据目录（SQLite 回退库 / 邮件取件箱）──────────────────────────
RUN mkdir -p /app/data/mail

# ── 构建期：建表 + 生成 90 天演示数据，直接烤进镜像（启动自愈、秒级就绪）──
RUN mkdir -p /app/data \
 && cd server \
 && node scripts/init-db.js \
 && node scripts/seed.js --days 90

# ── 运行时环境变量 ────────────────────────────────────────────────────────
ENV DB_DRIVER=sqlite \
    HOST=0.0.0.0 \
    NODE_ENV=production \
    PORT=7860 \
    SEED_DAYS=90

EXPOSE 7860

# ── 启动：若数据库缺失则自动补种（自愈），随后启动服务 ──────────────────
CMD cd /app/server \
 && ([ -f /app/data/fish_price.db ] || (node scripts/init-db.js && node scripts/seed.js --days 90)) \
 && node src/server.js
