import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'
import { collectMetadataPatches, partitionRaindropItems, type RaindropLocal } from './raindrop-reconcile.js'
import { resolveTaxonomy, syncRaindropTaxonomy, type RaindropTaxonomyClient, type TaxonomyIndex } from './raindrop-taxonomy.js'

/**
 * Raindrop 按页导入。按 raindropId **与 URL** 去重；已有条目若缺封面则回填，不新建。
 *
 * 2026-10-02 批次 0：与 `raindrop-pull.ts` 同样**先同步分类体系再落库**，
 * 走完全相同的映射逻辑。两条路径必须一致——只改 pull 的话，全量导入那条
 * 拉回来的书签仍然是「无标签、无收藏夹」，用户会以为整理好了其实没有。
 */

export const IMPORT_PAGE_SIZE = 50

export interface RaindropImportClient extends Partial<RaindropTaxonomyClient> {
  fetchBookmarks(page?: number, perPage?: number): Promise<{ items: RaindropBookmark[]; total: number }>
}

export interface ImportPageOptions {
  page?: number
  intoInbox?: boolean
  /** 复用已同步好的分类映射（批量导入由调用方循环驱动，只在第 0 页同步一次） */
  taxonomy?: TaxonomyIndex
}

export interface ImportPageSummary {
  page: number
  imported: number
  skipped: number
  filled: number
  /** 本页写入 bookmark_tags 的挂载条数 */
  tagged: number
  collections: number
  foldersCreated: number
  unmappedCollections: number
  errors: string[]
  total: number
  hasMore: boolean
}

export async function importRaindropPage(
  repository: BookmarkRepository,
  client: RaindropImportClient,
  options: ImportPageOptions = {},
): Promise<ImportPageSummary> {
  const page = Math.max(0, Math.floor(options.page ?? 0))
  const intoInbox = options.intoInbox !== false
  const summary: ImportPageSummary = { page, imported: 0, skipped: 0, filled: 0, tagged: 0, collections: 0, foldersCreated: 0, unmappedCollections: 0, errors: [], total: 0, hasMore: false }

  // 批量导入由前端逐页驱动：只在第 0 页同步一次分类体系，后续页复用同一份映射
  const taxonomy = options.taxonomy ?? (page === 0 ? await syncRaindropTaxonomy(repository, client as RaindropTaxonomyClient) : null)
  if (taxonomy) {
    summary.collections = taxonomy.collections
    summary.foldersCreated = taxonomy.foldersCreated
    summary.errors.push(...taxonomy.errors)
  }

  const result = await client.fetchBookmarks(page, IMPORT_PAGE_SIZE)
  summary.total = result.total || 0
  summary.hasMore = result.items.length >= IMPORT_PAGE_SIZE
  if (result.items.length === 0) return summary

  const byId = await repository.findByRaindropIds(result.items.map((rd) => String(rd._id)))
  const byUrl = repository.findByUrls
    ? await repository.findByUrls(result.items.map((rd) => rd.link))
    : []
  const { fresh, matched } = partitionRaindropItems(result.items, [...byId, ...byUrl] as RaindropLocal[])
  summary.skipped = matched.length

  const patches = collectMetadataPatches(matched)
  if (patches.length > 0 && repository.updateMany) {
    try {
      await repository.updateMany(patches)
      summary.filled = patches.length
    } catch (e) {
      summary.errors.push(`回填封面失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (fresh.length === 0) return summary

  try {
    const mapped = fresh.map((rd) => mapRaindropBookmark(rd))
    const resolved = taxonomy
      ? resolveTaxonomy(taxonomy, mapped)
      : { folderIds: mapped.map(() => null), tagIds: mapped.map(() => [] as string[]), unmappedCollectionIds: new Set<number>(), unmappedTags: [] as string[] }
    summary.unmappedCollections = resolved.unmappedCollectionIds.size

    const records = await repository.createMany(mapped.map((row, i) => ({
      id: randomUUID(),
      url: row.url,
      title: row.title,
      excerpt: row.excerpt,
      cover: row.cover,
      type: row.type,
      domain: row.domain,
      note: row.note,
      folderId: resolved.folderIds[i],
      status: intoInbox ? 'unread' as const : 'saved' as const,
      source: 'page' as const,
      private: false,
      raindropId: row.raindropId,
      raindropExtras: row.raindropExtras,
      syncStatus: 'synced' as const,
    })))
    summary.imported = records.length

    const pairs = records
      .map((record, i) => ({ bookmarkId: String((record as { id?: unknown }).id ?? ''), tagIds: resolved.tagIds[i] }))
      .filter((pair) => pair.bookmarkId && pair.tagIds.length > 0)
    if (pairs.length > 0) {
      await repository.attachTagsBatch(pairs)
      summary.tagged += pairs.reduce((sum, pair) => sum + pair.tagIds.length, 0)
    }
  } catch (e) {
    summary.errors.push(`批量写入失败：${e instanceof Error ? e.message : String(e)}`)
  }
  return summary
}
