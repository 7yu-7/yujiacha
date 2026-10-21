-- ============================================================================
-- 渔价查 · 智慧渔业全国水产品价格日报系统
-- 数据库结构定义（MySQL 5.7+ / 8.0+）
-- 依据《功能需求文档_智慧渔业水价App_v03》3.2 节 price_daily 表结构
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `fish_price`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE `fish_price`;

-- ── 1. price_daily 价格日报主表（对接已有自动化采集系统的产出表）────────────
DROP TABLE IF EXISTS `price_daily`;
CREATE TABLE `price_daily` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `date`         DATE            NOT NULL                COMMENT '采集日期',
  `province`     VARCHAR(32)     NOT NULL                COMMENT '地区（省份）',
  `province_code` VARCHAR(8)     DEFAULT NULL            COMMENT '省级行政区划代码',
  `market`       VARCHAR(64)     NOT NULL                COMMENT '批发市场',
  `category_l1`  VARCHAR(32)     NOT NULL                COMMENT '大类，如 海水鱼/虾蟹',
  `category_l2`  VARCHAR(32)     DEFAULT NULL            COMMENT '小类',
  `species`      VARCHAR(64)     NOT NULL                COMMENT '品种，如 草鱼',
  `price`        DECIMAL(10,2)   NOT NULL                COMMENT '价格（元/公斤）',
  `unit`         VARCHAR(16)     NOT NULL DEFAULT '元/公斤' COMMENT '单位',
  `spec`         VARCHAR(64)     DEFAULT NULL            COMMENT '规格',
  `source_url`   VARCHAR(255)    DEFAULT NULL            COMMENT '来源 URL（pfsc 链接）',
  `batch_no`     VARCHAR(64)     DEFAULT NULL            COMMENT '采集批次号（可审计）',
  `collected_at` DATETIME        DEFAULT NULL            COMMENT '采集时间戳（UTC+8）',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_daily` (`date`, `province_code`, `market`, `species`),
  KEY `idx_date` (`date`),
  KEY `idx_province_date` (`province_code`, `date`),
  KEY `idx_species_date` (`species`, `date`),
  KEY `idx_market_date` (`market`, `date`),
  KEY `idx_category` (`category_l1`, `category_l2`),
  KEY `idx_batch` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全国水产品价格日报（对接自动化采集系统）';

-- ── 2. 每日大区快照（T+0 发布标记 + 采集批次审计）──────────────────────────
DROP TABLE IF EXISTS `daily_snapshot`;
CREATE TABLE `daily_snapshot` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `date`           DATE          NOT NULL COMMENT '数据日期',
  `status`         VARCHAR(16)   NOT NULL DEFAULT 'published' COMMENT '状态：pending/published',
  `market_count`   INT           NOT NULL DEFAULT 0 COMMENT '覆盖市场数',
  `province_count` INT           NOT NULL DEFAULT 0 COMMENT '覆盖省份数',
  `species_count`  INT           NOT NULL DEFAULT 0 COMMENT '覆盖品种数',
  `record_count`   INT           NOT NULL DEFAULT 0 COMMENT '记录条数',
  `batch_no`       VARCHAR(64)   DEFAULT NULL COMMENT '采集批次号（可审计）',
  `published_at`   DATETIME      DEFAULT NULL COMMENT '发布时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日数据快照（T+0 发布状态）';

-- ── 3. 账户体系（F13 完整账号）─────────────────────────────────────────────
DROP TABLE IF EXISTS `app_user`;
CREATE TABLE `app_user` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`          VARCHAR(128)  NOT NULL COMMENT '邮箱（登录名）',
  `password_hash`  VARCHAR(255)  NOT NULL COMMENT '密码哈希（scrypt 加盐）',
  `nickname`       VARCHAR(64)   DEFAULT NULL COMMENT '昵称 / 称呼',
  `role`           VARCHAR(16)   NOT NULL DEFAULT 'user' COMMENT '角色：user/researcher/gov/admin',
  `org`            VARCHAR(128)  DEFAULT NULL COMMENT '所属机构（教研/政府用户）',
  `status`         VARCHAR(16)   NOT NULL DEFAULT 'active' COMMENT '状态：active/pending/disabled/deleted',
  `email_verified` TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '邮箱是否已验证',
  `theme`          VARCHAR(16)   NOT NULL DEFAULT 'light' COMMENT '主题偏好：light/dark/academic',
  `push_enabled`   TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '是否接收推送',
  `last_login_at`  DATETIME      DEFAULT NULL,
  `deleted_at`     DATETIME      DEFAULT NULL COMMENT '软删除时间（注销）',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账户';

-- ── 4. 令牌（邮箱验证 / 密码重置 / 刷新令牌）──────────────────────────────
DROP TABLE IF EXISTS `auth_token`;
CREATE TABLE `auth_token` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `type`       VARCHAR(24)   NOT NULL COMMENT 'verify_email/reset_password/refresh',
  `token`      VARCHAR(128)  NOT NULL COMMENT '令牌（明文，便于演示邮件链接还原真实流程）',
  `expires_at` DATETIME      NOT NULL COMMENT '过期时间',
  `used_at`    DATETIME      DEFAULT NULL COMMENT '使用时间（一次性）',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token` (`token`),
  KEY `idx_user_type` (`user_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账户令牌（验证/重置/刷新）';

