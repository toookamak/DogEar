import type { SyncQueueItem } from '@dogear/db'
import { RaindropClient } from '../channels/raindrop.js'

/**
 * 队列消费所需的 Raindrop 推送能力（结构化接口）：
 * 真实实现是 RaindropClient，测试用假客户端只需满足这三个方法。
 */
export interface RaindropPushClient {
  createBookmark(data: { url: string; title?: string; note?: string; tags?: string[] }): Promise<unknown>
  updateBookmark(raindropId: number, data: Record<string, unknown>): Promise<unknown>
  deleteBookmark(raindropId: number): Promise<void>
}

/**
 * sync_queue 消费器（L2）。
 *
 * 语义（见 docs/modules/20260904_同步功能设计.md §3.1）：
 * - 队列只承载 Raindrop 书签级推送（create/update/delete）；S3/WebDAV 是文件级
 *   导出，保持手动触发，不进队列——书签级项落进来会被标 failed 而非假装成功。
 * - 失败按指数退避重试：1s → 2s → 4s（封顶），retry_count 逐次累加；
 *   超过 MAX_RETRIES 后停留在 failed，不再自动重试（防止毒条目无限占用队列）。
 * - 429（限流）与一般失败同走退避；Retry-After 提示已记入 error 文案。
 */

export const MAX_RETRIES = 8

export function backoffMs(retryCount: number): number {
  // 1s / 2s / 4s 封顶（同步设计 §3.1）
  return Math.min(1000 * 2 ** Math.max(0, retryCount), 4000)
}

export interface SyncConsumeSummary {
  /** 本批实际处理的条数（不含仅被重新排队、未处理的） */
  processed: number
  succeeded: number
  failed: number
  /** 因退避到期被重置回 pending 的失败条数 */
  requeued: number
  /** 处理后仍在队列中的 pending 条数 */
  remaining: number
}

/** 消费所需的外部依赖：按当前通道配置构造 Raindrop 客户端；无可用通道返回 null */
export type RaindropClientResolver = () => Promise<RaindropPushClient | null>

export interface SyncQueueRepositoryShape {
  syncQueue: {
    getPending(limit?: number): Promise<SyncQueueItem[]>
    listFailed(limit?: number): Promise<SyncQueueItem[]>
    updateStatus(id: string, status: 'pending' | 'processing' | 'succeeded' | 'failed', error?: string | null): Promise<unknown>
    countPending(): Promise<number>
  }
  /** 只写 raindropId（推送成功写回）与 syncStatus（pending→synced）；不动关系字段 */
  update(bookmarkId: string, input: Record<string, unknown>): Promise<unknown>
}

function parsePayload(item: SyncQueueItem): Record<string, unknown> {
  if (!item.payload) return {}
  try {
    const parsed = JSON.parse(item.payload)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/**
 * 把退避到期的 failed 项重置回 pending。
 * 消费前调用一次；updateStatus('pending') 不会清 retry_count（只有 failed 才累加）。
 */
export async function requeueEligibleFailures(
  repository: SyncQueueRepositoryShape,
  now = Date.now(),
): Promise<number> {
  const failed = await repository.syncQueue.listFailed(100)
  let requeued = 0
  for (const item of failed) {
    if (item.retryCount >= MAX_RETRIES) continue
    const dueAt = new Date(item.updatedAt).getTime() + backoffMs(item.retryCount)
    if (Number.isNaN(dueAt) || dueAt > now) continue
    await repository.syncQueue.updateStatus(item.id, 'pending')
    requeued += 1
  }
  return requeued
}

async function handleRaindropBookmark(
  repository: SyncQueueRepositoryShape,
  client: RaindropPushClient,
  item: SyncQueueItem,
): Promise<void> {
  const payload = parsePayload(item)
  if (item.action === 'create' || item.action === 'update') {
    const url = String(payload.url ?? '')
    if (!url) throw new Error('payload.url is missing')
    const data: { url: string; title?: string; note?: string } = { url }
    if (typeof payload.title === 'string' && payload.title) data.title = payload.title
    if (typeof payload.note === 'string' && payload.note) data.note = payload.note

    const raindropId = typeof payload.raindropId === 'string' ? payload.raindropId : ''
    if (item.action === 'update' && raindropId) {
      await client.updateBookmark(Number(raindropId), data)
      return
    }
    const created = await client.createBookmark(data)
    const remoteId = String((created as { _id?: unknown })._id ?? '')
    if (remoteId) {
      // 只写回 raindropId：repository.update 对未传入的关系字段（scenes/tags）不动表
      await repository.update(item.targetId, { raindropId: remoteId })
    }
    return
  }

  if (item.action === 'delete') {
    // 本地从未推送过（无 raindropId）就无需远端删除，视为成功
    if (!raindropIdOf(payload)) return
    await client.deleteBookmark(Number(raindropIdOf(payload)))
    return
  }

  throw new Error(`Unsupported action: ${item.action}`)
}

function raindropIdOf(payload: Record<string, unknown>): string {
  return typeof payload.raindropId === 'string' ? payload.raindropId : ''
}

/**
 * 消费一批队列项。三处调度共用：Workers Cron（scheduled）、
 * 自托管定时器（index.ts）、工作台触发的 POST /api/sync/process。
 */
export async function processSyncQueue(
  repository: SyncQueueRepositoryShape,
  resolveRaindropClient: RaindropClientResolver,
  max = 10,
): Promise<SyncConsumeSummary> {
  const requeued = await requeueEligibleFailures(repository)

  const pending = await repository.syncQueue.getPending(max)
  let succeeded = 0
  let failed = 0
  let client: RaindropPushClient | null = null
  let clientResolved = false

  for (const item of pending) {
    await repository.syncQueue.updateStatus(item.id, 'processing')
    try {
      if (item.channel !== 'raindrop' || item.targetType !== 'bookmark') {
        // 队列当前只承载 Raindrop 书签推送；落到这里的任何条目都是编程错误，
        // 明确标 failed（禁止无 handler 标 succeeded）
        throw new Error(`No handler for channel=${item.channel} targetType=${item.targetType}`)
      }
      if (!clientResolved) {
        client = await resolveRaindropClient()
        clientResolved = true
      }
      if (!client) throw new Error('No enabled raindrop channel; cannot push bookmark')

      await handleRaindropBookmark(repository, client, item)
      await repository.syncQueue.updateStatus(item.id, 'succeeded')
      await repository.update(item.targetId, { syncStatus: 'synced' }).catch(() => undefined)
      succeeded += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await repository.syncQueue.updateStatus(item.id, 'failed', message)
      failed += 1
    }
  }

  const remaining = await repository.syncQueue.countPending()
  return { processed: pending.length, succeeded, failed, requeued, remaining }
}

/** 从已启用的通道配置里取第一个 Raindrop 通道并构造客户端；无则返回 null */
export async function resolveRaindropClient(
  channels: Array<{ channel: string; enabled: boolean; config: Record<string, unknown> }>,
): Promise<RaindropPushClient | null> {
  const found = channels.find((c) => c.channel === 'raindrop' && c.enabled)
  if (!found) return null
  const token = String(found.config.token ?? '')
  if (!token) return null
  return new RaindropClient(token)
}
