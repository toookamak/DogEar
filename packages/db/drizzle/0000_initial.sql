CREATE TABLE `bookmarks` (
  `id` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `status` text DEFAULT 'unread' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
