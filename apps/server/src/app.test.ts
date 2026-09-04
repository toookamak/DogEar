import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializeSqliteSchema } from '@dogear/db'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function repository() {
  type BookmarkRecord = { id: string; url: string; status: 'unread'; syncStatus: 'pending'; createdAt: number; updatedAt: number }
  type AccessRecord = { id: string; bookmarkId: string; openedAt: number; source: 'original' }
  const records: BookmarkRecord[] = []
  const accessRecords: AccessRecord[] = []
  return {
    records,
    accessRecords,
    create: async (record: { id: string; url: string; status: 'unread' }) => {
      const createdAt = Date.now()
      const result = { ...record, syncStatus: 'pending' as const, createdAt, updatedAt: createdAt }
      records.push(result)
      return result
    },
    list: async () => records,
    listInbox: async () => records.filter((record) => record.status === 'unread'),
    countPending: async () => records.filter((record) => record.syncStatus === 'pending').length,
    createAccessRecord: async (record: { id: string; bookmarkId: string; source?: 'original' }) => {
      const result = { id: record.id, bookmarkId: record.bookmarkId, openedAt: Date.now(), source: record.source ?? 'original' as const }
      accessRecords.push(result)
      return result
    },
    listAccessRecords: async (bookmarkId: string) => accessRecords.filter((record) => record.bookmarkId === bookmarkId),
  }
}

async function login(app: ReturnType<typeof createApp>, password = 'secret') {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  if (!cookie) throw new Error('Expected session cookie')
  return { response, cookie }
}

describe('authentication API', () => {
  it('allows credentialed requests from the web app origin', async () => {
    const app = createApp(repository(), { password: 'secret' })
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ password: 'secret' }),
    })

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('does not allow credentialed requests from an arbitrary origin', async () => {
    const app = createApp(repository(), { password: 'secret' })
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
      },
      body: JSON.stringify({ password: 'secret' }),
    })

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('logs in with the configured password and sets a session cookie', async () => {
    const app = createApp(repository(), { password: 'secret' })
    const { response, cookie } = await login(app)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user: { id: 'user' } })
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/)
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/^dogear_session=.+/)
  })

  it.each([
    ['incorrect password', { password: 'wrong' }],
    ['missing password', {}],
  ])('rejects %s with a stable unauthorized response', async (_name, body) => {
    const app = createApp(repository(), { password: 'secret' })
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('validates the session for the current-session API and protected routes', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)

    const me = await app.request('/api/auth/me', { headers: { cookie } })
    const bookmarks = await app.request('/api/bookmarks', { headers: { cookie } })

    expect(me.status).toBe(200)
    expect(await me.json()).toEqual({ user: { id: 'user' } })
    expect(bookmarks.status).toBe(200)
  })

  it('rejects missing, invalid, and expired sessions on protected routes', async () => {
    let now = 1_000
    const app = createApp(repository(), { password: 'secret', now: () => now, sessionTtlSeconds: 60 })
    const { cookie } = await login(app)

    expect((await app.request('/api/bookmarks')).status).toBe(401)
    expect((await app.request('/api/bookmarks', { headers: { cookie: 'dogear_session=invalid' } })).status).toBe(401)
    now += 61_000
    const response = await app.request('/api/bookmarks', { headers: { cookie } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
  })

  it('clears the session on logout and rejects subsequent protected requests', async () => {
    const app = createApp(repository(), { password: 'secret' })
    const { cookie } = await login(app)

    const logout = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })
    const afterLogout = await app.request('/api/bookmarks', { headers: { cookie } })

    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0/)
    expect(afterLogout.status).toBe(401)
  })

  it('keeps health checks public', async () => {
    const app = createApp(repository(), { password: 'secret' })
    expect((await app.request('/health')).status).toBe(200)
  })
})

