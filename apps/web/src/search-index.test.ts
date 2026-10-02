import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BookmarkSearchIndex } from './search-index.js'
import { bookmarksApi } from './api/bookmarks.js'

/**
 * 端侧全量检索索引的纯逻辑测试（批次 2）。
 *
 * 覆盖的是「搜不全」这个老问题本身：⌘K 此前只索引当前页，
 * 所以这里要验证的是**预取拼接后能搜到不在第一页的条目**。
 */

vi.mock('./api/bookmarks.js', () => ({ bookmarksApi: { searchIndex: vi.fn() } }))

const searchIndexMock = vi.mocked(bookmarksApi.searchIndex)

/** 造一页投影；最后一条固定是一条「特殊」条目，用来验证能搜到它 */
function makeCorpus(total: number) {
  return Array.from({ length: total }, (_, i) => {
    const special = i === total - 1
    return {
      id: `bm-${String(i).padStart(4, '0')}`,
      title: special ? 'Houdini 渲染终极笔记' : `条目 ${i}`,
      url: `https://example.com/${i}`,
      domain: 'example.com',
      note: special ? 'VEX 软体与碎裂' : null,
      tagText: special ? '渲染 图形学' : '',
      tagNames: special ? ['渲染', '图形学'] : [],
      folderName: special ? '论文' : null,
      createdAt: new Date(2026, 0, 1, 0, 0, total - i).toISOString(),
    }
  })
}

beforeEach(() => {
  searchIndexMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BookmarkSearchIndex', () => {
  it('跨页拼出的索引能搜到最后一页的条目——这正是此前搜不到的那批', async () => {
    const corpus = makeCorpus(300)
    searchIndexMock.mockImplementation(async ({ cursor } = {}) => {
      const offset = cursor ? Number(cursor) : 0
      const items = corpus.slice(offset, offset + 100)
      const next = offset + 100 < corpus.length ? String(offset + 100) : undefined
      return { items, nextCursor: next ?? null, total: corpus.length }
    })

    const index = new BookmarkSearchIndex()
    await index.ensure()

    expect(searchIndexMock).toHaveBeenCalledTimes(3)
    expect(index.getSnapshot()).toMatchObject({ state: 'ready', indexed: 300, total: 300 })

    // 第 300 条在最后一页，此前 ⌘K 永远搜不到它
    const hits = index.search('Houdini')
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('bm-0299')
    expect(hits[0].title).toBe('Houdini 渲染终极笔记')
    expect(hits[0].tagNames).toEqual(['渲染', '图形学'])
    expect(hits[0].folderName).toBe('论文')
  })

  it('按标签名、备注、域名都能命中（索引字段覆盖设计意图）', async () => {
    const corpus = makeCorpus(5)
    searchIndexMock.mockResolvedValue({ items: corpus, nextCursor: null, total: 5 })

    const index = new BookmarkSearchIndex()
    await index.ensure()

    const last = corpus[corpus.length - 1].id
    expect(index.search('渲染')[0]?.id).toBe(last)   // tagText
    expect(index.search('软体')[0]?.id).toBe(last)   // note
    expect(index.search('example.com').length).toBe(5)    // domain 命中全部
  })

  it('并发调用 ensure 只预取一次', async () => {
    searchIndexMock.mockResolvedValue({ items: makeCorpus(3), nextCursor: null, total: 3 })
    const index = new BookmarkSearchIndex()
    await Promise.all([index.ensure(), index.ensure(), index.ensure()])
    expect(searchIndexMock).toHaveBeenCalledTimes(1)
  })

  it('预取失败落到 error 态且不抛，查询返回空而不是崩', async () => {
    searchIndexMock.mockRejectedValue(new Error('网络不通'))
    const index = new BookmarkSearchIndex()
    await expect(index.ensure()).resolves.toBeUndefined()
    expect(index.getSnapshot()).toMatchObject({ state: 'error', error: '网络不通' })
    expect(index.search('任何词')).toEqual([])
  })

  it('invalidate 后索引清空并可重建', async () => {
    searchIndexMock.mockResolvedValue({ items: makeCorpus(10), nextCursor: null, total: 10 })
    const index = new BookmarkSearchIndex()
    await index.ensure()
    // 按域名搜能覆盖全部 10 条
    expect(index.search('example.com').length).toBe(10)

    index.invalidate()
    expect(index.getSnapshot()).toMatchObject({ state: 'idle', indexed: 0 })
    expect(index.search('example.com')).toEqual([])

    await index.ensure()
    expect(index.search('example.com').length).toBe(10)
    expect(searchIndexMock).toHaveBeenCalledTimes(2)
  })

  it('预取有 6000 条上限，不会因游标异常无限翻页', async () => {
    // 服务端永远返回一个新游标：没有上限就会死循环
    let calls = 0
    searchIndexMock.mockImplementation(async () => {
      calls += 1
      return { items: makeCorpus(100).map((r) => ({ ...r, id: `bm-${calls}-${r.id}` })), nextCursor: `c${calls}`, total: 999999 }
    })
    const index = new BookmarkSearchIndex()
    await index.ensure()
    expect(calls).toBe(60) // 6000 / 100
    expect(index.getSnapshot().indexed).toBe(6000)
  })
})
