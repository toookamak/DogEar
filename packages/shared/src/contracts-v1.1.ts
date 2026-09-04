import { z } from 'zod'
import { bookmarkSchema, createBookmarkInputSchema, updateBookmarkFieldsSchema } from './bookmark.js'
import { paginationQuerySchema, suggestionSchema } from './contracts.js'

export const idempotencyQuerySchema = z.object({
  idempotencyKey: z.string().min(8).max(255).optional(),
  sessionKey: z.string().min(1).optional(),
})

export const workbenchCreateBookmarkInputSchema = createBookmarkInputSchema
export const workbenchBookmarkIdempotentResponseSchema = z.object({
  bookmark: bookmarkSchema,
  idempotent: z.boolean(),
  replay: z.boolean().default(false),
})

export const workbenchPatchBookmarkInputSchema = updateBookmarkFieldsSchema.extend({
  version: z.number().int().positive().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const workbenchPatchBookmarkResponseSchema = z.object({
  bookmark: bookmarkSchema,
})

export const bookmarkVersionConflictErrorSchema = z.object({
  error: z.object({
    code: z.literal('CONFLICT'),
    message: z.string().min(1),
    details: z.object({
      currentVersion: z.number().int().positive(),
    }),
  }),
})

export const batchUpdateRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['unread', 'saved', 'archived']).optional(),
  addSceneIds: z.array(z.string().uuid()).optional(),
  removeSceneIds: z.array(z.string().uuid()).optional(),
  folderId: z.string().uuid().nullable().optional(),
  addTagIds: z.array(z.string().uuid()).optional(),
  removeTagIds: z.array(z.string().uuid()).optional(),
  deleted: z.boolean().optional(),
})

export const batchUpdateResponseSchema = z.object({
  updated: z.array(bookmarkSchema),
  skipped: z.array(z.object({
    id: z.string().uuid(),
    reason: z.enum(['not_found', 'deleted']),
  })),
})

export const recycleBinListQuerySchema = paginationQuerySchema
export const recycleBinRestoreResponseSchema = z.object({
  ok: z.literal(true),
  bookmark: bookmarkSchema,
})
export const recycleBinPurgeResponseSchema = z.object({
  ok: z.literal(true),
})
export const recycleBinEmptyRequestSchema = z.object({
  onlyExpired: z.boolean().optional(),
})
export const recycleBinEmptyResponseSchema = z.object({
  ok: z.literal(true),
  purged: z.number().int().nonnegative(),
})

export const suggestionsListResponseSchema = z.object({
  items: z.array(suggestionSchema),
  nextCursor: z.string().nullable(),
})

export const suggestionMutationResponseSchema = z.object({
  ok: z.literal(true),
  suggestion: suggestionSchema,
})

export const settingsItemSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: z.number().int().nonnegative(),
})

export const settingsListResponseSchema = z.object({
  items: z.array(settingsItemSchema),
})

export const settingsWhitelistSchema = z.object({
  'recycle.retention_days': z.union([z.string(), z.number()]).optional(),
  'skill.capabilities': z.object({
    read: z.boolean(),
    write_new: z.boolean(),
    update_existing: z.boolean(),
  }).optional(),
})

export const skillCapabilitiesBodySchema = z.object({
  read: z.boolean(),
  write_new: z.boolean(),
  update_existing: z.boolean(),
})

export const skillUsageResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requests: z.number().int().nonnegative(),
  writes: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
})

export const archiveJobStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled'])
export const archiveJobSchema = z.object({
  id: z.string().uuid(),
  bookmarkId: z.string().uuid(),
  type: z.enum(['snapshot', 'reader']),
  status: archiveJobStatusSchema,
  retryCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const archiveCreateInputSchema = z.object({
  type: z.enum(['snapshot', 'reader']).default('snapshot'),
})

export const archiveCreateResponseSchema = z.object({
  jobId: z.string().uuid(),
  snapshotStatus: z.literal('queued_pending_browser'),
})

export type IdempotencyQuery = z.infer<typeof idempotencyQuerySchema>
export type WorkbenchCreateBookmarkInput = z.infer<typeof workbenchCreateBookmarkInputSchema>
export type WorkbenchPatchBookmarkInput = z.infer<typeof workbenchPatchBookmarkInputSchema>
export type WorkbenchPatchBookmarkResponse = z.infer<typeof workbenchPatchBookmarkResponseSchema>
export type BatchUpdateRequest = z.infer<typeof batchUpdateRequestSchema>
export type BatchUpdateResponse = z.infer<typeof batchUpdateResponseSchema>
export type RecycleBinEmptyRequest = z.infer<typeof recycleBinEmptyRequestSchema>
export type RecycleBinEmptyResponse = z.infer<typeof recycleBinEmptyResponseSchema>
export type SuggestionMutationResponse = z.infer<typeof suggestionMutationResponseSchema>
export type SkillCapabilitiesBody = z.infer<typeof skillCapabilitiesBodySchema>
export type SkillUsageResponse = z.infer<typeof skillUsageResponseSchema>
export type ArchiveJob = z.infer<typeof archiveJobSchema>
export type ArchiveJobStatus = z.infer<typeof archiveJobStatusSchema>
export type ArchiveCreateInput = z.infer<typeof archiveCreateInputSchema>
export type ArchiveCreateResponse = z.infer<typeof archiveCreateResponseSchema>
