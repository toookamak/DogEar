import { describe, expect, it } from 'vitest'
import { initializeSqliteSchema } from './sqlite.js'

type FakeDatabase = {
  statements: string[]
  columns: Array<{ name: string }>
  run: (sql: string) => void
  query: (sql: string) => { all: () => Array<{ name: string }> }
}

function createDatabase(columns: Array<{ name: string }> = []): FakeDatabase {
  const statements: string[] = []
  const database = {
    statements,
    columns,
    run(sql: string) {
      database.statements.push(sql)
      if (sql.startsWith('ALTER TABLE bookmarks')) database.columns.push({ name: 'sync_status' })
    },
    query() {
      return { all: () => database.columns }
    },
  }
  return database
}

describe('SQLite schema initialization', () => {
  it('creates the complete M2 schema for a fresh database', () => {
    const database = createDatabase()

    initializeSqliteSchema(database)

    expect(database.statements).toEqual([
      'BEGIN',
      expect.stringContaining('CREATE TABLE IF NOT EXISTS bookmarks'),
      expect.stringContaining('sync_status TEXT NOT NULL DEFAULT'),
      expect.stringContaining('CREATE TABLE IF NOT EXISTS access_records'),
      'COMMIT',
    ])
  })

  it('adds sync_status and access_records to an M1 database idempotently', () => {
    const database = createDatabase([
      { name: 'id' },
      { name: 'url' },
      { name: 'status' },
      { name: 'created_at' },
      { name: 'updated_at' },
    ])

    initializeSqliteSchema(database)
    initializeSqliteSchema(database)

    expect(database.statements.filter((statement) => statement.startsWith('ALTER TABLE bookmarks'))).toHaveLength(1)
    expect(database.statements.filter((statement) => statement.includes('CREATE TABLE IF NOT EXISTS access_records'))).toHaveLength(2)
  })

  it('does not re-add sync_status when an M2 database is initialized again', () => {
    const database = createDatabase([
      { name: 'id' },
      { name: 'url' },
      { name: 'status' },
      { name: 'sync_status' },
      { name: 'created_at' },
      { name: 'updated_at' },
    ])

    initializeSqliteSchema(database)

    expect(database.statements.some((statement) => statement.startsWith('ALTER TABLE bookmarks'))).toBe(false)
  })
})
