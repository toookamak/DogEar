import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createBookmarkRepository } from '@dogear/db'
import { createApp } from './app.js'

const dbPath = process.env.DOGEAR_DB_PATH ?? './data/dogear.sqlite'
mkdirSync(dirname(dbPath), { recursive: true })
const sqlite = new Database(dbPath)
sqlite.run(`CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unread', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`)

const app = createApp(createBookmarkRepository(drizzle(sqlite)))
export default { port: Number(process.env.PORT ?? 8787), fetch: app.fetch }
