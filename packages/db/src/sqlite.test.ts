import { describe, expect, it } from 'vitest'
import { initializeSqliteSchema } from './sqlite.js'

type FakeDatabase = {
  statements: string[]
  columns: Record<string, Array<{ name: string }>>
  run: (sql: string) => void
  query: (sql: string) => { all: () => Array<{ name: string }> }
}

const bookmarkColumns = ['id', 'url', 'status', 'created_at', 'updated_at']

function createDatabase(initialBookmarkColumns = bookmarkColumns, initialAccessColumns = ['id', 'bookmark_id', 'opened_at', 'source']): FakeDatabase {
  const statements: string[] = []
  const columns = {
    bookmarks: initialBookmarkColumns.map((name) => ({ name })),
    access_records: initialAccessColumns.map((name) => ({ name })),
  }
  const database = {
    statements,
    columns,
    run(sql: string) {
      database.statements.push(sql)
      const bookmarkMatch = sql.match(/^ALTER TABLE bookmarks ADD COLUMN (\w+)/)
      if (bookmarkMatch) database.columns.bookmarks.push({ name: bookmarkMatch[1] })
      if (sql.startsWith('ALTER TABLE access_records ADD COLUMN client')) database.columns.access_records.push({ name: 'client' })
    },
    query(sql: string) {
      const table = sql.match(/table_info\((\w+)\)/)?.[1] ?? 'bookmarks'
      return { all: () => database.columns[table as keyof typeof database.columns] ?? [] }
    },
  }
  return database
}

describe('SQLite schema initialization', () => {
  it('creates M3/M4 tables, indexes and defaults for a fresh database', () => {
    const database = createDatabase()

    initializeSqliteSchema(database)

    expect(database.statements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS scenes'))).toBe(true)
    expect(database.statements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS archive_jobs'))).toBe(true)
    expect(database.statements).toContain('CREATE INDEX IF NOT EXISTS suggestions_bookmark_id_status_idx ON suggestions(bookmark_id, status)')
    expect(database.statements.some((statement) => statement.includes('INSERT OR IGNORE INTO scenes'))).toBe(true)
    expect(database.statements.at(-1)).toBe('COMMIT')
  })

  it('upgrades an M1 database and adds all missing columns and client', () => {
    const database = createDatabase()

    initializeSqliteSchema(database)

    expect(database.statements.filter((statement) => statement.startsWith('ALTER TABLE bookmarks'))).toHaveLength(21)
    expect(database.statements.filter((statement) => statement.startsWith('ALTER TABLE access_records'))).toHaveLength(1)
  })

  it('is idempotent for bookmark and access record columns', () => {
    const database = createDatabase()

    initializeSqliteSchema(database)
    const firstBookmarkAlters = database.statements.filter((statement) => statement.startsWith('ALTER TABLE bookmarks')).length
    const firstAccessAlterCount = database.statements.filter((statement) => statement.startsWith('ALTER TABLE access_records')).length

    initializeSqliteSchema(database)

    expect(database.statements.filter((statement) => statement.startsWith('ALTER TABLE bookmarks'))).toHaveLength(firstBookmarkAlters)
    expect(database.statements.filter((statement) => statement.startsWith('ALTER TABLE access_records'))).toHaveLength(firstAccessAlterCount)
  })

  it('keeps M2 columns and only adds the client column to access records', () => {
    const database = createDatabase([
      ...bookmarkColumns,
      'title', 'excerpt', 'cover', 'type', 'author', 'favicon', 'published_at', 'note', 'intent', 'important',
      'source', 'private', 'folder_id', 'domain', 'broken', 'raindrop_id', 'raindrop_extras', 'sync_status',
      'version', 'deleted_at', 'last_opened_at',
    ], ['id', 'bookmark_id', 'opened_at', 'source'])

    initializeSqliteSchema(database)

    expect(database.statements.some((statement) => statement.startsWith('ALTER TABLE bookmarks'))).toBe(false)
    expect(database.statements.filter((statement) => statement.startsWith('ALTER TABLE access_records'))).toHaveLength(1)
  })
})
