import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

function repository() {
  const records: Array<{ id: string; url: string; status: 'unread' }> = []
  return {
    records,
    create: async (record: { id: string; url: string; status: 'unread' }) => {
      records.push(record)
      return record
    },
    list: async () => records,
    listInbox: async () => records,
    countPending: async () => records.length,
    createAccessRecord: async () => undefined,
    listAccessRecords: async () => [],
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

describe('bookmark API', () => {
  it('creates a bookmark and lists it for an authenticated client', async () => {
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
    expect(created.url).toBe('https://example.com/article')
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect((await (await app.request('/api/bookmarks', { headers: { cookie } })).json())).toHaveLength(1)
  })
})
