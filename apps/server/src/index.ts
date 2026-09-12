import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createBookmarkRepository, initializeSqliteSchema } from '@dogear/db'
import { createApp } from './app.js'
import { createBackupRoutes } from './backup/backup-routes.js'
import { ChannelConfigManager } from './channels/index.js'
import { processSyncQueue, resolveRaindropClient } from './sync/consumer.js'

const dbPath = process.env.DOGEAR_DB_PATH ?? './data/dogear.sqlite'
mkdirSync(dirname(dbPath), { recursive: true })
const sqlite = new Database(dbPath)
initializeSqliteSchema(sqlite)

const pw = process.env.DOGEAR_PASSWORD || 'admin123'
const repository = createBookmarkRepository(drizzle(sqlite))
const channelManager = new ChannelConfigManager(repository)
const app = createApp(repository, {
  password: pw,
  // 自托管（Bun/Docker）有本地文件系统，注入本地文件备份实现
  backupRoutes: (repo) => createBackupRoutes(repo, dbPath),
})

// Background sync queue worker：每 60 秒消费一批 sync_queue（推送到已启用的
// Raindrop 通道）。与工作台触发的 POST /api/sync/process、Workers Cron 共用消费器。
// processRunning 防重入：上一批没跑完就跳过本次 tick。
const syncWorkerInterval = 60_000
let syncWorkerTimer: ReturnType<typeof setInterval> | null = null
let syncWorkerRunning = false

async function runSyncWorker() {
  if (syncWorkerRunning) return
  syncWorkerRunning = true
  try {
    const summary = await processSyncQueue(repository, async () => {
      const channels = await channelManager.getAllChannels()
      return resolveRaindropClient(channels)
    }, 25)
    if (summary.processed > 0) console.log('[sync-worker]', JSON.stringify(summary))
  } catch (err) {
    console.error('[sync-worker] Error:', err instanceof Error ? err.message : String(err))
  } finally {
    syncWorkerRunning = false
  }
}

syncWorkerTimer = setInterval(runSyncWorker, syncWorkerInterval)
// Run first tick immediately after a short delay
setTimeout(runSyncWorker, 5000)

export default {
  port: Number(process.env.PORT ?? 8787),
  fetch: app.fetch,
  // Raindrop 拉取/导入等长任务可超过默认 10s 空闲超时，调大避免被 Bun 掐断
  idleTimeout: Number(process.env.DOGEAR_IDLE_TIMEOUT ?? 120),
}