import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'

function toNavItem(bookmark: Record<string, unknown>) {
  return {
    id: bookmark.id,
    title: bookmark.title ?? null,
    favicon: bookmark.favicon ?? null,
    url: bookmark.url,
    domain: bookmark.domain ?? null,
  }
}

function asRecord(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {}
  const record = row as Record<string, unknown>
  if (record.bookmarks && typeof record.bookmarks === 'object') return record.bookmarks as Record<string, unknown>
  return record
}

export function createNavRoutes(repository: BookmarkRepository) {
  const app = new Hono()

  app.get('/rules', async (c) => {
    const rules = await repository.navRules.list()
    return c.json({ items: rules })
  })

  app.post('/rules', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
    if (!body.name || typeof body.name !== 'string') {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name required' } }, 400)
    }
    const now = new Date()
    const rule = await repository.navRules.create({
      id: randomUUID(),
      name: body.name,
      mode: typeof body.mode === 'string' ? body.mode : 'all',
      rule: typeof body.rule === 'string' ? body.rule : body.rule ? JSON.stringify(body.rule) : undefined,
      searchQuery: typeof body.searchQuery === 'string' ? body.searchQuery : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    })
    return c.json(rule, 201)
  })

  app.patch('/rules/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const data = { ...body, updatedAt: new Date() }
    const rule = await repository.navRules.update(c.req.param('id'), data)
    if (!rule) return c.json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }, 404)
    return c.json(rule)
  })

  app.delete('/rules/:id', async (c) => {
    await repository.navRules.remove(c.req.param('id'))
    return c.json({ ok: true })
  })

  app.get('/bookmarks', async (c) => {
    const limit = Number(c.req.query('limit') ?? 50)
    const cursor = c.req.query('cursor') || undefined
    const result = await repository.list({ private: false, excludeStatus: 'unread' }, Number.isFinite(limit) ? limit : 50, cursor)
    return c.json({
      items: (result.items || []).map((row) => toNavItem(asRecord(row))),
      nextCursor: result.nextCursor,
    })
  })

  app.get('/recent', async (c) => {
    const limit = Number(c.req.query('limit') ?? 20)
    const items = await repository.listRecentOpened(Number.isFinite(limit) ? limit : 20)
    return c.json({ items: items.map((row) => toNavItem(asRecord(row))) })
  })

  return app
}
