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

/** 内存版 sync_queue + 书签仓，覆盖消费器用到的最小面 */
function makeRepo(items: SyncQueueItem[]) {
  const bookmarks = new Map<string, Record<string, unknown>>()
  const repo: SyncQueueRepositoryShape & { bookmarks: Map<string, Record<string, unknown>> } = {
    bookmarks,
    syncQueue: {
      async getPending(limit = 50) {
        return items.filter((i) => i.status === 'pending').slice(0, limit)
      },
      async listFailed(limit = 100) {
        return items.filter((i) => i.status === 'failed').slice(0, limit)
      },
      async updateStatus(id, status, error) {
        const item = items.find((i) => i.id === id)
        if (!item) return undefined
        item.status = status
        item.updatedAt = new Date()
        if (status === 'failed') {
          item.retryCount += 1
          item.error = error ?? null
        }
        return item
      },
      async countPending() {
        return items.filter((i) => i.status === 'pending').length
      },
    },
    async update(bookmarkId: string, input: Record<string, unknown>) {
      const current = bookmarks.get(bookmarkId) ?? {}
      bookmarks.set(bookmarkId, { ...current, ...input })
      return current
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
})
