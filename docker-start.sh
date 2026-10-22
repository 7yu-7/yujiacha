#!/bin/bash
# Hugging Face Spaces 容器启动入口
# HF 会注入 PORT（默认 7860），服务端通过 process.env.PORT 读取
set -e

cd /app/server

# 确保表结构存在（幂等）
node scripts/init-db.js

# 若数据库文件因容器重置丢失，则补种（正常构建已预种，这里只是自愈）
if [ ! -f /app/data/fish_price.db ]; then
  echo "[docker-start] 未检测到数据库，重新生成演示数据 …"
  node scripts/seed.js --days "${SEED_DAYS:-90}"
fi

echo "[docker-start] 启动鱼价查服务，监听 ${HOST:-0.0.0.0}:${PORT:-7860}"
exec node src/server.js
