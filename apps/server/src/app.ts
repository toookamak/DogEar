import { createBookmarkInputSchema } from '@dogear/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { BookmarkRepository } from '@dogear/db'
import { randomUUID } from 'node:crypto'

export function createApp(repository: BookmarkRepository) {
  const app = new Hono()
  app.use('/api/*', cors())

  app.get('/health', (c) => c.json({ ok: true }))

  app.get('/api/bookmarks', async (c) => {
    const records = await repository.list()
    return c.json(records)
  })

  app.post('/api/bookmarks', async (c) => {
    const input = createBookmarkInputSchema.safeParse(await c.req.json())
    if (!input.success) return c.json({ error: 'Invalid bookmark input' }, 400)
    const record = await repository.create({ id: randomUUID(), url: input.data.url, status: 'unread' })
    return c.json(record, 201)
  })

  return app
}