-- ── 5. 关注订阅（F4，多端同步）─────────────────────────────────────────────
DROP TABLE IF EXISTS `watch_item`;
CREATE TABLE `watch_item` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `species`     VARCHAR(64)   NOT NULL COMMENT '品种标准名',
  `province`    VARCHAR(32)   DEFAULT NULL COMMENT '地区维度，空=全国',
  `threshold_up`   DECIMAL(6,2) DEFAULT NULL COMMENT '涨阈值（%）',
  `threshold_down` DECIMAL(6,2) DEFAULT NULL COMMENT '跌阈值（%）',
  `notify_channel` VARCHAR(32) DEFAULT 'app' COMMENT '推送通道：wechat_push/app_push/web_push/inbox',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_species_prov` (`user_id`, `species`, `province`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='关注品种订阅（含异动阈值）';

-- ── 6. 阈值告警记录（F7 异动提醒）──────────────────────────────────────────
DROP TABLE IF EXISTS `alert_log`;
CREATE TABLE `alert_log` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `species`     VARCHAR(64)   NOT NULL,
  `province`    VARCHAR(32)   DEFAULT NULL,
  `date`        DATE          NOT NULL COMMENT '触发日期',
  `prev_price`  DECIMAL(10,2) NOT NULL,
  `curr_price`  DECIMAL(10,2) NOT NULL,
  `change_pct`  DECIMAL(6,2)  NOT NULL COMMENT '涨跌幅（%）',
  `direction`   VARCHAR(8)    NOT NULL COMMENT 'up/down',
  `channel`     VARCHAR(32)   DEFAULT NULL COMMENT '实际推送通道',
  `pushed`      TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否已推送',
  `is_read`     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '用户是否已读',
  `title`       VARCHAR(255)  DEFAULT NULL,
  `content`     VARCHAR(512)  DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`, `date`),
  KEY `idx_unread` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格异动告警记录';

-- ── 7. 数据申报（F2 空结果时的「申报新品种」入口）──────────────────────────
DROP TABLE IF EXISTS `species_request`;
CREATE TABLE `species_request` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED DEFAULT NULL,
  `name`       VARCHAR(64)   NOT NULL COMMENT '申报品种名',
  `province`   VARCHAR(32)   DEFAULT NULL COMMENT '所在地区',
  `contact`    VARCHAR(128)  DEFAULT NULL,
  `remark`     VARCHAR(512)  DEFAULT NULL,
  `status`     VARCHAR(16)   NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='品种申报';

-- ── 8. 操作审计日志（F14 管理后台）────────────────────────────────────────
DROP TABLE IF EXISTS `audit_log`;
CREATE TABLE `audit_log` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED DEFAULT NULL COMMENT '操作人',
  `user_email` VARCHAR(128)  DEFAULT NULL,
  `action`     VARCHAR(64)   NOT NULL COMMENT '动作，如 PRICE_CORRECT/USER_DISABLE',
  `target`     VARCHAR(128)  DEFAULT NULL COMMENT '操作对象',
  `detail`     VARCHAR(512)  DEFAULT NULL COMMENT '详情（变更前后）',
  `ip`         VARCHAR(64)   DEFAULT NULL,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计日志';

-- ── 9. 系统设置 / 公告（F14）──────────────────────────────────────────────
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
  `k`          VARCHAR(64)   NOT NULL,
  `v`          VARCHAR(1024) DEFAULT NULL,
  `remark`     VARCHAR(255)  DEFAULT NULL,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置与公告';

-- ── 10. 推送订阅关系（小程序订阅消息 / Web Push 授权登记）──────────────────
DROP TABLE IF EXISTS `push_subscription`;
CREATE TABLE `push_subscription` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `channel`    VARCHAR(32)   NOT NULL COMMENT 'wechat_push/app_push/web_push',
  `endpoint`   VARCHAR(512)  DEFAULT NULL COMMENT '设备/订阅标识（脱敏存储）',
  `enabled`    TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_channel` (`user_id`, `channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送订阅登记';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 视图：各省当日综合均价（F3 地图比色 / F5 日报表）
-- ============================================================================
CREATE OR REPLACE VIEW `v_province_daily` AS
SELECT
  pd.`date`                        AS `date`,
  pd.`province`                    AS `province`,
  pd.`province_code`               AS `province_code`,
  ROUND(AVG(pd.`price`), 2)        AS `avg_price`,
  ROUND(MIN(pd.`price`), 2)        AS `min_price`,
  ROUND(MAX(pd.`price`), 2)        AS `max_price`,
  COUNT(DISTINCT pd.`market`)      AS `market_count`,
  COUNT(DISTINCT pd.`species`)     AS `species_count`,
  COUNT(*)                         AS `record_count`
FROM `price_daily` pd
GROUP BY pd.`date`, pd.`province`, pd.`province_code`;

-- ============================================================================
-- 初始化系统配置
-- ============================================================================
INSERT INTO `sys_config` (`k`, `v`, `remark`) VALUES
  ('site_name',        '渔价查',                                   '站点名称'),
  ('announcement',     '每日 06:30 自动发布前一日全国水产品价格日报。', '前台公告'),
  ('alert_threshold',  '5',                                        '默认异动阈值（%）'),
  ('data_source',      '农业农村部全国农产品价格信息系统 pfsc.agri.cn', '数据来源'),
  ('t0_publish',       'true',                                     'T+0 当日发布'),
  ('hot_search',       '大黄鱼,梭子蟹,对虾,生蚝,鲍鱼,贝类',          '热门搜索快捷键')
ON DUPLICATE KEY UPDATE `v` = VALUES(`v`);
