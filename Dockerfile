# 鱼价查后端 · Hugging Face Spaces (Docker SDK) 部署镜像
# HF 会自动注入 PORT 环境变量（默认 7860），本镜像监听 0.0.0.0:$PORT
FROM node:22-slim

ENV HOST=0.0.0.0 \
    DB_DRIVER=sqlite \
    NODE_ENV=production \
    SEED_DAYS=90

WORKDIR /app
COPY . .

WORKDIR /app/server
# 装依赖 + 建表 + 预生成 90 天演示数据（写入镜像，启动即秒级就绪）
RUN npm install \
 && mkdir -p /app/data \
 && node scripts/init-db.js \
 && node scripts/seed.js --days 90

EXPOSE 7860

CMD ["bash", "/app/docker-start.sh"]
