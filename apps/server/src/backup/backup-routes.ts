import { Hono } from 'hono'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { BookmarkRepository } from '@dogear/db'
import { backupRestoreRequestSchema, exportZipQuerySchema } from '@dogear/shared'
import { BackupRestoreError, BackupService, parseCsv } from './backup-service.js'

export function createBackupRoutes(repository: BookmarkRepository, dbPath?: string) {
  const app = new Hono()
  const backupService = new BackupService(repository, dbPath)

  /** 上传上限（用户拍板）：25MB，足够多年量级的 CSV/ZIP 导出包 */
  const IMPORT_MAX_BYTES = 25 * 1024 * 1024

  /** 按范围导出的 query（v1.15，§4.6.2）：与列表筛选同语义，加性且向后兼容 */

  /** 本地导出 ZIP（备份设计 §3.1）：bookmarks.csv + meta.json，浏览器下载；v1.15 支持按范围 */
  app.get('/export-zip', async (c) => {
    const query = exportZipQuerySchema.safeParse(c.req.query())
    if (!query.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid export filters' } }, 400)
    }
    const { status, folderId, tagId, createdFrom, createdTo } = query.data
    const result = await backupService.exportZip({
      status,
      folderId: folderId === 'none' ? 'none' : folderId,
      tagId,
      createdFrom,
      createdTo,
    })
    return c.body(result.bytes as unknown as ArrayBuffer, 200, {
      'Content-Disposition': `attachment; filename="${result.name}"`,
      'Content-Type': 'application/zip',
    })
  })

  /**
   * 本地导入（备份设计 §3.2）：multipart 上传 CSV / ZIP，全量替换书签表。
   * 保护与恢复一致：显式 confirm + 导入前自动创建回滚点备份（BackupService.importRows）。
   * ZIP 中的 snapshots/ 本轮跳过（快照存储待 L3），回执里如实报告 skippedSnapshots。
   */
  app.post('/import', async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'multipart field "file" is required' } }, 400)
    }
    if (file.size > IMPORT_MAX_BYTES) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `文件过大（上限 ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)}MB）` } }, 400)
    }
    if (body.confirm !== 'true') {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Import requires explicit confirm=true（当前书签将被替换；系统会先自动创建回滚点备份）' } }, 400)
    }

    const name = file.name.toLowerCase()
    let csv: string
    let skippedSnapshots = 0
    try {
      if (name.endsWith('.zip')) {
        const { unzipSync, strFromU8 } = await import('fflate')
        const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
        const csvEntry = Object.entries(entries).find(([path, data]) =>
          path.split('/').pop() === 'bookmarks.csv' && data.length > 0)
        if (!csvEntry) {
          return c.json({ error: { code: 'BAD_BACKUP', message: 'ZIP 里没有找到 bookmarks.csv' } }, 400)
        }
        csv = strFromU8(csvEntry[1])
        skippedSnapshots = Object.keys(entries).filter((path) => path.includes('snapshots/')).length
      } else {
        csv = await file.text()
      }
    } catch (e) {
      return c.json({ error: { code: 'BAD_BACKUP', message: `无法读取文件：${e instanceof Error ? e.message : String(e)}` } }, 400)
    }

    const rows = parseCsv(csv)
    if (rows.length === 0) {
      return c.json({ error: { code: 'BAD_BACKUP', message: '文件里没有可导入的书签行' } }, 400)
    }
    const result = await backupService.importRows(rows, `本地导入 ${file.name}`)
    return c.json({ ...result, skippedSnapshots, sourceFile: file.name })
  })

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

  /**
   * 从备份恢复书签表（全量替换），见 docs/modules/20260904_备份功能设计.md §2.8。
   * 破坏性操作：恢复前会自动做一次全量备份作为回滚点；`full` 档明确拒绝（见服务层说明）。
   */
  app.post('/:id/restore', async (c) => {
    const parsed = backupRestoreRequestSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request: restore requires explicit {"confirm": true}',
        },
      }, 400)
    }
    try {
      const result = await backupService.restoreFromBackup(c.req.param('id'))
      return c.json(result)
    } catch (err) {
      if (err instanceof BackupRestoreError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'NOT_SUPPORTED' ? 501 : 409
        return c.json({ error: { code: err.code, message: err.message } }, status)
      }
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: { code: 'INTERNAL_ERROR', message } }, 500)
    }
  })

  return app
}
