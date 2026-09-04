import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { isMaskedSecret, mergeChannelSecrets } from './channels/index.js'

function connectivityRepo(): any {
  const bookmarks: any[] = []
  const channelRows: any[] = []
  const jobs: any[] = []
  const backupRows: any[] = []
  const settingsRows: any[] = [{ key: 'recycle.retention_days', value: '7' }]

  return {
    bookmarks,
    channelRows,
    jobs,
    create: async (record: any) => {
      const row = { ...record, createdAt: Date.now(), updatedAt: Date.now(), version: 1 }
      bookmarks.push(row)
      return row
    },
    get: async (id: string) => bookmarks.find((row) => row.id === id),
    findByRaindropId: async (raindropId: string) => bookmarks.find((row) => row.raindropId === raindropId),
    list: async (filters?: any) => {
      const items = bookmarks.filter((row) => {
        if (row.deletedAt) return false
        if (filters?.private === false && row.private) return false
        if (filters?.excludeStatus && row.status === filters.excludeStatus) return false
        if (filters?.status && row.status !== filters.status) return false
        return true
      })
      return { items, nextCursor: null }
    },
    listRecentOpened: async (limit = 20) => bookmarks.filter((row) => !row.private && row.status !== 'unread').slice(0, limit),
    listInbox: async () => ({ bookmarks: bookmarks.filter((row) => row.status === 'unread'), nextCursor: null }),
    listRecycleBin: async () => ({ items: [], nextCursor: null }),
    search: async () => ({ items: bookmarks, nextCursor: null }),
    update: async (id: string, input: Record<string, unknown>) => {
      const row = bookmarks.find((item) => item.id === id)
      if (!row) return undefined
      Object.assign(row, input)
      return row
    },
    batchUpdate: async () => ({ updated: [], skipped: [] }),
    softDelete: async () => undefined,
    restore: async () => undefined,
    purgeDeleted: async () => 0,
    countPending: async () => 0,
    createAccessRecord: async (record: any) => ({ ...record, openedAt: Date.now(), source: record.source ?? 'original', client: record.client ?? 'workbench' }),
    listAccessRecords: async () => [],
    scenes: { list: async () => [], create: async (input: any) => input, update: async () => undefined, remove: async () => true },
    folders: { list: async () => [], create: async (input: any) => input, update: async () => undefined, remove: async () => true },
    tags: { list: async () => [], create: async (input: any) => input, remove: async () => true },
    suggestions: { list: async () => ({ items: [], nextCursor: null }), create: async (input: any) => input, resolve: async () => undefined, accept: async () => undefined },
    operationLog: { list: async () => [], append: async (input: any) => input },
    settings: {
      list: async () => settingsRows,
      get: async (key: string) => settingsRows.find((row) => row.key === key),
      set: async (key: string, value: unknown) => ({ key, value }),
    },
    archives: { create: async (input: any) => input, get: async () => undefined, listByBookmark: async () => [], updateStatus: async () => undefined, listPending: async () => [], countPending: async () => 0 },
    archiveJobs: {
      list: async (bookmarkId?: string) => bookmarkId ? jobs.filter((job) => job.bookmarkId === bookmarkId) : jobs,
      get: async (id: string) => jobs.find((job) => job.id === id),
      create: async (input: any) => {
        const job = { ...input, retryCount: 0, createdAt: Date.now(), updatedAt: Date.now() }
        jobs.push(job)
        return job
      },
      update: async (id: string, input: any) => {
        const job = jobs.find((row) => row.id === id)
        if (!job) return undefined
        Object.assign(job, input)
        return job
      },
      getStatus: async (id: string) => jobs.find((job) => job.id === id)?.status,
    },
    syncQueue: {
      enqueue: async () => ({ id: 'q' }),
      getPending: async () => [],
      updateStatus: async () => undefined,
      remove: async () => true,
      countPending: async () => 0,
    },
    backups: {
      create: async (input: any) => {
        const row = { ...input, status: 'pending', filePath: null, createdAt: Date.now() }
        backupRows.push(row)
        return row
      },
      get: async (id: string) => backupRows.find((row) => row.id === id),
      list: async () => backupRows,
      updateStatus: async (id: string, status: string, data?: any) => {
        const row = backupRows.find((item) => item.id === id)
        if (!row) return undefined
        Object.assign(row, { status, ...data })
        return row
      },
    },
    navRules: { list: async () => [], get: async () => undefined, create: async (input: any) => input, update: async () => undefined, remove: async () => undefined },
    channelConfig: {
      list: async () => channelRows,
      get: async (id: string) => channelRows.find((row) => row.id === id),
      create: async (data: any) => {
        const row = { ...data, createdAt: Date.now(), updatedAt: Date.now() }
        channelRows.push(row)
        return row
      },
      update: async (id: string, data: any) => {
        const row = channelRows.find((item) => item.id === id)
        if (!row) return undefined
        Object.assign(row, data)
        return row
      },
      remove: async (id: string) => {
        const index = channelRows.findIndex((row) => row.id === id)
        if (index >= 0) channelRows.splice(index, 1)
        return true
      },
    },
    idempotency: { findReplay: async () => undefined, store: async () => {} },
    skillUsage: { increment: async () => {}, getDaily: async () => ({ read: 0, write: 0, blocked: 0 }) },
  }
}

