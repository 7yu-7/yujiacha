-- ============================================================================
-- 渔价查 · SQLite 表结构（与 sql/schema.sql 语义一致）
-- 用于无 MySQL 密码时的本地运行 / 离线演示（DB_DRIVER=sqlite）
-- 字段、索引、视图与 MySQL 版本保持一一对应
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── 1. price_daily 价格日报主表 ────────────────────────────────────────────
DROP TABLE IF EXISTS price_daily;
CREATE TABLE price_daily (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT          NOT NULL,
  province      TEXT          NOT NULL,
  province_code TEXT          DEFAULT NULL,
  market        TEXT          NOT NULL,
  category_l1   TEXT          NOT NULL,
  category_l2   TEXT          DEFAULT NULL,
  species       TEXT          NOT NULL,
  price         REAL          NOT NULL,
  unit          TEXT          NOT NULL DEFAULT '元/公斤',
  spec          TEXT          DEFAULT NULL,
  source_url    TEXT          DEFAULT NULL,
  batch_no      TEXT          DEFAULT NULL,
  collected_at  TEXT          DEFAULT NULL,
  created_at    TEXT          NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE UNIQUE INDEX uk_daily            ON price_daily (date, province_code, market, species);
CREATE INDEX idx_date                   ON price_daily (date);
CREATE INDEX idx_province_date          ON price_daily (province_code, date);
CREATE INDEX idx_species_date           ON price_daily (species, date);
CREATE INDEX idx_market_date            ON price_daily (market, date);
CREATE INDEX idx_category               ON price_daily (category_l1, category_l2);
CREATE INDEX idx_batch                  ON price_daily (batch_no);

-- ── 2. daily_snapshot ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS daily_snapshot;
CREATE TABLE daily_snapshot (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'published',
  market_count   INTEGER NOT NULL DEFAULT 0,
  province_count INTEGER NOT NULL DEFAULT 0,
  species_count  INTEGER NOT NULL DEFAULT 0,
  record_count   INTEGER NOT NULL DEFAULT 0,
  batch_no       TEXT    DEFAULT NULL,
  published_at   TEXT    DEFAULT NULL
);
CREATE UNIQUE INDEX uk_snapshot_date ON daily_snapshot (date);

-- ── 3. app_user ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS app_user;
CREATE TABLE app_user (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL,
  password_hash  TEXT    NOT NULL,
  nickname       TEXT    DEFAULT NULL,
  role           TEXT    NOT NULL DEFAULT 'user',
  org            TEXT    DEFAULT NULL,
  status         TEXT    NOT NULL DEFAULT 'active',
  email_verified INTEGER NOT NULL DEFAULT 0,
  theme          TEXT    NOT NULL DEFAULT 'light',
  push_enabled   INTEGER NOT NULL DEFAULT 1,
  last_login_at  TEXT    DEFAULT NULL,
  deleted_at     TEXT    DEFAULT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now','+8 hours')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE UNIQUE INDEX uk_user_email ON app_user (email);
CREATE INDEX idx_user_status      ON app_user (status);

-- ── 4. auth_token ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS auth_token;
CREATE TABLE auth_token (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  token      TEXT    NOT NULL,
  expires_at TEXT    NOT NULL,
  used_at    TEXT    DEFAULT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE UNIQUE INDEX uk_token        ON auth_token (token);
CREATE INDEX idx_token_user_type    ON auth_token (user_id, type);

-- ── 5. watch_item ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS watch_item;
CREATE TABLE watch_item (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  species         TEXT    NOT NULL,
  province        TEXT    DEFAULT NULL,
  threshold_up    REAL    DEFAULT NULL,
  threshold_down  REAL    DEFAULT NULL,
  notify_channel  TEXT    DEFAULT 'app',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE UNIQUE INDEX uk_watch ON watch_item (user_id, species, province);
CREATE INDEX idx_watch_user  ON watch_item (user_id);

-- ── 6. alert_log ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS alert_log;
CREATE TABLE alert_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  species     TEXT    NOT NULL,
  province    TEXT    DEFAULT NULL,
  date        TEXT    NOT NULL,
  prev_price  REAL    NOT NULL,
  curr_price  REAL    NOT NULL,
  change_pct  REAL    NOT NULL,
  direction   TEXT    NOT NULL,
  channel     TEXT    DEFAULT NULL,
  pushed      INTEGER NOT NULL DEFAULT 0,
  is_read     INTEGER NOT NULL DEFAULT 0,
  title       TEXT    DEFAULT NULL,
  content     TEXT    DEFAULT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX idx_alert_user_date ON alert_log (user_id, date);
CREATE INDEX idx_alert_unread    ON alert_log (user_id, is_read);

-- ── 7. species_request ────────────────────────────────────────────────────
DROP TABLE IF EXISTS species_request;
CREATE TABLE species_request (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER DEFAULT NULL,
  name       TEXT    NOT NULL,
  province   TEXT    DEFAULT NULL,
  contact    TEXT    DEFAULT NULL,
  remark     TEXT    DEFAULT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX idx_req_status ON species_request (status);

-- ── 8. audit_log ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER DEFAULT NULL,
  user_email TEXT    DEFAULT NULL,
  action     TEXT    NOT NULL,
  target     TEXT    DEFAULT NULL,
  detail     TEXT    DEFAULT NULL,
  ip         TEXT    DEFAULT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX idx_audit_user    ON audit_log (user_id);
CREATE INDEX idx_audit_action  ON audit_log (action);
CREATE INDEX idx_audit_created ON audit_log (created_at);

-- ── 9. sys_config ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS sys_config;
CREATE TABLE sys_config (
  k          TEXT NOT NULL PRIMARY KEY,
  v          TEXT DEFAULT NULL,
  remark     TEXT DEFAULT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

-- ── 10. push_subscription ─────────────────────────────────────────────────
DROP TABLE IF EXISTS push_subscription;
CREATE TABLE push_subscription (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  channel    TEXT    NOT NULL,
  endpoint   TEXT    DEFAULT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX idx_push_user_channel ON push_subscription (user_id, channel);

-- ── 视图：各省当日综合均价 ────────────────────────────────────────────────
DROP VIEW IF EXISTS v_province_daily;
CREATE VIEW v_province_daily AS
SELECT
  date                                   AS date,
  province                               AS province,
  province_code                          AS province_code,
  ROUND(AVG(price), 2)                   AS avg_price,
  ROUND(MIN(price), 2)                   AS min_price,
  ROUND(MAX(price), 2)                   AS max_price,
  COUNT(DISTINCT market)                 AS market_count,
  COUNT(DISTINCT species)                AS species_count,
  COUNT(*)                               AS record_count
FROM price_daily
GROUP BY date, province, province_code;

-- ── 系统配置 ──────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO sys_config (k, v, remark) VALUES
  ('site_name',       '渔价查',                                    '站点名称'),
  ('announcement',    '每日 06:30 自动发布前一日全国水产品价格日报。', '前台公告'),
  ('alert_threshold', '5',                                         '默认异动阈值（%）'),
  ('data_source',     '农业农村部全国农产品价格信息系统 pfsc.agri.cn', '数据来源'),
  ('t0_publish',      'true',                                      'T+0 当日发布'),
  ('hot_search',      '大黄鱼,梭子蟹,对虾,生蚝,鲍鱼,贝类',           '热门搜索快捷键');
