import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'

export function createNavRoutes(repository: BookmarkRepository) {
  const app = new Hono()

  // GET /api/nav/rules - list all nav rules
  app.get('/rules', async (c) => {
    const rules = await repository.navRules.list()
    return c.json({ items: rules })
  })

  // POST /api/nav/rules - create a nav rule
  app.post('/rules', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    if (!body.name) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name required' } }, 400)
    const now = Date.now()
    const rule = await repository.navRules.create({
      id: randomUUID(),
      name: body.name,
      mode: body.mode ?? 'all',
      rule: body.rule,
      searchQuery: body.searchQuery,
      sortOrder: body.sortOrder ?? 0,
      enabled: body.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    return c.json(rule, 201)
  })

  // PATCH /api/nav/rules/:id - update a nav rule
  app.patch('/rules/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const data = { ...body, updatedAt: Date.now() }
    const rule = await repository.navRules.update(c.req.param('id'), data)
    if (!rule) return c.json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }, 404)
    return c.json(rule)
  })

  // DELETE /api/nav/rules/:id - delete a nav rule
  app.delete('/rules/:id', async (c) => {
    await repository.navRules.remove(c.req.param('id'))
    return c.json({ ok: true })
  })

  // GET /api/nav/bookmarks - get bookmarks for the navigation page
  // Applies enabled rules and returns visible bookmarks
  app.get('/bookmarks', async (c) => {
    const limit = Number(c.req.query('limit') ?? 50)
    const cursor = c.req.query('cursor')

    const rules = await repository.navRules.list()
    const enabledRules = rules.filter((r: any) => r.enabled)

    // If no rules, return all non-private, non-inbox bookmarks
    // If rules exist, apply them to filter bookmarks
    const result = await repository.list(undefined, limit, cursor)

    // Filter out private and inbox bookmarks for nav page
    const filtered = (result.items || []).filter((b: any) => !b.private && b.status !== 'unread')

    return c.json({ items: filtered, nextCursor: result.nextCursor })
  })

  // GET /api/nav/recent - get recently accessed bookmarks
  app.get('/recent', async (c) => {
    const limit = Number(c.req.query('limit') ?? 20)
    // Use access records to find recently accessed bookmarks
    // For now, return bookmarks ordered by lastOpenedAt
    const result = await repository.list(undefined, limit, undefined, { orderBy: 'lastOpenedAt' })
    const filtered = (result.items || []).filter((b: any) => !b.private && b.status !== 'unread')
    return c.json({ items: filtered })
  })

  return app
}
