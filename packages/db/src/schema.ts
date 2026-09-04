import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  raindropId: text('raindrop_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  title: text('title'),
  excerpt: text('excerpt'),
  cover: text('cover'),
  type: text('type').notNull().default('link'),
  author: text('author'),
  favicon: text('favicon'),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  note: text('note'),
  intent: text('intent'),
  important: integer('important', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('unread'),
  source: text('source').notNull().default('page'),
  private: integer('private', { mode: 'boolean' }).notNull().default(false),
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  domain: text('domain'),
  broken: integer('broken', { mode: 'boolean' }).notNull().default(false),
  raindropId: text('raindrop_id'),
  raindropExtras: text('raindrop_extras'),
  syncStatus: text('sync_status').notNull().default('pending'),
  version: integer('version').notNull().default(1),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  lastOpenedAt: integer('last_opened_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  statusCreatedAtIdx: index('bookmarks_status_created_at_idx').on(table.status, table.createdAt),
  deletedCreatedAtIdx: index('bookmarks_deleted_at_created_at_idx').on(table.deletedAt, table.createdAt),
  folderIdx: index('bookmarks_folder_id_idx').on(table.folderId),
  syncStatusIdx: index('bookmarks_sync_status_idx').on(table.syncStatus),
}))

export const scenes = sqliteTable('scenes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  aerr: text('aerr').notNull().default('reference'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const bookmarkScenes = sqliteTable('bookmark_scenes', {
  bookmarkId: text('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
  sceneId: text('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.bookmarkId, table.sceneId] }),
  sceneIdx: index('bookmark_scenes_scene_id_idx').on(table.sceneId),
}))

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  nameKeyIdx: uniqueIndex('tags_name_key_idx').on(table.nameKey),
}))

export const bookmarkTags = sqliteTable('bookmark_tags', {
  bookmarkId: text('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.bookmarkId, table.tagId] }),
  tagIdx: index('bookmark_tags_tag_id_idx').on(table.tagId),
}))

export const suggestions = sqliteTable('suggestions', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  targetId: text('target_id'),
  targetLabel: text('target_label'),
  confidence: real('confidence'),
  rationale: text('rationale'),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
}, (table) => ({
  bookmarkStatusIdx: index('suggestions_bookmark_id_status_idx').on(table.bookmarkId, table.status),
}))

export const accessRecords = sqliteTable('access_records', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
  openedAt: integer('opened_at', { mode: 'timestamp_ms' }).notNull(),
  source: text('source').notNull().default('original'),
  client: text('client').notNull().default('workbench'),
}, (table) => ({
  bookmarkOpenedAtIdx: index('access_records_bookmark_id_opened_at_idx').on(table.bookmarkId, table.openedAt),
}))

export const operationLog = sqliteTable('operation_log', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  detail: text('detail'),
  revertToken: text('revert_token'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  createdAtIdx: index('operation_log_created_at_idx').on(table.createdAt),
}))

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const archiveJobs = sqliteTable('archive_jobs', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('snapshot'),
  source: text('source').notNull(),
  status: text('status').notNull().default('pending'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
})

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').notNull(),
  actor: text('actor').notNull(),
  requestPath: text('request_path').notNull(),
  requestBodyHash: text('request_body_hash').notNull(),
  statusCode: integer('status_code').notNull(),
  responseBody: text('response_body').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.key, table.actor] }),
  expiresIdx: index('idempotency_keys_expires_at_idx').on(table.expiresAt),
}))

export const skillUsage = sqliteTable('skill_usage', {
  date: text('date').notNull(),
  bucket: text('bucket').notNull(),
  count: integer('count').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.date, table.bucket] }),
}))
