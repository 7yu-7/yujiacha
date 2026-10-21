#!/usr/bin/env bash
# 云端 / 托管部署引导脚本（Linux 容器）
# 功能：确保监听 0.0.0.0、使用内置 SQLite、自动建库+轻量种子、启动服务
# 环境变量（均可被外部覆盖）：
#   HOST            监听地址（默认 0.0.0.0，务必对外）
#   PORT            监听端口（平台通常注入，默认 8787）
#   DB_DRIVER       数据库驱动（默认 sqlite，云端无需 MySQL）
#   SEED_DAYS       演示数据历史天数（默认 90，约 80MB；如需更全可设 669）
#   APP_BASE_URL    站点对外地址（影响邮件/分享链接，可后续设置）
set -e

cd "$(dirname "$0")/.."          # → 项目根 yujiacha/
export DB_DRIVER="${DB_DRIVER:-sqlite}"
export HOST="${HOST:-0.0.0.0}"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-8787}"

# 确保 SQLite 文件所在目录存在
mkdir -p data

cd server
echo "════════════════════════════════════════════════════════════"
echo " 鱼价查 · 云端启动引导"
echo " driver=${DB_DRIVER}  host=${HOST}  port=${PORT}  seedDays=${SEED_DAYS:-90}"
echo "════════════════════════════════════════════════════════════"

echo "[1/3] 初始化数据库表结构 …"
node scripts/init-db.js

echo "[2/3] 生成演示数据（--days ${SEED_DAYS:-90}）…"
node scripts/seed.js --days "${SEED_DAYS:-90}"

echo "[3/3] 启动服务 …"
exec node src/server.js
