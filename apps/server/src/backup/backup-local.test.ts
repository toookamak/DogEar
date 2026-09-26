import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chdir } from 'node:process'
import { describe, expect, it, beforeAll } from 'vitest'
import { unzipSync, strFromU8, strToU8, zipSync } from 'fflate'
import { BackupService, parseCsv } from './backup-service.js'

/**
 * 本地导出/导入（备份设计 §3，v0.7.30）。
 * 回滚点会真写 backups/ 文件（gitignore 目录）：测试期间把 cwd 指到临时目录避免污染仓库。
 */

let service: BackupService
const store = {
  bookmarks: [] as Array<Record<string, any>>,
  backups: [] as Array<Record<string, any>>,
  tags: [] as Array<Record<string, any>>,
  scenes: [] as Array<Record<string, any>>,
}

beforeAll(() => {
  chdir(mkdtempSync(join(tmpdir(), 'dogear-zip-')))
  const repository: any = {
    list: async () => ({
      items: store.bookmarks.map((b) => ({
        ...b,
        tags: b.tagIds.map((id: string) => store.tags.find((t) => t.id === id)).filter(Boolean),
        scenes: b.sceneIds.map((id: string) => store.scenes.find((s) => s.id === id)).filter(Boolean),
      })),
      nextCursor: null,
    }),
    create: async (record: Record<string, any>) => {
      const row = { tagIds: [], sceneIds: [], ...record, tags: [], scenes: [], createdAt: record.createdAt ?? new Date(), updatedAt: new Date() }
      store.bookmarks.push(row)
      return row
    },
    update: async (id: string, input: Record<string, any>) => {
      const row = store.bookmarks.find((b) => b.id === id)
      if (!row) return undefined
      Object.assign(row, input)
      return row
    },
    softDelete: async (id: string) => {
      const row = store.bookmarks.find((b) => b.id === id)
      if (row) row.deletedAt = Date.now()
      return row
    },
    purgeDeleted: async () => {
      const before = store.bookmarks.length
      store.bookmarks = store.bookmarks.filter((b) => !b.deletedAt)
      return before - store.bookmarks.length
    },
    tags: {
      list: async () => store.tags,
      create: async (input: Record<string, any>) => {
        const row = { ...input }
        store.tags.push(row)
        return row
      },
    },
    scenes: {
      list: async () => store.scenes,
      create: async (input: Record<string, any>) => {
        const row = { ...input }
        store.scenes.push(row)
        return row
      },
    },
    settings: { list: async () => [] },
    backups: {
      create: async (data: Record<string, any>) => {
        const row = { ...data, status: 'pending', filePath: null, fileSize: null }
        store.backups.push(row)
        return row
      },
      updateStatus: async (id: string, status: string, patch?: Record<string, any>) => {
        const row = store.backups.find((b) => b.id === id)
        if (row) Object.assign(row, { status }, patch ?? {})
        return row
      },
      get: async (id: string) => store.backups.find((b) => b.id === id),
      list: async () => store.backups,
    },
    operationLog: { append: async (input: Record<string, any>) => ({ id: 'log-1', ...input }) },
  }
  // full 档回滚点会 copyfile dbPath：先落一个真实文件占位
  const dbPath = join(tmpdir(), 'dogear-zip.sqlite')
  writeFileSync(dbPath, 'placeholder')
  service = new BackupService(repository, dbPath)
})

