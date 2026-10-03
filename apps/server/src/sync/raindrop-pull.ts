import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'
import { collectMetadataPatches, partitionRaindropItems, type RaindropLocal } from './raindrop-reconcile.js'
import { resolveTaxonomy, syncRaindropTaxonomy, type RaindropTaxonomyClient, type TaxonomyIndex } from './raindrop-taxonomy.js'

/**
 * Raindrop 拉回（双向同步的远端 → 本地侧，同步设计 §3；API 结构表 v1.8）。
 *
 * 行为：
 * - **先同步分类体系**：拉书签之前先拉收藏夹与标签清单（`syncRaindropTaxonomy`），
 *   否则第一页书签找不到归属。2026-10-02 批次 0 补；此前 `folder_id` 恒为 NULL、
 *   `bookmark_tags` 恒为空，等于把「整理」这条路整个堵死。
 * - **低频单页**：每次调用只拉一页（默认 50 条，不自动翻页）。
 * - **批量 D1**：查重/建书签/挂标签/记冲突/补空封面都按页批量。
 * - 新书签：raindropId **与 URL** 都找不到才创建（避免工作台/插件先存、再拉回收到重复）。
 * - 已有书签：空封面/简介/raindropId 用远端回填，不覆盖已有标题；内容有差异且远端较新 → 本地赢并记 conflicts。
 * - **只读**：本路径不向 `sync_queue` 入队（计划 §3.6.1 额度保护第 2 条）。
 */

export interface PullOptions {
  intoInbox?: boolean
  maxPages?: number
  /** 复用已同步好的分类映射；不传则本次调用内先同步一次 */
  taxonomy?: TaxonomyIndex
}

export interface PullSummary {
  pages: number
  scanned: number
  created: number
  skipped: number
  filled: number
  tagged: number
  conflicts: number
  /** 已写入 folders.raindrop_id 的远端根集合数 / 本次新建数 */
  collections: number
  foldersCreated: number
  /** 映射不到的远端集合 id 数量（如落在子集合里）——如实上报，不静默 */
  unmappedCollections: number
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

export interface RaindropPullClient extends Partial<RaindropTaxonomyClient> {
  fetchBookmarks(page?: number, perPage?: number): Promise<{ items: RaindropBookmark[]; total: number }>
}

export async function pullFromRaindrop(
  repository: BookmarkRepository,
  client: RaindropPullClient,
  options: PullOptions = {},
): Promise<PullSummary> {
  const intoInbox = options.intoInbox !== false
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 1, 10))
  const summary: PullSummary = { pages: 0, scanned: 0, created: 0, skipped: 0, filled: 0, tagged: 0, conflicts: 0, collections: 0, foldersCreated: 0, unmappedCollections: 0, errors: [], hasMore: false }

  // 先同步分类体系：映射表是「这一页书签属于哪个收藏夹」的必要前提
  const taxonomy = options.taxonomy ?? await syncRaindropTaxonomy(repository, client as RaindropTaxonomyClient)
  summary.collections = taxonomy.collections
  summary.foldersCreated = taxonomy.foldersCreated
  summary.errors.push(...taxonomy.errors)
  // 跨页累计的「映射失效」事实（同一集合只在结果里出现一次）
  const unmappedCollectionIds = new Set<number>()
  const unmappedTagNames = new Set<string>()

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
    // 回填需要知道「本地这条已经挂了哪些标签」——逐条查会在 D1 上超子请求上限
    if (repository.findTagIdsByBookmarkIds) {
      const tagMap = await repository.findTagIdsByBookmarkIds(locals.map((row) => String(row.id)))
      for (const row of locals) row.tagIds = tagMap.get(String(row.id)) ?? []
    }
    const { fresh, matched } = partitionRaindropItems(items, locals)

    if (fresh.length > 0) {
      try {
        // mapRaindropBookmark 现在会多返回 collectionId / tags，二者都不是 bookmarks 的列，
        // 必须显式挑出来再落库，不能整包塞进 createMany（会插到不存在的列上）。
        const mapped = fresh.map((rd) => mapRaindropBookmark(rd))
        const resolved = resolveTaxonomy(taxonomy, mapped)
        for (const name of resolved.unmappedTags) unmappedTagNames.add(name)
        resolved.unmappedCollectionIds.forEach((id) => unmappedCollectionIds.add(id))

        const created = await repository.createMany(mapped.map((row, i) => ({
          id: randomUUID(),
          url: row.url,
          title: row.title,
          excerpt: row.excerpt,
          cover: row.cover,
          type: row.type,
          domain: row.domain,
          note: remoteNote(fresh[i]) || null,
          // 映射不到就留 null（计划 §3.6.3：映射失效如实上报，不塞错的 folder）
          folderId: resolved.folderIds[i],
          status: intoInbox ? 'unread' as const : 'saved' as const,
          source: 'raindrop' as const,
          private: false,
          raindropId: row.raindropId,
          raindropExtras: row.raindropExtras,
          syncStatus: 'synced' as const,
        })))
        summary.created += created.length

        const pairs = created
          .map((record, i) => ({ bookmarkId: String((record as { id?: unknown }).id ?? ''), tagIds: resolved.tagIds[i] }))
          .filter((pair) => pair.bookmarkId && pair.tagIds.length > 0)
        if (pairs.length > 0) {
          await repository.attachTagsBatch(pairs)
          summary.tagged += pairs.reduce((sum, pair) => sum + pair.tagIds.length, 0)
        }
      } catch (error) {
        summary.errors.push(`批量写入失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const reconcile = collectMetadataPatches(matched, taxonomy)
    if (reconcile.metadata.length > 0 && repository.updateMany) {
      try {
        await repository.updateMany(reconcile.metadata)
        summary.filled += reconcile.metadata.length
      } catch (error) {
        summary.errors.push(`回填失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // 已存在的书签补标签/收藏夹（2026-10-02）：这是「重新导入能补上归类」的关键
    if (reconcile.tagAttachments.length > 0) {
      try {
        await repository.attachTagsBatch(reconcile.tagAttachments)
        summary.tagged += reconcile.tagAttachments.reduce((sum, pair) => sum + pair.tagIds.length, 0)
      } catch (error) {
        summary.errors.push(`回填标签失败：${error instanceof Error ? error.message : String(error)}`)
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

  summary.unmappedCollections = unmappedCollectionIds.size
  if (unmappedTagNames.size > 0) {
    summary.errors.push(`有 ${unmappedTagNames.size} 个远端标签未能映射到本地：${Array.from(unmappedTagNames).slice(0, 5).join('、')}${unmappedTagNames.size > 5 ? ' …' : ''}`)
  }
  return summary
}
