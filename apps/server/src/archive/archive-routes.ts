import { Hono } from 'hono'
import type { BookmarkRepository } from '@dogear/db'
import { ArchiveJobService } from './archive-service.js'

export function createArchiveRoutes(repository: BookmarkRepository) {
  const app = new Hono()
  const archiveService = new ArchiveJobService(repository)

  // POST /api/archive - create a new archive job
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const bookmarkId = body.bookmarkId
    const type = body.type ?? 'snapshot'
    if (!bookmarkId) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'bookmarkId required' } }, 400)
    if (type === 'reader') return c.json({ error: { code: 'NOT_SUPPORTED', message: 'Reader archive is not supported' } }, 400)
    if (!await repository.get(bookmarkId)) return c.json({ error: { code: 'NOT_FOUND', message: 'Bookmark not found' } }, 404)
    const job = await archiveService.createJob(bookmarkId, type)
    return c.json({ jobId: job.id, snapshotStatus: 'queued_pending_browser' }, 201)
  })

  app.get('/bookmark/:bookmarkId', async (c) => {
    const jobs = await archiveService.getJobsByBookmark(c.req.param('bookmarkId'))
    return c.json({ items: jobs })
  })

  app.get('/:id', async (c) => {
    const job = await archiveService.getJob(c.req.param('id'))
    if (!job) return c.json({ error: { code: 'NOT_FOUND', message: 'Job not found' } }, 404)
    return c.json(job)
  })

  // POST /api/archive/:id/retry - retry a failed job
  app.post('/:id/retry', async (c) => {
    try {
      const job = await archiveService.retryJob(c.req.param('id'))
      return c.json({ ok: true, job })
    } catch (e) {
      return c.json({ error: { code: 'CONFLICT', message: e instanceof Error ? e.message : 'Retry failed' } }, 409)
    }
  })

  // POST /api/archive/:id/cancel - cancel a job
  app.post('/:id/cancel', async (c) => {
    try {
      const job = await archiveService.cancelJob(c.req.param('id'))
      return c.json({ ok: true, job })
    } catch (e) {
      return c.json({ error: { code: 'CONFLICT', message: e instanceof Error ? e.message : 'Cancel failed' } }, 409)
    }
  })

  return app
}