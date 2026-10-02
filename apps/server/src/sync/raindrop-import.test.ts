import { describe, expect, it } from 'vitest'
import type { RaindropBookmark } from '../channels/raindrop.js'
import { importRaindropPage, IMPORT_PAGE_SIZE } from './raindrop-import.js'

/**
 * 内存仓：只实现按页导入路径用到的面。
 * 2026-10-02 批次 0 补 `folders` / `tags` / `attachTagsBatch` 三块——
 * 此前这些方法不存在，于是「拉回来的书签没有收藏夹和标签」这件事在测试里完全看不见，
 * CI 全绿是假象（0.9 的结论）。
 */
function makeRepo(existing: Array<Record<string, any>> = []) {
  const bookmarks = existing
  const folders: Array<Record<string, any>> = []
  const tagRows: Array<Record<string, any>> = []
  const mounts: Array<{ bookmarkId: string; tagId: string; source: string }> = []
  let seq = 0
  const repository: any = {
    bookmarks,
    mounts,
    folders,
    tags: tagRows,
    findByRaindropIds: async (ids: string[]) => bookmarks.filter((b) => ids.includes(String(b.raindropId))),
    findByUrls: async (urls: string[]) => bookmarks.filter((b) => urls.includes(String(b.url))),
    updateMany: async (patches: Array<Record<string, any>>) => {
      for (const patch of patches) {
        const row = bookmarks.find((b) => b.id === patch.id)
        if (row) Object.assign(row, patch)
      }
    },
    createMany: async (records: Array<Record<string, any>>) => {
      bookmarks.push(...records)
      return records
    },
    attachTagsBatch: async (pairs: Array<{ bookmarkId: string; tagIds: string[] }>) => {
      for (const pair of pairs) {
        for (const tagId of pair.tagIds) {
          if (!mounts.some((m) => m.bookmarkId === pair.bookmarkId && m.tagId === tagId)) {
            mounts.push({ bookmarkId: pair.bookmarkId, tagId, source: 'raindrop' })
          }
        }
      }
    },
    folders: {
      list: async () => folders,
      ensureByRaindropId: async (items: Array<{ raindropId: number; name: string }>) => {
        let created = 0
        for (const item of items) {
          if (folders.some((f) => f.raindropId === String(item.raindropId))) continue
          folders.push({ id: `f-${++seq}`, name: item.name, raindropId: String(item.raindropId) })
          created += 1
        }
        return { synced: items.length, created }
      },
    },
    tags: {
      ensureMany: async (names: string[]) => {
        const mapping = new Map<string, string>()
        for (const row of tagRows) mapping.set(String(row.name).toLowerCase(), row.id)
        for (const name of names) {
          const key = name.toLowerCase()
          if (mapping.has(key)) continue
          const id = `t-${++seq}`
          tagRows.push({ id, name, nameKey: key })
          mapping.set(key, id)
        }
        return mapping
      },
    },
  }
  return { repository, bookmarks, folders, tagRows, mounts }
}

/**
 * fixture 用**真实的 tags 与正的 collection id**。
 * 此前一律 `tags: []` + `collection: { $id: -1 }`（Unsorted），恰好绕开了整条链路，
 * 所以「收藏夹和标签有没有被拉下来」这件事从来没被验证过。
 */
function makeItems(n: number, startId = 1): RaindropBookmark[] {
  return Array.from({ length: n }, (_, i) => ({
    _id: startId + i,
    link: `https://example.com/${startId + i}`,
    title: `页 ${startId + i}`,
    excerpt: `摘 ${startId + i}`,
    note: '',
    tags: i % 2 === 0 ? ['渲染', '图形学'] : ['Houdini'],
    collection: { $id: 100 },
    created: '2026-09-01T00:00:00Z',
    lastUpdate: '2026-09-01T00:00:00Z',
    type: 'link',
  }))
}

/** 远端分类清单：与 makeItems 的 collection 100 / 标签名对齐 */
const REMOTE_COLLECTIONS = [
  { _id: 100, title: '论文', count: 2, sort: 0, public: false },
  { _id: -1, title: 'Unsorted', count: 0, sort: 1, public: false },
]
const REMOTE_TAGS = [
  { _id: 1, name: '渲染', count: 2 },
  { _id: 2, name: '图形学', count: 2 },
  { _id: 3, name: 'Houdini', count: 1 },
]

function fakeClient(pages: RaindropBookmark[][], calls: Array<{ page: number; perPage: number }> = []) {
  return {
    async fetchBookmarks(page = 0, perPage = IMPORT_PAGE_SIZE) {
      calls.push({ page, perPage })
      return { items: pages[page] ?? [], total: pages.reduce((n, p) => n + p.length, 0) }
    },
    async getCollections() { return REMOTE_COLLECTIONS },
    async getTags() { return REMOTE_TAGS },
  }
}

