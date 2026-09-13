import { describe, expect, it } from 'vitest'
import type { RaindropBookmark } from '../channels/raindrop.js'
import { importRaindropPage, IMPORT_PAGE_SIZE } from './raindrop-import.js'

/** 内存仓：只实现按页导入路径用到的面 */
function makeRepo(existing: Array<Record<string, any>> = []) {
  const bookmarks = existing
  const repository: any = {
    bookmarks,
    findByRaindropIds: async (ids: string[]) => bookmarks.filter((b) => ids.includes(String(b.raindropId))),
    createMany: async (records: Array<Record<string, any>>) => {
      bookmarks.push(...records)
      return records
    },
  }
  return { repository, bookmarks }
}

function makeItems(n: number, startId = 1): RaindropBookmark[] {
  return Array.from({ length: n }, (_, i) => ({
    _id: startId + i,
    link: `https://example.com/${startId + i}`,
    title: `页 ${startId + i}`,
    excerpt: `摘 ${startId + i}`,
    note: '',
    tags: [],
    collection: { $id: -1 },
    created: '2026-09-01T00:00:00Z',
    lastUpdate: '2026-09-01T00:00:00Z',
    type: 'link',
  }))
}

function fakeClient(pages: RaindropBookmark[][], calls: Array<{ page: number; perPage: number }> = []) {
  return {
    async fetchBookmarks(page = 0, perPage = IMPORT_PAGE_SIZE) {
      calls.push({ page, perPage })
      return { items: pages[page] ?? [], total: pages.reduce((n, p) => n + p.length, 0) }
    },
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
    })
    expect(JSON.parse(bookmarks[0].raindropExtras)).toMatchObject({ excerpt: '摘 1', collectionId: -1 })
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
    const repository: any = {
      findByRaindropIds: async () => [],
      createMany: async () => { throw new Error('D1 broken') },
    }
    const client = fakeClient([makeItems(2)])

    const summary = await importRaindropPage(repository, client, { page: 0 })

    expect(summary.imported).toBe(0)
    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0]).toContain('D1 broken')
  })
})
