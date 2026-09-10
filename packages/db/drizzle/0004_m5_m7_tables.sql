-- M5–M7 表补齐 + 迁移链索引补齐（轨 A / D1 与自托管通用）
--
-- 背景：0000–0003 只覆盖到 M4，下列结构此前仅由 packages/db 的 initializeSqliteSchema()
-- 在启动时补建，自托管（Bun/SQLite）因此正常，但 D1 不会执行该初始化函数，
-- 缺表缺索引会导致运行时报错或全表扫描。本迁移把这些补进迁移链，
-- 使「从零迁移」即可得到应用所需的完整 schema。
--
-- DDL 与 packages/db/src/sqlite.ts 的 tableDefinitions / createIndexes 保持一致。

CREATE TABLE IF NOT EXISTS `sync_queue` (
  `id` text PRIMARY KEY NOT NULL,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `channel` text NOT NULL,
  `payload` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `retry_count` integer DEFAULT 0 NOT NULL,
  `error` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `channel_config` (
  `id` text PRIMARY KEY NOT NULL,
  `channel` text NOT NULL,
  `label` text NOT NULL,
  `config` text NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `archives` (
  `id` text PRIMARY KEY NOT NULL,
  `bookmark_id` text NOT NULL,
  `type` text DEFAULT 'snapshot' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `file_path` text,
  `file_size` integer,
  `mime_type` text,
  `metadata` text,
  `error` text,
  `created_at` integer NOT NULL,
  `completed_at` integer,
  FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `backups` (
  `id` text PRIMARY KEY NOT NULL,
  `tier` text NOT NULL,
  `target` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `file_path` text,
  `file_size` integer,
  `includes` text NOT NULL,
  `error` text,
  `created_at` integer NOT NULL,
  `completed_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `nav_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `mode` text DEFAULT 'all' NOT NULL,
  `rule` text,
  `search_query` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sync_queue_status_channel_idx` ON `sync_queue` (`status`, `channel`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sync_queue_created_at_idx` ON `sync_queue` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `channel_config_channel_enabled_idx` ON `channel_config` (`channel`, `enabled`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archives_bookmark_id_status_idx` ON `archives` (`bookmark_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `backups_tier_target_idx` ON `backups` (`tier`, `target`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `backups_created_at_idx` ON `backups` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `nav_rules_enabled_sort_order_idx` ON `nav_rules` (`enabled`, `sort_order`);
--> statement-breakpoint
-- 补齐既有表上缺失的索引（raindrop 去重导入依赖此索引，见 channels-routes 的按 raindropId 去重）
CREATE INDEX IF NOT EXISTS `bookmarks_raindrop_id_idx` ON `bookmarks` (`raindrop_id`);
--> statement-breakpoint
-- 默认数据：与 packages/db 的 seedDefaults() 对齐，保证新库开箱有 Scene 与设置项。
-- 迁移文件是静态 SQL，时间戳取执行时刻（毫秒）。
INSERT OR IGNORE INTO `scenes` (`id`, `name`, `aerr`, `sort_order`, `enabled`, `created_at`, `updated_at`) VALUES
  ('00000000-0000-4000-8000-000000000001', '工作研究', 'action', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('00000000-0000-4000-8000-000000000002', '灵感收集', 'explore', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('00000000-0000-4000-8000-000000000003', '稍后再读', 'read', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('00000000-0000-4000-8000-000000000004', '长期资料', 'reference', 4, 1, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);
--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `updated_at`) VALUES
  ('skill.token_hash', '""', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('skill.capabilities', '{"read":true,"write_new":true,"update_existing":false}', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('recycle.retention_days', '7', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('operation_log.retention_days', '30', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('operation_log.max_rows', '5000', CAST(strftime('%s','now') AS INTEGER) * 1000);
