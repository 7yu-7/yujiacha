/**
 * 数据库初始化脚本
 * 用法：
 *   node scripts/init-db.js            建库建表（幂等）
 *   node scripts/init-db.js --drop     先删库重建（危险，仅开发）
 *
 * 支持 MySQL 与 SQLite 两种驱动，表结构由 sql/schema.sql（MySQL）与
 * sql/schema.sqlite.sql（SQLite）分别定义，语义保持一致。
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/lib/db');

async function main() {
  const drop = process.argv.includes('--drop');
  const driver = config.usingSqlite ? 'sqlite' : 'mysql';
  console.log('═'.repeat(72));
  console.log(` 渔价查 · 数据库初始化   驱动：${driver}${drop ? '   模式：重建' : ''}`);
  console.log('═'.repeat(72));

  if (driver === 'sqlite') {
    const file = config.db.sqlite.file;
    if (drop && fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
      fs.rmSync(file + '-wal', { force: true });
      fs.rmSync(file + '-shm', { force: true });
      console.log(` · 已删除旧库文件 ${file}`);
    }
    const ddl = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sqlite.sql'), 'utf8');
    await db.exec(ddl);
    console.log(` ✓ SQLite 表结构创建完成：${file}`);
  } else {
    const mysql = require('mysql2/promise');
    const { host, port, user, password, database } = config.db.mysql;

    let conn;
    try {
      conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true, charset: 'utf8mb4' });
    } catch (e) {
      console.error('\n✗ 无法连接 MySQL：', e.code || e.message);
      console.error('  请检查 .env 中 DB_USER / DB_PASSWORD / DB_HOST / DB_PORT，并确认 MySQL 服务已启动。');
      console.error('  若暂时没有密码，可改用内置数据库：在 .env 中设置 DB_DRIVER=sqlite');
      process.exit(1);
    }

    try {
      if (drop) {
        await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
        console.log(` · 已删除数据库 ${database}`);
      }
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
      await conn.query(`USE \`${database}\``);

      const ddl = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
      // 去掉库级语句（已单独执行），其余建表语句整体执行
      const cleaned = ddl
        .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
        .replace(/USE `?\w+`?\s*;/gi, '');
      await conn.query(cleaned);
      console.log(` ✓ MySQL 表结构创建完成：${user}@${host}:${port}/${database}`);

      const [tables] = await conn.query(
        `SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`, [database]
      );
      console.log(`   表清单：${tables.map((x) => x.t).join(', ')}`);
    } finally {
      await conn.end();
    }
  }

  const info = await db.ping();
  console.log(`\n ✓ 连通性校验通过：${JSON.stringify(info)}`);
  console.log('   下一步：node scripts/seed.js   （生成演示数据）');
}

main()
  .then(async () => { await db.close(); process.exit(0); })
  .catch(async (e) => { console.error('\n✗ 初始化失败：', e); await db.close().catch(() => {}); process.exit(1); });
