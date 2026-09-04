import {
  createBookmarkInputSchema,
  getStatsSkillInputSchema,
  listBookmarksSkillInputSchema,
  loginRequestSchema,
  saveBookmarkSkillInputSchema,
  searchBookmarksSkillInputSchema,
  suggestSceneSkillInputSchema,
  triggerArchiveSkillInputSchema,
  updateBookmarkSkillInputSchema,
  updateBookmarkInputSchema,
} from '@dogear/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { BookmarkRepository } from '@dogear/db'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const sessionCookie = 'dogear_session'
const user = { id: 'user' }

type AppOptions = {
  password?: string
  skillToken?: string
  sessionTtlSeconds?: number
  now?: () => number
  rateLimits?: { read?: number; write?: number; batch?: number }
}

type SkillLimit = 'read' | 'write' | 'batch'

const skillDefinitions = [
  { name: 'save_bookmark', write: true, capability: 'write_new', input: 'url, note?, intent?, snapshot?', notes: 'Writes one bookmark to the source database.' },
  { name: 'search_bookmarks', write: false, capability: 'read', input: 'query?, filters?, limit?, cursor?', notes: 'Searches active non-private bookmarks by default.' },
  { name: 'update_bookmark', write: true, capability: 'update_existing', input: 'id plus editable fields', notes: 'Disabled by default; structure changes require confirmation.' },
  { name: 'list_bookmarks', write: false, capability: 'read', input: 'filters?, limit?, cursor?', notes: 'Lists active bookmarks.' },
  { name: 'get_stats', write: false, capability: 'read', input: '{}', notes: 'Returns active bookmark counts.' },
  { name: 'trigger_archive', write: true, capability: 'write_new', input: 'bookmarkId, type?', notes: 'Queues a browser-side snapshot job only.' },
  { name: 'suggest_scene', write: false, capability: 'read', input: 'bookmarkId or bookmarkIds', notes: 'Stores pending suggestions without changing structure.' },
] as const

function unauthorized(c: { json: (body: unknown, status: 401) => Response }) {
  return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
}

function invalidRequest(c: { json: (body: unknown, status: 400) => Response }, details?: unknown) {
  return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', ...(details ? { details } : {}) } }, 400)
}

function skillError(c: { json: (body: unknown, status: number) => Response }, code: string, status: number, message: string) {
  return c.json({ error: { code, message } }, status)
}

function jsonBody(c: Parameters<NonNullable<Parameters<Hono['use']>[1]>>[0]) {
  return c.req.json().catch(() => undefined)
}

function cookieValue(header: string | undefined) {
  return header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1)
}

