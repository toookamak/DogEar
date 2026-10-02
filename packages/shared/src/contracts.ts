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

/**
 * 端侧全量检索的查询参数（2026-10-02，批次 2）。
 * 单独一套 schema：**只收 limit + cursor**，不接排序与时间范围——
 * 端侧预取要的是「一次拿全、按固定顺序拼」，让调用方传 sort 反而容易拼出重复或漏项。
 */
export const searchIndexQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).default(200),
  cursor: z.string().min(1).optional(),
})

/** 搜索瘦投影的一条记录：只要「能被搜到 + 能点开」的字段，不含 cover / excerpt 等大字段 */
export const searchIndexItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  domain: z.string().nullable(),
  note: z.string().nullable(),
  /** 标签名预先空格拼接，MiniSearch 可直接作为索引字段 */
  tagText: z.string(),
  tagNames: z.array(z.string()),
  folderName: z.string().nullable(),
  createdAt: z.string(),
})
export type SearchIndexItem = z.infer<typeof searchIndexItemSchema>

export const searchIndexResponseSchema = z.object({
  items: z.array(searchIndexItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number(),
})
export type SearchIndexResponse = z.infer<typeof searchIndexResponseSchema>

/**
 * 列表排序键。recent 为默认（createdAt 倒序，与既有行为一致）。
 * title / domain 由数据库层排序，避免「读全量再内存排序」——见 docs/API结构表.md 第 316 行。
 * important（v1.14）：收藏标星优先（important DESC → createdAt DESC）。
 * 均以 id 作为同值次级键，保证分页稳定。
 */
export const bookmarkSortSchema = z.enum(['recent', 'title', 'domain', 'important'])
export type BookmarkSort = z.infer<typeof bookmarkSortSchema>

/** 书签列表 / 搜索的查询参数：分页 + 排序 + 时间范围 / 导航展示筛选（v1.14） */
export const bookmarkListQuerySchema = paginationQuerySchema.extend({
  sort: bookmarkSortSchema.optional(),
  /** ISO 日期时间；闭区间端点 */
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  /** 是否在导航页展示（按 nav_rules 求值集过滤） */
  navVisible: z.enum(['true', 'false']).optional(),
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

/** 空串/空白视为未传，避免插件把空标题写成库里的 "" */
const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => (value ? value : undefined))

/**
 * save_bookmark 的 Skill 入参：base 之上扩展可选 `source`，以及插件可带上的页面元数据。
 * Chrome 扩展保存传 `source: 'extension'`（工作台来源条据此显示「插件」）；
 * 缺省仍为 `agent`，既有 agent 不传该字段不受影响（对外契约向后兼容）。
 * `title`/`excerpt`/`favicon` 可选：浏览器扩展在保存当下就能拿到，比服务端事后抓页更稳。
 * Skill 侧有意不加 .strict()（见 contracts-v1.1.ts 的说明），多传字段仍被宽松忽略。
 */
export const saveBookmarkSkillInputSchema = saveBookmarkInputSchema.extend({
  source: z.enum(['agent', 'extension']).optional(),
  title: optionalTrimmedText(500),
  excerpt: optionalTrimmedText(2000),
  favicon: z.string().url().nullish().transform((value) => (value ? value : undefined)),
})
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
