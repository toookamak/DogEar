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
        return ['bookmarks:csv', 'snapshots']
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
    // Medium backup: CSV plus any snapshot files
    // For now, just do the CSV backup since snapshot handling needs more infrastructure
    // In future, this would include copying snapshot files to backup
    return this.createLightBackup(backupDir, backupId)
  }

  private async createFullBackup(backupDir: string, backupId: string): Promise<{ filePath: string; fileSize: number }> {
    // Full backup: copy the entire database file
    // This works for SQLite (track B), for D1 (track A) this would need to dump all tables
    const dbPath = process.env.DOGEAR_DATABASE_PATH
    if (!dbPath) {
      throw new Error('DOGEAR_DATABASE_PATH environment variable is required for full backup')
    }

    const { copyFile, stat } = await import('node:fs/promises')
    const filePath = join(backupDir, `${backupId}-full.db`)
    await copyFile(dbPath, filePath)
    const stats = await stat(filePath)
    return { filePath, fileSize: stats.size }
  }
}
