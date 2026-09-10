import {
  archiveJobStatusSchema,
  batchUpdateRequestSchema,
  bookmarkListQuerySchema,
  bookmarkVersionConflictErrorSchema,
  createBookmarkInputSchema,
  getStatsSkillInputSchema,
  listBookmarksSkillInputSchema,
  loginRequestSchema,
  paginationQuerySchema,
  recycleBinEmptyRequestSchema,
  saveBookmarkSkillInputSchema,
  searchBookmarksSkillInputSchema,
  settingsWhitelistSchema,
  skillCapabilitiesBodySchema,
  skillUsageResponseSchema,
  suggestSceneSkillInputSchema,
  triggerArchiveSkillInputSchema,
  updateBookmarkSkillInputSchema,
  updateBookmarkInputSchema,
} from '@dogear/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { BookmarkRepository } from '@dogear/db'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createArchiveRoutes } from './archive/archive-routes.js'
import { createBackupRoutes } from './backup/backup-routes.js'
import { createChannelRoutes } from './channels-routes.js'
import { createMetadataRoutes } from './archive/metadata-routes.js'
import { createNavRoutes } from './nav/nav-routes.js'
import { extractMetadata } from './archive/metadata.js'

const sessionCookie = 'dogear_session'
const user = { id: 'user' }

