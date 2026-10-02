import { describe, expect, it } from 'vitest'
import { computeSyncDiff, summarizeAhead } from './raindrop-diff.js'
import type { RaindropBookmark } from '../channels/raindrop.js'

/**
 * 双向差异探测（计划 §3.5）。
 *
 * 本组测试盯的是三个**容易做错、且错了会骗到用户**的地方：
 * ① 落后数是下界不是总数——不能把「至少 N」说成「一共 N」
 * ② 探测页内全是已知条目时，落后才可断言为 0（这依赖 -lastUpdate 排序）
 * ③ 没连上 Raindrop 时**不能报 behind=0**——那会被读成「远端没有新东西」
 */

function makeRepo(over: {
  pending?: number
  failed?: number
  knownRaindropIds?: string[]
  pendingPayloads?: Array<string | null>
  settings?: Record<string, string>
} = {}) {
  return {
    syncQueue: {
      countPending: async () => over.pending ?? 0,
      countFailed: async () => over.failed ?? 0,
      getPending: async (limit?: number) => {
        const payloads = over.pendingPayloads ?? []
        return payloads.slice(0, limit ?? payloads.length).map((payload, i) => ({ payload } as never))
      },
    },
    settings: {
      get: async (key: string) => over.settings?.[key] ?? null,
    },
    findByRaindropIds: async (ids: string[]) =>
      (over.knownRaindropIds ?? []).filter((id) => ids.includes(id)).map((id) => ({ raindropId: id })),
  } as never
}

function remote(ids: number[]): { items: RaindropBookmark[]; total: number } {
  return {
    items: ids.map((id) => ({ _id: id, link: `https://e.com/${id}`, title: `t${id}`, collection: { $id: -1 } })) as RaindropBookmark[],
    total: ids.length,
  }
}

describe('summarizeAhead', () => {
  it('按队列条目聚合改动类型：一条改两个字段会同时计入两项', () => {
    const breakdown = summarizeAhead([
      JSON.stringify({ tags: ['a'] }),
      JSON.stringify({ collectionId: 5 }),
      JSON.stringify({ title: '新标题' }),
      JSON.stringify({ note: '备注' }),
      JSON.stringify({ tags: ['b'], collectionId: 7, title: 't' }), // 一条三改
      null,                 // create / delete
      'not json',           // 坏 payload 不得抛
      JSON.stringify({}),   // 认不出改了什么
    ])
    expect(breakdown).toEqual({ tags: 2, folder: 2, title: 2, note: 1, other: 3 })
  })
})

describe('computeSyncDiff', () => {
  it('探测页全是已知条目 ⇒ 落后确为 0，且 behindIsExact=true', async () => {
    const repo = makeRepo({ knownRaindropIds: ['1', '2', '3'] })
    const result = await computeSyncDiff(repo, { fetchBookmarks: async () => remote([1, 2, 3]) })
    expect(result.behind).toBe(0)
    expect(result.behindIsExact).toBe(true)
  })

  it('探测页内有未知条目 ⇒ behind 是下界，behindIsExact=false', async () => {
    const repo = makeRepo({ knownRaindropIds: ['1', '2'] })
    const result = await computeSyncDiff(repo, { fetchBookmarks: async () => remote([1, 2, 9, 10, 11]) })
    expect(result.behind).toBe(3)              // 至少 3，真实值可能更多
    expect(result.behindIsExact).toBe(false)   // 界面必须据此显示「至少」而非「一共」
  })

  it('探测请求带 sort=-lastUpdate —— 排序是这个方案成立的前提', async () => {
    const calls: Array<{ page?: number; perPage?: number; sort?: string }> = []
    const repo = makeRepo({ knownRaindropIds: [] })
    await computeSyncDiff(repo, {
      fetchBookmarks: async (page, perPage, sort) => { calls.push({ page, perPage, sort }); return remote([1]) },
    })
    expect(calls[0]).toMatchObject({ page: 0, perPage: 50, sort: '-lastUpdate' })
  })

  it('未连接 Raindrop：报 probeError 而不是 behind=0', async () => {
    const repo = makeRepo()
    const result = await computeSyncDiff(repo, null)
    expect(result.probeError).toBeTruthy()
    expect(result.behindIsExact).toBe(false)
    // 关键：不能是「落后 0 条」——那会被读成「远端没有新东西」，与事实相反
    expect(result.behind).toBe(0)
    expect(result.probeError).toMatch(/未连接/)
  })

  it('远端报错时降级为 probeError，不抛', async () => {
    const repo = makeRepo()
    const result = await computeSyncDiff(repo, {
      fetchBookmarks: async () => { throw new Error('429 限流') },
    })
    expect(result.probeError).toBe('429 限流')
    expect(result.behindIsExact).toBe(false)
  })

  it('领先/失败/时间戳与明细：默认不算 breakdown，按需才算', async () => {
    const repo = makeRepo({
      pending: 2,
      failed: 1,
      pendingPayloads: [JSON.stringify({ tags: ['a'] }), JSON.stringify({ collectionId: 3 })],
      settings: { 'sync.last_push_at': '1700000000000' },
      knownRaindropIds: ['1'],
    })
    const client = { fetchBookmarks: async () => remote([1]) }

    const cheap = await computeSyncDiff(repo, client)
    expect(cheap.ahead).toBe(2)
    expect(cheap.failed).toBe(1)
    expect(cheap.lastPushAt).toBe(1700000000000)
    expect(cheap.lastPullAt).toBeNull()      // 没写过就是 null，不编造
    expect(cheap.aheadBreakdown).toBeUndefined()

    const rich = await computeSyncDiff(repo, client, { withBreakdown: true })
    expect(rich.aheadBreakdown).toEqual({ tags: 1, folder: 1, title: 0, note: 0, other: 0 })
  })
})
