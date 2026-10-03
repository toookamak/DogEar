import { describe, expect, it } from 'vitest'
import type { SyncQueueItem } from '@dogear/db'
import {
  MAX_RETRIES,
  backoffMs,
  processSyncQueue,
  requeueEligibleFailures,
  type SyncQueueRepositoryShape,
} from './consumer.js'

interface FakeClientCalls {
  created: Array<Record<string, unknown>>
  updated: Array<{ id: number; data: Record<string, unknown> }>
  deleted: number[]
  bulk?: Array<{ collectionId: number; data: { ids: number[]; tags?: string[]; collection?: { $id: number } } }>
  failOn?: (action: string) => Error | undefined
}

function makeFakeClient(calls: FakeClientCalls) {
  return {
    async createBookmark(data: Record<string, unknown>) {
      const error = calls.failOn?.('create')
      if (error) throw error
      calls.created.push(data)
      return { _id: 987654 }
    },
    async updateBookmark(id: number, data: Record<string, unknown>) {
      const error = calls.failOn?.('update')
      if (error) throw error
      calls.updated.push({ id, data })
      return { _id: id }
    },
    async deleteBookmark(id: number) {
      const error = calls.failOn?.('delete')
      if (error) throw error
      calls.deleted.push(id)
    },
    async updateBookmarksBulk(collectionId: number, data: { ids: number[]; tags?: string[]; collection?: { $id: number } }) {
      const error = calls.failOn?.('bulk')
      if (error) throw error
      calls.bulk = calls.bulk ?? []
      calls.bulk.push({ collectionId, data })
    },
  }
}

