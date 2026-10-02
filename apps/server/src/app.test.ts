import { createRequire } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializeSqliteSchema } from '@dogear/db'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createBackupRoutes } from './backup/backup-routes.js'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function repository(): any {
  type BookmarkRecord = { id: string; url: string; title?: string | null; status: 'unread'; source?: string; note?: string | null; syncStatus: 'pending' | 'synced'; createdAt: number; updatedAt: number }
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
    syncQueue: { enqueue: async () => ({}), getPending: async () => [], updateStatus: async () => undefined, remove: async () => true, countPending: async () => 0, countFailed: async () => 0 },
    findByRaindropIds: async () => [],
    backups: { create: async (input: Record<string, unknown>) => input, get: async () => undefined, list: async () => [], updateStatus: async () => undefined },
    navRules: { list: async () => [], get: async () => undefined, create: async (input: Record<string, unknown>) => input, update: async () => undefined, remove: async () => undefined },

    listRecentOpened: async () => [],
    listSearchIndex: async (limit = 100, cursor?: string) => ({
      items: records.slice(0, limit).map((record) => ({
        id: record.id,
        title: record.title,
        url: record.url,
        domain: null,
        note: null,
        tagText: '',
        tagNames: [],
        folderName: null,
        createdAt: new Date().toISOString(),
      })),
      nextCursor: cursor ? null : 'next-cursor-token',
      total: records.length,
    }),
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

  /**
   * 批次 2 的端侧检索投影：鉴权、回执形状、分页游标透传。
   * 这个端点一次返回**全库**的瘦投影，漏掉鉴权就是整库数据裸奔，故单独测。
   */
  it('search-index 需登录；已登录时按 limit/cursor 分页返回瘦投影', async () => {
    const repo = repository()
    repo.records.push({ id: 'b1', url: 'https://a.example.com/', title: 'A', status: 'unread', source: 'page', syncStatus: 'synced', createdAt: Date.now(), updatedAt: Date.now() })
    const app = createApp(repo, { password: 'secret' })

    expect((await app.request('/api/bookmarks/search-index')).status).toBe(401)
    expect((await app.request('/api/bookmarks/search-index', { headers: { cookie: 'dogear_session=invalid' } })).status).toBe(401)

    const { cookie } = await login(app)
    const first = await app.request('/api/bookmarks/search-index?limit=1', { headers: { cookie } })
    expect(first.status).toBe(200)
    const body = await first.json() as { items: any[]; nextCursor: string | null; total: number }
    expect(body.items).toHaveLength(1)
    expect(body.nextCursor).toBe('next-cursor-token')
    expect(body.total).toBe(1)
    // 瘦投影：可搜字段齐全，大字段不在
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ['createdAt', 'domain', 'folderName', 'id', 'note', 'tagNames', 'tagText', 'title', 'url'],
    )
    expect(body.items[0]).not.toHaveProperty('cover')
    expect(body.items[0]).not.toHaveProperty('excerpt')

    // 游标透传：第二页拿它换数据，且不再给下一页游标
    const second = await app.request('/api/bookmarks/search-index?limit=1&cursor=next-cursor-token', { headers: { cookie } })
    const secondBody = await second.json() as { nextCursor: string | null }
    expect(secondBody.nextCursor).toBeNull()

    // limit 越界走 400，不静默兜底
    expect((await app.request('/api/bookmarks/search-index?limit=9999', { headers: { cookie } })).status).toBe(400)
  })

  /** 双向差异探测（批次 2 · 屏 5 胶囊的数据源）：鉴权 + 回执形状 */
  it('sync/diff 需登录；未连接 Raindrop 时报 probeError 而非 behind=0', async () => {
    const app = createApp(repository(), { password: 'secret' })

    expect((await app.request('/api/sync/diff')).status).toBe(401)

    const { cookie } = await login(app)
    const response = await app.request('/api/sync/diff', { headers: { cookie } })
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    // 桩仓库里没有配任何通道 ⇒ 探不了远端
    expect(body.probeError).toBeTruthy()
    expect(body.behindIsExact).toBe(false)
    expect(body).toHaveProperty('ahead')
    expect(body).toHaveProperty('failed')
    expect(body).toHaveProperty('lastPushAt')
    expect(body).toHaveProperty('lastPullAt')
    // breakdown 是按需的，默认不算
    expect(body).not.toHaveProperty('aheadBreakdown')
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

  it('persists title/excerpt from save_bookmark and does not overwrite title with fetched metadata', async () => {
    const repo = repository()
    let fetched = false
    const app = createApp(repo, {
      password: 'secret',
      skillToken: 'skill-secret',
      metadataEnhancer: async () => {
        fetched = true
        return { title: '抓取到的标题', description: '抓取到的简介' }
      },
    })
    const response = await app.request('/api/skill/save_bookmark', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com/from-extension',
        title: '插件标题',
        excerpt: '插件简介',
        favicon: 'https://example.com/favicon.ico',
        source: 'extension',
      }),
      headers: { 'content-type': 'application/json', authorization: 'Bearer skill-secret' },
    })
    const saved = await response.json()
    expect(response.status).toBe(201)
    expect(saved).toMatchObject({
      url: 'https://example.com/from-extension',
      title: '插件标题',
      excerpt: '插件简介',
      favicon: 'https://example.com/favicon.ico',
      source: 'extension',
      domain: 'example.com',
    })
    expect(repo.records[0]).toMatchObject({ title: '插件标题', excerpt: '插件简介', favicon: 'https://example.com/favicon.ico' })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(fetched).toBe(true)
    expect(repo.records[0].title).toBe('插件标题')
    expect(repo.records[0].excerpt).toBe('插件简介')
  })

  it('fills title/excerpt on save_bookmark 201 when the caller omitted them', async () => {
    const repo = repository()
    const app = createApp(repo, {
      password: 'secret',
      skillToken: 'skill-secret',
      metadataWaitMs: 1000,
      metadataEnhancer: async () => ({ title: '抓取标题', description: '抓取简介', image: 'https://cdn.example.com/c.jpg' }),
    })
    const response = await app.request('/api/skill/save_bookmark', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/meta', source: 'agent' }),
      headers: { 'content-type': 'application/json', authorization: 'Bearer skill-secret' },
    })
    const saved = await response.json()
    expect(response.status).toBe(201)
    expect(saved).toMatchObject({ title: '抓取标题', excerpt: '抓取简介', cover: 'https://cdn.example.com/c.jpg', domain: 'example.com' })
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

describe('tag rename/merge and stats API (v1.14)', () => {
  function tagRepo(tags: Record<string, unknown>, logs: unknown[] = []) {
    const repo = repository()
    repo.tags = {
      list: async () => [],
      create: async (input: Record<string, unknown>) => input,
      remove: async () => true,
      ...tags,
    }
    repo.operationLog = {
      list: async () => [],
      get: async () => undefined,
      append: async (input: Record<string, unknown>) => {
        logs.push(input)
        return input
      },
      consumeRevert: async () => undefined,
    }
    return { repo, logs }
  }

  it('requires a session for tag rename/merge and stats', async () => {
    const app = createApp(repository(), { password: 'secret' })

    expect((await app.request('/api/tags/tag-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x' }) })).status).toBe(401)
    expect((await app.request('/api/tags/tag-1/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000001' }) })).status).toBe(401)
    expect((await app.request('/api/stats')).status).toBe(401)
  })

  it('renames a tag, records the log, and rejects conflicts / missing tags / invalid bodies', async () => {
    const { repo, logs } = tagRepo({
      rename: async (id: string, input: { name: string }) =>
        id === 'tag-1'
          ? { ok: true as const, record: { id: 'tag-1', name: input.name, nameKey: input.name.toLowerCase() } }
          : { ok: false as const, reason: 'not_found' as const },
    })
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)

    const ok = await app.request('/api/tags/tag-1', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ name: '前端开发' }) })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ id: 'tag-1', name: '前端开发' })
    expect(logs[0]).toMatchObject({ action: 'rename_tag', targetType: 'tag', targetId: 'tag-1' })

    const conflictRepo = tagRepo({ rename: async () => ({ ok: false as const, reason: 'name_conflict' as const }) })
    const conflictApp = createApp(conflictRepo.repo, { password: 'secret' })
    const conflictCookie = (await login(conflictApp)).cookie
    const conflict = await conflictApp.request('/api/tags/tag-1', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: conflictCookie }, body: JSON.stringify({ name: '已有' }) })
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).error.code).toBe('CONFLICT')

    const missing = await app.request('/api/tags/tag-404', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ name: '不存在' }) })
    expect(missing.status).toBe(404)

    const blank = await app.request('/api/tags/tag-1', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ name: '   ' }) })
    expect(blank.status).toBe(400)

    const unknownField = await app.request('/api/tags/tag-1', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ name: '新名', bogus: 1 }) })
    expect(unknownField.status).toBe(400)
  })

  it('merges a tag into a target, records the log, and rejects self-merge / missing tags / invalid bodies', async () => {
    const { repo, logs } = tagRepo({
      merge: async (sourceId: string) =>
        sourceId === 'tag-1'
          ? { ok: true as const, moved: 3, target: { id: 'tag-2', name: '目标' } }
          : { ok: false as const, reason: 'not_found' as const },
    })
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)

    const ok = await app.request('/api/tags/tag-1/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000002' }) })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ ok: true, moved: 3, target: { id: 'tag-2', name: '目标' } })
    expect(logs[0]).toMatchObject({ action: 'merge_tag', targetType: 'tag', targetId: 'tag-1' })
    expect(String((logs[0] as { detail?: string }).detail)).toContain('目标')

    const sameRepo = tagRepo({ merge: async () => ({ ok: false as const, reason: 'same_tag' as const }) })
    const sameApp = createApp(sameRepo.repo, { password: 'secret' })
    const sameCookie = (await login(sameApp)).cookie
    const same = await sameApp.request('/api/tags/tag-1/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie: sameCookie }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000001' }) })
    expect(same.status).toBe(400)

    const missing = await app.request('/api/tags/tag-404/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000002' }) })
    expect(missing.status).toBe(404)

    const invalid = await app.request('/api/tags/tag-1/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: 'not-a-uuid' }) })
    expect(invalid.status).toBe(400)
  })

  it('returns aggregated stats', async () => {
    const repo = repository()
    repo.stats = async () => ({
      total: 412,
      byStatus: { unread: 14, saved: 351, archived: 47 },
      bySource: { page: 380, agent: 12, extension: 15, raindrop: 5 },
      byFolder: [], byScene: [], byTag: [],
      importantCount: 23,
      recycleCount: 6,
    })
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/stats', { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ total: 412, importantCount: 23, recycleCount: 6, byStatus: { unread: 14 } })
  })

  it('passes time range, nav visibility and important sort through to the repository list', async () => {
    const calls: Array<{ filters: Record<string, unknown>; opts?: { sort?: string } }> = []
    const repo = repository()
    const rows = [
      { id: 'b-1', status: 'saved', private: false },
      { id: 'b-2', status: 'saved', private: false },
    ]
    repo.list = async (filters: Record<string, unknown>, _limit?: number, _cursor?: string, opts?: { sort?: string }) => {
      calls.push({ filters, opts })
      return { items: [...rows], nextCursor: null, total: rows.length }
    }
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)

    const response = await app.request('/api/bookmarks?sort=important&createdFrom=2026-09-01T00:00:00.000Z&createdTo=2026-09-26T00:00:00.000Z&navVisible=true', { headers: { cookie } })
    expect(response.status).toBe(200)
    const listCall = calls.find((call) => call.opts?.sort === 'important')
    expect(listCall).toBeTruthy()
    expect(listCall!.filters.createdFrom).toBeInstanceOf(Date)
    expect(listCall!.filters.createdTo).toBeInstanceOf(Date)
    // navVisible=true：路由先跑 nav 求值（无规则回落=全部候选），把候选 id 集交给仓储过滤
    expect(listCall!.filters.navVisibleIds).toEqual(['b-1', 'b-2'])

    const excluded = await app.request('/api/bookmarks?navVisible=false', { headers: { cookie } })
    expect(excluded.status).toBe(200)
    const excludedCall = calls.filter((call) => call.filters.navExcludedIds !== undefined).at(-1)
    expect(excludedCall!.filters.navExcludedIds).toEqual(['b-1', 'b-2'])

    const invalidNav = await app.request('/api/bookmarks?navVisible=yes', { headers: { cookie } })
    expect(invalidNav.status).toBe(400)
    const invalidDate = await app.request('/api/bookmarks?createdFrom=not-a-date', { headers: { cookie } })
    expect(invalidDate.status).toBe(400)
  })
})

