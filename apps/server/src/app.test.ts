import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializeSqliteSchema } from '@dogear/db'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function repository(): any {
  type BookmarkRecord = { id: string; url: string; status: 'unread'; source?: string; note?: string | null; syncStatus: 'pending' | 'synced'; createdAt: number; updatedAt: number }
  type AccessRecord = { id: string; bookmarkId: string; openedAt: number; source: 'original' }
  const records: BookmarkRecord[] = []
  const accessRecords: AccessRecord[] = []
  return {
    records,
    accessRecords,
    create: async (record: { id: string; url: string; status: 'unread'; source?: string; note?: string | null; intent?: string | null; syncStatus?: 'pending' | 'synced' }) => {
      const createdAt = Date.now()
      const result = { ...record, source: record.source ?? 'page', note: record.note ?? null, intent: record.intent ?? null, syncStatus: record.syncStatus ?? 'pending', createdAt, updatedAt: createdAt }
      records.push(result)
      return result
    },
    get: async (id: string) => records.find((record) => record.id === id),
    findByRaindropId: async (raindropId: string) => records.find((record) => (record as any).raindropId === raindropId),
    search: async (filters?: any, limit?: number, cursor?: string) => {
      const items = records
      return { items, nextCursor: null }
    },
    update: async (id: string, input: Record<string, unknown>) => {
      const record = records.find((item) => item.id === id)
      if (!record) return undefined
      Object.assign(record, input)
      return record
    },
    batchUpdate: async () => ({ updated: [], skipped: [] }),
    softDelete: async () => undefined,
    restore: async () => undefined,
    purgeDeleted: async () => 0,
    scenes: {},
    folders: {},
    tags: {},
    suggestions: { create: async (input: Record<string, unknown>) => input },
    operationLog: {
      list: async () => [],
      get: async () => undefined,
      append: async (input: Record<string, unknown>) => ({ id: 'log-1', ...input }),
      consumeRevert: async () => undefined,
    },
    archiveJobs: {
      list: async () => [],
      get: async () => undefined,
      create: async (input: Record<string, unknown>) => input,
      update: async () => undefined,
      getStatus: async () => undefined,
    },
    channelConfig: {
      list: async () => [],
      get: async () => undefined,
      create: async (input: Record<string, unknown>) => input,
      update: async () => undefined,
      remove: async () => true,
    },
    settings: { list: async () => [], get: async () => undefined, set: async (key: string, value: unknown) => ({ key, value }) },
    syncQueue: { enqueue: async () => ({}), getPending: async () => [], updateStatus: async () => undefined, remove: async () => true, countPending: async () => 0 },
    backups: { create: async (input: Record<string, unknown>) => input, get: async () => undefined, list: async () => [], updateStatus: async () => undefined },
    navRules: { list: async () => [], get: async () => undefined, create: async (input: Record<string, unknown>) => input, update: async () => undefined, remove: async () => undefined },

    listRecentOpened: async () => [],
    list: async (filters?: any, limit?: number, cursor?: string) => {
      return { items: [...records], nextCursor: null }
    },
    listInbox: async (limit?: number, cursor?: string) => {
      return { bookmarks: records.filter((record) => record.status === 'unread'), nextCursor: null }
    },
    listRecycleBin: async (limit?: number, cursor?: string) => {
      return { items: [], nextCursor: null }
    },
    countPending: async () => records.filter((record) => record.syncStatus === 'pending').length,
    createAccessRecord: async (record: { id: string; bookmarkId: string; source?: 'original' }) => {
      const result = { id: record.id, bookmarkId: record.bookmarkId, openedAt: Date.now(), source: record.source ?? 'original' as const }
      accessRecords.push(result)
      return result
    },
    listAccessRecords: async (bookmarkId: string) => accessRecords.filter((record) => record.bookmarkId === bookmarkId),
    idempotency: {
      findReplay: async () => undefined,
      store: async () => {},
    },
    skillUsage: {
      increment: async () => {},
      getDaily: async () => ({ read: 0, write: 0, blocked: 0 }),
    },
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

describe('workbench REST API', () => {
  it('rejects an oversized bookmark batch before touching the repository', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/bookmarks/batch', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ ids: Array.from({ length: 101 }, (_, index) => `bookmark-${index}`), status: 'saved' }),
    })

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('requires a session for the recycle bin and scene resources', async () => {
    const app = createApp(repository(), { password: 'secret' })

    expect((await app.request('/api/recycle-bin')).status).toBe(401)
    expect((await app.request('/api/scenes')).status).toBe(401)
  })

  it('lets a logged-in workbench session read skill usage without a Bearer token', async () => {
    const app = createApp(repository(), { password: 'secret', skillToken: 'skill-secret' })
    expect((await app.request('/api/skill/usage')).status).toBe(401)
    const { cookie } = await login(app)
    const response = await app.request('/api/skill/usage', { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ requests: expect.any(Number), writes: expect.any(Number), blocked: expect.any(Number) })
  })
})

describe('skill API', () => {
  it('publishes seven capabilities without authentication', async () => {
    const app = createApp(repository(), { password: 'secret', skillToken: 'skill-secret' })
    const response = await app.request('/.well-known/capabilities')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.skills).toHaveLength(7)
    expect(body.skills.map((skill: { name: string }) => skill.name)).toEqual([
      'save_bookmark', 'search_bookmarks', 'update_bookmark', 'list_bookmarks', 'get_stats', 'trigger_archive', 'suggest_scene',
    ])
  })

  it('rejects missing or invalid Skill tokens and saves with a stable UUID', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret', skillToken: 'skill-secret' })
    const body = { url: 'https://example.com/agent', note: 'from agent' }

    expect((await app.request('/api/skill/save_bookmark', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })).status).toBe(401)
    expect((await app.request('/api/skill/save_bookmark', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' } })).status).toBe(401)

    const response = await app.request('/api/skill/save_bookmark', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', authorization: 'Bearer skill-secret' },
    })
    const saved = await response.json()

    expect(response.status).toBe(201)
    expect(saved).toMatchObject({ url: body.url, note: body.note, source: 'agent', status: 'unread', syncStatus: 'synced', snapshotStatus: 'not_requested' })
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(repo.records[0].id).toBe(saved.id)
    expect(repo.records[0]).toMatchObject({ source: 'agent', syncStatus: 'synced' })

    const session = await login(app)
    const inboxResponse = await app.request('/api/inbox', { headers: { cookie: session.cookie } })
    expect(inboxResponse.status).toBe(200)
    expect(await inboxResponse.json()).toEqual({ bookmarks: expect.arrayContaining([expect.objectContaining({ id: saved.id, url: 'https://example.com/agent', source: 'agent', status: 'unread' })]), nextCursor: null })
  })

  it('queues snapshots, returns supported reads, rejects disabled updates, and never writes suggestions to structure', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret', skillToken: 'skill-secret' })
    const headers = { 'content-type': 'application/json', authorization: 'Bearer skill-secret' }
    const saved = await (await app.request('/api/skill/save_bookmark', { method: 'POST', headers, body: JSON.stringify({ url: 'https://example.com/archive', snapshot: true }) })).json()

    const archive = await app.request('/api/skill/trigger_archive', { method: 'POST', headers, body: JSON.stringify({ bookmarkId: saved.id }) })
    expect(archive.status).toBe(200)
    expect(await archive.json()).toMatchObject({ snapshotStatus: 'queued_pending_browser', jobId: expect.stringMatching(/^[0-9a-f-]{36}$/) })

    for (const name of ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene']) {
      const input = name === 'suggest_scene' ? { bookmarkId: saved.id } : {}
      const response = await app.request(`/api/skill/${name}`, { method: 'POST', headers, body: JSON.stringify(input) })
      expect(response.status).toBe(200)
    }

    const update = await app.request('/api/skill/update_bookmark', { method: 'POST', headers, body: JSON.stringify({ id: saved.id, note: 'changed' }) })
    expect(update.status).toBe(403)
    expect((await update.json()).error.code).toBe('CAPABILITY_DISABLED')
    expect(repo.records[0].note).toBeNull()
  })

  it('enforces independent Skill rate limits', async () => {
    const app = createApp(repository(), { password: 'secret', skillToken: 'skill-secret', rateLimits: { read: 1, write: 5, batch: 5 } })
    const headers = { 'content-type': 'application/json', authorization: 'Bearer skill-secret' }
    expect((await app.request('/api/skill/list_bookmarks', { method: 'POST', headers, body: '{}' })).status).toBe(200)
    const limited = await app.request('/api/skill/get_stats', { method: 'POST', headers, body: '{}' })
    expect(limited.status).toBe(429)
    expect((await limited.json()).error.code).toBe('RATE_LIMITED')
  })

  it('lets the workbench mint a Skill Token that authenticates Skill requests', async () => {
    const store = new Map<string, string>()
    const repo = repository()
    repo.settings = {
      list: async () => [],
      get: async (key: string) => (store.has(key) ? { key, value: store.get(key) } : undefined),
      set: async (key: string, value: unknown) => {
        const stored = typeof value === 'string' ? value : JSON.stringify(value)
        store.set(key, stored)
        return { key, value: stored }
      },
    }
    const app = createApp(repo, { password: 'secret', skillToken: '' })
    expect((await app.request('/api/skill/token')).status).toBe(401)
    const { cookie } = await login(app)
    expect(await (await app.request('/api/skill/token', { headers: { cookie } })).json()).toMatchObject({
      configured: false, fromEnv: false, fromSettings: false,
    })
    const rotated = await app.request('/api/skill/token', { method: 'POST', headers: { cookie } })
    expect(rotated.status).toBe(200)
    const body = await rotated.json() as { token: string }
    expect(body.token.startsWith('de_')).toBe(true)
    const saved = await app.request('/api/skill/save_bookmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${body.token}` },
      body: JSON.stringify({ url: 'https://example.com/from-ui-token' }),
    })
    expect(saved.status).toBe(201)
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
    expect(created).toMatchObject({ url: 'https://example.com/article', status: 'unread', syncStatus: 'synced' })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.createdAt).toEqual(expect.any(Number))
    expect(created.updatedAt).toEqual(expect.any(Number))
    expect(await (await app.request('/api/bookmarks', { headers: { cookie } })).json()).toEqual({ items: [created], nextCursor: null })
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
    expect(await inbox.json()).toEqual({ bookmarks: expect.arrayContaining([expect.objectContaining({ url: 'https://example.com/inbox' })]), nextCursor: null })
    expect(await pending.json()).toEqual({ pendingCount: 0 })
  })

  it('creates and lists access records with server-generated timestamps', async () => {
    const repo = repository()
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const bookmarkResponse = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ url: 'https://example.com/opened' }),
    })
    const bookmark = await bookmarkResponse.json()
    const createResponse = await app.request(`/api/bookmarks/${bookmark.id}/access-records`, { method: 'POST', headers: { cookie } })
    const created = await createResponse.json()
    const listResponse = await app.request(`/api/bookmarks/${bookmark.id}/access-records`, { headers: { cookie } })

    expect(createResponse.status).toBe(201)
    expect(created).toMatchObject({ bookmarkId: bookmark.id, source: 'original' })
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
    expect(listed).toEqual({ items: [created], nextCursor: null })
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
        async create(input: { id: string; url: string; status: 'unread'; source?: string; note?: string | null }) {
          const createdAt = Date.now()
          database.prepare('INSERT INTO bookmarks (id, url, status, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(input.id, input.url, input.status, 'synced', createdAt, createdAt)
          return { ...input, syncStatus: 'synced' as const, createdAt, updatedAt: createdAt }
        },
        async get(id: string) {
          const row = database.prepare('SELECT id, url, status FROM bookmarks WHERE id = ?').get(id) as { id: string } | undefined
          return row
        },
        async list() {
          return { items: database.prepare('SELECT id, url, status, sync_status AS syncStatus, created_at AS createdAt, updated_at AS updatedAt FROM bookmarks ORDER BY created_at DESC').all().map((row: any) => ({ ...row, createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt) })), nextCursor: null }
        },
        async listInbox() {
          return { bookmarks: database.prepare("SELECT id, url, status, sync_status AS syncStatus, created_at AS createdAt, updated_at AS updatedAt FROM bookmarks WHERE status = 'unread' ORDER BY created_at DESC").all().map((row: any) => ({ ...row, createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt) })), nextCursor: null }
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
        operationLog: { append: async () => {} },
        idempotency: { findReplay: async () => undefined, store: async () => {} },
        skillUsage: { increment: async () => {}, getDaily: async () => ({ read: 0, write: 0, blocked: 0 }) },
      }
    }

    try {
      const firstDatabase = openDatabase()
      const firstApp = createApp(createRepository(firstDatabase) as any, { password: 'secret' })
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
      const restartedApp = createApp(createRepository(secondDatabase) as any, { password: 'secret' })
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
