import { Hono } from 'hono'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { BookmarkRepository } from '@dogear/db'
import { BackupService } from './backup-service.js'

export function createBackupRoutes(repository: BookmarkRepository) {
  const app = new Hono()
  const backupService = new BackupService(repository)

  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const tier = body.tier ?? 'light'
    const target = body.target ?? 'local'
    const result = await backupService.createBackup(tier, target)
    return c.json(result, 201)
  })

  app.get('/', async (c) => {
    const backups = await backupService.listBackups()
    return c.json({ items: backups })
  })

  app.get('/:id/download', async (c) => {
    const backup = await backupService.getBackup(c.req.param('id')) as { status?: string; filePath?: string | null } | undefined
    if (!backup) return c.json({ error: { code: 'NOT_FOUND', message: 'Backup not found' } }, 404)
    if (backup.status !== 'completed' || !backup.filePath) {
      return c.json({ error: { code: 'CONFLICT', message: 'Backup file is not ready' } }, 409)
    }
    try {
      await stat(backup.filePath)
    } catch {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Backup file is missing' } }, 404)
    }
    const name = basename(backup.filePath)
    const bytes = await readFile(backup.filePath)
    return c.body(bytes, 200, {
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Type': name.endsWith('.csv') ? 'text/csv; charset=utf-8' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    })
  })

  app.get('/:id', async (c) => {
    const backup = await backupService.getBackup(c.req.param('id'))
    if (!backup) return c.json({ error: { code: 'NOT_FOUND', message: 'Backup not found' } }, 404)
    return c.json(backup)
  })

  return app
}
