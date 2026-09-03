import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  status: text('status').notNull().default('unread'),
  syncStatus: text('sync_status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const accessRecords = sqliteTable('access_records', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull(),
  openedAt: integer('opened_at', { mode: 'timestamp_ms' }).notNull(),
  source: text('source').notNull().default('original'),
})
