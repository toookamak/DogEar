import type { BookmarkRepository } from '@dogear/db'
import type { RaindropCollection, RaindropTag } from '../channels/raindrop.js'

/**
 * Raindrop 分类体系（收藏夹 + 标签）的拉取与本地映射（批次 0 · 拉取侧）。
 *
 * **为什么需要这个模块**：Raindrop 侧的「收藏夹」和「标签」此前**从来没有被拉过**——
 * `RaindropClient.getCollections()` / `getTags()` 定义了却全仓零调用，
 * `mapRaindropBookmark` 又把 `tags` 和 `collection.$id` 整个丢弃。
 * 结果是拉回来的书签 `folder_id` 恒为 NULL、`bookmark_tags` 恒为空。
 *
 * **本模块只做只读同步**（远端 → 本地），不产生任何 `sync_queue` 入队，
 * 符合计划 §3.6.1「拉取只读，永不入队」与额度保护第 2 条。
 *
 * **范围限制（须如实上报，不得静默）**：
 * - 只拉**根集合**（`GET /collections`）。Raindrop 的子集合需要另外的端点，
 *   本版不拉——落在子集合里的书签 `collectionId` 映射不到，`folderId` 留空，
 *   并计入 `unmappedCollections` 如实报出，不假装已归类。
 * - 系统集合 `-1`（Unsorted）与 `-99`（Trash）**不建本地 folder**，
 *   它们表示「无归属 / 回收站」，不是用户建的分类。
 */

export interface RaindropTaxonomyClient {
  getCollections(): Promise<RaindropCollection[]>
  getTags(): Promise<RaindropTag[]>
}

export interface TaxonomyIndex {
  /** Raindrop collection id（正数）→ 本地 folders.id */
  folderByCollectionId: Map<number, string>
  /** 标签名小写（= tags.name_key）→ 本地 tags.id */
  tagIdByNameKey: Map<string, string>
  /** 远端根集合总数 / 本次新建的本地 folder 数 */
  collections: number
  foldersCreated: number
  /** 本次涉及的远端标签名去重后数量 */
  tagNames: number
  tagsCreated: number
  /** 非空错误信息（逐条，不中断整体同步） */
  errors: string[]
}

function emptyIndex(): TaxonomyIndex {
  return {
    folderByCollectionId: new Map(),
    tagIdByNameKey: new Map(),
    collections: 0,
    foldersCreated: 0,
    tagNames: 0,
    tagsCreated: 0,
    errors: [],
  }
}

type FolderRow = { id?: unknown; raindropId?: unknown }

/**
 * 拉取远端分类体系并落到本地，返回可直接用于批量建书签的映射表。
 *
 * 调用时机：**在拉书签之前**。映射表是拉书签的前提——先拉书签再同步集合，
 * 第一页的书签就找不到归属了。
 */
export async function syncRaindropTaxonomy(
  repository: BookmarkRepository,
  client: RaindropTaxonomyClient,
): Promise<TaxonomyIndex> {
  const index = emptyIndex()

  // 1) 收藏夹：远端集合 id ↔ 本地 folders.raindrop_id
  try {
    const remote: RaindropCollection[] = await client.getCollections()
    // 系统集合（id ≤ 0）不入映射：Unsorted / Trash 不是用户建的分类
    const usable = remote.filter((c) => typeof c?._id === 'number' && c._id > 0 && String(c?.title ?? '').trim())
    index.collections = usable.length
    if (usable.length > 0) {
      const result = await repository.folders.ensureByRaindropId(
        usable.map((c) => ({ raindropId: c._id, name: String(c.title).trim() })),
      )
      index.foldersCreated = result.created
    }
    // 回读本地 folder 表建映射（D1 的 RETURNING 行为与 SQLite 不一致，回读最稳）
    const local = (await repository.folders.list()) as FolderRow[]
    for (const row of local) {
      const remoteId = Number(row.raindropId)
      if (!row.id || !Number.isFinite(remoteId) || remoteId <= 0) continue
      index.folderByCollectionId.set(remoteId, String(row.id))
    }
  } catch (error) {
    index.errors.push(`收藏夹清单同步失败：${error instanceof Error ? error.message : String(error)}`)
  }

  // 2) 标签：Raindrop 的标签本身就是字符串名，name_key（小写）即映射键
  try {
    const remote: RaindropTag[] = await client.getTags()
    const names = Array.from(
      new Set(
        remote
          .map((t) => String(t?.name ?? (t as unknown as { _id?: unknown })?._id ?? '').trim())
          .filter(Boolean),
      ),
    )
    index.tagNames = names.length
    if (names.length > 0) {
      const before = index.tagIdByNameKey.size
      index.tagIdByNameKey = await repository.tags.ensureMany(names)
      index.tagsCreated = index.tagIdByNameKey.size - before
    }
  } catch (error) {
    index.errors.push(`标签清单同步失败：${error instanceof Error ? error.message : String(error)}`)
  }

  return index
}

/**
 * 汇总一批 Raindrop 条目的分类映射结果。
 * `unmappedCollections` 是**必须上报的事实**（计划 §3.6.3 的「映射失效」），
 * 宁可显示「有 N 条没找到归属的收藏夹」，也不要静默归到「未分类」让人以为已经理好了。
 */
export function resolveTaxonomy(
  index: TaxonomyIndex,
  items: Array<{ collectionId: number | null; tags: string[] }>,
): {
  folderIds: Array<string | null>
  tagIds: string[][]
  /** 映射不到的远端集合 id（去重后原样返回，便于跨页累计） */
  unmappedCollectionIds: Set<number>
  unmappedTags: string[]
} {
  const unmappedCollectionIds = new Set<number>()
  const unmappedTagNames = new Set<string>()

  const folderIds = items.map((item) => {
    if (item.collectionId === null) return null
    const folderId = index.folderByCollectionId.get(item.collectionId)
    if (!folderId) unmappedCollectionIds.add(item.collectionId)
    return folderId ?? null
  })

  const tagIds = items.map((item) => {
    const ids: string[] = []
    for (const name of item.tags) {
      const tagId = index.tagIdByNameKey.get(name.toLowerCase())
      if (tagId) ids.push(tagId)
      else unmappedTagNames.add(name)
    }
    return ids
  })

  return {
    folderIds,
    tagIds,
    unmappedCollectionIds,
    unmappedTags: Array.from(unmappedTagNames),
  }
}
