import { z } from 'zod'

export const bookmarkStatusSchema = z.enum(['unread', 'saved', 'archived'])
export const bookmarkSourceSchema = z.enum(['page', 'agent', 'extension'])
export const bookmarkTypeSchema = z.enum(['link', 'article', 'video', 'image'])
export const bookmarkSyncStatusSchema = z.enum(['pending', 'synced'])
export const snapshotStatusSchema = z.enum(['not_requested', 'queued_pending_browser'])

export const bookmarkReferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const bookmarkSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().nullable().default(null),
  excerpt: z.string().nullable().default(null),
  cover: z.string().url().nullable().default(null),
  type: bookmarkTypeSchema.default('link'),
  author: z.string().nullable().default(null),
  favicon: z.string().url().nullable().default(null),
  publishedAt: z.number().int().nonnegative().nullable().default(null),
  note: z.string().nullable().default(null),
  intent: z.string().nullable().default(null),
  important: z.boolean().default(false),
  status: bookmarkStatusSchema.default('unread'),
  source: bookmarkSourceSchema.default('page'),
  private: z.boolean().default(false),
  folder: bookmarkReferenceSchema.nullable().default(null),
  domain: z.string().nullable().default(null),
  broken: z.boolean().default(false),
  raindropId: z.string().nullable().default(null),
  syncStatus: bookmarkSyncStatusSchema.default('pending'),
  version: z.number().int().positive().default(1),
  deletedAt: z.number().int().nonnegative().nullable().default(null),
  lastOpenedAt: z.number().int().nonnegative().nullable().default(null),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  scenes: z.array(bookmarkReferenceSchema).default([]),
  tags: z.array(bookmarkReferenceSchema).default([]),
  pendingSuggestionCount: z.number().int().nonnegative().default(0),
})

export const createBookmarkInputSchema = z.object({
  url: z.string().url(),
  note: z.string().nullable().optional(),
  intent: z.string().nullable().optional(),
  important: z.boolean().optional(),
  private: z.boolean().optional(),
})

export const bookmarkReceiptSchema = bookmarkSchema.extend({
  snapshotStatus: snapshotStatusSchema.default('not_requested'),
  suggestions: z.array(z.unknown()).default([]),
})

export const saveBookmarkInputSchema = createBookmarkInputSchema.extend({
  snapshot: z.boolean().default(false),
})

export const bookmarkListFiltersSchema = z.object({
  status: bookmarkStatusSchema.optional(),
  sceneId: z.string().uuid().optional(),
  folderId: z.union([z.string().uuid(), z.literal('none')]).optional(),
  tagId: z.string().uuid().optional(),
  important: z.coerce.boolean().optional(),
  source: bookmarkSourceSchema.optional(),
  q: z.string().optional(),
  includePrivate: z.boolean().optional(),
})

export const updateBookmarkFieldsSchema = z.object({
  title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  important: z.boolean().optional(),
  private: z.boolean().optional(),
  status: bookmarkStatusSchema.optional(),
  folderId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  sceneIds: z.array(z.string().uuid()).optional(),
  confirmStructure: z.boolean().optional(),
})

export const updateBookmarkInputSchema = updateBookmarkFieldsSchema.refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
})

export type Bookmark = z.infer<typeof bookmarkSchema>
export type BookmarkReceipt = z.infer<typeof bookmarkReceiptSchema>
export type CreateBookmarkInput = z.infer<typeof createBookmarkInputSchema>
export type SaveBookmarkInput = z.infer<typeof saveBookmarkInputSchema>
export type BookmarkListFilters = z.infer<typeof bookmarkListFiltersSchema>
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkInputSchema>