describe('importRaindropPage', () => {
  it('导入一页新书签：进 Inbox、带 raindropId 与 extras、返回 total 与 hasMore', async () => {
    const { repository, bookmarks } = makeRepo()
    const client = fakeClient([makeItems(3)])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.imported).toBe(3)
    expect(summary.skipped).toBe(0)
    expect(summary.errors).toEqual([])
    expect(summary.total).toBe(3)
    expect(summary.hasMore).toBe(false) // 未拉满一页
    expect(bookmarks).toHaveLength(3)
    expect(bookmarks[0]).toMatchObject({
      url: 'https://example.com/1',
      status: 'unread',
      source: 'page',
      syncStatus: 'synced',
      raindropId: '1',
      excerpt: '摘 1',
      domain: 'example.com',
    })
    expect(JSON.parse(bookmarks[0].raindropExtras)).toMatchObject({ excerpt: '摘 1', collectionId: 100 })
  })

  /**
   * 批次 0 的核心回归：收藏夹与标签**必须真的落库**。
   * 这条测试在 v0.7.x 根本写不出来——那时 fixture 是 `tags: []` + `collection.$id: -1`，
   * 恰好绕开整条链路，CI 全绿却什么也没验证到。
   */
  it('拉回来的书签带上收藏夹归属与标签挂载（批次 0 核心回归）', async () => {
    const { repository, bookmarks, folders, tagRows, mounts } = makeRepo()
    const client = fakeClient([makeItems(4)])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    // 远端分类清单已同步：100 号集合建成本地 folder；系统集合 -1 不建
    expect(summary.collections).toBe(1)
    expect(summary.foldersCreated).toBe(1)
    expect(folders).toHaveLength(1)
    expect(folders[0]).toMatchObject({ name: '论文', raindropId: '100' })

    // 三条书签都归到同一个本地 folder
    const folderId = folders[0].id
    expect(bookmarks.every((b) => b.folderId === folderId)).toBe(true)

    // 标签建了 3 个，挂载数 = 2*2 + 1*2 = 6
    expect(tagRows.map((t) => t.name).sort()).toEqual(['Houdini', '图形学', '渲染'].sort())
    expect(summary.tagged).toBe(6)
    expect(mounts).toHaveLength(6)
    expect(mounts.every((m) => m.source === 'raindrop')).toBe(true)
  })

  it('系统集合 -1（Unsorted）视为无收藏夹，不凭空建分类', async () => {
    const { repository, bookmarks, folders } = makeRepo()
    const client = fakeClient([[{ ...makeItems(1)[0], collection: { $id: -1 } }]])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.imported).toBe(1)
    expect(bookmarks[0].folderId).toBeNull()
    // 远端清单里的 100 号集合照常建成本地 folder（本就该建），
    // 只是这条书签不指向它；-1 不曾被建过任何 folder
    expect(folders).toHaveLength(1)
    expect(folders[0].raindropId).toBe('100')
  })

  it('落在未同步的远端集合里：folderId 留空并计入 unmappedCollections，不静默归类', async () => {
    const { repository, bookmarks, folders } = makeRepo()
    const client = fakeClient([[{ ...makeItems(1)[0], collection: { $id: 999 } }]])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.unmappedCollections).toBe(1)
    expect(bookmarks[0].folderId).toBeNull()
    expect(folders).toHaveLength(1) // 只建了已知的 100 号
  })

  it('拉满一页（50 条）时 hasMore=true，提示调用方继续下一页', async () => {
    const { repository } = makeRepo()
    const client = fakeClient([makeItems(IMPORT_PAGE_SIZE)])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.imported).toBe(IMPORT_PAGE_SIZE)
    expect(summary.hasMore).toBe(true)
  })

  it('按 raindropId 去重：已存在的跳过不重复入库', async () => {
    const { repository } = makeRepo([{ id: 'b1', raindropId: '1' }])
    const client = fakeClient([makeItems(3)])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.imported).toBe(2)
    expect(summary.skipped).toBe(1)
  })

  it('page 参数透传给远端客户端', async () => {
    const { repository } = makeRepo()
    const calls: Array<{ page: number; perPage: number }> = []
    const client = fakeClient([makeItems(2), makeItems(2, 10)], calls)

    await importRaindropPage(repository, client, { page: 1 })

    expect(calls).toEqual([{ page: 1, perPage: IMPORT_PAGE_SIZE }])
  })

  it('intoInbox=false 时落 saved', async () => {
    const { repository, bookmarks } = makeRepo()
    const client = fakeClient([makeItems(1)])

    await importRaindropPage(repository, client, { page: 0, intoInbox: false })

    expect(bookmarks[0].status).toBe('saved')
  })

  it('空页直接返回：imported=0、hasMore=false', async () => {
    const { repository } = makeRepo()
    const client = fakeClient([makeItems(2), []])

    const summary = await importRaindropPage(repository, client, { page: 1 })

    expect(summary.imported).toBe(0)
    expect(summary.skipped).toBe(0)
    expect(summary.hasMore).toBe(false)
  })

  it('批量写入失败：记入 errors、imported=0，不抛出', async () => {
    // 用完整桩再把 createMany 换成抛错，避免少 folders/tags 造成额外的无关 errors
    const { repository } = makeRepo()
    repository.createMany = async () => { throw new Error('D1 broken') }
    const client = fakeClient([makeItems(2)])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.imported).toBe(0)
    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0]).toContain('D1 broken')
  })

  it('same URL without raindropId is not imported twice; empty cover is filled', async () => {
    const { repository, bookmarks } = makeRepo([{ id: 'old', url: 'https://example.com/1', raindropId: null, cover: null }])
    const client = fakeClient([[{
      _id: 1, link: 'https://example.com/1', title: '页 1', excerpt: '', note: '', tags: [],
      collection: { $id: -1 }, created: '2026-09-01T00:00:00Z', lastUpdate: '2026-09-01T00:00:00Z', type: 'link',
      cover: 'https://rd-bg.b-cdn.net/c.jpg',
    }]])
    const summary = await importRaindropPage(repository, client, { page: 0 })
    expect(summary.imported).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0]).toMatchObject({ id: 'old', raindropId: '1', cover: 'https://rd-bg.b-cdn.net/c.jpg' })
  })
})
