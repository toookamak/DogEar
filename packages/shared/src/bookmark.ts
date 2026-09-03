import { z } from 'zod'

export const bookmarkStatusSchema = z.enum(['unread', 'saved', 'archived'])
export const bookmarkSyncStatusSchema = z.enum(['pending', 'synced'])

export const bookmarkSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  status: bookmarkStatusSchema.default('unread'),
  syncStatus: bookmarkSyncStatusSchema.default('pending'),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const createBookmarkInputSchema = z.object({
  url: z.string().url(),
})

export type Bookmark = z.infer<typeof bookmarkSchema>
export type CreateBookmarkInput = z.infer<typeof createBookmarkInputSchema>
