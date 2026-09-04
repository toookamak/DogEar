import { z } from 'zod'
import { bookmarkSchema } from './bookmark.js'

export const loginRequestSchema = z.object({
  password: z.string().min(1),
})

export const sessionUserSchema = z.object({
  id: z.string().min(1),
})

export const unauthorizedErrorSchema = z.object({
  error: z.object({
    code: z.literal('UNAUTHORIZED'),
    message: z.string().min(1),
  }),
})

export const accessRecordSourceSchema = z.enum(['original', 'snapshot'])
export const accessRecordClientSchema = z.enum(['workbench', 'navigation', 'plugin', 'unknown'])

export const accessRecordSchema = z.object({
  id: z.string().uuid(),
  bookmarkId: z.string().uuid(),
  openedAt: z.number().int().nonnegative(),
  source: accessRecordSourceSchema.default('original'),
  client: accessRecordClientSchema.default('workbench'),
})

export const inboxResponseSchema = z.object({
  bookmarks: z.array(bookmarkSchema),
})

export const pendingCountResponseSchema = z.object({
  pendingCount: z.number().int().nonnegative(),
})

export const accessRecordResponseSchema = z.object({
  records: z.array(accessRecordSchema),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type SessionUser = z.infer<typeof sessionUserSchema>
export type UnauthorizedError = z.infer<typeof unauthorizedErrorSchema>
export type AccessRecord = z.infer<typeof accessRecordSchema>
export type AccessRecordResponse = z.infer<typeof accessRecordResponseSchema>
export type InboxResponse = z.infer<typeof inboxResponseSchema>
export type PendingCountResponse = z.infer<typeof pendingCountResponseSchema>
