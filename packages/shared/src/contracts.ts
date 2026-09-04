import { z } from 'zod'
import {
  bookmarkListFiltersSchema,
  bookmarkReceiptSchema,
  bookmarkSchema,
  saveBookmarkInputSchema,
  updateBookmarkFieldsSchema,
} from './bookmark.js'

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
})

export const paginationResponseSchema = z.object({
  nextCursor: z.string().nullable(),
})

export const bookmarkListResponseSchema = paginationResponseSchema.extend({
  items: z.array(bookmarkSchema),
})

export const inboxResponseV2Schema = paginationResponseSchema.extend({
  bookmarks: z.array(bookmarkSchema),
})

export const unifiedErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'CAPABILITY_DISABLED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'BOOKMARK_DELETED',
  'SCENE_IN_USE',
  'BATCH_TOO_LARGE',
  'RATE_LIMITED',
  'NOT_SUPPORTED',
  'CONFLICT',
])

export const unifiedErrorSchema = z.object({
  error: z.object({
    code: unifiedErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
  }),
})

export const capabilityLevelSchema = z.enum(['read', 'write_new', 'update_existing'])
export const skillNameSchema = z.enum([
  'save_bookmark',
  'search_bookmarks',
  'update_bookmark',
  'list_bookmarks',
  'get_stats',
  'trigger_archive',
  'suggest_scene',
])

export const saveBookmarkSkillInputSchema = saveBookmarkInputSchema
export const searchBookmarksSkillInputSchema = paginationQuerySchema.extend({
  query: z.string().optional(),
  filters: bookmarkListFiltersSchema.optional(),
})
export const listBookmarksSkillInputSchema = paginationQuerySchema.merge(bookmarkListFiltersSchema)
export const updateBookmarkSkillInputSchema = z.object({
  id: z.string().uuid(),
}).merge(updateBookmarkFieldsSchema)
export const getStatsSkillInputSchema = z.object({})
export const triggerArchiveSkillInputSchema = z.object({
  bookmarkId: z.string().uuid(),
  type: z.enum(['snapshot', 'reader']).default('snapshot'),
})
export const suggestSceneSkillInputSchema = z.union([
  z.object({ bookmarkId: z.string().uuid() }),
  z.object({ bookmarkIds: z.array(z.string().uuid()).min(1).max(20) }),
])

export const skillInputSchemas = {
  save_bookmark: saveBookmarkSkillInputSchema,
  search_bookmarks: searchBookmarksSkillInputSchema,
  update_bookmark: updateBookmarkSkillInputSchema,
  list_bookmarks: listBookmarksSkillInputSchema,
  get_stats: getStatsSkillInputSchema,
  trigger_archive: triggerArchiveSkillInputSchema,
  suggest_scene: suggestSceneSkillInputSchema,
} as const

export const skillCapabilitySchema = z.object({
  name: skillNameSchema,
  write: z.boolean(),
  capability: capabilityLevelSchema,
  input: z.string().min(1),
  notes: z.string().min(1),
})

export const capabilitiesResponseSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  auth: z.string().min(1),
  skills: z.array(skillCapabilitySchema).length(7),
})

export const snapshotReceiptSchema = z.object({
  jobId: z.string().uuid(),
  snapshotStatus: z.literal('queued_pending_browser'),
})

export const saveBookmarkSkillResponseSchema = bookmarkReceiptSchema
export const bookmarkListSkillResponseSchema = bookmarkListResponseSchema

export const suggestionKindSchema = z.enum(['scene', 'folder', 'tag'])
export const suggestionStatusSchema = z.enum(['pending', 'accepted', 'deferred', 'dismissed'])
export const suggestionSchema = z.object({
  id: z.string().uuid(),
  bookmarkId: z.string().uuid(),
  kind: suggestionKindSchema,
  targetId: z.string().uuid().nullable(),
  targetLabel: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  rationale: z.string().nullable(),
  status: suggestionStatusSchema,
  createdAt: z.number().int().nonnegative(),
  resolvedAt: z.number().int().nonnegative().nullable(),
})

export const suggestSceneSkillResponseSchema = z.object({
  suggestions: z.array(suggestionSchema),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
export type PaginationResponse = z.infer<typeof paginationResponseSchema>
export type BookmarkListResponse = z.infer<typeof bookmarkListResponseSchema>
export type UnifiedError = z.infer<typeof unifiedErrorSchema>
export type UnifiedErrorCode = z.infer<typeof unifiedErrorCodeSchema>
export type CapabilityLevel = z.infer<typeof capabilityLevelSchema>
export type SkillName = z.infer<typeof skillNameSchema>
export type SkillCapability = z.infer<typeof skillCapabilitySchema>
export type CapabilitiesResponse = z.infer<typeof capabilitiesResponseSchema>
export type SnapshotReceipt = z.infer<typeof snapshotReceiptSchema>
export type Suggestion = z.infer<typeof suggestionSchema>
export type SuggestionKind = z.infer<typeof suggestionKindSchema>
export type SuggestionStatus = z.infer<typeof suggestionStatusSchema>
export type SaveBookmarkSkillResponse = z.infer<typeof saveBookmarkSkillResponseSchema>
export type SuggestSceneSkillResponse = z.infer<typeof suggestSceneSkillResponseSchema>
