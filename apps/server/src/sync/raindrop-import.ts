import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'
import { collectMetadataPatches, partitionRaindropItems, type RaindropLocal } from './raindrop-reconcile.js'

/**
 * Raindrop 按页导入。按 raindropId **与 URL** 去重；已有条目若缺封面则回填，不新建。
 */

export const IMPORT_PAGE_SIZE = 50

export interface RaindropImportClient {
  fetchBookmarks(page?: number, perPage?: number): Promise<{ items: RaindropBookmark[]; total: number }>
}

export interface ImportPageOptions {
  page?: number
  intoInbox?: boolean
}

export interface ImportPageSummary {
  page: number
  imported: number
  skipped: number
  filled: number
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
  const summary: ImportPageSummary = { page, imported: 0, skipped: 0, filled: 0, errors: [], total: 0, hasMore: false }

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
    const records = await repository.createMany(fresh.map((rd) => ({
      id: randomUUID(),
      ...mapRaindropBookmark(rd),
      status: intoInbox ? 'unread' as const : 'saved' as const,
      source: 'page' as const,
      private: false,
      syncStatus: 'synced' as const,
    })))
    summary.imported = records.length
  } catch (e) {
    summary.errors.push(`批量写入失败：${e instanceof Error ? e.message : String(e)}`)
  }
  return summary
}
