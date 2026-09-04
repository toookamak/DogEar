import { createBookmarkInputSchema, loginRequestSchema } from '@dogear/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { BookmarkRepository } from '@dogear/db'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const sessionCookie = 'dogear_session'
const user = { id: 'user' }

type AppOptions = {
  password?: string
  sessionTtlSeconds?: number
  now?: () => number
}

function unauthorized(c: { json: (body: unknown, status: 401) => Response }) {
  return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
}

function invalidRequest(c: { json: (body: unknown, status: 400) => Response }) {
  return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }, 400)
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

  return app
}