function makeItem(overrides: Partial<SyncQueueItem>): SyncQueueItem {
  const now = new Date()
  return {
    id: 'q-1',
    action: 'create',
    targetType: 'bookmark',
    targetId: 'bm-1',
    channel: 'raindrop',
    payload: JSON.stringify({ url: 'https://example.com', title: 'Example', note: null }),
    status: 'pending',
    retryCount: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as SyncQueueItem
}

/** 内存版 sync_queue + 书签仓，覆盖消费器用到的最小面（批量接口） */
function makeRepo(items: SyncQueueItem[], options?: { folderRemote?: Map<string, string | null> }) {
  const bookmarks = new Map<string, Record<string, unknown>>()
  const folderRemote = options?.folderRemote ?? new Map<string, string | null>()
  const repo: SyncQueueRepositoryShape & { bookmarks: Map<string, Record<string, unknown>> } = {
    bookmarks,
    folders: {
      async raindropIdOf(folderId: string) {
        return folderRemote.get(folderId) ?? null
      },
    },
    syncQueue: {
      async getPending(limit = 50) {
        return items.filter((i) => i.status === 'pending').slice(0, limit)
      },
      async listFailed(limit = 100) {
        return items.filter((i) => i.status === 'failed').slice(0, limit)
      },
      async updateStatusMany(entries) {
        for (const entry of entries) {
          const item = items.find((i) => i.id === entry.id)
          if (!item) continue
          item.status = entry.status
          item.updatedAt = new Date()
          if (entry.status === 'failed') {
            item.retryCount += 1
            item.error = entry.error ?? null
          } else {
            item.error = null
          }
        }
      },
      async countPending() {
        return items.filter((i) => i.status === 'pending').length
      },
    },
    async updateRaindropIds(pairs) {
      for (const pair of pairs) {
        const current = bookmarks.get(pair.id) ?? {}
        bookmarks.set(pair.id, { ...current, raindropId: pair.raindropId, syncStatus: 'synced' })
      }
    },
    async markSyncStatus(bookmarkIds, status) {
      for (const id of bookmarkIds) {
        const current = bookmarks.get(id) ?? {}
        bookmarks.set(id, { ...current, syncStatus: status })
      }
    },
  }
  return repo
}

describe('sync queue consumer (L2)', () => {
  it('backoff follows 1s/2s/4s cap', () => {
    expect(backoffMs(0)).toBe(1000)
    expect(backoffMs(1)).toBe(2000)
    expect(backoffMs(2)).toBe(4000)
    expect(backoffMs(10)).toBe(4000)
  })

  it('processes create: calls client, writes back raindropId and syncStatus', async () => {
    const repo = makeRepo([makeItem({})])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary).toMatchObject({ processed: 1, succeeded: 1, failed: 0, remaining: 0 })
    // payload.note 为 null 时不携带 note 字段
    expect(calls.created).toEqual([{ url: 'https://example.com', title: 'Example' }])
    expect(repo.bookmarks.get('bm-1')).toMatchObject({ raindropId: '987654', syncStatus: 'synced' })
  })

  it('marks 429 failures failed with retry_count and records the error', async () => {
    const item = makeItem({})
    const repo = makeRepo([item])
    const calls: FakeClientCalls = {
      created: [], updated: [], deleted: [],
      failOn: () => Object.assign(new Error('Rate limit exceeded, retry after 60 seconds'), { status: 429 }),
    }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary).toMatchObject({ processed: 1, succeeded: 0, failed: 1, remaining: 0 })
    expect(item.status).toBe('failed')
    expect(item.retryCount).toBe(1)
    expect(item.error).toContain('Rate limit')
  })

  it('requeues failed items only after backoff elapses and gives up past MAX_RETRIES', async () => {
    const due = makeItem({ id: 'due', status: 'failed', retryCount: 1, updatedAt: new Date(Date.now() - backoffMs(1) - 1) })
    const notDue = makeItem({ id: 'not-due', status: 'failed', retryCount: 2, updatedAt: new Date(Date.now() - 10) })
    const exhausted = makeItem({ id: 'exhausted', status: 'failed', retryCount: MAX_RETRIES, updatedAt: new Date(Date.now() - 60_000) })
    const repo = makeRepo([due, notDue, exhausted])
    const requeued = await requeueEligibleFailures(repo)
    expect(requeued).toBe(1)
    expect(due.status).toBe('pending')
    expect(notDue.status).toBe('failed')
    expect(exhausted.status).toBe('failed')
  })

  it('fails items without a handler instead of pretending success', async () => {
    const item = makeItem({ channel: 's3' })
    const repo = makeRepo([item])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary.failed).toBe(1)
    expect(item.error).toContain('No handler')
    expect(calls.created).toHaveLength(0)
  })

  it('fails cleanly when no enabled raindrop channel exists', async () => {
    const repo = makeRepo([makeItem({})])
    const summary = await processSyncQueue(repo, async () => null)
    expect(summary.failed).toBe(1)
  })

  it('treats delete without raindropId as success (never pushed)', async () => {
    const item = makeItem({ action: 'delete', payload: JSON.stringify({}) })
    const repo = makeRepo([item])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary.succeeded).toBe(1)
    expect(calls.deleted).toHaveLength(0)
  })

  it('update uses stored raindropId and pushes to remote', async () => {
    const item = makeItem({ action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '111222' }) })
    const repo = makeRepo([item])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary.succeeded).toBe(1)
    expect(calls.updated).toEqual([{ id: 111222, data: { url: 'https://example.com' } }])
  })

  // ── 批次 0.5/0.6/0.8：payload 契约与攒批（语义 2026-10-03 实测，见同步设计 §3.1.1）──

  it('update carries full tag set only when edited, and [] clears remote tags', async () => {
    const item = makeItem({ action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '1', tags: ['a', 'b'] }) })
    const cleared = makeItem({ id: 'q-2', action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '2', tags: [] }) })
    const repo = makeRepo([item, cleared])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(calls.updated).toEqual([
      { id: 1, data: { url: 'https://example.com', tags: ['a', 'b'] } },
      { id: 2, data: { url: 'https://example.com', tags: [] } },
    ])
  })

  it('update resolves folderId to remote collection and suspends when unmapped', async () => {
    const mapped = makeItem({ action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '1', folderId: 'f-1' }) })
    const unmapped = makeItem({ id: 'q-2', action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '2', folderId: 'f-x' }) })
    const removed = makeItem({ id: 'q-3', action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '3', folderId: null }) })
    const repo = makeRepo([mapped, unmapped, removed], { folderRemote: new Map([['f-1', '42']]) })
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(calls.updated).toEqual([
      { id: 1, data: { url: 'https://example.com', collection: { $id: 42 } } },
      { id: 3, data: { url: 'https://example.com', collection: { $id: -1 } } },
    ])
    expect(summary.failed).toBe(1)
    expect(unmapped.error).toContain('未映射')
  })

  it('groups pure add-tag updates into one bulk call per (source collection, tag set)', async () => {
    const mkAdd = (id: string, raindropId: string, src: number) => makeItem({
      id, action: 'update',
      payload: JSON.stringify({ url: 'https://example.com', raindropId, addTags: ['js'], srcCollection: src }),
    })
    const repo = makeRepo([mkAdd('q-1', '1', 10), mkAdd('q-2', '2', 10), mkAdd('q-3', '3', 20)])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary.succeeded).toBe(3)
    expect(calls.updated).toHaveLength(0)
    expect(calls.bulk).toEqual([
      { collectionId: 10, data: { ids: [1, 2], tags: ['js'] } },
      { collectionId: 20, data: { ids: [3], tags: ['js'] } },
    ])
  })

  it('never sends bulk with empty tags and fails contract-breaking addTags payloads', async () => {
    const emptyAdd = makeItem({ action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '1', addTags: [], srcCollection: 10 }) })
    const mixed = makeItem({ id: 'q-2', action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '2', title: 't', addTags: ['js'], srcCollection: 10 }) })
    const missingSrc = makeItem({ id: 'q-3', action: 'update', payload: JSON.stringify({ url: 'https://example.com', raindropId: '3', addTags: ['js'] }) })
    const repo = makeRepo([emptyAdd, mixed, missingSrc])
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(calls.bulk ?? []).toHaveLength(0)
    expect(summary.failed).toBe(3)
    expect(mixed.error).toContain('不得与')
  })

  it('routes update without raindropId through create with tags and collection', async () => {
    const item = makeItem({
      action: 'update',
      payload: JSON.stringify({ url: 'https://example.com', folderId: 'f-1', tags: ['a'] }),
    })
    const repo = makeRepo([item], { folderRemote: new Map([['f-1', '42']]) })
    const calls: FakeClientCalls = { created: [], updated: [], deleted: [] }
    const summary = await processSyncQueue(repo, async () => makeFakeClient(calls))
    expect(summary.succeeded).toBe(1)
    expect(calls.created).toEqual([{ url: 'https://example.com', tags: ['a'], collection: { $id: 42 } }])
  })
})
