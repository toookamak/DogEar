import { desc } from 'drizzle-orm'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { bookmarks } from './schema.js'

type D1Database = Parameters<typeof drizzleD1>[0]

export type BookmarkRepository = {
  create: (input: { id: string; url: string; status: 'unread' }) => Promise<unknown>
  list: () => Promise<unknown[]>
}

export function createD1BookmarkRepository(database: D1Database): BookmarkRepository {
  return createBookmarkRepository(drizzleD1(database))
}

export function createBookmarkRepository(db: any): BookmarkRepository {
  return {
    async create(input) {
      const now = new Date()
      const record = { ...input, createdAt: now, updatedAt: now }
      await db.insert(bookmarks).values(record).run()
      return record
    },
    async list() {
      return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt)).all()
    },
  }
}
