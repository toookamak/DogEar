import { describe, expect, it } from 'vitest'
import { exportRaindropPage, EXPORT_PAGE_SIZE } from './raindrop-export.js'

/** 内存仓：只实现导出路径用到的面 */
function makeRepo(existing: Array<Record<string, any>> = []) {
  const bookmarks = existing
  const repository: any = {
    bookmarks,
    listExportRows: async (opts: { onlyWithoutRaindropId?: boolean }, limit: number, offset: number) => {
      let rows = bookmarks.filter((row) => !row.deletedAt)
      if (opts.onlyWithoutRaindropId) rows = rows.filter((row) => !row.raindropId)
      return rows.slice(offset, offset + limit)
    },
    countWithoutRaindropId: async () => bookmarks.filter((row) => !row.deletedAt && !row.raindropId).length,
    updateRaindropIds: async (pairs: Array<{ id: string; raindropId: string }>) => {
      for (const pair of pairs) {
        const row = bookmarks.find((b) => b.id === pair.id)
        if (row) {
          row.raindropId = pair.raindropId
          row.syncStatus = 'synced'
        }
      }
    },
  }
  return { repository, bookmarks }
}

function makeClient(failUrls: Set<string> = new Set()) {
  const created: Array<Record<string, unknown>> = []
  let nextId = 1000
  return {
    created,
    async createBookmark(data: Record<string, unknown>) {
      if (failUrls.has(String(data.url))) throw new Error('boom')
      created.push(data)
      return { _id: nextId++ }
    },
  }
}

describe('exportRaindropPage', () => {
  /**
   * 批次 0（0.7）核心回归：导出必须带上用户本地整理好的标签与远端集合。
   * 此前 `tags: []` 是硬编码的，等于「整理成果没有出口」——本地挂好的标签
   * 推回 Raindrop 时被静默丢掉，而回执还显示成功。
   */
  it('导出时带上标签与已映射的远端集合（批次 0.7 核心回归）', async () => {
    const { repository } = makeRepo([
      { id: 'b1', url: 'https://a.example.com/', title: 'A', note: null, tagNames: ['渲染', '图形学'], collectionId: '100' },
      { id: 'b2', url: 'https://b.example.com/', title: 'B', note: null, tagNames: [], collectionId: null },
    ])
    const client = makeClient()

    await exportRaindropPage(repository, client, { count: 20 })

    const byUrl = new Map(client.created.map((row) => [String(row.url), row]))
    expect((byUrl.get('https://a.example.com/') as any).tags).toEqual(['渲染', '图形学'])
    expect((byUrl.get('https://a.example.com/') as any).collection).toEqual({ $id: 100 })
    // 没标签 / 没映射到远端集合时：标签空数组，且**不塞 collection**（不塞错的 id）
    expect((byUrl.get('https://b.example.com/') as any).tags).toEqual([])
    expect((byUrl.get('https://b.example.com/') as any).collection).toBeUndefined()
  })

  it('导出一页：推送远端并批量写回 raindropId 与 synced', async () => {
    const { repository, bookmarks } = makeRepo([
      { id: 'b1', url: 'https://a.example.com/', title: 'A', note: null },
      { id: 'b2', url: 'https://b.example.com/', title: 'B', note: 'n' },
    ])
    const client = makeClient()

    const summary = await exportRaindropPage(repository, client, { count: 20 })

    expect(summary).toMatchObject({ exported: 2, failed: 0, processed: 2, total: 0, hasMore: false })
    expect(client.created).toHaveLength(2)
    expect(bookmarks[0]).toMatchObject({ raindropId: '1000', syncStatus: 'synced' })
  })

  it('页大小封顶：count 超过 EXPORT_PAGE_SIZE 也只导一页', async () => {
    const { repository } = makeRepo(Array.from({ length: 50 }, (_, i) => ({ id: `b${i}`, url: `https://x.example.com/${i}`, title: `X${i}`, note: null })))
    const client = makeClient()

    const summary = await exportRaindropPage(repository, client, { count: 500 })

    expect(summary.processed).toBe(EXPORT_PAGE_SIZE)
    expect(client.created).toHaveLength(EXPORT_PAGE_SIZE)
    expect(summary.hasMore).toBe(true)
  })

  it('失败不重试：excludeIds 跳过毒条目，循环能走到耗尽', async () => {
    const bad = { id: 'bad', url: 'https://bad.example.com/', title: 'Bad', note: null }
    const { repository } = makeRepo([bad, { id: 'b2', url: 'https://ok.example.com/', title: 'OK', note: null }])
    const client = makeClient(new Set(['https://bad.example.com/']))

    const first = await exportRaindropPage(repository, client, { count: 20 })
    expect(first).toMatchObject({ exported: 1, failed: 1, processed: 2 })

    // 前端把失败 id 传回：候选集只剩失败行 → processed=0，循环终止
    const second = await exportRaindropPage(repository, client, { count: 20, excludeIds: ['bad'] })
    expect(second).toMatchObject({ exported: 0, failed: 0, processed: 0, hasMore: false })
    expect(second.total).toBe(1)
    // 失败条目没有被重试
    expect(client.created).toHaveLength(1)
  })

  it('失败的行不会被写回 raindropId', async () => {
    const { repository, bookmarks } = makeRepo([
      { id: 'bad', url: 'https://bad.example.com/', title: 'Bad', note: null },
      { id: 'ok', url: 'https://ok.example.com/', title: 'OK', note: null },
    ])
    const client = makeClient(new Set(['https://bad.example.com/']))

    await exportRaindropPage(repository, client, { count: 20 })

    expect(bookmarks.find((b) => b.id === 'bad')?.raindropId).toBeUndefined()
    expect(bookmarks.find((b) => b.id === 'ok')?.raindropId).toBe('1000')
  })

  it('已经推送过的书签不再进入候选集', async () => {
    const { repository } = makeRepo([
      { id: 'done', url: 'https://done.example.com/', title: 'Done', note: null, raindropId: '42' },
      { id: 'new', url: 'https://new.example.com/', title: 'New', note: null },
    ])
    const client = makeClient()

    const summary = await exportRaindropPage(repository, client, { count: 20 })

    expect(summary.processed).toBe(1)
    expect(summary.total).toBe(0)
  })
})