function signSession(timestamp: number, password: string) {
  const payload = `${timestamp}`
  const signature = createHmac('sha256', password).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function hasValidSession(value: string | undefined, password: string, now: () => number, ttl: number, revoked: Set<string>) {
  if (!value || revoked.has(value)) return false
  const [timestampValue, signature] = value.split('.')
  const timestamp = Number(timestampValue)
  if (!Number.isSafeInteger(timestamp) || !signature || now() - timestamp < 0 || now() - timestamp > ttl * 1000) return false
  const expected = createHmac('sha256', password).update(timestampValue).digest('base64url')
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function setSessionCookie(value: string, maxAge: number) {
  return `${sessionCookie}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`
}

function timestamp(value: unknown) {
  return value instanceof Date ? value.getTime() : Number(value)
}

function serializeBookmark(record: any) {
  return { ...record, createdAt: timestamp(record.createdAt), updatedAt: timestamp(record.updatedAt) }
}

function serializeAccessRecord(record: any) {
  return { ...record, openedAt: timestamp(record.openedAt) }
}

export function createApp(repository: BookmarkRepository, options: AppOptions = {}) {
  const password = options.password ?? process.env.DOGEAR_PASSWORD ?? ''
  const sessionTtlSeconds = options.sessionTtlSeconds ?? 60 * 60 * 24 * 7
  const now = options.now ?? Date.now
  const revokedSessions = new Set<string>()
  const app = new Hono()
  app.use('/api/*', cors({ origin: 'http://localhost:5173', credentials: true }))

  app.get('/health', (c) => c.json({ ok: true }))

  app.post('/api/auth/login', async (c) => {
    const input = loginRequestSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!password || !input.success || input.data.password !== password) return unauthorized(c)
    c.header('Set-Cookie', setSessionCookie(signSession(now(), password), sessionTtlSeconds))
    return c.json({ user })
  })

  app.get('/api/auth/me', (c) => {
    if (!hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    return c.json({ user })
  })

  app.post('/api/auth/logout', (c) => {
    const cookie = cookieValue(c.req.header('Cookie'))
    if (cookie) {
      revokedSessions.add(cookie)
      c.header('Set-Cookie', setSessionCookie('', 0))
    }
    return c.json({ ok: true })
  })

  const requireSession = async (c: Parameters<NonNullable<Parameters<typeof app.use>[1]>>[0], next: Parameters<NonNullable<Parameters<typeof app.use>[1]>>[1]) => {
    if (!hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    await next()
  }

  app.use('/api/bookmarks', requireSession)
  app.use('/api/bookmarks/*', requireSession)

  app.use('/api/inbox', async (c, next) => {
    if (!hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    await next()
  })

  app.use('/api/sync/*', async (c, next) => {
    if (!hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    await next()
  })

  app.get('/api/bookmarks', async (c) => {
    const records = await repository.list()
    return c.json(records.map(serializeBookmark))
  })

  app.post('/api/bookmarks', async (c) => {
    const input = createBookmarkInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!input.success) return invalidRequest(c)
    const record = await repository.create({ id: randomUUID(), url: input.data.url, status: 'unread' })
    return c.json(serializeBookmark(record), 201)
  })

  app.get('/api/inbox', async (c) => {
    const records = await repository.listInbox()
    return c.json({ bookmarks: records.map(serializeBookmark) })
  })

  app.get('/api/sync/pending-count', async (c) => {
    return c.json({ pendingCount: await repository.countPending() })
  })

  const workbenchPaths = [
    '/api/recycle-bin', '/api/recycle-bin/*', '/api/scenes', '/api/scenes/*',
    '/api/folders', '/api/folders/*', '/api/tags', '/api/tags/*',
    '/api/suggestions/*', '/api/operation-log', '/api/settings', '/api/settings/*',
    '/api/jobs', '/api/jobs/*',
  ]
  for (const path of workbenchPaths) app.use(path, requireSession)

  const parseLimit = (value: string | undefined) => Math.min(Math.max(Number(value ?? 50) || 50, 1), 100)
  const serializeList = (items: unknown[]) => ({ items: items.map(serializeBookmark), nextCursor: null })

  app.get('/api/bookmarks/search', async (c) => {
    const items = await repository.search({
      q: c.req.query('q'), status: c.req.query('status'), sceneId: c.req.query('sceneId'),
      folderId: c.req.query('folderId') === 'none' ? 'none' : c.req.query('folderId'),
      tagId: c.req.query('tagId'), important: c.req.query('important') === undefined ? undefined : c.req.query('important') === 'true',
      source: c.req.query('source'), includeDeleted: false,
    })
    return c.json({ ...serializeList(items.slice(0, parseLimit(c.req.query('limit')))) })
  })

  app.patch('/api/bookmarks/batch', async (c) => {
    const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined
    if (!body || !Array.isArray(body.ids)) return invalidRequest(c)
    if (body.ids.length > 100) return skillError(c, 'BATCH_TOO_LARGE', 400, 'Batch size must not exceed 100')
    const result = await repository.batchUpdate(body as any)
    for (const item of result.updated) await repository.operationLog.append({ actor: 'user', action: 'update', targetType: 'bookmark', targetId: String((item as any).id) })
    return c.json({ updated: result.updated.map(serializeBookmark), skipped: result.skipped })
  })

  app.get('/api/bookmarks/:bookmarkId', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    return record ? c.json(serializeBookmark(record)) : skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
  })

  app.patch('/api/bookmarks/:bookmarkId', async (c) => {
    const input = updateBookmarkInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const existing = await repository.get(c.req.param('bookmarkId'), true)
    if (!existing) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    if ((existing as any).deletedAt) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    const { confirmStructure: _confirmStructure, ...changes } = input.data
    const updated = await repository.update(c.req.param('bookmarkId'), changes)
    if (!updated) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    await repository.operationLog.append({ actor: 'user', action: 'update', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json(serializeBookmark(updated))
  })

  app.delete('/api/bookmarks/:bookmarkId', async (c) => {
    const deleted = await repository.softDelete(c.req.param('bookmarkId'))
    if (!deleted) return c.json({ ok: true, deletedAt: null })
    await repository.operationLog.append({ actor: 'user', action: 'delete', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json({ ok: true, deletedAt: timestamp((deleted as any).deletedAt) })
  })

  app.get('/api/recycle-bin', async (c) => {
    const items = await repository.list({ includeDeleted: true })
    return c.json(serializeList(items.filter((item: any) => item.deletedAt).slice(0, parseLimit(c.req.query('limit')))))
  })

  app.post('/api/recycle-bin/:bookmarkId/restore', async (c) => {
    const restored = await repository.restore(c.req.param('bookmarkId'))
    if (!restored) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    await repository.operationLog.append({ actor: 'user', action: 'restore', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json(serializeBookmark(restored))
  })

  app.delete('/api/recycle-bin/:bookmarkId', async (c) => {
    const count = await repository.purgeDeleted([c.req.param('bookmarkId')])
    if (!count) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    await repository.operationLog.append({ actor: 'user', action: 'purge', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json({ ok: true })
  })

  app.post('/api/recycle-bin/empty', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { onlyExpired?: boolean }
    let before: Date | undefined
    if (body.onlyExpired !== false) {
      const setting = await repository.settings.get('recycle.retention_days') as any
      const days = Number(setting?.value ?? 7)
      before = new Date(Date.now() - days * 86400000)
    }
    const count = await repository.purgeDeleted(undefined, before)
    await repository.operationLog.append({ actor: 'user', action: 'purge', targetType: 'bookmark', targetId: 'recycle-bin' })
    return c.json({ ok: true, purged: count })
  })

  const resourceRoutes = [
    ['scenes', repository.scenes], ['folders', repository.folders], ['tags', repository.tags],
  ] as const
  for (const [name, resource] of resourceRoutes) {
    app.get(`/api/${name}`, async (c) => c.json({ items: await resource.list() }))
    app.post(`/api/${name}`, async (c) => {
      const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined
      if (!body || typeof body.name !== 'string' || !body.name.trim()) return invalidRequest(c)
      const record = await resource.create({ ...body, id: body.id ?? randomUUID() })
      await repository.operationLog.append({ actor: 'user', action: 'create', targetType: name.slice(0, -1), targetId: String((record as any).id) })
      return c.json(record, 201)
    })
    if (name !== 'tags') app.patch(`/api/${name}/:id`, async (c) => {
      const body = await c.req.json().catch(() => undefined)
      const record = await resource.update(c.req.param('id'), body ?? {})
      return record ? c.json(record) : skillError(c, 'NOT_FOUND', 404, 'Resource not found')
    })
    app.delete(`/api/${name}/:id`, async (c) => {
      const removed = await resource.remove(c.req.param('id'))
      if (!removed) return skillError(c, name === 'scenes' ? 'SCENE_IN_USE' : 'NOT_FOUND', 409, name === 'scenes' ? 'Scene is in use' : 'Resource not found')
      await repository.operationLog.append({ actor: 'user', action: 'delete', targetType: name.slice(0, -1), targetId: c.req.param('id') })
      return c.json({ ok: true })
    })
  }

  app.get('/api/bookmarks/:bookmarkId/suggestions', async (c) => c.json({ items: await repository.suggestions.list(c.req.param('bookmarkId'), c.req.query('status')) }))
  for (const action of ['accept', 'defer', 'dismiss'] as const) app.post(`/api/suggestions/:id/${action}`, async (c) => {
    const result = action === 'accept' ? await repository.suggestions.accept(c.req.param('id'), 'user') : await repository.suggestions.resolve(c.req.param('id'), action === 'defer' ? 'deferred' : 'dismissed')
    if (!result) return skillError(c, 'NOT_FOUND', 404, 'Suggestion not found')
    if (action !== 'accept') await repository.operationLog.append({ actor: 'user', action: action === 'dismiss' ? 'dismiss_suggestion' : 'update', targetType: 'suggestion', targetId: c.req.param('id') })
    return c.json(result)
  })

  app.get('/api/operation-log', async (c) => c.json({ items: await repository.operationLog.list({ actor: c.req.query('actor'), action: c.req.query('action') }), nextCursor: null }))
  app.get('/api/settings', async (c) => c.json({ items: (await repository.settings.list()).filter((item: any) => !String(item.key).includes('token') && !String(item.key).includes('password')) }))
  app.put('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined
    if (!body) return invalidRequest(c)
    const entries = Object.entries(body).filter(([key]) => !key.includes('token') && !key.includes('password'))
    const items = await Promise.all(entries.map(([key, value]) => repository.settings.set(key, value)))
    return c.json({ items })
  })
  app.get('/api/jobs', async (c) => c.json({ items: await repository.archiveJobs.list(c.req.query('bookmarkId')), nextCursor: null }))
  app.post('/api/jobs/:id/retry', async (c) => c.json(await repository.archiveJobs.update(c.req.param('id'), { status: 'pending' })))
  app.post('/api/jobs/:id/cancel', async (c) => c.json(await repository.archiveJobs.update(c.req.param('id'), { status: 'cancelled' })))
  app.post('/api/bookmarks/:bookmarkId/archives', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { type?: string }
    if (body.type && body.type !== 'snapshot') return skillError(c, 'NOT_SUPPORTED', 400, 'Archive type is not supported')
    if (!await repository.get(c.req.param('bookmarkId'))) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: c.req.param('bookmarkId'), source: 'manual', type: 'snapshot' }) as any
    return c.json({ ...job, snapshotStatus: 'queued_pending_browser' }, 202)
  })

  app.post('/api/bookmarks/:bookmarkId/access-records', async (c) => {
    const bookmarkId = c.req.param('bookmarkId')
    if (!bookmarkId) return invalidRequest(c)
    const record = await repository.createAccessRecord({ id: randomUUID(), bookmarkId, source: 'original' })
    return c.json(serializeAccessRecord(record), 201)
  })

  app.get('/api/bookmarks/:bookmarkId/access-records', async (c) => {
    const records = await repository.listAccessRecords(c.req.param('bookmarkId'))
    return c.json({ records: records.map(serializeAccessRecord) })
  })

  const configuredSkillToken = options.skillToken ?? process.env.DOGEAR_SKILL_TOKEN ?? ''
  const limits = { read: options.rateLimits?.read ?? 60, write: options.rateLimits?.write ?? 30, batch: options.rateLimits?.batch ?? 10 }
  const usage = { read: 0, write: 0, batch: 0 }
  const capabilities = { read: true, write_new: true, update_existing: false }
  const skillLimit = (name: string): SkillLimit => name === 'update_bookmark' ? 'batch' : ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene'].includes(name) ? 'read' : 'write'
  const skillCapability = (name: string) => name === 'update_bookmark' ? 'update_existing' : ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene'].includes(name) ? 'read' : 'write_new'
  const requireSkill = async (c: any, next: any) => {
    const authorization = c.req.header('Authorization')
    if (!configuredSkillToken || authorization !== `Bearer ${configuredSkillToken}`) return skillError(c, 'UNAUTHORIZED', 401, 'Unauthorized')
    const name = c.req.param('name')
    const configured = repository.settings && typeof repository.settings.get === 'function' ? await repository.settings.get('skill.capabilities') : undefined
    let configuredCapabilities = capabilities
    if (configured && typeof configured === 'object' && 'value' in configured) {
      try { configuredCapabilities = JSON.parse(String((configured as { value: unknown }).value)) } catch { configuredCapabilities = capabilities }
    }
    const capability = skillCapability(name) as keyof typeof capabilities
    if (!configuredCapabilities[capability]) return skillError(c, 'CAPABILITY_DISABLED', 403, 'Skill capability is disabled')
    const limit = skillLimit(name)
    usage[limit] += 1
    if (usage[limit] > limits[limit]) return skillError(c, 'RATE_LIMITED', 429, 'Skill rate limit exceeded')
    await next()
  }

  app.get('/.well-known/capabilities', (c) => c.json({ name: 'DogEar', version: 'v1', auth: 'Bearer token', skills: skillDefinitions }))
  app.use('/api/skill/:name', requireSkill)

  app.post('/api/skill/save_bookmark', async (c) => {
    const input = saveBookmarkSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const record = await repository.create({ id: randomUUID(), url: input.data.url, status: 'unread', source: 'agent', note: input.data.note, intent: input.data.intent, syncStatus: 'synced' })
    const saved = { ...serializeBookmark(record), snapshotStatus: 'not_requested', suggestions: [] }
    if (input.data.snapshot && repository.archiveJobs) {
      const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: saved.id, source: 'agent', type: 'snapshot' }) as any
      saved.snapshotStatus = 'queued_pending_browser'
      saved.jobId = job.id
    }
    if (repository.operationLog) await repository.operationLog.append({ actor: 'agent', action: 'save_bookmark', targetType: 'bookmark', targetId: saved.id })
    return c.json(saved, 201)
  })

  app.post('/api/skill/search_bookmarks', async (c) => {
    const input = searchBookmarksSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const filters = { ...(input.data.filters ?? {}), q: input.data.query, includeDeleted: false }
    const items = await repository.search(filters)
    return c.json({ items: items.filter((item: any) => input.data.filters?.includePrivate || !item.private).slice(0, input.data.limit).map(serializeBookmark), nextCursor: null })
  })

  app.post('/api/skill/list_bookmarks', async (c) => {
    const input = listBookmarksSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const items = await repository.list({ ...input.data, includeDeleted: false })
    return c.json({ items: items.filter((item: any) => !item.private).slice(0, input.data.limit).map(serializeBookmark), nextCursor: null })
  })

  app.post('/api/skill/get_stats', async (c) => {
    const input = getStatsSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const items = await repository.list()
    const statuses = Object.fromEntries(['unread', 'saved', 'archived'].map((status) => [status, items.filter((item: any) => item.status === status).length]))
    return c.json({ total: items.length, inbox: statuses.unread, statuses, scenes: [] })
  })

  app.post('/api/skill/trigger_archive', async (c) => {
    const input = triggerArchiveSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    if (input.data.type === 'reader') return skillError(c, 'NOT_SUPPORTED', 400, 'Reader archive is not supported')
    const bookmark = await repository.get(input.data.bookmarkId)
    if (!bookmark) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: input.data.bookmarkId, type: 'snapshot', source: 'agent' }) as any
    return c.json({ jobId: job.id, snapshotStatus: 'queued_pending_browser' })
  })

  app.post('/api/skill/suggest_scene', async (c) => {
    const input = suggestSceneSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const bookmarkIds = 'bookmarkId' in input.data ? [input.data.bookmarkId] : input.data.bookmarkIds
    const suggestions: unknown[] = []
    for (const bookmarkId of bookmarkIds) {
      if (!await repository.get(bookmarkId)) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
      if (repository.suggestions) {
        const suggestion = await repository.suggestions.create({ id: randomUUID(), bookmarkId, kind: 'scene', targetId: null, targetLabel: null, confidence: null, rationale: null })
        suggestions.push(suggestion)
      }
    }
    return c.json({ suggestions })
  })

  app.post('/api/skill/update_bookmark', async (c) => {
    const input = updateBookmarkSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const existing = await repository.get(input.data.id)
    if (!existing) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const structure = 'sceneIds' in input.data || 'tagIds' in input.data || 'folderId' in input.data
    if (structure && !input.data.confirmStructure) return c.json({ applied: false, suggestions: [] })
    const { id, confirmStructure, ...changes } = input.data
    const updated = await repository.update(id, changes)
    if (!updated) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    if (repository.operationLog) await repository.operationLog.append({ actor: 'agent', action: 'update_bookmark', targetType: 'bookmark', targetId: id })
    return c.json({ applied: true, bookmark: serializeBookmark(updated) })
  })

  return app
}
