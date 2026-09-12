import type { BookmarkRepository } from '@dogear/db'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'csv-stringify'
import { pipeline } from 'node:stream/promises'

export type BackupTier = 'light' | 'medium' | 'full'
export type BackupTarget = 'local' | 's3' | 'webdav'

/** 恢复失败时用带 code 的错误，便于路由映射成正确的 HTTP 状态 */
export class BackupRestoreError extends Error {
  constructor(public code: 'NOT_FOUND' | 'CONFLICT' | 'NOT_SUPPORTED' | 'BAD_BACKUP', message: string) {
    super(message)
    this.name = 'BackupRestoreError'
  }
}

export type RestoreResult = {
  ok: true
  restored: number
  removed: number
  createdTags: number
  createdScenes: number
  rollbackBackupId: string | null
}

export class BackupService {
  constructor(private repository: BookmarkRepository, private dbPath?: string) {}

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

  /**
   * 从备份恢复书签表（`docs/modules/20260904_备份功能设计.md` §2.8）。
   *
   * 语义为**全量替换**：用备份中的 CSV 覆盖当前书签表，而非增量合并。
   * 因此流程里包含两道保护：
   *   1. 恢复前**先做一次全量备份**作为回滚点（做不出来就拒绝恢复，不冒险）
   *   2. 复用 CSV 里的书签 id，使恢复后的身份与原记录一致（操作日志、访问记录仍可对应）
   *
   * `full` 档是数据库文件副本，恢复它等于替换正在被运行时持有的库文件，
   * 服务运行中无法安全完成，故明确拒绝并给出替代做法——不假装支持。
   */
  async restoreFromBackup(id: string): Promise<RestoreResult> {
    const backup = await this.repository.backups.get(id) as
      { tier?: string; status?: string; filePath?: string | null } | undefined
    if (!backup) throw new BackupRestoreError('NOT_FOUND', 'Backup not found')
    if (backup.status !== 'completed' || !backup.filePath) {
      throw new BackupRestoreError('CONFLICT', 'Backup is not completed or has no file')
    }
    if (backup.tier === 'full') {
      throw new BackupRestoreError(
        'NOT_SUPPORTED',
        'Restoring a full database file is not supported while the server is running. '
        + 'Stop the server and replace the SQLite file manually, or restore from a light/medium backup (CSV).',
      )
    }

    const rows = await this.readBackupRows(backup.tier, backup.filePath)
    return this.replaceBookmarksWithRows(rows, `备份 ${id}`)
  }

  /**
   * 本地导入（备份设计 §3.2）：把解析出的书签 CSV 行**全量替换**进真源。
   * 与 restoreFromBackup 共用同一套替换与回滚点保护；来源只影响日志文案。
   */
  async importRows(rows: BackupRow[], source: string): Promise<RestoreResult> {
    return this.replaceBookmarksWithRows(rows, source)
  }

