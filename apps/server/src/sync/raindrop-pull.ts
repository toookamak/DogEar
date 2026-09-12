import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import type { RaindropBookmark } from '../channels/raindrop.js'

/**
 * Raindrop 拉回（双向同步的远端 → 本地侧，同步设计 §3；API 结构表 v1.8）。
 *
 * 行为：
 * - **低频单页**：每次调用只拉一页（默认 50 条，不自动翻页）——Raindrop API 有
 *   速率限制，自动循环全量容易触发风控；全量导入走通道的「导入」（显式动作）。
 * - 新书签（按 raindropId 找不到）：创建，`source: 'raindrop'`，状态按
 *   intoInbox（默认 true → unread，PRD「导入新书签默认进入 Inbox」）。
 * - 已有书签：内容有差异且远端较新 → **本地赢**（本地不动），差异记入
 *   `conflicts` 表（两端快照都存，用户可按条/批量以 local/remote/merge 解决）；
 *   内容一致或远端不比本地新 → 跳过。
 * - 已解决的冲突若再次出现差异，会生成新的 pending 记录。
 */

export interface PullOptions {
  intoInbox?: boolean
  /** 最多拉几页（每页 50 条）；默认 1 页，防风控 */
  maxPages?: number
}

export interface PullSummary {
  pages: number
  scanned: number
  created: number
  skipped: number
  conflicts: number
  errors: string[]
  hasMore: boolean
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').trim()
}

function remoteNote(rd: RaindropBookmark): string {
  return normalize(rd.note) || normalize(rd.excerpt)
}

function differs(existing: Record<string, unknown>, rd: RaindropBookmark): boolean {
  if (normalize(existing.title as string) !== normalize(rd.title)) return true
  if (normalize(existing.url as string) !== normalize(rd.link)) return true
  if (normalize(existing.note as string) !== remoteNote(rd)) return true
  return false
}

/** 结构化拉取能力：真实实现是 RaindropClient，测试可用假客户端 */
export interface RaindropPullClient {
  fetchBookmarks(page?: number, perPage?: number): Promise<{ items: RaindropBookmark[]; total: number }>
}

export async function pullFromRaindrop(
  repository: BookmarkRepository,
  client: RaindropPullClient,
  options: PullOptions = {},
): Promise<PullSummary> {
  const intoInbox = options.intoInbox !== false
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 1, 10))
  const summary: PullSummary = { pages: 0, scanned: 0, created: 0, skipped: 0, conflicts: 0, errors: [], hasMore: false }

  for (let page = 0; page < maxPages; page += 1) {
    let items: RaindropBookmark[] = []
    try {
      const result = await client.fetchBookmarks(page, 50)
      items = result.items
      summary.pages += 1
      // 拉满一页说明可能还有更多，如实上报（是否继续由调用方决定，防风控）
      summary.hasMore = items.length >= 50
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push(`page ${page}: ${message}`)
      break
    }
    if (items.length === 0) break

    for (const rd of items) {
      summary.scanned += 1
      const raindropId = String(rd._id)
      try {
        const existing = await repository.findByRaindropId(raindropId) as Record<string, unknown> | undefined
        if (!existing) {
          await repository.create({
            id: randomUUID(),
            url: rd.link,
            title: rd.title || rd.link,
            status: intoInbox ? 'unread' : 'saved',
            source: 'raindrop',
            private: false,
            syncStatus: 'synced',
            note: remoteNote(rd) || null,
            raindropId,
          })
          summary.created += 1
          continue
        }

        // 本地赢：有差异且远端较新才记冲突（本地不动）；已解决过的冲突再次出现差异会生成新记录
        const remoteNewer = new Date(rd.lastUpdate).getTime() > new Date(String(existing.updatedAt ?? 0)).getTime()
        if (remoteNewer && differs(existing, rd)) {
          const duplicate = await repository.conflicts.findByRaindropId(raindropId, 'pending')
          if (!duplicate) {
            await repository.conflicts.create({
              id: randomUUID(),
              bookmarkId: String(existing.id),
              raindropId,
              localSnapshot: JSON.stringify({
                title: existing.title ?? null,
                url: existing.url,
                note: existing.note ?? null,
                updatedAt: existing.updatedAt ?? null,
              }),
              remoteSnapshot: JSON.stringify({
                title: rd.title,
                url: rd.link,
                note: remoteNote(rd) || null,
                lastUpdate: rd.lastUpdate,
              }),
            })
            summary.conflicts += 1
          } else {
            summary.skipped += 1
          }
          continue
        }
        summary.skipped += 1
      } catch (error) {
        summary.errors.push(`raindrop ${raindropId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  return summary
}
