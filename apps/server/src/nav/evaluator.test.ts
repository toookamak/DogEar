import { describe, expect, it } from 'vitest'
import { evaluateNavFeed, parseRulePayload } from './evaluator.js'

type RecordBag = Record<string, unknown>

interface FakeRule {
  id: string
  name: string
  mode: string
  rule: string | null
  searchQuery: string | null
  sortOrder: number
  enabled: boolean
}

function bookmark(id: string, over: RecordBag = {}): RecordBag {
  return {
    id,
    url: `https://${id}.example.com/`,
    title: id,
    status: 'saved',
    private: false,
    deletedAt: null,
    folderId: null,
    createdAt: 1000,
    scenes: [],
    tags: [],
    ...over,
  }
}

/** 内存仓：list 支持 q（标题/URL 子串）、private、excludeStatus；其余过滤测试自行构造 */
function makeRepo(rules: FakeRule[], bookmarks: RecordBag[]) {
  return {
    navRules: {
      list: async () => [...rules].sort((a, b) => a.sortOrder - b.sortOrder),
      get: async () => undefined,
      create: async () => undefined,
      update: async () => undefined,
      remove: async () => true,
    },
    list: async (filters: Record<string, unknown>, limit: number) => {
      let out = bookmarks.filter((b) => !b.deletedAt)
      if (filters.private === false) out = out.filter((b) => !b.private)
      if (filters.excludeStatus) out = out.filter((b) => b.status !== filters.excludeStatus)
      if (typeof filters.q === 'string' && filters.q) {
        const q = filters.q.toLowerCase()
        out = out.filter((b) => String(b.title).toLowerCase().includes(q) || String(b.url).toLowerCase().includes(q))
      }
      return { items: out.slice(0, limit), nextCursor: null }
    },
  } as unknown as import('@dogear/db').BookmarkRepository
}

function ids(records: Array<RecordBag>): string[] {
  return records.map((r) => String(r.id))
}

describe('nav feed evaluator (L4, v1.6)', () => {
  const docs = [
    bookmark('a', { createdAt: 300 }),
    bookmark('b', { createdAt: 200 }),
    bookmark('c', { createdAt: 100, status: 'unread' }),
    bookmark('d', { createdAt: 50, private: true }),
    bookmark('e', {
      createdAt: 40,
      scenes: [{ id: 's1', name: '工作研究' }],
      tags: [{ id: 't1', name: 'workers' }],
    }),
  ]

  it('parseRulePayload tolerates junk and returns object for valid JSON', () => {
    expect(parseRulePayload(null)).toEqual({})
    expect(parseRulePayload('not-json')).toEqual({})
    expect(parseRulePayload('[1,2]')).toEqual({})
    expect(parseRulePayload('{"sceneIds":["s1"]}')).toEqual({ sceneIds: ['s1'] })
  })

  it('with no rules falls back to legacy projection (private & unread excluded)', async () => {
    const feed = await evaluateNavFeed(makeRepo([], docs))
    expect(ids(feed)).toEqual(['a', 'b', 'e'])
  })

  it('rule mode adds matches by scene OR tag OR status (union, deduped)', async () => {
    const rules: FakeRule[] = [
      { id: 'r1', name: '工作相关', mode: 'rule', rule: JSON.stringify({ sceneIds: ['s1'] }), searchQuery: null, sortOrder: 0, enabled: true },
      { id: 'r2', name: '标签兜底', mode: 'rule', rule: JSON.stringify({ tagIds: ['t-nope'], status: 'unread' }), searchQuery: null, sortOrder: 1, enabled: true },
    ]
    // b 命中第二条的 status=unread？——候选集不含 unread（口径不放宽），所以只有 e 进集
    const feed = await evaluateNavFeed(makeRepo(rules, docs))
    expect(ids(feed)).toEqual(['e'])
  })

  it('all resets the feed to the full candidate set', async () => {
    const rules: FakeRule[] = [
      { id: 'r1', name: '先圈一个', mode: 'rule', rule: JSON.stringify({ sceneIds: ['s1'] }), searchQuery: null, sortOrder: 0, enabled: true },
      { id: 'r2', name: '再来全部', mode: 'all', rule: null, searchQuery: null, sortOrder: 1, enabled: true },
    ]
    const feed = await evaluateNavFeed(makeRepo(rules, docs))
    expect(ids(feed)).toEqual(['a', 'b', 'e'])
  })

  it('search mode adds query hits', async () => {
    const rules: FakeRule[] = [
      { id: 'r1', name: '搜 workers', mode: 'search', rule: null, searchQuery: 'a.example', sortOrder: 0, enabled: true },
    ]
    const feed = await evaluateNavFeed(makeRepo(rules, docs))
    expect(ids(feed)).toEqual(['a'])
  })

  it('hide removes matches; application order follows sort_order', async () => {
    const rules: FakeRule[] = [
      { id: 'r1', name: '全部', mode: 'all', rule: null, searchQuery: null, sortOrder: 0, enabled: true },
      { id: 'r2', name: '隐藏 e', mode: 'hide', rule: JSON.stringify({ sceneIds: ['s1'] }), searchQuery: null, sortOrder: 1, enabled: true },
    ]
    const feed = await evaluateNavFeed(makeRepo(rules, docs))
    expect(ids(feed)).toEqual(['a', 'b'])

    // hide 排在 rule 之前时：先隐藏不会阻止后续 rule 把它加回来
    const rules2: FakeRule[] = [rules[1], rules[0]].map((r, i) => ({ ...r, sortOrder: i }))
    const feed2 = await evaluateNavFeed(makeRepo(rules2, docs))
    expect(ids(feed2)).toEqual(['a', 'b', 'e'])
  })

  it('disabled rules are ignored', async () => {
    const rules: FakeRule[] = [
      { id: 'r1', name: '隐藏 e（停用）', mode: 'hide', rule: JSON.stringify({ sceneIds: ['s1'] }), searchQuery: null, sortOrder: 0, enabled: false },
    ]
    const feed = await evaluateNavFeed(makeRepo(rules, docs))
    expect(ids(feed)).toEqual(['a', 'b', 'e'])
  })
})
