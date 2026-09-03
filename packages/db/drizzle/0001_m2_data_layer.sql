ALTER TABLE `bookmarks` ADD COLUMN `sync_status` text DEFAULT 'pending' NOT NULL;

CREATE TABLE `access_records` (
  `id` text PRIMARY KEY NOT NULL,
  `bookmark_id` text NOT NULL,
  `opened_at` integer NOT NULL,
  `source` text DEFAULT 'original' NOT NULL
);