async function login(app: ReturnType<typeof createApp>) {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'secret' }),
  })
  return { cookie: response.headers.get('set-cookie') ?? '' }
}

describe('channel secret helpers', () => {
  it('detects masked secrets and keeps the stored token', () => {
    expect(isMaskedSecret('abc***xyz')).toBe(true)
    expect(isMaskedSecret('real-token-value')).toBe(false)
    const merged = mergeChannelSecrets('raindrop', { token: 'abc***xyz' }, { token: 'real-token-value' })
    expect(merged.token).toBe('real-token-value')
  })
})

describe('connectivity APIs', () => {
  it('stores channel config outside settings and never returns the raw token', async () => {
    const repo = connectivityRepo()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const headers = { 'content-type': 'application/json', cookie }

    const created = await app.request('/api/channels', {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'raindrop', label: 'rd', config: { token: 'real-token-value' } }),
    })
    expect(created.status).toBe(201)
    const { id } = await created.json()
    expect(repo.channelRows[0].config).toContain('real-token-value')

    const listed = await app.request('/api/channels', { headers: { cookie } })
    const body = await listed.json()
    expect(body.items[0].config.token).not.toContain('real-token-value')
    expect(body.items[0].config.token).toContain('*')

    const patched = await app.request(`/api/channels/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ config: { token: body.items[0].config.token } }),
    })
    expect(patched.status).toBe(200)
    expect(JSON.parse(repo.channelRows[0].config).token).toBe('real-token-value')
  })

  it('rejects webdav import and queues archive jobs onto archive_jobs', async () => {
    const repo = connectivityRepo()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const headers = { 'content-type': 'application/json', cookie }

    const created = await app.request('/api/channels', {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'webdav', label: 'dav', config: { url: 'https://dav.example/remote.php/dav/', username: 'u', password: 'p' } }),
    })
    const { id } = await created.json()
    const imported = await app.request(`/api/channels/${id}/import`, { method: 'POST', headers, body: '{}' })
    expect(imported.status).toBe(400)
    expect((await imported.json()).error.code).toBe('NOT_SUPPORTED')

    const bookmark = await repo.create({ id: '11111111-1111-4111-8111-111111111111', url: 'https://example.com', status: 'unread' })
    const queued = await app.request('/api/archive', {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookmarkId: bookmark.id }),
    })
    expect(queued.status).toBe(201)
    const payload = await queued.json()
    expect(payload.snapshotStatus).toBe('queued_pending_browser')
    const jobs = await app.request('/api/jobs', { headers: { cookie } })
    const listed = await jobs.json()
    expect(listed.items.some((job: { id: string }) => job.id === payload.jobId)).toBe(true)
  })

  it('downloads a completed light backup file', async () => {
    const repo = connectivityRepo()
    const dir = mkdtempSync(join(tmpdir(), 'dogear-backup-'))
    const filePath = join(dir, 'light.csv')
    writeFileSync(filePath, 'url,title\nhttps://example.com,Example\n')
    const backup = await repo.backups.create({ id: '22222222-2222-4222-8222-222222222222', tier: 'light', target: 'local', includes: '["bookmarks:csv"]' })
    await repo.backups.updateStatus(backup.id, 'completed', { filePath, fileSize: 32 })

    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request(`/api/backup/${backup.id}/download`, { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('https://example.com')
  })

  it('looks up raindrop bookmarks by raindrop_id not by uuid', async () => {
    const repo = connectivityRepo()
    await repo.create({ id: '33333333-3333-4333-8333-333333333333', url: 'https://example.com/a', status: 'unread', raindropId: '99' })
    expect(await repo.findByRaindropId('99')).toMatchObject({ url: 'https://example.com/a' })
    expect(await repo.get('99')).toBeUndefined()
  })

  it('returns projected nav bookmarks without notes, inbox, or private items', async () => {
    const repo = connectivityRepo()
    await repo.create({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', url: 'https://example.com/saved', status: 'saved', title: 'Saved', note: 'secret note', private: false, domain: 'example.com', favicon: 'https://example.com/f.ico' })
    await repo.create({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', url: 'https://example.com/inbox', status: 'unread', title: 'Inbox', note: 'hidden', private: false })
    await repo.create({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', url: 'https://example.com/private', status: 'saved', title: 'Private', note: 'nope', private: true })
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/nav/bookmarks', { headers: { cookie } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.items).toEqual([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Saved', favicon: 'https://example.com/f.ico', url: 'https://example.com/saved', domain: 'example.com' },
    ])
    expect(JSON.stringify(body)).not.toContain('secret note')
  })

  it('writes navigation client on access records', async () => {
    const repo = connectivityRepo()
    await repo.create({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', url: 'https://example.com/nav', status: 'saved' })
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/bookmarks/dddddddd-dddd-4ddd-8ddd-dddddddddddd/access-records', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ source: 'original', client: 'navigation' }),
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ bookmarkId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', source: 'original', client: 'navigation' })
  })
})
