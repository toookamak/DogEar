/**
 * Cloudflare Workers 入口（轨 A）。
 *
 * 与自托管入口 src/index.ts 共用同一份 createApp 与业务逻辑，差异只在运行时装配：
 * - 真源库：D1（binding DB）而非本地 SQLite 文件
 * - 备份：Workers 无本地文件系统，不注入文件备份实现（落到 501 回执）
 * - 端口/监听：由 Workers 平台管理，无需自行 listen
 *
 * isolate 内缓存 Hono 应用：CORS 按请求 Origin 回显（见 createApp），不再每请求重建路由树。
 */
import { createD1BookmarkRepository } from '@dogear/db'
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types'
import { createApp } from './app.js'
import { ChannelConfigManager } from './channels/index.js'
import { processSyncQueue, resolveRaindropClient } from './sync/consumer.js'
import { cleanupOperationLog } from './log-cleanup.js'
import { createFetchSnapshotProcessor } from './archive/snapshot-fetch.js'
import { createR2CoverStore } from './archive/cover-store.js'

export interface Env {
  DB: D1Database
  DOGEAR_PASSWORD?: string
  DOGEAR_SKILL_TOKEN?: string
  DOGEAR_CORS_ORIGIN?: string
  COVERS?: import('./archive/cover-store.js').R2CoverBucket
}

type AppInstance = ReturnType<typeof createApp>

let cachedApp: { key: string; app: AppInstance } | null = null

function appCacheKey(env: Env): string {
  return `${env.DOGEAR_PASSWORD ?? ''}\0${env.DOGEAR_SKILL_TOKEN ?? ''}\0${env.DOGEAR_CORS_ORIGIN ?? ''}`
}

function getApp(env: Env): AppInstance {
  const key = appCacheKey(env)
  if (cachedApp && cachedApp.key === key) return cachedApp.app
  const repository = createD1BookmarkRepository(env.DB)
  const app = createApp(repository, {
    password: env.DOGEAR_PASSWORD,
    skillToken: env.DOGEAR_SKILL_TOKEN,
    corsOrigin: env.DOGEAR_CORS_ORIGIN,
    snapshotProcessor: createFetchSnapshotProcessor(),
    coverStore: env.COVERS ? createR2CoverStore(env.COVERS) : undefined,
    metadataWaitMs: 6000,
  })
  cachedApp = { key, app }
  return app
}

function withApiCacheHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const started = Date.now()
    if (!env.DB) {
      return Response.json(
        { error: { code: 'CONFIG_ERROR', message: 'D1 binding "DB" is missing. Check wrangler.toml d1_databases.' } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const password = env.DOGEAR_PASSWORD
    if (!password) {
      return Response.json(
        { error: { code: 'CONFIG_ERROR', message: 'Secret DOGEAR_PASSWORD is not set. Run: wrangler secret put DOGEAR_PASSWORD' } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const app = getApp(env)
    const response = withApiCacheHeaders(await app.fetch(request, env, ctx))
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api') || url.pathname === '/health' || url.pathname.startsWith('/.well-known')) {
      console.log(JSON.stringify({
        msg: 'dogear.request',
        method: request.method,
        path: url.pathname,
        status: response.status,
        ms: Date.now() - started,
      }))
    }
    return response
  },

  async scheduled(controller: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.DB) return
    const repository = createD1BookmarkRepository(env.DB)
    const channelManager = new ChannelConfigManager(repository)
    ctx.waitUntil(
      processSyncQueue(repository, async () => {
        const channels = await channelManager.getAllChannels()
        return resolveRaindropClient(channels)
      }, 25)
        .then((summary) => {
          console.log(JSON.stringify({ msg: 'dogear.sync-cron', ...summary }))
        })
        // 操作日志保留清理（v1.15）：低频顺带执行，通常为空操作
        .then(() => cleanupOperationLog(repository))
        .then((removed) => {
          if (removed > 0) console.log(JSON.stringify({ msg: 'dogear.log-cleanup', removed }))
        })
        .catch((err: unknown) => {
          console.error(JSON.stringify({
            msg: 'dogear.sync-cron',
            error: err instanceof Error ? err.message : String(err),
          }))
        }),
    )
  },
}
