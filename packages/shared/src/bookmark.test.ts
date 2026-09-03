import { describe, expect, it } from 'vitest'
import {
  accessRecordResponseSchema,
  accessRecordSchema,
  bookmarkSchema,
  bookmarkSyncStatusSchema,
  inboxResponseSchema,
  loginRequestSchema,
  pendingCountResponseSchema,
  sessionUserSchema,
  unauthorizedErrorSchema,
} from './index.js'

describe('M2 shared schemas', () => {
  it('accepts a complete bookmark with sync status and timestamps', () => {
    const result = bookmarkSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      url: 'https://example.com/article',
      status: 'unread',
      syncStatus: 'pending',
      createdAt: 1735689600000,
      updatedAt: 1735689600000,
    })

    expect(result.syncStatus).toBe('pending')
  })

  it('rejects an invalid sync status', () => {
    expect(() => bookmarkSyncStatusSchema.parse('queued')).toThrow()
  })

  it('accepts login, session, and unauthorized contracts', () => {
    expect(loginRequestSchema.parse({ password: 'secret' }).password).toBe('secret')
    expect(sessionUserSchema.parse({ id: 'user' }).id).toBe('user')
    expect(unauthorizedErrorSchema.parse({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }).error.code).toBe(
      'UNAUTHORIZED',
    )
  })

  it('rejects invalid inbox and pending count responses', () => {
    expect(() => inboxResponseSchema.parse({ bookmarks: 'invalid' })).toThrow()
    expect(() => pendingCountResponseSchema.parse({ pendingCount: -1 })).toThrow()
  })

  it('accepts access records and their response', () => {
    const record = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      bookmarkId: '550e8400-e29b-41d4-a716-446655440000',
      openedAt: 1735689600000,
      source: 'original',
    }

    expect(accessRecordSchema.parse(record).source).toBe('original')
    expect(accessRecordResponseSchema.parse({ records: [record] }).records).toHaveLength(1)
  })
})