  /**
   * 全量替换的公共主体：回滚点（做不出来就整体放弃）→ 软删 + purge → 按 CSV 行重建
   * （复用行内 id 保持身份一致；标签/场景按名字查找或创建）。
   */
  private async replaceBookmarksWithRows(rows: BackupRow[], source: string): Promise<RestoreResult> {
    // 回滚点：先落盘一份全量备份。失败则整体放弃，避免「替换了却无法回退」。
    const rollbackBackupId = await this.createBackupNow('full', 'local')

    // 全量替换：先把现有书签软删再彻底删除（软删是既有语义，purge 会连带清掉
    // 场景/标签挂载、建议与访问记录），然后按 CSV 重建。
    const existing = await this.repository.list({}, 100000)
    const existingIds = (existing.items as { id: string }[]).map((row) => row.id)
    for (const bookmarkId of existingIds) await this.repository.softDelete(bookmarkId)
    const removed = await this.repository.purgeDeleted()

    // 归属按名字还原：标签用 nameKey 查找或创建，场景按名字匹配或创建
    const tagIdByNameKey = new Map<string, string>()
    for (const tag of await this.repository.tags.list() as { id: string; nameKey?: string; name: string }[]) {
      tagIdByNameKey.set(String(tag.nameKey ?? tag.name.toLowerCase()), tag.id)
    }
    const sceneIdByName = new Map<string, string>()
    for (const scene of await this.repository.scenes.list() as { id: string; name: string }[]) {
      sceneIdByName.set(scene.name, scene.id)
    }

    let restored = 0
    let createdTags = 0
    let createdScenes = 0

    for (const row of rows) {
      if (!row.url) continue
      const tagIds: string[] = []
      for (const name of splitNames(row.tags)) {
        const key = name.toLowerCase()
        let tagId = tagIdByNameKey.get(key)
        if (!tagId) {
          const created = await this.repository.tags.create({ id: randomUUID(), name, nameKey: key }) as { id: string }
          tagId = created.id
          tagIdByNameKey.set(key, tagId)
          createdTags++
        }
        tagIds.push(tagId)
      }

      const sceneIds: string[] = []
      for (const name of splitNames(row.scenes)) {
        let sceneId = sceneIdByName.get(name)
        if (!sceneId) {
          const created = await this.repository.scenes.create({ id: randomUUID(), name }) as { id: string }
          sceneId = created.id
          sceneIdByName.set(name, sceneId)
          createdScenes++
        }
        sceneIds.push(sceneId)
      }

      await this.repository.create({
        id: row.id || randomUUID(),
        url: row.url,
        // title 的入参类型是 string|undefined（不接受 null），备为空串时省略该字段
        ...(row.title ? { title: row.title } : {}),
        note: row.note || null,
        status: normalizeStatus(row.status),
        createdAt: new Date(Number(row.createdAt) || Date.now()),
      })

      if (sceneIds.length || tagIds.length) {
        await this.repository.update(row.id, {
          ...(sceneIds.length ? { sceneIds } : {}),
          ...(tagIds.length ? { tagIds } : {}),
        })
      }
      restored++
    }

    await this.repository.operationLog.append({
      actor: 'user',
      action: 'import',
      targetType: 'backup',
      targetId: source,
      detail: `${source}：导入 ${restored} 条（替换掉 ${removed} 条）；回滚点 ${rollbackBackupId}`,
    })

    return { ok: true, restored, removed, createdTags, createdScenes, rollbackBackupId }
  }

