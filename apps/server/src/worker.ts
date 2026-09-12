/**
 * Cloudflare Workers 入口（轨 A）。
 *
 * 与自托管入口 src/index.ts 共用同一份 createApp 与业务逻辑，差异只在运行时装配：
 * - 真源库：D1（binding DB）而非本地 SQLite 文件
 * - 备份：Workers 无本地文件系统，不注入文件备份实现（落到 501 回执）
 * - 端口/监听：由 Workers 平台管理，无需自行 listen
 *
 * 需要 wrangler.toml 中的 d1 binding 名为 DB，并开启 nodejs_compat
 * （app.ts 使用 node:crypto 做会话签名与 UUID）。
 */
import { createD1BookmarkRepository } from '@dogear/db'
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types'
import { createApp } from './app.js'
import { ChannelConfigManager } from './channels/index.js'
import { processSyncQueue, resolveRaindropClient } from './sync/consumer.js'

export interface Env {
  DB: D1Database
  /** 工作台登录口令 */
  DOGEAR_PASSWORD?: string
  /** Skill（Agent）Bearer Token */
  DOGEAR_SKILL_TOKEN?: string
  /** 允许携带 Cookie 的工作台来源，逗号分隔；默认取请求同源 */
  DOGEAR_CORS_ORIGIN?: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!env.DB) {
      return Response.json(
        { error: { code: 'CONFIG_ERROR', message: 'D1 binding "DB" is missing. Check wrangler.toml d1_databases.' } },
        { status: 500 },
      )
    }

    const password = env.DOGEAR_PASSWORD
    if (!password) {
      return Response.json(
        { error: { code: 'CONFIG_ERROR', message: 'Secret DOGEAR_PASSWORD is not set. Run: wrangler secret put DOGEAR_PASSWORD' } },
        { status: 500 },
      )
    }

    // 同源部署时 CORS 来源即请求来源；未配置时回退到请求 Origin，便于同域工作台
    const corsOrigin = env.DOGEAR_CORS_ORIGIN ?? request.headers.get('Origin') ?? undefined

    const repository = createD1BookmarkRepository(env.DB)
    const app = createApp(repository, {
      password,
      skillToken: env.DOGEAR_SKILL_TOKEN,
      corsOrigin,
    })

    return app.fetch(request, env, ctx)
  },

  /**
   * Cron 触发（wrangler.toml [triggers]，每 5 分钟）：消费 sync_queue，
   * 把书签变更推送到已启用的 Raindrop 通道。与工作台触发的
   * POST /api/sync/process、自托管入口的定时器共用同一消费器。
   */
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
          if (summary.processed > 0) console.log('[sync-cron]', JSON.stringify(summary))
        })
        .catch((err: unknown) => {
          console.error('[sync-cron]', err instanceof Error ? err.message : String(err))
        }),
    )
  },
}