describe('bookmark and access record API', () => {
  it('rejects unauthenticated writes without touching either repository', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })

    const bookmark = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/article' }),
    })
    const access = await app.request('/api/bookmarks/bookmark-1/access-records', { method: 'POST' })

    expect(bookmark.status).toBe(401)
    expect(access.status).toBe(401)
    expect(repo.records).toHaveLength(0)
    expect(repo.accessRecords).toHaveLength(0)
  })

  it('creates and lists formal bookmarks with sync status and numeric timestamps', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ url: 'https://example.com/article' }),
    })

    expect(response.status).toBe(201)
    const created = await response.json()
    expect(created).toMatchObject({ url: 'https://example.com/article', status: 'unread', syncStatus: 'pending' })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.createdAt).toEqual(expect.any(Number))
    expect(created.updatedAt).toEqual(expect.any(Number))
    expect(await (await app.request('/api/bookmarks', { headers: { cookie } })).json()).toEqual([created])
  })

  it('serves inbox and pending sync count from protected endpoints', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ url: 'https://example.com/inbox' }),
    })

    const inbox = await app.request('/api/inbox', { headers: { cookie } })
    const pending = await app.request('/api/sync/pending-count', { headers: { cookie } })

    expect(inbox.status).toBe(200)
    expect(await inbox.json()).toEqual({ bookmarks: expect.arrayContaining([expect.objectContaining({ url: 'https://example.com/inbox' })]) })
    expect(await pending.json()).toEqual({ pendingCount: 1 })
  })

  it('creates and lists access records with server-generated timestamps', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const createResponse = await app.request('/api/bookmarks/bookmark-1/access-records', { method: 'POST', headers: { cookie } })
    const created = await createResponse.json()
    const listResponse = await app.request('/api/bookmarks/bookmark-1/access-records', { headers: { cookie } })

    expect(createResponse.status).toBe(201)
    expect(created).toMatchObject({ bookmarkId: 'bookmark-1', source: 'original' })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.openedAt).toEqual(expect.any(Number))
    expect(await listResponse.json()).toEqual({ records: [created] })
  })

  it('returns the same bookmark ID to separate authenticated clients', async () => {
    const repo = repository()
    const firstClient = createApp(repo, { password: 'secret' })
    const secondClient = createApp(repo, { password: 'secret' })
    const firstSession = await login(firstClient)
    const secondSession = await login(secondClient)
    const createdResponse = await firstClient.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: firstSession.cookie },
      body: JSON.stringify({ url: 'https://example.com/shared' }),
    })
    const created = await createdResponse.json()
    const listedResponse = await secondClient.request('/api/bookmarks', { headers: { cookie: secondSession.cookie } })
    const listed = await listedResponse.json()

    expect(createdResponse.status).toBe(201)
    expect(listed).toEqual([created])
  })

  it('persists access records across SQLite app restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dogear-m2-'))
    const databasePath = join(directory, 'dogear.sqlite')
    const openDatabase = () => new DatabaseSync(databasePath)
    const createRepository = (database: InstanceType<typeof DatabaseSync>) => {
      initializeSqliteSchema({
        run: (sql) => database.exec(sql),
        query: (sql) => ({ all: () => database.prepare(sql).all() as Array<{ name: string }> }),
      })
      return {
        async create(input: { id: string; url: string; status: 'unread' }) {
          const createdAt = Date.now()
          database.prepare('INSERT INTO bookmarks (id, url, status, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(input.id, input.url, input.status, 'pending', createdAt, createdAt)
          return { ...input, syncStatus: 'pending' as const, createdAt, updatedAt: createdAt }
        },
        async list() {
          return database.prepare('SELECT id, url, status, sync_status AS syncStatus, created_at AS createdAt, updated_at AS updatedAt FROM bookmarks ORDER BY created_at DESC').all().map((row: any) => ({ ...row, createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt) }))
        },
        async listInbox() {
          return database.prepare("SELECT id, url, status, sync_status AS syncStatus, created_at AS createdAt, updated_at AS updatedAt FROM bookmarks WHERE status = 'unread' ORDER BY created_at DESC").all().map((row: any) => ({ ...row, createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt) }))
        },
        async countPending() {
          return Number((database.prepare("SELECT COUNT(*) AS count FROM bookmarks WHERE sync_status = 'pending'").get() as any).count)
        },
        async createAccessRecord(input: { id: string; bookmarkId: string; source?: 'original' }) {
          const openedAt = Date.now()
          database.prepare('INSERT INTO access_records (id, bookmark_id, opened_at, source) VALUES (?, ?, ?, ?)').run(input.id, input.bookmarkId, openedAt, input.source ?? 'original')
          return { id: input.id, bookmarkId: input.bookmarkId, openedAt, source: input.source ?? 'original' }
        },
        async listAccessRecords(bookmarkId: string) {
          return database.prepare('SELECT id, bookmark_id AS bookmarkId, opened_at AS openedAt, source FROM access_records WHERE bookmark_id = ? ORDER BY opened_at DESC').all(bookmarkId).map((row: any) => ({ ...row, openedAt: Number(row.openedAt) }))
        },
      }
    }

    try {
      const firstDatabase = openDatabase()
      const firstApp = createApp(createRepository(firstDatabase), { password: 'secret' })
      const firstSession = await login(firstApp)
      const createdResponse = await firstApp.request('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: firstSession.cookie },
        body: JSON.stringify({ url: 'https://example.com/restart' }),
      })
      const bookmark = await createdResponse.json()
      const accessResponse = await firstApp.request(`/api/bookmarks/${bookmark.id}/access-records`, {
        method: 'POST',
        headers: { cookie: firstSession.cookie },
      })
      const accessRecord = await accessResponse.json()
      firstDatabase.close()

      const secondDatabase = openDatabase()
      const restartedApp = createApp(createRepository(secondDatabase), { password: 'secret' })
      const restartedSession = await login(restartedApp)
      const listedResponse = await restartedApp.request(`/api/bookmarks/${bookmark.id}/access-records`, {
        headers: { cookie: restartedSession.cookie },
      })

      expect(accessResponse.status).toBe(201)
      expect(await listedResponse.json()).toEqual({ records: [accessRecord] })
      secondDatabase.close()
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  })
})
