import { describe, expect, it } from 'vitest'
import {
  capabilitiesResponseSchema,
  paginationQuerySchema,
  saveBookmarkSkillInputSchema,
  snapshotReceiptSchema,
  suggestSceneSkillInputSchema,
  suggestionSchema,
  unifiedErrorSchema,
} from './index.js'

describe('M3/M4 shared schemas', () => {
  it('normalizes pagination defaults and rejects limits over 100', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 50 })
    expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow()
  })

  it('accepts save input and both snapshot receipt states', () => {
    expect(saveBookmarkSkillInputSchema.parse({ url: 'https://example.com', snapshot: true }).snapshot).toBe(true)
    expect(snapshotReceiptSchema.parse({
      jobId: '550e8400-e29b-41d4-a716-446655440001',
      snapshotStatus: 'queued_pending_browser',
    }).snapshotStatus).toBe('queued_pending_browser')
  })

  it('enforces suggestion target and status contracts', () => {
    const suggestion = suggestionSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      bookmarkId: '550e8400-e29b-41d4-a716-446655440000',
      kind: 'scene',
      targetId: null,
      targetLabel: '工作研究',
      confidence: 0.8,
      rationale: '匹配内容',
      status: 'pending',
      createdAt: 1735689600000,
      resolvedAt: null,
    })

    expect(suggestion.status).toBe('pending')
    expect(() => suggestSceneSkillInputSchema.parse({ bookmarkIds: [] })).toThrow()
    expect(() => suggestionSchema.parse({ ...suggestion, confidence: 2 })).toThrow()
  })

  it('accepts capabilities without user data or secrets', () => {
    const capabilities = capabilitiesResponseSchema.parse({
      name: 'dogear',
      version: 'v1',
      auth: 'Bearer token',
      skills: [
        { name: 'save_bookmark', write: true, capability: 'write_new', input: 'save_bookmark', notes: '保存书签' },
        { name: 'search_bookmarks', write: false, capability: 'read', input: 'search_bookmarks', notes: '搜索书签' },
        { name: 'update_bookmark', write: true, capability: 'update_existing', input: 'update_bookmark', notes: '更新书签' },
        { name: 'list_bookmarks', write: false, capability: 'read', input: 'list_bookmarks', notes: '列出书签' },
        { name: 'get_stats', write: false, capability: 'read', input: 'get_stats', notes: '统计信息' },
        { name: 'trigger_archive', write: true, capability: 'write_new', input: 'trigger_archive', notes: '触发归档' },
        { name: 'suggest_scene', write: true, capability: 'read', input: 'suggest_scene', notes: '生成建议' },
      ],
    })

    expect(capabilities.skills).toHaveLength(7)
  })

  it('supports unified errors with optional details', () => {
    expect(unifiedErrorSchema.parse({
      error: { code: 'CAPABILITY_DISABLED', message: 'Capability disabled', details: { skill: 'update_bookmark' } },
    }).error.code).toBe('CAPABILITY_DISABLED')
    expect(() => unifiedErrorSchema.parse({ error: { code: 'UNKNOWN', message: 'error' } })).toThrow()
  })
})
