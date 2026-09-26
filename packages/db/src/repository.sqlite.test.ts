import { createRequire } from 'node:module'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { describe, expect, it } from 'vitest'
import { initializeSqliteSchema } from './sqlite.js'
import { createBookmarkRepository } from './repository.js'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/**
 * 真 SQL 验证（批次一新增能力的仓储层行为）：
 * drizzle-orm/sqlite-proxy 桥接 node:sqlite 内存库，跑真实 schema 与 SQL。
 * 覆盖 v1.14 新增的标签改名/合并、stats 聚合、important 排序 keyset 分页、
 * 时间范围与导航展示集过滤——这些逻辑在 mock 桩上验证不了。
 */
function setup() {
  const database = new DatabaseSync(':memory:')
  initializeSqliteSchema({
    run: (sql) => database.exec(sql),
    query: (sql) => ({ all: () => database.prepare(sql).all() as Array<{ name: string }> }),
  })
  const db = drizzle(async (sql, params, method) => {
    const statement = database.prepare(sql)
    if (method === 'run') {
      statement.run(...(params as never[]))
      return { rows: [] }
    }
    const rows = statement.all(...(params as never[])) as Record<string, unknown>[]
    // sqlite-proxy 期望数组行（values 模式）：按语句列序把对象行转数组
    const columns = statement.columns().map((column) => column.name)
    return { rows: rows.map((row) => columns.map((column) => row[column])) }
  })
  return createBookmarkRepository(db)
}

let seq = 0
async function seedBookmark(repository: ReturnType<typeof createBookmarkRepository>, overrides: Partial<Record<string, unknown>> = {}) {
  seq += 1
  const id = overrides.id ? String(overrides.id) : `bm-${String(seq).padStart(3, '0')}`
  const { createdAt, ...rest } = overrides
  const record = await repository.create({
    id,
    url: `https://example.com/${id}`,
    status: 'saved',
    ...rest,
    createdAt: createdAt !== undefined ? new Date(Number(createdAt)) : undefined,
  } as never)
  return record as Record<string, unknown>
}

