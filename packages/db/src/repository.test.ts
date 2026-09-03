import { describe, expect, it } from 'vitest'
import { accessRecords, bookmarks } from './schema.js'
import { createBookmarkRepository } from './repository.js'

function setup() {
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
    select() {
      return {
        from(table: any) {
          const target = table === bookmarks ? bookmarkRows : accessRows
          return {
            where(condition: any) {
              return {
                all: () => [{ count: bookmarkRows.filter((record) => record.syncStatus === 'pending').length }],
                orderBy(column: any) {
                  return {
                    all: () => [...target]
                      .filter((record) => record.status === 'unread' || record.bookmarkId === 'bookmark-1')
                      .reverse(),
                  }
                },
              }
            },
            orderBy(column: any) {
              return {
                all: () => [...target].sort((left, right) => {
                  const leftValue = column === bookmarks.createdAt ? left.createdAt : left.openedAt
                  const rightValue = column === bookmarks.createdAt ? right.createdAt : right.openedAt
                  if (!leftValue || !rightValue) return 0
                  return rightValue.getTime() - leftValue.getTime()
                }),
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

    expect((await repository.listInbox()).map((bookmark: any) => bookmark.id)).toEqual(['2', '1'])
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
})
