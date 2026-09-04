import { Hono } from 'hono'
import type { BookmarkRepository } from '@dogear/db'
import { BackupService } from './backup-service.js'

export function createBackupRoutes(repository: BookmarkRepository) {
  const app = new Hono()
  const backupService = new BackupService(repository)

  // POST /api/backup - create a backup
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const tier = body.tier ?? 'light'
    const target = body.target ?? 'local'
    const result = await backupService.createBackup(tier, target)
    return c.json(result)
  })

  // GET /api/backup - list backups
  app.get('/', async (c) => {
    const backups = await backupService.listBackups()
    return c.json({ items: backups })
  })

  // GET /api/backup/:id - get backup details
  app.get('/:id', async (c) => {
    const backup = await backupService.getBackup(c.req.param('id'))
    if (!backup) return c.json({ error: { code: 'NOT_FOUND', message: 'Backup not found' } }, 404)
    return c.json(backup)
  })

  return app
}