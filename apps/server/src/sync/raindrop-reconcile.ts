import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'
import type { TaxonomyIndex } from './raindrop-taxonomy.js'

export type RaindropLocal = {
  id: string
  url?: string | null
  cover?: string | null
  excerpt?: string | null
  domain?: string | null
  raindropId?: string | null
  raindropExtras?: string | null
  /** 本地已归入的收藏夹；为 null/空表示「还没归类」，可由远端回填（2026-10-02） */
  folderId?: string | null
  /** 本地已挂的标签 id；空数组表示「还没有标签」，可由远端回填 */
  tagIds?: string[]
}

function nonempty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** 按 raindropId 优先、其次 URL，把远端条目对应到已有本地行；都没有才算新书签。 */
export function partitionRaindropItems(
  items: RaindropBookmark[],
  locals: RaindropLocal[],
): { fresh: RaindropBookmark[]; matched: Array<{ rd: RaindropBookmark; locals: RaindropLocal[] }> } {
  const byId = new Map<string, RaindropLocal[]>()
  const byUrl = new Map<string, RaindropLocal[]>()
  for (const row of locals) {
    if (row.raindropId) {
      const list = byId.get(String(row.raindropId)) ?? []
      list.push(row)
      byId.set(String(row.raindropId), list)
    }
    if (row.url) {
      const list = byUrl.get(row.url) ?? []
      list.push(row)
      byUrl.set(row.url, list)
    }
  }

  const fresh: RaindropBookmark[] = []
  const matched: Array<{ rd: RaindropBookmark; locals: RaindropLocal[] }> = []
  for (const rd of items) {
    const seen = new Set<string>()
    const rows: RaindropLocal[] = []
    for (const row of byId.get(String(rd._id)) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    for (const row of byUrl.get(rd.link) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    if (rows.length === 0) fresh.push(rd)
    else matched.push({ rd, locals: rows })
  }
  return { fresh, matched }
}

/**
 * 回填结果（2026-10-02）。两类要分开落：
 * - `metadata` 走 `updateMany`（bookmarks 表上的标量列）
 * - `tagAttachments` 走 `attachTagsBatch`（bookmark_tags 关联表，updateMany 碰不到它）
 */
export interface ReconcileResult {
  metadata: Array<{ id: string } & Record<string, unknown>>
  tagAttachments: Array<{ bookmarkId: string; tagIds: string[] }>
}

/** 只补空字段（封面/简介/raindropId/收藏夹），不覆盖用户已改的标题。 */
export function emptyMetadataPatch(
  existing: RaindropLocal,
  rd: RaindropBookmark,
  index?: TaxonomyIndex,
): { id: string } & Record<string, unknown> | null {
  const mapped = mapRaindropBookmark(rd)
  const patch: Record<string, unknown> = {}
  if (!nonempty(existing.cover) && mapped.cover) patch.cover = mapped.cover
  if (!nonempty(existing.excerpt) && mapped.excerpt) patch.excerpt = mapped.excerpt
  if (!nonempty(existing.domain) && mapped.domain) patch.domain = mapped.domain
  if (!nonempty(existing.raindropId)) patch.raindropId = mapped.raindropId
  // 收藏夹回填：**只在本地为空时填**。本地已归过类（哪怕是用户后来手工改的）一律不动——
  // 本地是工作副本，回填不能覆盖用户在本地做过的整理。
  if (!existing.folderId && mapped.collectionId !== null && index) {
    const folderId = index.folderByCollectionId.get(mapped.collectionId)
    if (folderId) patch.folderId = folderId
  }
  const extrasLackCover = (() => {
    if (!nonempty(existing.raindropExtras)) return true
    try {
      const extras = JSON.parse(String(existing.raindropExtras)) as { cover?: unknown; media?: unknown }
      return !nonempty(extras.cover) && !Array.isArray(extras.media)
    } catch {
      return true
    }
  })()
  if (extrasLackCover && mapped.raindropExtras) patch.raindropExtras = mapped.raindropExtras
  if (Object.keys(patch).length === 0) return null
  return { id: existing.id, ...patch }
}

export function collectMetadataPatches(
  matched: Array<{ rd: RaindropBookmark; locals: RaindropLocal[] }>,
  index?: TaxonomyIndex,
): ReconcileResult {
  const metadata: Array<{ id: string } & Record<string, unknown>> = []
  const tagAttachments: Array<{ bookmarkId: string; tagIds: string[] }> = []
  const seen = new Set<string>()
  for (const { rd, locals } of matched) {
    const mapped = mapRaindropBookmark(rd)
    for (const row of locals) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      const patch = emptyMetadataPatch(row, rd, index)
      if (patch) metadata.push(patch)
      // 标签回填：**只在本地一个标签都没挂时**整份填入。
      // 本地已有标签说明用户整理过，远端那份过时——不清空也不合并，宁可不动。
      if (index && (row.tagIds?.length ?? 0) === 0 && mapped.tags.length > 0) {
        const tagIds = mapped.tags
          .map((name) => index.tagIdByNameKey.get(name.toLowerCase()))
          .filter((id): id is string => Boolean(id))
        if (tagIds.length > 0) tagAttachments.push({ bookmarkId: row.id, tagIds })
      }
    }
  }
  return { metadata, tagAttachments }
}
