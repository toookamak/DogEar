import { createRequire } from 'node:module'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { describe, expect, it } from 'vitest'
import { createBookmarkRepository, initializeSqliteSchema } from '@dogear/db'
import { createApp } from './app.js'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/**
 * **真仓储 + 真路由**的端到端验证（2026-10-02 补的验证缺口）。
 *
 * 此前两类测试各管一半，交叉地带是空的：
 * - `packages/db/src/repository.sqlite.test.ts` 用真 SQL 验仓储方法
 * - `apps/server/src/app.test.ts` 用**手写桩仓储**验路由
 *
 * 于是「仓储方法单独能用、但路由把参数传错」这类问题谁也抓不到——
 * 例如本轮新增的 `listSearchIndex(limit, cursor)` 与
 * `list({ tagId: 'none' })`，若路由漏传/传错顺序，桩测试照绿。
 */
function realRepository() {
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
    const columns = statement.columns().map((column) => column.name)
    return { rows: rows.map((row) => columns.map((column) => row[column])) }
  })
  return createBookmarkRepository(db)
}

async function login(app: ReturnType<typeof createApp>, password = 'secret') {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const setCookie = response.headers.get('set-cookie') ?? ''
  return { cookie: setCookie.split(';')[0] }
}

describe('端到端：真仓储 + 真路由（批次 0 / 1 / 2 新增能力）', () => {
  it('搜索瘦投影：数据经路由 → 真 SQL → 回执，且不含大字段', async () => {
    const repository = realRepository()
    const { id: tagId } = await repository.tags.create({ id: 'tag-e2e', name: '渲染' }) as Record<string, unknown>
    await repository.folders.create({ id: 'folder-e2e', name: '论文' })
    await repository.create({
      id: 'bm-e2e-1', url: 'https://example.com/1', title: 'Houdini 渲染笔记',
      status: 'saved', source: 'page', note: 'VEX 软体', folderId: 'folder-e2e',
    } as never)
    await repository.attachTagsBatch([{ bookmarkId: 'bm-e2e-1', tagIds: [String(tagId)] }])

    const app = createApp(repository, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/bookmarks/search-index?limit=50', { headers: { cookie } })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: any[]; total: number }
    expect(body.total).toBe(1)
    expect(body.items).toHaveLength(1)
    // 真实数据真的流过了路由与 SQL：标签拼接、收藏夹名都对得上
    expect(body.items[0]).toMatchObject({ id: 'bm-e2e-1', tagText: '渲染', folderName: '论文' })
    // 瘦投影不含大字段
    expect(body.items[0]).not.toHaveProperty('cover')
    expect(body.items[0]).not.toHaveProperty('excerpt')
  })

  it('无状态筛选条件 tagId=none 经路由生效（桩测试覆盖不到这里的参数传递）', async () => {
    const repository = realRepository()
    const { id: tagId } = await repository.tags.create({ id: 'tag-e2e2', name: 'AI' }) as Record<string, unknown>
    await repository.create({ id: 'bm-t1', url: 'https://example.com/t1', title: '有标签', status: 'saved' } as never)
    await repository.create({ id: 'bm-t2', url: 'https://example.com/t2', title: '没标签', status: 'saved' } as never)
    await repository.attachTagsBatch([{ bookmarkId: 'bm-t1', tagIds: [String(tagId)] }])

    const app = createApp(repository, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/bookmarks?tagId=none', { headers: { cookie } })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: any[] }
    expect(body.items.map((row) => row.id)).toEqual(['bm-t2'])
  })

  it('sync/diff 未配置通道时返回 probeError，且 behind 不谎报为 0', async () => {
    const repository = realRepository()
    await repository.create({ id: 'bm-d1', url: 'https://example.com/d1', title: 'x', status: 'saved' } as never)

    const app = createApp(repository, { password: 'secret' })
    const { cookie } = await login(app)
    const response = await app.request('/api/sync/diff', { headers: { cookie } })

    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body.probeError).toBeTruthy()
    expect(body.behindIsExact).toBe(false)
    expect(body).toHaveProperty('ahead')
  })

  it('队列里的 pending 被算作领先，并可用 breakdown 拆出改动类型', async () => {
    const repository = realRepository()
    await repository.create({ id: 'bm-q1', url: 'https://example.com/q1', title: 'q1', status: 'saved' } as never)
    await repository.syncQueue.enqueue('update', 'bookmark', 'bm-q1', 'raindrop', JSON.stringify({ tags: ['x'] }))
    await repository.syncQueue.enqueue('update', 'bookmark', 'bm-q1', 'raindrop', JSON.stringify({ collectionId: 7 }))

    const app = createApp(repository, { password: 'secret' })
    const { cookie } = await login(app)
    const plain = await (await app.request('/api/sync/diff', { headers: { cookie } })).json() as any
    expect(plain.ahead).toBe(2)
    expect(plain).not.toHaveProperty('aheadBreakdown')

    const detailed = await (await app.request('/api/sync/diff?breakdown=1', { headers: { cookie } })).json() as any
    expect(detailed.aheadBreakdown).toMatchObject({ tags: 1, folder: 1 })
  })
})
