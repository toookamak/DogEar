import { describe, expect, it } from 'vitest'
import type { RaindropBookmark } from '../channels/raindrop.js'
import { pullFromRaindrop, type RaindropPullClient } from './raindrop-pull.js'

/** 内存仓：只实现拉回路径用到的面（批量接口） */
function makeRepo(existing: Array<Record<string, any>> = []) {
  const bookmarks = existing
  const conflicts: Array<Record<string, any>> = []
  const folders: Array<Record<string, any>> = []
  const tagRows: Array<Record<string, any>> = []
  const mounts: Array<{ bookmarkId: string; tagId: string; source: string }> = []
  let seq = 0
  const repository: any = {
    bookmarks,
    conflicts: {
      list: async () => conflicts,
      get: async (id: string) => conflicts.find((c) => c.id === id),
      findByRaindropId: async (raindropId: string, resolution?: string) =>
        conflicts.find((c) => c.raindropId === raindropId && (!resolution || c.resolution === resolution)),
      findByRaindropIds: async (raindropIds: string[], resolution?: string) =>
        conflicts.filter((c) => raindropIds.includes(String(c.raindropId)) && (!resolution || c.resolution === resolution)),
      create: async (data: Record<string, any>) => {
        const row = { resolution: 'pending', ...data, resolvedAt: null }
        conflicts.push(row)
        return row
      },
      createMany: async (rows: Array<Record<string, any>>) => {
        for (const data of rows) {
          conflicts.push({ resolution: 'pending', ...data, resolvedAt: null })
        }
        return rows
      },
      resolve: async (id: string, resolution: string) => {
        const row = conflicts.find((c) => c.id === id)
        if (row) Object.assign(row, { resolution, resolvedAt: new Date() })
        return row
      },
      resolveAll: async (resolution: string) => {
        let n = 0
        for (const row of conflicts) {
          if (row.resolution === 'pending') {
            Object.assign(row, { resolution, resolvedAt: new Date() })
            n += 1
          }
        }
        return n
      },
      countPending: async () => conflicts.filter((c) => c.resolution === 'pending').length,
    },
    findByRaindropIds: async (raindropIds: string[]) => bookmarks.filter((b) => raindropIds.includes(String(b.raindropId))),
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
    get: async (id: string) => bookmarks.find((b) => b.id === id),
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
  return { repository, bookmarks, conflicts, folders, tagRows, mounts }
}

const REMOTE_COLLECTIONS = [
  { _id: 100, title: '论文', count: 2, sort: 0, public: false },
  { _id: -1, title: 'Unsorted', count: 0, sort: 1, public: false },
]
const REMOTE_TAGS = [
  { _id: 1, name: '渲染', count: 1 },
  { _id: 2, name: 'Houdini', count: 1 },
]

function fakeClient(pages: RaindropBookmark[][]): RaindropPullClient {
  return {
    async fetchBookmarks(page = 0) {
      return { items: pages[page] ?? [], total: pages.reduce((n, p) => n + p.length, 0) }
    },
    async getCollections() { return REMOTE_COLLECTIONS },
    async getTags() { return REMOTE_TAGS },
  }
}

/** 2026-10-02：默认给正的 collection 与真实 tags，不再一律 `-1` + 无标签 */
function rd(id: number, over: Partial<RaindropBookmark> = {}): RaindropBookmark {
  return {
    _id: id,
    link: `https://rd-${id}.example.com/`,
    title: `Remote ${id}`,
    collection: { $id: 100 },
    tags: ['渲染'],
    note: '',
    excerpt: '',
    created: '2026-09-01T00:00:00Z',
    lastUpdate: '2026-09-10T00:00:00Z',
    ...over,
  }
}

describe('Raindrop 拉回（L2 双向的远端→本地侧）', () => {
  it('creates new bookmarks into Inbox with source=raindrop', async () => {
    const { repository, bookmarks } = makeRepo()
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1, { excerpt: '远端简介' }), rd(2)]]))
    expect(summary).toMatchObject({ created: 2, skipped: 0, conflicts: 0, pages: 1 })
    expect(bookmarks).toHaveLength(2)
    expect(bookmarks[0]).toMatchObject({ source: 'raindrop', status: 'unread', raindropId: '1', excerpt: '远端简介' })
  })

  /**
   * 批次 0 的核心回归：拉回时**先同步分类体系**，书签带上 folderId 与标签挂载。
   * 此前 `getCollections()` / `getTags()` 零调用、`mapRaindropBookmark` 丢弃 tags 与
   * collection，所以这条路径完全没有验证——CI 全绿而功能是空的。
   */
  it('先同步收藏夹/标签清单，再把归属与挂载写进新书签（批次 0 核心回归）', async () => {
    const { repository, bookmarks, folders, tagRows, mounts } = makeRepo()

    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1), rd(2, { tags: ['Houdini'] })]]))

    expect(summary.collections).toBe(1)
    expect(summary.foldersCreated).toBe(1)
    expect(folders[0]).toMatchObject({ name: '论文', raindropId: '100' })
    expect(bookmarks.every((b) => b.folderId === folders[0].id)).toBe(true)
    expect(tagRows.map((t) => t.name).sort()).toEqual(['Houdini', '渲染'].sort())
    expect(summary.tagged).toBe(2)
    expect(mounts).toHaveLength(2)
  })

  it('拉取不产生任何 sync_queue 入队（额度保护第 2 条：拉取只读）', async () => {
    const { repository, bookmarks } = makeRepo()
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1), rd(2)]]))
    // 拉回创建的书签必须是 synced（不是 pending），否则会被消费器当成「本地领先」推回远端
    expect(summary.created).toBe(2)
    expect(bookmarks.every((b) => b.syncStatus === 'synced')).toBe(true)
  })

  it('远端集合未同步时 folderId 留空并计入 unmappedCollections，不静默归类', async () => {
    const { repository, bookmarks } = makeRepo()
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1, { collection: { $id: 999 } })]]))
    expect(summary.unmappedCollections).toBe(1)
    expect(bookmarks[0].folderId).toBeNull()
  })

  it('skips unchanged bookmarks', async () => {
    const { repository, bookmarks } = makeRepo([
      { id: 'b-1', raindropId: '1', title: 'Remote 1', url: 'https://rd-1.example.com/', note: null, updatedAt: new Date('2026-09-11T00:00:00Z') },
    ])
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1)]]))
    // 远端 lastUpdate（09-10）早于本地 updatedAt（09-11）→ 直接跳过
    expect(summary).toMatchObject({ created: 0, skipped: 1, conflicts: 0 })
    expect(bookmarks).toHaveLength(1)
  })

  it('records a conflict (local wins, both snapshots kept) when both sides changed', async () => {
    const { repository, bookmarks, conflicts } = makeRepo([
      { id: 'b-1', raindropId: '1', title: '本地改过的标题', url: 'https://rd-1.example.com/', note: '本地备注', updatedAt: new Date('2026-09-11T00:00:00Z') },
    ])
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1, { title: '远端改过的标题', lastUpdate: '2026-09-12T00:00:00Z' })]]))
    expect(summary).toMatchObject({ created: 0, conflicts: 1 })
    // 本地赢：本地书签不动
    expect(bookmarks[0].title).toBe('本地改过的标题')
    // 两端快照都在
    expect(conflicts).toHaveLength(1)
    expect(JSON.parse(conflicts[0].localSnapshot).title).toBe('本地改过的标题')
    expect(JSON.parse(conflicts[0].remoteSnapshot).title).toBe('远端改过的标题')
  })

  it('does not duplicate pending conflicts for the same raindropId', async () => {
    const { repository, conflicts } = makeRepo([
      { id: 'b-1', raindropId: '1', title: '本地标题', url: 'https://rd-1.example.com/', note: null, updatedAt: new Date('2026-09-11T00:00:00Z') },
    ])
    const client = fakeClient([[rd(1, { title: '远端标题', lastUpdate: '2026-09-12T00:00:00Z' })]])
    await pullFromRaindrop(repository, client)
    await pullFromRaindrop(repository, client)
    expect(conflicts).toHaveLength(1)
  })

  it('respects maxPages (single page by default) to avoid Raindrop rate limits', async () => {
    const { repository } = makeRepo()
    const pages = [[rd(1)], [rd(2)]]
    const summary = await pullFromRaindrop(repository, fakeClient(pages), { maxPages: 1 })
    // 只拉第一页：第 2 页的 rd(2) 不会被扫描（防风控的关键约束）
    expect(summary.pages).toBe(1)
    expect(summary.created).toBe(1)
    expect(summary.scanned).toBe(1)
  })

  it('does not duplicate a bookmark that already exists by URL, and fills empty cover', async () => {
    const { repository, bookmarks } = makeRepo([
      { id: 'b-old', url: 'https://rd-1.example.com/', title: '先存的', cover: null, raindropId: null },
    ])
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1, { cover: 'https://rd-bg.b-cdn.net/a.jpg' })]]))
    expect(summary.created).toBe(0)
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0]).toMatchObject({ id: 'b-old', raindropId: '1', cover: 'https://rd-bg.b-cdn.net/a.jpg' })
  })

  it('fills cover on an existing raindropId row instead of creating another', async () => {
    const { repository, bookmarks } = makeRepo([
      { id: 'b-1', raindropId: '1', title: 'Remote 1', url: 'https://rd-1.example.com/', cover: null, updatedAt: new Date('2026-09-11T00:00:00Z') },
    ])
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1, { cover: 'https://rd-bg.b-cdn.net/b.jpg' })]]))
    expect(summary.created).toBe(0)
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0].cover).toBe('https://rd-bg.b-cdn.net/b.jpg')
  })
})