type AppOptions = {
  password?: string
  skillToken?: string
  sessionTtlSeconds?: number
  now?: () => number
  rateLimits?: { read?: number; write?: number; batch?: number }
  /** 真源库文件路径，供重档备份整库复制使用 */
  dbPath?: string
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

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
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
    const body = await c.req.json().catch(() => undefined)
    const input = loginRequestSchema.safeParse(body)
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

  app.use('/api/metadata/*', async (c, next) => {
    if (!hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    await next()
  })

  app.get('/api/bookmarks', async (c) => {
    const query = bookmarkListQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor, sort } = query.data
    const importantQuery = c.req.query('important')
    const result = await repository.list({
      q: c.req.query('q'),
      status: c.req.query('status'),
      sceneId: c.req.query('sceneId'),
      folderId: c.req.query('folderId') === 'none' ? 'none' : c.req.query('folderId'),
      tagId: c.req.query('tagId'),
      important: importantQuery === 'true' ? true : importantQuery === 'false' ? false : undefined,
      source: c.req.query('source'),
    }, limit, cursor, { sort })
    return c.json({ items: result.items.map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/bookmarks', async (c) => {
    const input = createBookmarkInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!input.success) return invalidRequest(c)
    const idempotencyKey = c.req.header('Idempotency-Key')
    const actor = 'user'
    if (idempotencyKey) {
      const replay = await repository.idempotency.findReplay(idempotencyKey, actor)
      if (replay) {
        const keyEntry = (await repository.get(JSON.parse(replay.responseBody).id))
        return c.json({ bookmark: serializeBookmark(keyEntry ?? {}), idempotent: true, replay: true }, 201)
      }
    }
    const id = randomUUID()
    const record = await repository.create({
      id, url: input.data.url, status: 'unread',
      note: input.data.note ?? null, intent: input.data.intent ?? null,
      important: input.data.important ?? false, private: input.data.private ?? false,
      syncStatus: 'synced',
    })
    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await repository.idempotency.store({
        key: idempotencyKey, actor,
        requestPath: c.req.path, requestBodyHash: '',
        statusCode: 201, responseBody: JSON.stringify(record),
        expiresAt, createdAt: new Date(),
      })
    }
    await repository.operationLog.append({ actor, action: 'create', targetType: 'bookmark', targetId: id })

    // Async metadata extraction - don't block the response
    const recordWithId = record as { id: string; url: string }
    const recordId = recordWithId.id
    const recordUrl = recordWithId.url
    Promise.resolve().then(async () => {
      try {
        const meta = await extractMetadata(recordUrl)
        const updates: Record<string, unknown> = {}
        if (meta.title) updates.title = meta.title
        if (meta.description) updates.excerpt = meta.description
        if (meta.image) updates.cover = meta.image
        if (meta.author) updates.author = meta.author
        if (meta.domain) updates.domain = meta.domain
        if (meta.favicon) updates.favicon = meta.favicon
        if (meta.publishedAt) {
          const d = new Date(meta.publishedAt)
          if (!Number.isNaN(d.getTime())) updates.publishedAt = d.getTime()
        }
        if (Object.keys(updates).length > 0) {
          await repository.update(recordId, updates)
        }
      } catch {
        // Metadata extraction failed silently - partial metadata is fine
      }
    })

    return c.json(serializeBookmark(record), 201)
  })

  app.get('/api/inbox', async (c) => {
    const query = paginationQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor } = query.data
    const result = await repository.listInbox(limit, cursor)
    return c.json({ bookmarks: result.bookmarks.map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.get('/api/sync/pending-count', async (c) => {
    const count = await repository.syncQueue.countPending()
    return c.json({ pendingCount: count })
  })

  app.get('/api/sync/queue', async (c) => {
    const limit = Number(c.req.query('limit')) || 50
    const items = await repository.syncQueue.getPending(limit)
    return c.json({ items })
  })

  app.post('/api/sync/process', async (c) => {
    const items = await repository.syncQueue.getPending(1)
    if (items.length === 0) return c.json({ processed: 0, item: null })
    const item = items[0]
    await repository.syncQueue.updateStatus(item.id, 'processing')
    // Mark as processing — actual processing is handled by the background worker
    // or by the client-side channel handler
    return c.json({ processed: 1, item })
  })

  const workbenchPaths = [
    '/api/recycle-bin', '/api/recycle-bin/*', '/api/scenes', '/api/scenes/*',
    '/api/folders', '/api/folders/*', '/api/tags', '/api/tags/*',
    '/api/suggestions/*', '/api/operation-log', '/api/operation-log/*', '/api/settings', '/api/settings/*',
    '/api/jobs', '/api/jobs/*', '/api/channels', '/api/channels/*',
    '/api/archive', '/api/archive/*', '/api/backup', '/api/backup/*',
    '/api/nav', '/api/nav/*',
    '/api/skill/usage', '/api/skill/capabilities',
  ]
  for (const path of workbenchPaths) app.use(path, requireSession)

  app.get('/api/bookmarks/search', async (c) => {
    const query = paginationQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor } = query.data
    const items = await repository.search({
      q: c.req.query('q'), status: c.req.query('status'), sceneId: c.req.query('sceneId'),
      folderId: c.req.query('folderId') === 'none' ? 'none' : c.req.query('folderId'),
      tagId: c.req.query('tagId'), important: c.req.query('important') === undefined ? undefined : c.req.query('important') === 'true',
      source: c.req.query('source'), includeDeleted: false,
    }, limit, cursor)
    return c.json({ items: items.items.map(serializeBookmark), nextCursor: items.nextCursor })
  })

  app.patch('/api/bookmarks/batch', async (c) => {
    const body = batchUpdateRequestSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return invalidRequest(c)
    const snapshots = []
    for (const id of body.data.ids) {
      const existing = await repository.get(id, true) as { id: string; status?: string; folderId?: string | null; deletedAt?: unknown } | undefined
      if (existing) snapshots.push({ id: existing.id, status: existing.status ?? 'unread', folderId: existing.folderId ?? null, deleted: Boolean(existing.deletedAt) })
    }
    const result = await repository.batchUpdate(body.data as any)
    const log = await repository.operationLog.append({
      actor: 'user',
      action: body.data.deleted ? 'delete' : 'update',
      targetType: 'bookmark',
      targetId: body.data.ids[0],
      detail: JSON.stringify({ ids: body.data.ids }),
      revertToken: JSON.stringify({ kind: 'batch', snapshots }),
    }) as { id: string }
    return c.json({ updated: result.updated.map(serializeBookmark), skipped: result.skipped, undoId: log.id })
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
    if (input.data.version !== undefined && (existing as any).version !== input.data.version) {
      return c.json({
        error: { code: 'CONFLICT' as const, message: 'Version conflict', details: { currentVersion: (existing as any).version } },
      }, 409)
    }
    const { confirmStructure: _confirmStructure, version: _version, ...changes } = input.data
    const updated = await repository.update(c.req.param('bookmarkId'), changes)
    if (!updated) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    await repository.operationLog.append({ actor: 'user', action: 'update', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json(serializeBookmark(updated))
  })

  app.delete('/api/bookmarks/:bookmarkId', async (c) => {
    const deleted = await repository.softDelete(c.req.param('bookmarkId'))
    if (!deleted) return c.json({ ok: true, deletedAt: null, undoId: null })
    const log = await repository.operationLog.append({
      actor: 'user',
      action: 'delete',
      targetType: 'bookmark',
      targetId: c.req.param('bookmarkId'),
      revertToken: JSON.stringify({ kind: 'undelete', ids: [c.req.param('bookmarkId')] }),
    }) as { id: string }
    return c.json({ ok: true, deletedAt: timestamp((deleted as any).deletedAt), undoId: log.id })
  })

  app.get('/api/recycle-bin', async (c) => {
    const query = paginationQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor } = query.data
    const result = await repository.listRecycleBin(limit, cursor)
    return c.json({ items: result.items.map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/recycle-bin/:bookmarkId/restore', async (c) => {
    const restored = await repository.restore(c.req.param('bookmarkId'))
    if (!restored) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    await repository.operationLog.append({ actor: 'user', action: 'restore', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json({ ok: true, bookmark: serializeBookmark(restored) })
  })

  app.delete('/api/recycle-bin/:bookmarkId', async (c) => {
    const count = await repository.purgeDeleted([c.req.param('bookmarkId')])
    if (!count) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    await repository.operationLog.append({ actor: 'user', action: 'purge', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json({ ok: true })
  })

  app.post('/api/recycle-bin/empty', async (c) => {
    const body = recycleBinEmptyRequestSchema.safeParse(await c.req.json().catch(() => ({})))
    const onlyExpired = body.success ? body.data.onlyExpired : true
    let before: Date | undefined
    if (onlyExpired !== false) {
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

  app.get('/api/bookmarks/:bookmarkId/suggestions', async (c) => {
    const result = await repository.suggestions.list(c.req.param('bookmarkId'), c.req.query('status'))
    return c.json({ items: result.items, nextCursor: result.nextCursor })
  })
  for (const action of ['accept', 'defer', 'dismiss'] as const) app.post(`/api/suggestions/:id/${action}`, async (c) => {
    const result = action === 'accept' ? await repository.suggestions.accept(c.req.param('id'), 'user') : await repository.suggestions.resolve(c.req.param('id'), action === 'defer' ? 'deferred' : 'dismissed')
    if (!result) return skillError(c, 'NOT_FOUND', 404, 'Suggestion not found')
    if (action !== 'accept') await repository.operationLog.append({ actor: 'user', action: action === 'dismiss' ? 'dismiss_suggestion' : 'update', targetType: 'suggestion', targetId: c.req.param('id') })
    return c.json({ ok: true, suggestion: result })
  })

  app.get('/api/operation-log', async (c) => c.json({ items: await repository.operationLog.list({ actor: c.req.query('actor'), action: c.req.query('action') }), nextCursor: null }))
  app.post('/api/operation-log/:id/revert', async (c) => {
    const row = await repository.operationLog.consumeRevert(c.req.param('id')) as { revertToken?: string | null } | undefined
    if (!row?.revertToken) return skillError(c, 'CONFLICT', 409, 'Nothing to undo')
    let payload: { kind?: string; ids?: string[]; snapshots?: Array<{ id: string; status: string; folderId: string | null; deleted: boolean }> }
    try {
      payload = JSON.parse(row.revertToken)
    } catch {
      return invalidRequest(c)
    }
    if (payload.kind === 'undelete') {
      for (const id of payload.ids ?? []) await repository.restore(id)
    } else if (payload.kind === 'batch') {
      for (const snapshot of payload.snapshots ?? []) {
        if (snapshot.deleted) continue
        await repository.restore(snapshot.id)
        await repository.update(snapshot.id, { status: snapshot.status, folderId: snapshot.folderId })
      }
    } else {
      return invalidRequest(c)
    }
    return c.json({ ok: true })
  })

  app.route('/api/channels', createChannelRoutes(repository))
  app.route('/api/archive', createArchiveRoutes(repository))
  app.route('/api/backup', createBackupRoutes(repository, options.dbPath))
  app.route('/api/metadata', createMetadataRoutes())
  app.route('/api/nav', createNavRoutes(repository))

  app.get('/api/settings', async (c) => {
    const rows = await repository.settings.list() as { key: string; value: unknown; updatedAt?: unknown }[]
    const items = rows.filter((row) => !row.key.includes('token') && !row.key.includes('password') && row.key !== 'skill.token_hash')
    return c.json({ items })
  })
  app.put('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined
    if (!body) return invalidRequest(c)
    const validated = settingsWhitelistSchema.safeParse(body)
    if (!validated.success) return invalidRequest(c, validated.error.flatten())
    const entries = Object.entries(validated.data).filter(([key]) => !key.includes('token') && !key.includes('password'))
    const items = await Promise.all(entries.map(([key, value]) => repository.settings.set(key, value)))
    return c.json({ items })
  })
  app.get('/api/jobs', async (c) => c.json({ items: await repository.archiveJobs.list(c.req.query('bookmarkId')), nextCursor: null }))
  app.post('/api/jobs/:id/retry', async (c) => {
    const currentStatus = await repository.archiveJobs.getStatus(c.req.param('id'))
    if (!currentStatus) return skillError(c, 'NOT_FOUND', 404, 'Job not found')
    if (currentStatus !== 'failed') {
      return c.json({ error: { code: 'CONFLICT' as const, message: 'Only failed jobs can be retried' } }, 409)
    }
    return c.json(await repository.archiveJobs.update(c.req.param('id'), { status: 'pending' }))
  })
  app.post('/api/jobs/:id/cancel', async (c) => {
    const currentStatus = await repository.archiveJobs.getStatus(c.req.param('id'))
    if (!currentStatus) return skillError(c, 'NOT_FOUND', 404, 'Job not found')
    if (!['pending', 'running'].includes(currentStatus)) {
      return c.json({ error: { code: 'CONFLICT' as const, message: 'Only pending or running jobs can be cancelled' } }, 409)
    }
    return c.json(await repository.archiveJobs.update(c.req.param('id'), { status: 'cancelled' }))
  })
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
    if (!await repository.get(bookmarkId, true)) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const body = await c.req.json().catch(() => ({})) as { source?: string; client?: string }
    const source = body.source === 'snapshot' ? 'snapshot' : 'original'
    const client = ['workbench', 'navigation', 'plugin', 'unknown'].includes(body.client ?? '') ? body.client : 'workbench'
    const record = await repository.createAccessRecord({ id: randomUUID(), bookmarkId, source, client })
    return c.json(serializeAccessRecord(record), 201)
  })

  app.get('/api/bookmarks/:bookmarkId/access-records', async (c) => {
    const records = await repository.listAccessRecords(c.req.param('bookmarkId'))
    return c.json({ records: records.map(serializeAccessRecord) })
  })

  app.get('/api/bookmarks/:bookmarkId/export/html', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    if (!record) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const anyRecord = record as Record<string, any>
    const title = anyRecord.title || anyRecord.url || 'bookmark'
    const domain = anyRecord.domain || ''
    const createdAt = anyRecord.createdAt ? new Date(anyRecord.createdAt instanceof Date ? anyRecord.createdAt.getTime() : Number(anyRecord.createdAt)).toISOString() : ''
    const author = anyRecord.author || ''
    const note = anyRecord.note || ''
    const url = anyRecord.url || ''
    const excerpt = anyRecord.excerpt || ''
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="author" content="${escapeHtml(author)}">
  <meta name="description" content="${escapeHtml(excerpt)}">
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    a { color: #0066cc; }
    .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h1>
  <div class="meta">
    <p>来源: ${escapeHtml(domain)}</p>
    <p>保存时间: ${escapeHtml(createdAt)}</p>
    ${author ? `<p>作者: ${escapeHtml(author)}</p>` : ''}
    ${note ? `<div><h2>备注</h2><p>${escapeHtml(note)}</p></div>` : ''}
  </div>
</body>
</html>`
    return c.newResponse(html, 200, { 'Content-Type': 'text/html; charset=utf-8' })
  })

  app.get('/api/bookmarks/:bookmarkId/export/markdown', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    if (!record) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const anyRecord = record as Record<string, any>
    const title = anyRecord.title || anyRecord.url || 'bookmark'
    const url = anyRecord.url || ''
    const domain = anyRecord.domain || ''
    const createdAt = anyRecord.createdAt ? new Date(anyRecord.createdAt instanceof Date ? anyRecord.createdAt.getTime() : Number(anyRecord.createdAt)).toISOString() : ''
    const author = anyRecord.author || ''
    const note = anyRecord.note || ''
    const md = `# [${title}](${url})

- 来源: ${domain}
- 保存时间: ${createdAt}
${author ? `- 作者: ${author}` : ''}
${note ? `\n## 备注\n\n${note}` : ''}
`
    return c.newResponse(md, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  })

  const configuredSkillToken = options.skillToken ?? process.env.DOGEAR_SKILL_TOKEN ?? ''
  const limits = { read: options.rateLimits?.read ?? 60, write: options.rateLimits?.write ?? 30, batch: options.rateLimits?.batch ?? 10 }
  const usage = { read: 0, write: 0, batch: 0 }
  const capabilities = { read: true, write_new: true, update_existing: false }
  const skillLimit = (name: string): SkillLimit => name === 'update_bookmark' ? 'batch' : ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene'].includes(name) ? 'read' : 'write'
  const skillCapability = (name: string) => name === 'update_bookmark' ? 'update_existing' : ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene'].includes(name) ? 'read' : 'write_new'
  const skillRouteNames = new Set(skillDefinitions.map((skill) => skill.name))
  const requireSkill = async (c: any, next: any) => {
    const name = c.req.param('name')
    if (!name || !skillRouteNames.has(name)) return next()
    const authorization = c.req.header('Authorization')
    if (!configuredSkillToken || authorization !== `Bearer ${configuredSkillToken}`) return skillError(c, 'UNAUTHORIZED', 401, 'Unauthorized')
    const configured = repository.settings && typeof repository.settings.get === 'function' ? await repository.settings.get('skill.capabilities') : undefined
    let configuredCapabilities = capabilities
    if (configured && typeof configured === 'object' && 'value' in configured) {
      try { configuredCapabilities = JSON.parse(String((configured as { value: unknown }).value)) } catch { configuredCapabilities = capabilities }
    }
    const capability = skillCapability(name) as keyof typeof capabilities
    if (!configuredCapabilities[capability]) {
      await repository.skillUsage.increment('blocked')
      return skillError(c, 'CAPABILITY_DISABLED', 403, 'Skill capability is disabled')
    }
    const limit = skillLimit(name)
    usage[limit] += 1
    if (usage[limit] > limits[limit]) {
      await repository.skillUsage.increment('blocked')
      return skillError(c, 'RATE_LIMITED', 429, 'Skill rate limit exceeded')
    }
    const bucket = limit === 'read' ? 'read' : 'write'
    await repository.skillUsage.increment(bucket)
    await next()
  }

  app.get('/.well-known/capabilities', (c) => c.json({ name: 'DogEar', version: 'v1', auth: 'Bearer token', skills: skillDefinitions }))
  app.use('/api/skill/:name', requireSkill)

  app.put('/api/skill/capabilities', async (c) => {
    const body = skillCapabilitiesBodySchema.safeParse(await jsonBody(c))
    if (!body.success) return invalidRequest(c, body.error.flatten())
    await repository.settings.set('skill.capabilities', body.data)
    return c.json(body.data)
  })

  app.get('/api/skill/usage', async (c) => {
    const today = new Date().toISOString().split('T')[0]
    const usage = await repository.skillUsage.getDaily(today)
    return c.json({ date: today, requests: usage.read, writes: usage.write, blocked: usage.blocked })
  })

  app.post('/api/skill/save_bookmark', async (c) => {
    const input = saveBookmarkSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    await repository.skillUsage.increment('write')
    const idempotencyKey = c.req.header('Idempotency-Key')
    const actor = 'agent'
    if (idempotencyKey) {
      const replay = await repository.idempotency.findReplay(idempotencyKey, actor)
      if (replay) {
        const keyEntry = (await repository.get(JSON.parse(replay.responseBody).id))
        return c.json({ bookmark: serializeBookmark(keyEntry ?? {}), idempotent: true, replay: true }, 201)
      }
    }
    const id = randomUUID()
    const record = await repository.create({ id, url: input.data.url, status: 'unread', source: 'agent', note: input.data.note, intent: input.data.intent, syncStatus: 'synced' })
    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await repository.idempotency.store({
        key: idempotencyKey, actor,
        requestPath: c.req.path, requestBodyHash: '',
        statusCode: 201, responseBody: JSON.stringify(record),
        expiresAt, createdAt: new Date(),
      })
    }
    const saved = { ...serializeBookmark(record), snapshotStatus: 'not_requested', suggestions: [] }
    if (input.data.snapshot && repository.archiveJobs) {
      const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: saved.id, source: 'agent', type: 'snapshot' }) as any
      saved.snapshotStatus = 'queued_pending_browser'
      saved.jobId = job.id
    }
    if (repository.operationLog) await repository.operationLog.append({ actor: 'agent', action: 'save_bookmark', targetType: 'bookmark', targetId: saved.id })

    // Async metadata extraction - don't block the response
    const savedId = saved.id
    const savedUrl = saved.url
    Promise.resolve().then(async () => {
      try {
        const meta = await extractMetadata(savedUrl)
        const updates: Record<string, unknown> = {}
        if (meta.title) updates.title = meta.title
        if (meta.description) updates.excerpt = meta.description
        if (meta.image) updates.cover = meta.image
        if (meta.author) updates.author = meta.author
        if (meta.domain) updates.domain = meta.domain
        if (meta.favicon) updates.favicon = meta.favicon
        if (meta.publishedAt) {
          const d = new Date(meta.publishedAt)
          if (!Number.isNaN(d.getTime())) updates.publishedAt = d.getTime()
        }
        if (Object.keys(updates).length > 0) {
          await repository.update(savedId, updates)
        }
      } catch {
        // Metadata extraction failed silently - partial metadata is fine
      }
    })

    return c.json(saved, 201)
  })

  app.post('/api/skill/search_bookmarks', async (c) => {
    const input = searchBookmarksSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const filters = { ...(input.data.filters ?? {}), q: input.data.query, includeDeleted: false }
    const result = await repository.search(filters, input.data.limit)
    return c.json({ items: result.items.filter((item: any) => input.data.filters?.includePrivate || !item.private).map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/skill/list_bookmarks', async (c) => {
    const input = listBookmarksSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const result = await repository.list({ ...input.data, includeDeleted: false }, input.data.limit)
    return c.json({ items: result.items.filter((item: any) => !item.private).map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/skill/get_stats', async (c) => {
    const input = getStatsSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const result = await repository.list()
    const statuses = Object.fromEntries(['unread', 'saved', 'archived'].map((status) => [status, result.items.filter((item: any) => item.status === status).length]))
    return c.json({ total: result.items.length, inbox: statuses.unread, statuses, scenes: [] })
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
