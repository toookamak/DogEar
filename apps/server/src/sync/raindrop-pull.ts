import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'
import { collectMetadataPatches, partitionRaindropItems, type RaindropLocal } from './raindrop-reconcile.js'

/**
 * Raindrop 拉回（双向同步的远端 → 本地侧，同步设计 §3；API 结构表 v1.8）。
 *
 * 行为：
 * - **低频单页**：每次调用只拉一页（默认 50 条，不自动翻页）。
 * - **批量 D1**：查重/建书签/记冲突/补空封面都按页批量。
 * - 新书签：raindropId **与 URL** 都找不到才创建（避免工作台/插件先存、再拉回收到重复）。
 * - 已有书签：空封面/简介/raindropId 用远端回填，不覆盖已有标题；内容有差异且远端较新 → 本地赢并记 conflicts。
 */

export interface PullOptions {
  intoInbox?: boolean
  maxPages?: number
}

export interface PullSummary {
  pages: number
  scanned: number
  created: number
  skipped: number
  filled: number
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
  const summary: PullSummary = { pages: 0, scanned: 0, created: 0, skipped: 0, filled: 0, conflicts: 0, errors: [], hasMore: false }

  for (let page = 0; page < maxPages; page += 1) {
    let items: RaindropBookmark[] = []
    try {
      const result = await client.fetchBookmarks(page, 50)
      items = result.items
      summary.pages += 1
      summary.hasMore = items.length >= 50
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push(`page ${page}: ${message}`)
      break
    }
    if (items.length === 0) break
    summary.scanned += items.length

    const byId = await repository.findByRaindropIds(items.map((rd) => String(rd._id)))
    const byUrl = repository.findByUrls
      ? await repository.findByUrls(items.map((rd) => rd.link))
      : []
    const locals = [...byId, ...byUrl] as RaindropLocal[]
    const { fresh, matched } = partitionRaindropItems(items, locals)

    if (fresh.length > 0) {
      try {
        await repository.createMany(fresh.map((rd) => ({
          id: randomUUID(),
          ...mapRaindropBookmark(rd),
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

    const patches = collectMetadataPatches(matched)
    if (patches.length > 0 && repository.updateMany) {
      try {
        await repository.updateMany(patches)
        summary.filled += patches.length
      } catch (error) {
        summary.errors.push(`回填封面失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const conflictCandidates = matched
      .map(({ rd, locals: rows }) => {
        const existing = rows.find((row) => String(row.raindropId ?? '') === String(rd._id)) as Record<string, unknown> | undefined
        return { rd, existing }
      })
      .filter((candidate): candidate is { rd: RaindropBookmark; existing: Record<string, unknown> } => {
        if (!candidate.existing) return false
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