describe('scene merge, export filters and log cleanup (v1.15)', () => {
  it('requires a session for scene merge and log cleanup', async () => {
    const app = createApp(repository(), { password: 'secret' })

    expect((await app.request('/api/scenes/00000000-0000-4000-8000-000000000001/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000002' }) })).status).toBe(401)
    expect((await app.request('/api/operation-log/cleanup', { method: 'POST' })).status).toBe(401)
  })

  it('merges a scene, records the log, and rejects self-merge / missing scenes', async () => {
    const logs: Array<Record<string, unknown>> = []
    const repo = repository()
    repo.scenes = {
      list: async () => [],
      create: async (input: Record<string, unknown>) => input,
      update: async () => undefined,
      remove: async () => true,
      merge: async (sourceId: string) =>
        sourceId === 'sc-1'
          ? { ok: true as const, moved: 2, target: { id: 'sc-2', name: '目标场景' } }
          : { ok: false as const, reason: 'not_found' as const },
    }
    repo.operationLog = {
      list: async () => [],
      get: async () => undefined,
      append: async (input: Record<string, unknown>) => { logs.push(input); return input },
      consumeRevert: async () => undefined,
    }
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)

    const ok = await app.request('/api/scenes/sc-1/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000002' }) })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ ok: true, moved: 2, target: { id: 'sc-2', name: '目标场景' } })
    expect(logs[0]).toMatchObject({ action: 'merge_scene', targetType: 'scene', targetId: 'sc-1' })

    const same = await app.request('/api/scenes/sc-1/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: 'sc-1' }) })
    expect(same.status).toBe(400)

    const missing = await app.request('/api/scenes/sc-404/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: '00000000-0000-4000-8000-000000000002' }) })
    expect(missing.status).toBe(404)

    const invalid = await app.request('/api/scenes/sc-1/merge', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targetId: 'nope' }) })
    expect(invalid.status).toBe(400)
  })

  it('cleans up logs using the settings-backed retention policy', async () => {
    const logs: Array<Record<string, unknown>> = []
    let cleanupOpts: { retentionDays?: number; maxEntries?: number } | undefined
    const repo = repository()
    repo.settings = {
      list: async () => [
        { key: 'log.retention_days', value: '14', updatedAt: new Date() },
        { key: 'log.max_entries', value: '1000', updatedAt: new Date() },
      ],
      get: async (key: string) => {
        if (key === 'log.retention_days') return { key, value: '14', updatedAt: new Date() }
        if (key === 'log.max_entries') return { key, value: '1000', updatedAt: new Date() }
        return undefined
      },
      set: async (key: string, value: unknown) => ({ key, value, updatedAt: new Date() }),
    }
    repo.operationLog = {
      list: async () => [],
      get: async () => undefined,
      append: async (input: Record<string, unknown>) => { logs.push(input); return input },
      consumeRevert: async () => undefined,
      cleanup: async (opts: { retentionDays?: number; maxEntries?: number }) => {
        cleanupOpts = opts
        return { removed: 7 }
      },
    }
    const app = createApp(repo, { password: 'secret' })
    const { cookie } = await login(app)

    const response = await app.request('/api/operation-log/cleanup', { method: 'POST', headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, removed: 7, retentionDays: 14, maxEntries: 1000 })
    expect(cleanupOpts).toEqual({ retentionDays: 14, maxEntries: 1000 })
    expect(logs[0]).toMatchObject({ action: 'cleanup_log', actor: 'system' })
  })

  it('validates export-zip range filters (v1.15)', async () => {
    const repo = repository()
    // export-zip 属 Track B 文件能力：测试里显式挂真路由（无 dbPath 也不影响导出）
    const app = createApp(repo, { password: 'secret', backupRoutes: (r) => createBackupRoutes(r) })
    const { cookie } = await login(app)

    const invalid = await app.request('/api/backup/export-zip?tagId=not-a-uuid', { headers: { cookie } })
    expect(invalid.status).toBe(400)
    const invalidStatus = await app.request('/api/backup/export-zip?status=bogus', { headers: { cookie } })
    expect(invalidStatus.status).toBe(400)

    const ok = await app.request('/api/backup/export-zip?status=saved&folderId=none', { headers: { cookie } })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('application/zip')
  })
})
