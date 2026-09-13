import { describe, expect, it } from 'vitest'
import type { RaindropBookmark } from '../channels/raindrop.js'
import { pullFromRaindrop, type RaindropPullClient } from './raindrop-pull.js'

/** 内存仓：只实现拉回路径用到的面（批量接口） */
function makeRepo(existing: Array<Record<string, any>> = []) {
  const bookmarks = existing
  const conflicts: Array<Record<string, any>> = []
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
    createMany: async (records: Array<Record<string, any>>) => {
      bookmarks.push(...records)
      return records
    },
    get: async (id: string) => bookmarks.find((b) => b.id === id),
  }
  return { repository, bookmarks, conflicts }
}

function fakeClient(pages: RaindropBookmark[][]): RaindropPullClient {
  return {
    async fetchBookmarks(page = 0) {
      return { items: pages[page] ?? [], total: pages.reduce((n, p) => n + p.length, 0) }
    },
  }
}

function rd(id: number, over: Partial<RaindropBookmark> = {}): RaindropBookmark {
  return {
    _id: id,
    link: `https://rd-${id}.example.com/`,
    title: `Remote ${id}`,
    collection: { $id: -1 },
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
    const summary = await pullFromRaindrop(repository, fakeClient([[rd(1), rd(2)]]))
    expect(summary).toMatchObject({ created: 2, skipped: 0, conflicts: 0, pages: 1 })
    expect(bookmarks).toHaveLength(2)
    expect(bookmarks[0]).toMatchObject({ source: 'raindrop', status: 'unread', raindropId: '1' })
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
})
