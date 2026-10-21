/**
 * 数据库访问层
 * 统一封装 MySQL 与 SQLite（node:sqlite）两种驱动，对外暴露同一套 query/exec/run/tx 接口。
 *
 * 设计取舍：
 *  - 所有日期区间都由 JS 计算后以参数传入，避免使用 DATE_SUB / CURDATE 等方言函数；
 *  - Upsert 走「先查后写」通用实现，避免 ON DUPLICATE KEY / ON CONFLICT 语法差异；
 *  - 因此同一份业务 SQL 在 MySQL 与 SQLite 上行为一致。
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

let pool = null;
let sqliteDb = null;

// ── MySQL 驱动 ──────────────────────────────────────────────────────────
async function initMysql() {
  const mysql = require('mysql2/promise');
  const { host, port, user, password, database, connectionLimit, charset } = config.db.mysql;

  // 先不指定 database 连接，确保库存在（库不存在时给出清晰指引）
  try {
    pool = mysql.createPool({ host, port, user, password, database, connectionLimit, charset, decimalNumbers: true, multipleStatements: false });
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
  } catch (err) {
    pool = null;
    const e = new Error(
      `MySQL 连接失败（${user}@${host}:${port}/${database}）：${err.code || err.message}\n` +
      '请确认：1) MySQL 服务已启动；2) .env 中 DB_USER / DB_PASSWORD 正确；' +
      '3) 已执行 npm run init:db 建库建表。\n' +
      '若暂时无法提供密码，可设置 DB_DRIVER=sqlite 使用内置数据库。'
    );
    e.cause = err;
    e.code = err.code;
    throw e;
  }
}

// ── SQLite 驱动（node:sqlite，Node 22+ 内置，零依赖）────────────────────
function initSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const file = config.db.sqlite.file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sqliteDb = new DatabaseSync(file);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
}

async function connect() {
  if (config.usingSqlite) {
    if (!sqliteDb) initSqlite();
  } else {
    if (!pool) await initMysql();
  }
}

// ── 统一查询接口 ────────────────────────────────────────────────────────
async function query(sql, params = []) {
  await connect();
  if (config.usingSqlite) {
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...normalize(params));
  }
  const [rows] = await pool.execute(sql, normalize(params));
  return rows;
}

/** 执行写语句，返回 { insertId, affectedRows } */
async function run(sql, params = []) {
  await connect();
  if (config.usingSqlite) {
    const stmt = sqliteDb.prepare(sql);
    const r = stmt.run(...normalize(params));
    return { insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) };
  }
  const [res] = await pool.execute(sql, normalize(params));
  return { insertId: res.insertId, affectedRows: res.affectedRows };
}

/** 执行多语句 DDL（仅初始化脚本使用） */
async function exec(sql) {
  await connect();
  if (config.usingSqlite) {
    sqliteDb.exec(sql);
    return;
  }
  const mysql = require('mysql2/promise');
  const { host, port, user, password, connectionLimit, charset } = config.db.mysql;
  const conn = await mysql.createConnection({ host, port, user, password, connectionLimit, charset, multipleStatements: true });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
}

/** 事务：callback 内使用同一连接顺序执行 */
async function tx(fn) {
  await connect();
  if (config.usingSqlite) {
    sqliteDb.exec('BEGIN');
    try {
      const r = await fn({ query: query, run: run });
      sqliteDb.exec('COMMIT');
      return r;
    } catch (e) {
      sqliteDb.exec('ROLLBACK');
      throw e;
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const api = {
      query: async (sql, p = []) => (await conn.execute(sql, normalize(p)))[0],
      run: async (sql, p = []) => {
        const [r] = await conn.execute(sql, normalize(p));
        return { insertId: r.insertId, affectedRows: r.affectedRows };
      },
    };
    const r = await fn(api);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 通用 Upsert（先查后写，跨方言一致）
 * @param {string} table
 * @param {object} row            要写入的字段
 * @param {string[]} keys         唯一键字段名（用于判断是否已存在）
 * @param {object} [conn]         可选：事务连接
 */
async function upsert(table, row, keys, conn = null) {
  const api = conn || { query, run };
  const where = keys.map((k) => `${k} = ?`).join(' AND ');
  const keyVals = keys.map((k) => row[k]);
  const existing = await api.query(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, keyVals);

  if (existing.length > 0) {
    const setCols = Object.keys(row).filter((c) => !keys.includes(c));
    if (setCols.length === 0) return { id: existing[0].id, updated: false };
    const setSql = setCols.map((c) => `${c} = ?`).join(', ');
    await api.run(`UPDATE ${table} SET ${setSql} WHERE id = ?`, [...setCols.map((c) => row[c]), existing[0].id]);
    return { id: existing[0].id, updated: true };
  }

  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  const res = await api.run(sql, cols.map((c) => row[c]));
  return { id: res.insertId, updated: false };
}

/**
 * 批量插入（多行 VALUES 提升吞吐；自动按参数上限切分）
 * MySQL 单语句占位符上限 65535，SQLite 变量上限 32766，取保守值。
 */
async function batchInsert(table, rows, { rowsPerStatement = 200, conn = null } = {}) {
  if (!rows.length) return 0;
  const api = conn || { run };
  const cols = Object.keys(rows[0]);
  const colCount = cols.length;
  const perStmt = Math.max(1, Math.min(rowsPerStatement, Math.floor(30000 / colCount)));
  const placeholders = `(${cols.map(() => '?').join(', ')})`;
  let total = 0;
  for (let i = 0; i < rows.length; i += perStmt) {
    const chunk = rows.slice(i, i + perStmt);
    const valuesSql = chunk.map(() => placeholders).join(', ');
    const params = [];
    for (const r of chunk) for (const c of cols) params.push(r[c]);
    await api.run(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${valuesSql}`,
      params
    );
    total += chunk.length;
  }
  return total;
}

/** 参数归一化：MySQL 不接受 undefined，SQLite 不接受 boolean */
function normalize(params) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return config.usingSqlite ? (p ? 1 : 0) : p;
    if (p instanceof Date) return formatDateTime(p);
    return p;
  });
}

function pad(n) { return String(n).padStart(2, '0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatDateTime(d) { return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

async function close() {
  if (pool) { await pool.end(); pool = null; }
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }
}

async function ping() {
  await connect();
  if (config.usingSqlite) {
    sqliteDb.prepare('SELECT 1 AS ok').all();
    return { driver: 'sqlite', file: config.db.sqlite.file };
  }
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  return { driver: 'mysql', database: config.db.mysql.database };
}

module.exports = { connect, query, run, exec, tx, upsert, batchInsert, close, ping, formatDate, formatDateTime };
