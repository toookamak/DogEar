import { count, desc, eq } from 'drizzle-orm'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { accessRecords, bookmarks } from './schema.js'

type D1Database = Parameters<typeof drizzleD1>[0]

type BookmarkInput = { id: string; url: string; status: 'unread' }
type AccessRecordInput = { id: string; bookmarkId: string; source?: 'original' }

export type BookmarkRepository = {
  create: (input: BookmarkInput) => Promise<unknown>
  list: () => Promise<unknown[]>
  listInbox: () => Promise<unknown[]>
  countPending: () => Promise<number>
  createAccessRecord: (input: AccessRecordInput) => Promise<unknown>
  listAccessRecords: (bookmarkId: string) => Promise<unknown[]>
}

export function createD1BookmarkRepository(database: D1Database): BookmarkRepository {
  return createBookmarkRepository(drizzleD1(database))
}

export function createBookmarkRepository(db: any): BookmarkRepository {
  return {
    async create(input) {
      const now = new Date()
      const record = { ...input, syncStatus: 'pending' as const, createdAt: now, updatedAt: now }
      await db.insert(bookmarks).values(record).run()
      return record
    },
    async list() {
      return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt)).all()
    },
    async listInbox() {
      return db.select().from(bookmarks).where(eq(bookmarks.status, 'unread')).orderBy(desc(bookmarks.createdAt)).all()
    },
    async countPending() {
      const result = await db.select({ count: count() }).from(bookmarks).where(eq(bookmarks.syncStatus, 'pending')).all()
      return Number(result[0]?.count ?? 0)
    },
    async createAccessRecord(input) {
      const record = { ...input, openedAt: new Date(), source: input.source ?? 'original' }
      await db.insert(accessRecords).values(record).run()
      return record
    },
    async listAccessRecords(bookmarkId) {
      return db.select().from(accessRecords).where(eq(accessRecords.bookmarkId, bookmarkId)).orderBy(desc(accessRecords.openedAt)).all()
    },
  }
}
