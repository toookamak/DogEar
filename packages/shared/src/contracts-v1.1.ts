import { z } from 'zod'
import { bookmarkSchema, createBookmarkInputSchema, updateBookmarkFieldsSchema } from './bookmark.js'
import { paginationQuerySchema, suggestionSchema } from './contracts.js'

export const idempotencyQuerySchema = z.object({
  idempotencyKey: z.string().min(8).max(255).optional(),
  sessionKey: z.string().min(1).optional(),
})

/**
 * 工作台侧书签入参：在 base schema 之上加 `.strict()`，**不改 base**。
 *
 * 为什么必须在使用点处理：`createBookmarkInputSchema` 被工作台与 Skill 共用
 * （`saveBookmarkSkillInputSchema = saveBookmarkInputSchema`，后者由 base `.extend()` 而来）。
 * 若直接给 base 加 strict，Skill 会一并收紧——而 Skill 是对外接口，第三方 agent
 * 可能回传含多余字段的完整对象，收紧会导致它保存失败，破坏外部契约。
 *
 * 加 strict 的目的：字段名打错（如 notee / statuss）时返回 400 而非静默丢弃，
 * 避免「看起来保存成功、实际该字段没生效」。详见 docs/TODO.md 记的取舍。
 */
export const workbenchCreateBookmarkInputSchema = createBookmarkInputSchema.strict()
export const workbenchBookmarkIdempotentResponseSchema = z.object({
  bookmark: bookmarkSchema,
  idempotent: z.boolean(),
  replay: z.boolean().default(false),
})

// 注意 `.strict()` 必须在 `.refine()` 之前：refine 返回 ZodEffects，其上没有 strict。
export const workbenchPatchBookmarkInputSchema = updateBookmarkFieldsSchema.strict().extend({
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

// 工作台专属端点，无对外调用方，可安全加 strict（见 workbenchCreateBookmarkInputSchema 的说明）
export const batchUpdateRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['unread', 'saved', 'archived']).optional(),
  addSceneIds: z.array(z.string().uuid()).optional(),
  removeSceneIds: z.array(z.string().uuid()).optional(),
  folderId: z.string().uuid().nullable().optional(),
  addTagIds: z.array(z.string().uuid()).optional(),
  removeTagIds: z.array(z.string().uuid()).optional(),
  deleted: z.boolean().optional(),
}).strict()

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
}).strict()
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

/**
 * PUT /api/settings 的白名单。
 *
 * 必须用 `.strict()`：zod 默认会**静默剥离**未知键，那样客户端把键名打错
 * （如 `recycle.retention_day` 少个 s）会拿到 200 + `{items:[]}`，
 * 看起来保存成功、实际什么都没写。docs/API结构表.md 明确要求
 * 「未知 key 返回 `VALIDATION_ERROR`」，strict 才能兑现该约定。
 */
export const settingsWhitelistSchema = z.object({
  'recycle.retention_days': z.union([z.string(), z.number()]).optional(),
  'skill.capabilities': z.object({
    read: z.boolean(),
    write_new: z.boolean(),
    update_existing: z.boolean(),
  }).optional(),
}).strict()

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

export const syncQueueStatusSchema = z.enum(['pending', 'processing', 'succeeded', 'failed'])
export const syncQueueActionSchema = z.enum(['create', 'update', 'delete'])
export const channelNameSchema = z.enum(['raindrop', 's3', 'webdav'])

