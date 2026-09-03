import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createBookmarkRepository, initializeSqliteSchema } from '@dogear/db'
import { createApp } from './app.js'

const dbPath = process.env.DOGEAR_DB_PATH ?? './data/dogear.sqlite'
mkdirSync(dirname(dbPath), { recursive: true })
const sqlite = new Database(dbPath)
initializeSqliteSchema(sqlite)

const app = createApp(createBookmarkRepository(drizzle(sqlite)))
export default { port: Number(process.env.PORT ?? 8787), fetch: app.fetch }
