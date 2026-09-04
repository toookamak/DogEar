import type { BookmarkRepository } from '@dogear/db'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'csv-stringify'
import { pipeline } from 'node:stream/promises'

export type BackupTier = 'light' | 'medium' | 'full'
export type BackupTarget = 'local' | 's3' | 'webdav'

export class BackupService {
  constructor(private repository: BookmarkRepository) {}

  async createBackup(tier: BackupTier, target: BackupTarget): Promise<any> {
    const id = randomUUID()
    const includes = this.getIncludedContent(tier)
    const record = await this.repository.backups.create({ id, tier, target, includes: JSON.stringify(includes) })

    // Run backup asynchronously
    Promise.resolve().then(async () => {
      try {
        await this.repository.backups.updateStatus(id, 'running')
        const result = await this.performBackup(tier, target, id)
        await this.repository.backups.updateStatus(id, 'completed', {
          filePath: result.filePath,
          fileSize: result.fileSize,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        await this.repository.backups.updateStatus(id, 'failed', { error: errorMessage })
      }
    })

    return record
  }

  async listBackups(): Promise<unknown[]> {
    return this.repository.backups.list(20)
  }

  async getBackup(id: string): Promise<unknown | undefined> {
    return this.repository.backups.get(id)
  }

  private getIncludedContent(tier: BackupTier): string[] {
    switch (tier) {
      case 'light':
        return ['bookmarks:csv']
      case 'medium':
        return ['bookmarks:csv', 'settings']
      case 'full':
        return ['database:full']
    }
  }

  private async performBackup(tier: BackupTier, target: BackupTarget, backupId: string): Promise<{ filePath: string; fileSize: number }> {
    // For now, only local backup is implemented
    const backupDir = join(process.cwd(), 'backups')
    await mkdir(backupDir, { recursive: true })

    if (tier === 'light') {
      return this.createLightBackup(backupDir, backupId)
    } else if (tier === 'medium') {
      return this.createMediumBackup(backupDir, backupId)
    } else {
      return this.createFullBackup(backupDir, backupId)
    }
  }

  private async createLightBackup(backupDir: string, backupId: string): Promise<{ filePath: string; fileSize: number }> {
    const filePath = join(backupDir, `${backupId}-bookmarks.csv`)
    const result = await this.repository.list({}, 10000)
    const bookmarks = result.items

    const csvData = bookmarks.map((b: any) => ({
      id: b.id,
      url: b.url,
      title: b.title ?? '',
      note: b.note ?? '',
      status: b.status,
      tags: (b.tags || []).map((t: any) => t.name).join('|'),
      scenes: (b.scenes || []).map((s: any) => s.name).join('|'),
      createdAt: b.createdAt?.getTime() ?? Date.now(),
    }))

    const output = createWriteStream(filePath)
    await pipeline(stringify(csvData, { header: true, columns: ['id', 'url', 'title', 'note', 'status', 'tags', 'scenes', 'createdAt'] }), output)

    const stat = await import('node:fs/promises').then(fs => fs.stat(filePath))
    return { filePath, fileSize: stat.size }
  }

  private async createMediumBackup(backupDir: string, backupId: string): Promise<{ filePath: string; fileSize: number }> {
    const light = await this.createLightBackup(backupDir, backupId)
    const settingsRows = await this.repository.settings.list() as { key: string; value: unknown }[]
    const settings = Object.fromEntries(
      settingsRows
        .filter((row) => !row.key.includes('token') && !row.key.includes('password'))
        .map((row) => [row.key, row.value]),
    )
    const filePath = join(backupDir, `${backupId}-medium.json`)
    const { writeFile, stat } = await import('node:fs/promises')
    const { readFile } = await import('node:fs/promises')
    const csv = await readFile(light.filePath, 'utf8')
    await writeFile(filePath, JSON.stringify({ includes: ['bookmarks:csv', 'settings'], csv, settings }, null, 2))
    const info = await stat(filePath)
    return { filePath, fileSize: info.size }
  }

  private async createFullBackup(backupDir: string, backupId: string): Promise<{ filePath: string; fileSize: number }> {
    const dbPath = process.env.DOGEAR_DB_PATH ?? process.env.DOGEAR_DATABASE_PATH
    if (!dbPath) {
      throw new Error('DOGEAR_DB_PATH or DOGEAR_DATABASE_PATH is required for full backup')
    }

    const { copyFile, stat } = await import('node:fs/promises')
    const filePath = join(backupDir, `${backupId}-full.db`)
    await copyFile(dbPath, filePath)
    const stats = await stat(filePath)
    return { filePath, fileSize: stats.size }
  }
}
