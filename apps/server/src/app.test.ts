import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

function repository() {
  const records: Array<{ id: string; url: string; status: 'unread'; syncStatus: 'pending'; createdAt: number; updatedAt: number }> = []
  const accessRecords: Array<{ id: string; bookmarkId: string; openedAt: number; source: 'original' }> = []
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
})
