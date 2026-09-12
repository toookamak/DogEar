-- 冲突表（双向同步拉回侧，API 结构表 v1.8）：
-- 探测到「同一 raindropId 本地与远端内容都有变化」时记录两端快照；
-- 默认本地赢（本地不动），用户可单条或批量按 local/remote/merge 解决。

CREATE TABLE IF NOT EXISTS `conflicts` (
  `id` text PRIMARY KEY NOT NULL,
  `bookmark_id` text,
  `raindrop_id` text NOT NULL,
  `local_snapshot` text,
  `remote_snapshot` text,
  `resolution` text DEFAULT 'pending' NOT NULL,
  `created_at` integer NOT NULL,
  `resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `conflicts_resolution_idx` ON `conflicts` (`resolution`);
