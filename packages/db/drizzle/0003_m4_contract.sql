CREATE TABLE IF NOT EXISTS `idempotency_keys` (
  `key` text NOT NULL,
  `actor` text NOT NULL,
  `request_path` text NOT NULL,
  `request_body_hash` text NOT NULL,
  `status_code` integer NOT NULL,
  `response_body` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`key`, `actor`)
);

CREATE INDEX IF NOT EXISTS `idempotency_keys_expires_at_idx` ON `idempotency_keys` (`expires_at`);

CREATE TABLE IF NOT EXISTS `skill_usage` (
  `date` text NOT NULL,
  `bucket` text NOT NULL,
  `count` integer DEFAULT 0 NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`date`, `bucket`)
);

ALTER TABLE `archive_jobs` ADD COLUMN `updated_at` integer;

UPDATE `archive_jobs` SET `status` = 'running' WHERE `status` = 'processing';
UPDATE `archive_jobs` SET `status` = 'succeeded' WHERE `status` = 'completed';
