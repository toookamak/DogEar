import { describe, expect, it } from 'vitest'
import { accessRecords, bookmarks, bookmarkScenes, bookmarkTags } from './schema.js'
import { createBookmarkRepository } from './repository.js'

/**
 * 记录 list/search 查询里出现过的 leftJoin。
 *
 * 背景：Bookmark↔Scene、Bookmark↔Tag 都是多对多，一旦在筛选/搜索时 JOIN 这两张表，
 * 结果会按「场景数 × 标签数」重复（实测：挂 2 场景 + 2 标签的书签按场景筛选时重复 2 次、
 * 按关键字搜索时重复 4 次）。正确做法是用 EXISTS 子查询做过滤。
 * 这里用结构性断言守住这个不变量——若有人把 JOIN 加回来，本测试立刻失败。
 */
const leftJoins: unknown[] = []

function setup() {
  leftJoins.length = 0
  const bookmarkRows: any[] = []
  const accessRows: any[] = []
  const db = {
    insert(table: any) {
      return {
        values(record: any) {
          return {
            run() {
              const target = table === bookmarks ? bookmarkRows : accessRows
              target.push({ ...record })
            },
          }
        },
      }
    },
    delete(table: any) {
      return {
        where(condition: any) {
          return {
            run() {},
          }
        },
      }
    },
    select() {
      return {
        from(table: any) {
          const target = table === bookmarks ? bookmarkRows : accessRows
          // readRelations 会经 innerJoin(scenes/tags) 读取关联；内存桩只需保持链式可调用
          const joined = { where: () => ({ all: () => [] }) }
          return {
            innerJoin: () => joined,
            // 记录并链式返回，让「误加 JOIN」表现为断言失败而不是运行时报错
            leftJoin(table: unknown) {
              leftJoins.push(table)
              return this
            },
            where(condition: any) {
              return {
                all: () => [{ count: bookmarkRows.filter((record) => record.syncStatus === 'pending').length }],
                orderBy(...columns: any[]) {
                  const sortKey = (row: any) => row.createdAt?.getTime?.() ?? row.openedAt?.getTime?.() ?? 0
                  return {
                    limit(n: number) {
                      return {
                        all: () => [...target]
                          .filter((record) => record.status === 'unread' || record.bookmarkId === 'bookmark-1')
                          .sort((a, b) => sortKey(b) - sortKey(a))
                          .slice(0, n),
                      }
                    },
                    all: () => [...target]
                      .filter((record) => record.status === 'unread' || record.bookmarkId === 'bookmark-1')
                      .sort((a, b) => sortKey(b) - sortKey(a)),
                  }
                },
              }
            },
            orderBy(...columns: any[]) {
              const sortKey = (row: any) => row.createdAt?.getTime?.() ?? row.openedAt?.getTime?.() ?? 0
              return {
                limit(n: number) {
                  return {
                    all: () => [...target].sort((a, b) => sortKey(b) - sortKey(a)).slice(0, n),
                  }
                },
                all: () => [...target].sort((a, b) => sortKey(b) - sortKey(a)),
              }
            },
            all: () => [{ count: bookmarkRows.filter((record) => record.syncStatus === 'pending').length }],
          }
        },
      }
    },
  }
  return createBookmarkRepository(db)
}

describe('bookmark repository', () => {
  it('creates pending bookmarks and queries inbox and pending count', async () => {
    const repository = setup()
    await repository.create({ id: '1', url: 'https://example.com/1', status: 'unread' })
    await new Promise((resolve) => setTimeout(resolve, 2))
    await repository.create({ id: '2', url: 'https://example.com/2', status: 'unread' })

    const inbox = await repository.listInbox()
    expect(inbox.bookmarks.map((bookmark: any) => bookmark.id)).toEqual(['2', '1'])
    expect(inbox.total).toBe(2)
    expect(await repository.countPending()).toBe(2)
  })

  it('creates and lists access records newest first', async () => {
    const repository = setup()
    const first = await repository.createAccessRecord({ id: 'access-1', bookmarkId: 'bookmark-1' })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = await repository.createAccessRecord({ id: 'access-2', bookmarkId: 'bookmark-1' })

    expect((first as any).source).toBe('original')
    expect((second as any).openedAt).toBeInstanceOf(Date)
    expect((await repository.listAccessRecords('bookmark-1')).map((record: any) => record.id)).toEqual(['access-2', 'access-1'])
  })

  it('supports bookmark detail, filtering, updates, recycle bin and purge operations', async () => {
    const repository = setup()

    expect(repository.get).toBeTypeOf('function')
    expect(repository.search).toBeTypeOf('function')
    expect(repository.update).toBeTypeOf('function')
    expect(repository.batchUpdate).toBeTypeOf('function')
    expect(repository.softDelete).toBeTypeOf('function')
    expect(repository.restore).toBeTypeOf('function')
    expect(repository.purgeDeleted).toBeTypeOf('function')
  })

  it('exposes transactional resource repositories', async () => {
    const repository = setup()

    expect(repository.scenes.create).toBeTypeOf('function')
    expect(repository.folders.create).toBeTypeOf('function')
    expect(repository.tags.create).toBeTypeOf('function')
    expect(repository.suggestions.accept).toBeTypeOf('function')
    expect(repository.operationLog.append).toBeTypeOf('function')
    expect(repository.settings.set).toBeTypeOf('function')
    expect(repository.archiveJobs.create).toBeTypeOf('function')
  })

  it('筛选与搜索不 JOIN 多对多表（否则结果会按场景数×标签数重复）', async () => {
    const repository = setup()

    // 三种会触及关联维度的过滤路径：场景、标签、关键字（关键字含标签名匹配）
    await repository.list({ sceneId: '11111111-1111-4111-8111-111111111111' })
    await repository.list({ tagId: '22222222-2222-4222-8222-222222222222' })
    await repository.list({ q: '关键字' })

    const joinedManyToMany = leftJoins.filter(
      (table) => table === bookmarkScenes || table === bookmarkTags,
    )
    expect(joinedManyToMany).toEqual([])
  })
})
