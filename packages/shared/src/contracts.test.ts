import { describe, expect, it } from 'vitest'
import {
  batchUpdateRequestSchema,
  capabilitiesResponseSchema,
  channelConfigInputSchema,
  folderCreateInputSchema,
  folderUpdateInputSchema,
  paginationQuerySchema,
  recycleBinEmptyRequestSchema,
  saveBookmarkSkillInputSchema,
  sceneCreateInputSchema,
  sceneUpdateInputSchema,
  settingsWhitelistSchema,
  snapshotReceiptSchema,
  suggestSceneSkillInputSchema,
  suggestionSchema,
  tagCreateInputSchema,
  unifiedErrorSchema,
  workbenchCreateBookmarkInputSchema,
  workbenchPatchBookmarkInputSchema,
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

  it('save skill input keeps agent default and accepts extension source', () => {
    // 既有 agent 不传 source 不受影响；Chrome 扩展传 extension；其余取值拒绝
    expect(saveBookmarkSkillInputSchema.parse({ url: 'https://example.com' }).source).toBeUndefined()
    expect(saveBookmarkSkillInputSchema.parse({ url: 'https://example.com', source: 'extension' }).source).toBe('extension')
    expect(saveBookmarkSkillInputSchema.parse({ url: 'https://example.com', source: 'agent' }).source).toBe('agent')
    expect(() => saveBookmarkSkillInputSchema.parse({ url: 'https://example.com', source: 'page' })).toThrow()
  })

  it('save skill input accepts optional title/excerpt/favicon from the extension', () => {
    expect(saveBookmarkSkillInputSchema.parse({
      url: 'https://example.com',
      title: '  网页名  ',
      excerpt: '简介',
      favicon: 'https://example.com/favicon.ico',
    })).toMatchObject({
      title: '网页名',
      excerpt: '简介',
      favicon: 'https://example.com/favicon.ico',
    })
    expect(saveBookmarkSkillInputSchema.parse({ url: 'https://example.com', title: '   ' }).title).toBeUndefined()
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

  describe('settingsWhitelistSchema 必须拒绝未知键', () => {
    // docs/API结构表.md：「PUT /api/settings 只允许白名单…未知 key 返回 VALIDATION_ERROR」。
    // zod 默认会静默剥离未知键，那样打字错误会返回 200 + {items:[]}，
    // 客户端以为保存成功、实际什么都没写。这里锁住 .strict() 行为。
    it('接受白名单内的键', () => {
      expect(settingsWhitelistSchema.parse({ 'recycle.retention_days': '7' }))
        .toEqual({ 'recycle.retention_days': '7' })
      expect(settingsWhitelistSchema.parse({
        'skill.capabilities': { read: true, write_new: false, update_existing: false },
      })).toBeTruthy()
    })

    it('拒绝完全未知的键', () => {
      expect(() => settingsWhitelistSchema.parse({ bogus: 1 })).toThrow()
    })

    it('拒绝键名打字错误（最容易被静默吞掉的情形）', () => {
      expect(() => settingsWhitelistSchema.parse({ 'recycle.retention_day': '3' })).toThrow()
    })

    it('拒绝与白名单键混在一起的未知键', () => {
      expect(() => settingsWhitelistSchema.parse({
        'recycle.retention_days': '7',
        'skill.token': 'leak',
      })).toThrow()
    })

    it('空对象仍合法（不改动任何设置）', () => {
      expect(settingsWhitelistSchema.parse({})).toEqual({})
    })
  })

  describe('工作台入参拒绝未知字段，Skill 入参保持宽松', () => {
    // 这一组是**有意的不对称**，见 docs/TODO.md 记的取舍：
    // - 工作台只有自己的前端调用，字段名打错应当报错（否则静默丢弃、看起来保存成功）
    // - Skill 是对外接口，第三方 agent 可能回传含多余字段的完整对象，
    //   收紧会导致它保存书签直接失败——破坏外部契约比漏检字段名严重。
    // 若有人把 base schema 改成 strict（连带收紧 Skill），本组会失败。

    it('工作台创建书签：拒绝错拼字段', () => {
      expect(() => workbenchCreateBookmarkInputSchema.parse({
        url: 'https://example.com',
        notee: '错拼的备注',
      })).toThrow()
      expect(workbenchCreateBookmarkInputSchema.parse({ url: 'https://example.com' })).toBeTruthy()
    })

    it('工作台更新书签：拒绝错拼字段，但空对象也拒绝（至少给一个字段）', () => {
      expect(() => workbenchPatchBookmarkInputSchema.parse({ titel: '错拼' })).toThrow()
      expect(() => workbenchPatchBookmarkInputSchema.parse({})).toThrow()
      expect(workbenchPatchBookmarkInputSchema.parse({ title: '正常' })).toBeTruthy()
      // version 是工作台专属字段，需与 base 字段共存
      expect(workbenchPatchBookmarkInputSchema.parse({ title: '正常', version: 2 })).toBeTruthy()
    })

    it('Skill 保存书签：仍接受多余字段（外部契约，不可收紧）', () => {
      expect(saveBookmarkSkillInputSchema.parse({
        url: 'https://example.com',
        // agent 常回传完整对象，这些多余字段不应导致失败
        extraFieldFromAgent: 1,
        nested: { whatever: true },
      })).toBeTruthy()
    })

    it('工作台批量与回收站清空：拒绝未知字段', () => {
      const ids = ['11111111-1111-4111-8111-111111111111']
      expect(() => batchUpdateRequestSchema.parse({ ids, statuss: 'saved' })).toThrow()
      expect(batchUpdateRequestSchema.parse({ ids, status: 'saved' })).toBeTruthy()
      expect(() => recycleBinEmptyRequestSchema.parse({ onlyExpiredd: true })).toThrow()
      expect(recycleBinEmptyRequestSchema.parse({ onlyExpired: true })).toBeTruthy()
    })

    it('渠道配置：拒绝未知字段', () => {
      expect(() => channelConfigInputSchema.parse({
        channel: 'webdav', label: 'x', config: '{}', enable: true,
      })).toThrow()
      expect(channelConfigInputSchema.parse({
        channel: 'webdav', label: 'x', config: '{}', enabled: true,
      })).toBeTruthy()
    })
  })

  describe('组织维度入参（此前完全没有 schema，字段名打错会被静默丢弃）', () => {
    it('场景：接受文档列出的可编辑字段', () => {
      expect(sceneCreateInputSchema.parse({
        name: '工作研究', description: '说明', icon: 'i', sortOrder: 1, enabled: false, aerr: 'action',
      })).toBeTruthy()
      expect(sceneCreateInputSchema.parse({ name: '仅名称' })).toBeTruthy()
    })

    it('场景：拒绝错拼的 aerr', () => {
      // 这是最典型的一例：aer 过去会被接受，aerr 回落到 reference，
      // 进而改变工作台的排序/密度/主按钮，却毫无提示
      expect(() => sceneCreateInputSchema.parse({ name: 'x', aer: 'action' })).toThrow()
      expect(() => sceneCreateInputSchema.parse({ name: 'x', aerr: 'bogus' })).toThrow()
    })

    it('场景：拒绝空名与纯空白名', () => {
      expect(() => sceneCreateInputSchema.parse({ name: '' })).toThrow()
      expect(() => sceneCreateInputSchema.parse({ name: '   ' })).toThrow()
    })

    it('场景：不 trim（保持既有存储行为，只校验不变换）', () => {
      expect(sceneCreateInputSchema.parse({ name: '  带空格  ' })).toEqual({ name: '  带空格  ' })
    })

    it('场景：更新至少给一个字段，且拒绝错拼', () => {
      expect(() => sceneUpdateInputSchema.parse({})).toThrow()
      expect(() => sceneUpdateInputSchema.parse({ enabld: false })).toThrow()
      expect(sceneUpdateInputSchema.parse({ enabled: false })).toBeTruthy()
      expect(sceneUpdateInputSchema.parse({ aerr: 'explore' })).toBeTruthy()
    })

    it('文件夹：拒绝错拼的 parentId', () => {
      expect(() => folderCreateInputSchema.parse({ name: 'x', parentid: null })).toThrow()
      expect(folderCreateInputSchema.parse({ name: 'x', parentId: null })).toBeTruthy()
      expect(() => folderUpdateInputSchema.parse({ parentid: null })).toThrow()
      expect(folderUpdateInputSchema.parse({ parentId: null })).toBeTruthy()
    })

    it('标签：只接受 name（含可选 id），拒绝其它字段', () => {
      expect(tagCreateInputSchema.parse({ name: 'x' })).toBeTruthy()
      expect(() => tagCreateInputSchema.parse({ name: 'x', nmae: 'y' })).toThrow()
      expect(() => tagCreateInputSchema.parse({ name: 'x', nameKey: 'x' })).toThrow()
    })

    it('保留「客户端自带 id」的既有行为', () => {
      expect(sceneCreateInputSchema.parse({
        id: '11111111-1111-4111-8111-111111111111', name: 'x',
      })).toBeTruthy()
      expect(() => sceneCreateInputSchema.parse({ id: 'not-a-uuid', name: 'x' })).toThrow()
    })
  })
})