describe('本地导出 ZIP（backup §3.1）', () => {
  it('packs bookmarks.csv + meta.json and round-trips through parseCsv', async () => {
    await service['repository'].create({ id: 'b-1', url: 'https://a.example.com/', status: 'saved', note: null })
    await service['repository'].create({ id: 'b-2', url: 'https://b.example.com/', status: 'unread', note: '带,逗号' })

    const { name, bytes, count } = await service.exportZip()
    expect(name).toMatch(/^dogear_export_\d{8}_\d{6}\.zip$/)
    expect(count).toBe(2)

    const entries = unzipSync(bytes)
    expect(Object.keys(entries).sort()).toEqual(['bookmarks.csv', 'meta.json'])
    const rows = parseCsv(strFromU8(entries['bookmarks.csv']))
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.id === 'b-2')?.note).toBe('带,逗号')
    expect(JSON.parse(strFromU8(entries['meta.json']))).toMatchObject({ app: 'DogEar', bookmarks: 2 })
  })

  it('exports a filtered subset and records the applied filters in meta.json (v1.15)', async () => {
    const repository = service['repository']
    const originalList = repository.list
    // 真实筛选由 repository.list 的 SQL 完成；这里模拟同语义（status + createdFrom）
    repository.list = async (filters: Record<string, any> = {}) => ({
      items: store.bookmarks
        .filter((b) => !filters.status || b.status === filters.status)
        .filter((b) => !filters.createdFrom || new Date(b.createdAt).getTime() >= filters.createdFrom.getTime())
        .map((b) => ({ ...b, tags: [], scenes: [] })),
      nextCursor: null,
    })

    const { bytes, count } = await service.exportZip({ status: 'unread', createdFrom: new Date('2020-01-01T00:00:00.000Z') })
    const entries = unzipSync(bytes)
    const rows = parseCsv(strFromU8(entries['bookmarks.csv']))
    expect(count).toBe(rows.length)
    expect(count).toBe(1)
    expect(rows[0].status).toBe('unread')
    expect(JSON.parse(strFromU8(entries['meta.json'])).filters).toMatchObject({ status: 'unread' })

    repository.list = originalList
  })
})

describe('本地导入（backup §3.2）', () => {
  it('replaces bookmarks from parsed rows and keeps a rollback backup', async () => {
    // 当前库已有 2 条；导入文件只含 1 条（换 URL）→ 全量替换后应为 1 条
    const csv = 'id,url,title,note,status,tags,scenes,createdAt\n' +
      'c-1,https://c.example.com/,来自本地文件,,saved,前端| workers,工作研究,1700000000000'
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(1)

    const before = store.bookmarks.length
    const result = await service.importRows(rows, '本地导入 test.csv')
    expect(result.ok).toBe(true)
    expect(result.restored).toBe(1)
    expect(result.removed).toBe(before)
    expect(result.rollbackBackupId).toBeTruthy()
    // 回滚点备份真的落了盘（completed + filePath）
    const rollback = store.backups.find((b) => b.id === result.rollbackBackupId)
    expect(rollback?.status).toBe('completed')
    expect(rollback?.filePath).toBeTruthy()
    // 全量替换后的库内容
    expect(store.bookmarks).toHaveLength(1)
    expect(store.bookmarks[0].url).toBe('https://c.example.com/')
    // 标签按名字复用/创建并重新挂载
    expect(store.tags.map((t) => t.name).sort()).toEqual(['workers', '前端'])
    expect(store.bookmarks[0].tagIds).toHaveLength(2)
    expect(store.scenes.map((s) => s.name)).toEqual(['工作研究'])
  })

  it('round-trips an export ZIP through the import path (csv extraction is route-agnostic)', async () => {
    await service['repository'].create({ id: 'd-1', url: 'https://d.example.com/', status: 'saved', note: null })
    const { bytes } = await service.exportZip()
    const entries = unzipSync(bytes)
    const rows = parseCsv(strFromU8(entries['bookmarks.csv']))
    const result = await service.importRows(rows, '本地导入 roundtrip.zip')
    expect(result.restored).toBe(2)
    // 此时的库里是上一条用例导入后的 c-1 + 本用例新建的 d-1
    expect(store.bookmarks.map((b) => b.id).sort()).toEqual(['c-1', 'd-1'])
  })
})

describe('ZIP 内容边界', () => {
  it('strToU8/strFromU8 keeps utf-8 notes intact', () => {
    const bytes = zipSyncShim({ 'bookmarks.csv': 'id,url\n中文,https://中.example.com/' })
    const csv = strFromU8(unzipSync(bytes)['bookmarks.csv'])
    expect(csv).toContain('中文')
  })
})

function zipSyncShim(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
}