describe('repository on real SQLite (v1.14 批次一)', () => {
  it('renames a tag, rejects conflicts and missing tags', async () => {
    const repository = setup()
    const created = await repository.tags.create({ id: 'tag-1', name: '前端' }) as Record<string, unknown>
    await repository.tags.create({ id: 'tag-2', name: '设计' })

    const renamed = await repository.tags.rename('tag-1', { name: '前端开发' })
    expect(renamed.ok).toBe(true)
    if (renamed.ok) expect((renamed.record as Record<string, unknown>).name).toBe('前端开发')

    const conflict = await repository.tags.rename('tag-2', { name: '前端开发' })
    expect(conflict).toEqual({ ok: false, reason: 'name_conflict' })

    const missing = await repository.tags.rename('tag-404', { name: '不存在' })
    expect(missing).toEqual({ ok: false, reason: 'not_found' })

    // 同名不同大小写视为撞 name_key
    const caseConflict = await repository.tags.rename('tag-2', { name: '前端开发'.toUpperCase() })
    expect(caseConflict).toEqual({ ok: false, reason: 'name_conflict' })
    expect(created).toBeTruthy()
  })

  it('merges a tag into a target with mount dedupe and source removal', async () => {
    const repository = setup()
    await repository.tags.create({ id: 'tag-a', name: '随记' })
    await repository.tags.create({ id: 'tag-b', name: '笔记' })
    const onlySource = await seedBookmark(repository)
    const both = await seedBookmark(repository)

    await repository.batchUpdate({ ids: [String(onlySource.id)], addTagIds: ['tag-a'] } as never)
    await repository.batchUpdate({ ids: [String(both.id)], addTagIds: ['tag-a', 'tag-b'] } as never)

    const result = await repository.tags.merge('tag-a', 'tag-b')
    expect(result).toMatchObject({ ok: true, moved: 2 })

    const tagsOfOnlySource = (await repository.get(String(onlySource.id)) as any).tags
    const tagsOfBoth = (await repository.get(String(both.id)) as any).tags
    expect(tagsOfOnlySource).toEqual([{ id: 'tag-b', name: '笔记' }])
    expect(tagsOfBoth).toEqual([{ id: 'tag-b', name: '笔记' }])

    expect((await repository.tags.list()).map((tag: any) => tag.id)).toEqual(['tag-b'])
    expect(await repository.tags.merge('tag-b', 'tag-b')).toEqual({ ok: false, reason: 'same_tag' })
    expect(await repository.tags.merge('tag-404', 'tag-b')).toEqual({ ok: false, reason: 'not_found' })
  })

  it('aggregates stats with the same scope as list (recycle bin excluded)', async () => {
    const repository = setup()
    await repository.tags.create({ id: 'tag-1', name: '前端' })
    await repository.scenes.create({ id: 'scene-1', name: '阅读' } as never)
    await repository.folders.create({ id: 'folder-1', name: '资料' } as never)

    await seedBookmark(repository, { id: 'bm-a', status: 'unread', source: 'page' })
    await seedBookmark(repository, { id: 'bm-b', status: 'saved', source: 'agent', important: true, folderId: 'folder-1' })
    const sceneTagged = await seedBookmark(repository, { id: 'bm-c', status: 'archived', source: 'extension' })
    await repository.batchUpdate({ ids: [String(sceneTagged.id)], addSceneIds: ['scene-1'], addTagIds: ['tag-1'] } as never)
    const deleted = await seedBookmark(repository, { id: 'bm-d', status: 'saved' })
    await repository.softDelete(String(deleted.id))

    const stats = await repository.stats()
    expect(stats.total).toBe(3)
    expect(stats.byStatus).toEqual({ unread: 1, saved: 1, archived: 1 })
    expect(stats.bySource).toEqual({ page: 1, agent: 1, extension: 1 })
    expect(stats.byFolder).toEqual([{ id: 'folder-1', name: '资料', count: 1 }])
    expect(stats.byScene).toEqual([{ id: 'scene-1', name: '阅读', count: 1 }])
    expect(stats.byTag).toEqual([{ id: 'tag-1', name: '前端', count: 1 }])
    expect(stats.importantCount).toBe(1)
    expect(stats.recycleCount).toBe(1)
  })

  it('sorts by important first then createdAt, with stable keyset pagination', async () => {
    const repository = setup()
    const base = 1_700_000_000_000
    await seedBookmark(repository, { id: 'imp-old', important: true, createdAt: base })
    await seedBookmark(repository, { id: 'imp-new', important: true, createdAt: base + 1000 })
    await seedBookmark(repository, { id: 'nor-new', createdAt: base + 2000 })
    await seedBookmark(repository, { id: 'nor-mid', createdAt: base + 500 })
    await seedBookmark(repository, { id: 'nor-old', createdAt: base - 1000 })

    const page = await repository.list({}, 50, undefined, { sort: 'important' })
    expect((page.items as any[]).map((row) => row.id)).toEqual(['imp-new', 'imp-old', 'nor-new', 'nor-mid', 'nor-old'])

    // 逐页走游标：全量无重复无漏项
    const walked: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 10; guard += 1) {
      const result = await repository.list({}, 2, cursor, { sort: 'important' })
      walked.push(...(result.items as any[]).map((row) => row.id))
      cursor = result.nextCursor ?? undefined
      if (!cursor) break
    }
    expect(walked).toEqual(['imp-new', 'imp-old', 'nor-new', 'nor-mid', 'nor-old'])
  })

  it('filters by created time range and nav visibility id set', async () => {
    const repository = setup()
    const base = 1_700_000_000_000
    await seedBookmark(repository, { id: 'old', createdAt: base })
    await seedBookmark(repository, { id: 'new', createdAt: base + 10_000 })
    await seedBookmark(repository, { id: 'hidden', createdAt: base + 20_000 })

    const from = await repository.list({ createdFrom: new Date(base + 5_000) })
    expect((from.items as any[]).map((row) => row.id).sort()).toEqual(['hidden', 'new'])
    const to = await repository.list({ createdTo: new Date(base + 5_000) })
    expect((to.items as any[]).map((row) => row.id)).toEqual(['old'])
    const both = await repository.list({ createdFrom: new Date(base), createdTo: new Date(base + 10_000) })
    expect((both.items as any[]).map((row) => row.id).sort()).toEqual(['new', 'old'])

    // 模拟「导航展示集」：求值结果只有 new（<90 个 id 走单组 IN；空集恒空）
    const visible = await repository.list({ navVisibleIds: ['new'] })
    expect((visible.items as any[]).map((row) => row.id)).toEqual(['new'])
    const excluded = await repository.list({ navExcludedIds: ['new'] })
    expect((excluded.items as any[]).map((row) => row.id).sort()).toEqual(['hidden', 'old'])
    const emptyVisible = await repository.list({ navVisibleIds: [] })
    expect(emptyVisible.items).toEqual([])
    // 超过 90 个 id 分片：包含集 OR、排除集 AND，600 条基线内不漏不错
    const manyIds = Array.from({ length: 120 }, (_, index) => `x-${index}`)
    manyIds.push('new', 'hidden')
    const chunked = await repository.list({ navVisibleIds: manyIds })
    expect((chunked.items as any[]).map((row) => row.id).sort()).toEqual(['hidden', 'new'])
    const chunkedExclude = await repository.list({ navExcludedIds: manyIds })
    expect((chunkedExclude.items as any[]).map((row) => row.id)).toEqual(['old'])
  })

  it('merges a scene into a target with mount dedupe and source removal (v1.15)', async () => {
    const repository = setup()
    // 初始化会种子 4 个默认场景（固定 UUID），直接取两个用
    const sourceId = '00000000-0000-4000-8000-000000000001'
    const targetId = '00000000-0000-4000-8000-000000000002'
    const onlySource = await seedBookmark(repository)
    const both = await seedBookmark(repository)
    await repository.batchUpdate({ ids: [String(onlySource.id)], addSceneIds: [sourceId] } as never)
    await repository.batchUpdate({ ids: [String(both.id)], addSceneIds: [sourceId, targetId] } as never)

    const result = await repository.scenes.merge(sourceId, targetId)
    expect(result).toMatchObject({ ok: true, moved: 2 })
    expect((await repository.get(String(onlySource.id)) as any).scenes).toEqual([{ id: targetId, name: '灵感收集' }])
    expect((await repository.get(String(both.id)) as any).scenes).toEqual([{ id: targetId, name: '灵感收集' }])
    const sceneIds = (await repository.scenes.list()).map((scene: any) => scene.id)
    expect(sceneIds).not.toContain(sourceId)
    expect(sceneIds).toContain(targetId)
    expect(await repository.scenes.merge(targetId, targetId)).toEqual({ ok: false, reason: 'same_scene' })
    expect(await repository.scenes.merge('sc-404', targetId)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('cleans up operation logs by retention days and max entries (v1.15)', async () => {
    const repository = setup()
    const now = Date.now()
    for (let i = 0; i < 5; i += 1) {
      await repository.operationLog.append({
        actor: 'user', action: 'create', targetType: 'bookmark', targetId: `b-${i}`,
        createdAt: new Date(now - (i + 3) * 86400000),
      })
    }

    // 保留 2 天：5 条（3~7 天前）全部过期
    const byDays = await repository.operationLog.cleanup({ retentionDays: 2 })
    expect(byDays.removed).toBe(5)
    expect(await repository.operationLog.list()).toHaveLength(0)

    // max=2：3 条新鲜日志删最旧 1 条，保留最新 2 条
    for (let i = 0; i < 3; i += 1) {
      await repository.operationLog.append({
        actor: 'user', action: 'create', targetType: 'bookmark', targetId: `fresh-${i}`,
        createdAt: new Date(now - i * 3600000),
      })
    }
    const byMax = await repository.operationLog.cleanup({ maxEntries: 2 })
    expect(byMax.removed).toBe(1)
    const rest = await repository.operationLog.list()
    expect(rest).toHaveLength(2)
    expect((rest as any[]).map((row) => row.targetId).sort()).toEqual(['fresh-0', 'fresh-1'])
  })
})