  /**
   * 本地导出（备份设计 §3.1）：当前书签表打包为 ZIP（bookmarks.csv + meta.json）。
   * 纯内存生成；快照文件归档待 L3 快照产出落地后在 snapshots/ 目录补充。
   */
  async exportZip(): Promise<{ name: string; bytes: Uint8Array; count: number }> {
    const csv = await this.buildExportCsv()
    const { zipSync, strToU8 } = await import('fflate')
    const count = parseCsv(csv).length
    const now = new Date()
    const stamp = [
      String(now.getFullYear()).padStart(4, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('') + '_' + [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('')
    const meta = JSON.stringify({
      app: 'DogEar',
      exportedAt: now.toISOString(),
      bookmarks: count,
      note: '快照文件归档待快照存储（L3）落地后加入 snapshots/ 目录',
    }, null, 2)
    const bytes = zipSync({
      'bookmarks.csv': strToU8(csv),
      'meta.json': strToU8(meta),
    })
    return { name: `dogear_export_${stamp}.zip`, bytes, count }
  }

  /** 导出/打包共用的书签 CSV（列与轻档备份一致，导入侧 parseCsv 直接可读） */
  private async buildExportCsv(): Promise<string> {
    const result = await this.repository.list({}, 10000)
    const csvData = (result.items as any[]).map((b) => ({
      id: b.id,
      url: b.url,
      title: b.title ?? '',
      note: b.note ?? '',
      status: b.status,
      tags: (b.tags || []).map((t: any) => t.name).join('|'),
      scenes: (b.scenes || []).map((s: any) => s.name).join('|'),
      createdAt: b.createdAt?.getTime() ?? Date.now(),
    }))
    return new Promise<string>((resolve, reject) => {
      stringify(csvData, { header: true, columns: ['id', 'url', 'title', 'note', 'status', 'tags', 'scenes', 'createdAt'] }, (err, out) => {
        if (err) reject(err)
        else resolve(out)
      })
    })
  }

  /** 解析备份内容为书签行。medium 档是内含 CSV 的 JSON，需先取出再解析。 */
  private async readBackupRows(tier: string | undefined, filePath: string): Promise<BackupRow[]> {
    let csv: string
    if (tier === 'medium') {
      let parsed: { csv?: unknown }
      try {
        parsed = JSON.parse(await readFile(filePath, 'utf8'))
      } catch {
        throw new BackupRestoreError('BAD_BACKUP', 'Backup file is not valid JSON')
      }
      if (typeof parsed.csv !== 'string') {
        throw new BackupRestoreError('BAD_BACKUP', 'Backup JSON does not contain a bookmarks CSV')
      }
      csv = parsed.csv
    } else {
      csv = await readFile(filePath, 'utf8')
    }
    return parseCsv(csv)
  }

  /**
   * 同步完成一次备份并返回记录 id（与 createBackup 的区别：等待落盘完成）。
   * 回滚点必须真的写成功才有意义，故不能走 fire-and-forget。
   */
  private async createBackupNow(tier: BackupTier, target: BackupTarget): Promise<string> {
    const id = randomUUID()
    const includes = this.getIncludedContent(tier)
    await this.repository.backups.create({ id, tier, target, includes: JSON.stringify(includes) })
    try {
      await this.repository.backups.updateStatus(id, 'running')
      const result = await this.performBackup(tier, target, id)
      await this.repository.backups.updateStatus(id, 'completed', { filePath: result.filePath, fileSize: result.fileSize })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.repository.backups.updateStatus(id, 'failed', { error: message })
      throw new BackupRestoreError('CONFLICT', `Failed to create rollback backup: ${message}`)
    }
    return id
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
    // 真源库路径由调用方注入（与 index.ts 解析出的路径同一份），环境变量仅作回退，
    // 避免出现「服务端用了默认路径、重档备份却因取不到环境变量而必然失败」的情况。
    const dbPath = this.dbPath ?? process.env.DOGEAR_DB_PATH ?? process.env.DOGEAR_DATABASE_PATH
    if (!dbPath) {
      throw new Error('Database path is required for full backup')
    }

    const { copyFile, stat } = await import('node:fs/promises')
    const filePath = join(backupDir, `${backupId}-full.db`)
    await copyFile(dbPath, filePath)
    const stats = await stat(filePath)
    return { filePath, fileSize: stats.size }
  }
}

export type BackupRow = {
  id: string
  url: string
  title: string
  note: string
  status: string
  tags: string
  scenes: string
  createdAt: string
}

/** CSV 里的多个名字用 `|` 连接（见 createLightBackup 的写法） */
function splitNames(value: string): string[] {
  if (!value) return []
  return value.split('|').map((name) => name.trim()).filter(Boolean)
}

/** 只接受契约里的三种状态；备份文件可能被人手改过，非法值回落 unread 而不是写入脏数据 */
function normalizeStatus(value: string): 'unread' | 'saved' | 'archived' {
  return value === 'saved' || value === 'archived' ? value : 'unread'
}

/**
 * 解析 CSV（含表头）。按 RFC 4180 处理引号包裹、字段内逗号、字段内换行与 `""` 转义。
 * 不使用 split(',')：书签标题与备注里带逗号/换行很常见，简单切分会把数据切坏。
 */
export function parseCsv(input: string): BackupRow[] {
  // 去掉 UTF-8 BOM（Excel 导出的 CSV 常带）
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += char
      continue
    }
    if (char === '"') { inQuotes = true; continue }
    if (char === ',') { record.push(field); field = ''; continue }
    if (char === '\r') continue
    if (char === '\n') { record.push(field); records.push(record); record = []; field = ''; continue }
    field += char
  }
  if (field.length || record.length) { record.push(field); records.push(record) }

  const header = records.shift()?.map((name) => name.trim()) ?? []
  const pick = (row: string[], name: string) => {
    const index = header.indexOf(name)
    return index >= 0 ? (row[index] ?? '') : ''
  }
  return records
    .filter((row) => row.some((cell) => cell.length > 0))
    .map((row) => ({
      id: pick(row, 'id'),
      url: pick(row, 'url'),
      title: pick(row, 'title'),
      note: pick(row, 'note'),
      status: pick(row, 'status'),
      tags: pick(row, 'tags'),
      scenes: pick(row, 'scenes'),
      createdAt: pick(row, 'createdAt'),
    }))
}
