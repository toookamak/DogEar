CREATE TABLE IF NOT EXISTS `folders` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `parent_id` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `raindrop_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON DELETE SET NULL
);

ALTER TABLE `bookmarks` ADD COLUMN `title` text;
ALTER TABLE `bookmarks` ADD COLUMN `excerpt` text;
ALTER TABLE `bookmarks` ADD COLUMN `cover` text;
ALTER TABLE `bookmarks` ADD COLUMN `type` text DEFAULT 'link' NOT NULL;
ALTER TABLE `bookmarks` ADD COLUMN `author` text;
ALTER TABLE `bookmarks` ADD COLUMN `favicon` text;
ALTER TABLE `bookmarks` ADD COLUMN `published_at` integer;
ALTER TABLE `bookmarks` ADD COLUMN `note` text;
ALTER TABLE `bookmarks` ADD COLUMN `intent` text;
ALTER TABLE `bookmarks` ADD COLUMN `important` integer DEFAULT 0 NOT NULL;
ALTER TABLE `bookmarks` ADD COLUMN `source` text DEFAULT 'page' NOT NULL;
ALTER TABLE `bookmarks` ADD COLUMN `private` integer DEFAULT 0 NOT NULL;
ALTER TABLE `bookmarks` ADD COLUMN `folder_id` text REFERENCES `folders`(`id`) ON DELETE SET NULL;
ALTER TABLE `bookmarks` ADD COLUMN `domain` text;
ALTER TABLE `bookmarks` ADD COLUMN `broken` integer DEFAULT 0 NOT NULL;
ALTER TABLE `bookmarks` ADD COLUMN `raindrop_id` text;
ALTER TABLE `bookmarks` ADD COLUMN `raindrop_extras` text;
ALTER TABLE `bookmarks` ADD COLUMN `version` integer DEFAULT 1 NOT NULL;
ALTER TABLE `bookmarks` ADD COLUMN `deleted_at` integer;
ALTER TABLE `bookmarks` ADD COLUMN `last_opened_at` integer;

CREATE TABLE IF NOT EXISTS `scenes` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `icon` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `aerr` text DEFAULT 'reference' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `bookmark_scenes` (
  `bookmark_id` text NOT NULL,
  `scene_id` text NOT NULL,
  `source` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`bookmark_id`, `scene_id`),
  FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `tags` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `name_key` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `tags_name_key_idx` ON `tags` (`name_key`);

CREATE TABLE IF NOT EXISTS `bookmark_tags` (
  `bookmark_id` text NOT NULL,
  `tag_id` text NOT NULL,
  `source` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`bookmark_id`, `tag_id`),
  FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `suggestions` (
  `id` text PRIMARY KEY NOT NULL,
  `bookmark_id` text NOT NULL,
  `kind` text NOT NULL,
  `target_id` text,
  `target_label` text,
  `confidence` real,
  `rationale` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` integer NOT NULL,
  `resolved_at` integer,
  FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON DELETE CASCADE
);

ALTER TABLE `access_records` ADD COLUMN `client` text DEFAULT 'workbench' NOT NULL;

CREATE TABLE IF NOT EXISTS `operation_log` (
  `id` text PRIMARY KEY NOT NULL,
  `actor` text NOT NULL,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `detail` text,
  `revert_token` text,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `archive_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `bookmark_id` text NOT NULL,
  `type` text DEFAULT 'snapshot' NOT NULL,
  `source` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `error` text,
  `retry_count` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `started_at` integer,
  `completed_at` integer,
  FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `bookmarks_status_created_at_idx` ON `bookmarks` (`status`, `created_at`);
CREATE INDEX IF NOT EXISTS `bookmarks_deleted_at_created_at_idx` ON `bookmarks` (`deleted_at`, `created_at`);
CREATE INDEX IF NOT EXISTS `bookmarks_folder_id_idx` ON `bookmarks` (`folder_id`);
CREATE INDEX IF NOT EXISTS `bookmarks_sync_status_idx` ON `bookmarks` (`sync_status`);
CREATE INDEX IF NOT EXISTS `bookmark_scenes_scene_id_idx` ON `bookmark_scenes` (`scene_id`);
CREATE INDEX IF NOT EXISTS `bookmark_tags_tag_id_idx` ON `bookmark_tags` (`tag_id`);
CREATE INDEX IF NOT EXISTS `access_records_bookmark_id_opened_at_idx` ON `access_records` (`bookmark_id`, `opened_at`);
CREATE INDEX IF NOT EXISTS `suggestions_bookmark_id_status_idx` ON `suggestions` (`bookmark_id`, `status`);
CREATE INDEX IF NOT EXISTS `operation_log_created_at_idx` ON `operation_log` (`created_at`);

INSERT OR IGNORE INTO `scenes` (`id`, `name`, `aerr`, `sort_order`, `enabled`, `created_at`, `updated_at`) VALUES
  ('00000000-0000-4000-8000-000000000001', '工作研究', 'action', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('00000000-0000-4000-8000-000000000002', '灵感收集', 'explore', 2, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('00000000-0000-4000-8000-000000000003', '稍后再读', 'read', 3, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('00000000-0000-4000-8000-000000000004', '长期资料', 'reference', 4, 1, unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR IGNORE INTO `settings` (`key`, `value`, `updated_at`) VALUES
  ('skill.token_hash', '""', unixepoch('now') * 1000),
  ('skill.capabilities', '{"read":true,"write_new":true,"update_existing":false}', unixepoch('now') * 1000),
  ('recycle.retention_days', '7', unixepoch('now') * 1000),
  ('operation_log.retention_days', '30', unixepoch('now') * 1000),
  ('operation_log.max_rows', '5000', unixepoch('now') * 1000);
