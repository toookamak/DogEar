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

const pw = process.env.DOGEAR_PASSWORD || 'admin123'
const repository = createBookmarkRepository(drizzle(sqlite))
const app = createApp(repository, {
  password: pw,
})

// Background sync queue worker: process pending items every 60 seconds
// Only runs when the server is a long-running process (Bun runtime)
const syncWorkerInterval = 60_000
let syncWorkerTimer: ReturnType<typeof setInterval> | null = null

async function processSyncQueue() {
  try {
    const items = await repository.syncQueue.getPending(1)
    if (items.length === 0) return

    const item = items[0]
    console.log(`[sync-worker] Processing ${item.id} (${item.action} ${item.targetType}:${item.targetId} via ${item.channel})`)

    // Mark as processing
    await repository.syncQueue.updateStatus(item.id, 'processing')

    try {
      // Channel-specific processing will be added here
      // For now, all items are marked as succeeded (no-op processing)
      // TODO: Implement actual channel handlers (Raindrop, S3, WebDAV)
      await repository.syncQueue.updateStatus(item.id, 'succeeded')
      console.log(`[sync-worker] Completed ${item.id}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`[sync-worker] Failed ${item.id}: ${errorMessage}`)
      await repository.syncQueue.updateStatus(item.id, 'failed', errorMessage)
    }
  } catch (err) {
    console.error('[sync-worker] Error fetching queue items:', err instanceof Error ? err.message : String(err))
  }
}

syncWorkerTimer = setInterval(processSyncQueue, syncWorkerInterval)
// Run first tick immediately after a short delay
setTimeout(processSyncQueue, 5000)

export default { port: Number(process.env.PORT ?? 8787), fetch: app.fetch }