export const syncQueueItemSchema = z.object({
  id: z.string().uuid(),
  action: syncQueueActionSchema,
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  channel: channelNameSchema,
  payload: z.string().nullable(),
  status: syncQueueStatusSchema,
  retryCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const channelConfigSchema = z.object({
  id: z.string().uuid(),
  channel: channelNameSchema,
  label: z.string().min(1).max(100),
  config: z.string().min(1), // JSON string
  enabled: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

// 工作台专属端点（渠道由工作台与自托管配置界面调用），加 strict 以拦截字段名打错
export const channelConfigInputSchema = z.object({
  channel: channelNameSchema,
  label: z.string().min(1).max(100),
  config: z.union([z.string().min(1), z.record(z.unknown())]),
  enabled: z.boolean().optional(),
}).strict()

export type SyncQueueItem = z.infer<typeof syncQueueItemSchema>
export type ChannelConfig = z.infer<typeof channelConfigSchema>
export type ChannelConfigInput = z.infer<typeof channelConfigInputSchema>

/**
 * 组织维度（Scene / Folder / Tag）入参。
 *
 * 此前这三条路由**没有任何 schema**——直接 `{ ...body }` 展开进 `resource.create()`，
 * 于是 `aer`（应为 `aerr`）、`enabld`（应为 `enabled`）、`parentid` 这类打字错误
 * 会被照常接受并静默丢弃，接口仍返回 201。字段白名单以
 * `docs/API结构表.md` §8.4 为准（「PATCH 只允许上述可编辑字段」）。
 *
 * 命名用「非空白」而非 `.trim()` 变换：现有路由是用 `body.name.trim()` 判空，
 * 但把原名原样入库。这里只做校验、不做变换，保持既有存储行为不变。
 */
const nonBlankName = z.string().refine((value) => value.trim().length > 0, { message: 'Name must not be blank' })
/** 场景 AERR 行为原型（PRD §2.0.3；系统内部概念，不展示给用户） */
export const aerrSchema = z.enum(['action', 'explore', 'read', 'reference'])

/** 创建允许的字段。`id` 可选以保留「客户端自带 id」的既有行为。 */
export const sceneCreateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: nonBlankName,
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
  aerr: aerrSchema.optional(),
}).strict()

/** 更新：字段全部可选，但至少要给一个（避免「什么都没改也返回 200」）。 */
export const sceneUpdateInputSchema = z.object({
  name: nonBlankName.optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
  aerr: aerrSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const folderCreateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: nonBlankName,
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).strict()

export const folderUpdateInputSchema = z.object({
  name: nonBlankName.optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const tagCreateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: nonBlankName,
}).strict()

export type SceneCreateInput = z.infer<typeof sceneCreateInputSchema>
export type SceneUpdateInput = z.infer<typeof sceneUpdateInputSchema>
export type FolderCreateInput = z.infer<typeof folderCreateInputSchema>
export type FolderUpdateInput = z.infer<typeof folderUpdateInputSchema>
export type TagCreateInput = z.infer<typeof tagCreateInputSchema>

export const archiveTierSchema = z.enum(['snapshot', 'reader', 'metadata'])
export const archiveStatusSchema = z.enum(['pending', 'completed', 'failed'])
export const backupTierSchema = z.enum(['light', 'medium', 'full'])
export const backupStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])

/**
 * 备份恢复（见 `docs/modules/20260904_备份功能设计.md` §2.8「恢复操作」）。
 *
 * 该设计稿定的语义是**覆盖**：「用备份中的书签 CSV 数据覆盖当前真源中的书签表
 * （全量替换，非增量合并）」，并要求「恢复前自动创建一次全量备份作为回滚点」。
 *
 * 服务端额外要求显式 `confirm: true`：这是破坏性端点，少一个字段就清库的代价太大，
 * 故把「明确确认」也做成契约的一部分（UI 侧另有二次确认对话框）。
 */
export const backupRestoreRequestSchema = z.object({
  /** 恢复范围。快照文件当前不产出（见 TODO 的 L3），故只支持书签表。 */
  bookmarks: z.boolean().optional(),
  /** 必须显式确认，防止误触导致全量替换 */
  confirm: z.literal(true),
}).strict()

export const backupRestoreResponseSchema = z.object({
  ok: z.literal(true),
  /** 本次恢复写入的书签数 */
  restored: z.number().int().nonnegative(),
  /** 被全量替换移除的原有书签数 */
  removed: z.number().int().nonnegative(),
  /** 为还原归属而新建的标签 / 场景数 */
  createdTags: z.number().int().nonnegative(),
  createdScenes: z.number().int().nonnegative(),
  /** 恢复前自动创建的回滚点备份 id；全量不可用时为 null（此时恢复会被拒绝） */
  rollbackBackupId: z.string().uuid().nullable(),
})

export const archiveSchema = z.object({
  id: z.string().uuid(),
  bookmarkId: z.string().uuid(),
  type: archiveTierSchema,
  status: archiveStatusSchema,
  filePath: z.string().nullable(),
  fileSize: z.number().int().nonnegative().nullable(),
  mimeType: z.string().nullable(),
  metadata: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable(),
})

export const backupSchema = z.object({
  id: z.string().uuid(),
  tier: backupTierSchema,
  target: z.string().min(1),
  status: backupStatusSchema,
  filePath: z.string().nullable(),
  fileSize: z.number().int().nonnegative().nullable(),
  includes: z.string().min(1),
  error: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable(),
})

export const backupConfigSchema = z.object({
  tier: backupTierSchema,
  target: z.string().min(1),
  frequencyHours: z.number().int().nonnegative(),
  retentionCount: z.number().int().positive().default(10),
  enabled: z.boolean().default(false),
})

export type Archive = z.infer<typeof archiveSchema>
export type BackupRestoreRequest = z.infer<typeof backupRestoreRequestSchema>
export type BackupRestoreResponse = z.infer<typeof backupRestoreResponseSchema>
export type Backup = z.infer<typeof backupSchema>
export type BackupConfig = z.infer<typeof backupConfigSchema>

export const navRuleModeSchema = z.enum(['all', 'rule', 'search', 'hide'])

export const navRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  mode: navRuleModeSchema,
  rule: z.string().nullable(),
  searchQuery: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const navRuleInputSchema = z.object({
  name: z.string().min(1).max(100),
  mode: navRuleModeSchema,
  rule: z.string().optional(),
  searchQuery: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  enabled: z.boolean().optional(),
})

export type NavRule = z.infer<typeof navRuleSchema>
export type NavRuleInput = z.infer<typeof navRuleInputSchema>
