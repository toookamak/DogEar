export type SqliteDatabase = {
  run: (sql: string) => unknown
  query?: (sql: string) => { all: () => Array<{ name: string }> }
}

const bookmarksTable = `CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`

const accessRecordsTable = `CREATE TABLE IF NOT EXISTS access_records (
  id TEXT PRIMARY KEY NOT NULL,
  bookmark_id TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'original'
)`

export function initializeSqliteSchema(database: SqliteDatabase) {
  database.run('BEGIN')
  try {
    database.run(bookmarksTable)
    const columns = database.query?.('PRAGMA table_info(bookmarks)').all() ?? []
    if (!columns.some((column) => column.name === 'sync_status')) {
      database.run("ALTER TABLE bookmarks ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'")
    }
    database.run(accessRecordsTable)
    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }
}
