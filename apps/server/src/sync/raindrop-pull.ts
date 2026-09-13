import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'

/**
 * Raindrop 拉回（双向同步的远端 → 本地侧，同步设计 §3；API 结构表 v1.8）。
 *
 * 行为：
 * - **低频单页**：每次调用只拉一页（默认 50 条，不自动翻页）——Raindrop API 有
 *   速率限制，自动循环全量容易触发风控；全量导入走通道的「导入」（显式动作）。
 * - **批量 D1**：查重/建书签/记冲突都按页批量（1~2 次查询 + 分片批量写入）。
 *   Workers（轨 A）单次调用有 50 子请求上限且 D1 每条查询都计入，逐条查写在
 *   Free 档跑不满一页（50 条逐条要 100+ 次）。
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
    summary.scanned += items.length

    // 一次批量查重（1 次查询），替代逐条 findByRaindropId
    const existingRows = await repository.findByRaindropIds(items.map((rd) => String(rd._id)))
    const existingByRaindropId = new Map(existingRows.map((row) => [String((row as { raindropId?: string }).raindropId), row as Record<string, unknown>]))

    // 新书签分片批量建（Raindrop 侧的逐条创建在导入/拉取中不存在，插入纯本地）
    const fresh = items.filter((rd) => !existingByRaindropId.has(String(rd._id)))
    if (fresh.length > 0) {
      try {
        await repository.createMany(fresh.map((rd) => ({
          id: randomUUID(),
          ...mapRaindropBookmark(rd),
          // 冲突检测仍按 note（含 excerpt 回退）；excerpt 列同时写入供卡片展示
          note: remoteNote(rd) || null,
          status: intoInbox ? 'unread' as const : 'saved' as const,
          source: 'raindrop' as const,
          private: false,
          syncStatus: 'synced' as const,
        })))
        summary.created += fresh.length
      } catch (error) {
        summary.errors.push(`批量写入失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // 差异检测纯内存；命中的先批量查 pending 冲突去重，再批量落 conflicts
    const conflictCandidates = items
      .map((rd) => ({ rd, existing: existingByRaindropId.get(String(rd._id)) }))
      .filter((candidate): candidate is { rd: RaindropBookmark; existing: Record<string, unknown> } => {
        if (!candidate.existing) return false
        // 本地赢：有差异且远端较新才记冲突（本地不动）
        const remoteNewer = new Date(candidate.rd.lastUpdate).getTime() > new Date(String(candidate.existing.updatedAt ?? 0)).getTime()
        return remoteNewer && differs(candidate.existing, candidate.rd)
      })

    const unchanged = items.length - fresh.length - conflictCandidates.length
    if (unchanged > 0) summary.skipped += unchanged
    if (conflictCandidates.length === 0) continue

    try {
      const pendingRows = await repository.conflicts.findByRaindropIds(conflictCandidates.map((c) => String(c.rd._id)), 'pending')
      const pendingIds = new Set(pendingRows.map((row) => String((row as { raindropId?: string }).raindropId)))
      const toCreate = conflictCandidates.filter((c) => !pendingIds.has(String(c.rd._id)))
      summary.skipped += conflictCandidates.length - toCreate.length
      if (toCreate.length > 0) {
        await repository.conflicts.createMany(toCreate.map(({ rd, existing }) => ({
          id: randomUUID(),
          bookmarkId: String(existing.id),
          raindropId: String(rd._id),
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
        })))
        summary.conflicts += toCreate.length
      }
    } catch (error) {
      summary.errors.push(`冲突记录失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return summary
}
