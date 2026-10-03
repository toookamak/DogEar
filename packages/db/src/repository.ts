import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lt, lte, ne, notInArray, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import {
  accessRecords,
  archiveJobs,
  archives,
  backups,
  bookmarkScenes,
  bookmarkTags,
  bookmarks,
  channelConfig,
  conflicts,
  folders,
  idempotencyKeys,
  navRules,
  operationLog,
  scenes,
  settings,
  skillUsage,
  suggestions,
  syncQueue,
  tags,
} from './schema.js'

type D1Database = Parameters<typeof drizzleD1>[0]
type Db = any
type BookmarkInput = {
  id: string
  url: string
  status: 'unread' | 'saved' | 'archived'
  source?: 'page' | 'agent' | 'extension' | 'raindrop'
  note?: string | null
  intent?: string | null
  important?: boolean
  private?: boolean
  syncStatus?: 'pending' | 'synced'
  title?: string
  favicon?: string | null
  excerpt?: string | null
  cover?: string | null
  type?: 'link' | 'article' | 'video' | 'image'
  domain?: string | null
  raindropId?: string | null
  raindropExtras?: string | null
  /**
   * 仅用于「从备份恢复」：保留原记录的创建时间。
   * 不传时取当前时间（默认行为不变）。不加这个的话，恢复回来的书签全都变成
   * 「今天创建」，与恢复语义不符（工作台按创建时间排序）。
   */
  createdAt?: Date
}
type AccessRecordInput = { id: string; bookmarkId: string; source?: 'original' | 'snapshot'; client?: string }
type BookmarkFilters = {
  status?: string
  sceneId?: string
  folderId?: string | null | 'none'
  /** 'none' = 「未打标签」（一个都没挂），与具体 tagId 的 EXISTS 语义区分开 */
  tagId?: string | 'none'
  /** 「近 N 天没打开」：lastOpenedAt 为空或早于该时刻（2026-10-02 批次 1） */
  lastOpenedBefore?: Date
  important?: boolean
  source?: string
  q?: string
  includeDeleted?: boolean
  private?: boolean
  excludeStatus?: string
  /** 时间范围筛选（created_at 落索引列；闭区间端点由调用方换算） */
  createdFrom?: Date
  createdTo?: Date
  /**
   * 「是否在导航页展示」筛选（API 结构表 v1.14）：展示集不是字段而是 nav_rules
   * 求值结果，由路由层先跑 evaluateNavFeed 得到 id 集再传入。
   * id 集按 D1 单语句 100 绑定参数上限分片成多个 IN 组（AND/OR 连接），
   * 600 条基线内代价可接受；不做反向缓存。
   */
  navVisibleIds?: string[]
  navExcludedIds?: string[]
}
type BookmarkUpdate = Record<string, unknown> & { folderId?: string | null; tagIds?: string[]; sceneIds?: string[] }
type BatchUpdate = BookmarkUpdate & { ids: string[]; addSceneIds?: string[]; removeSceneIds?: string[]; addTagIds?: string[]; removeTagIds?: string[]; deleted?: boolean }
type BatchUpdateSkippedItem = { id: string; reason: 'not_found' | 'deleted' }
type TagRenameResult = { ok: true; record: unknown } | { ok: false; reason: 'not_found' | 'name_conflict' }
type TagMergeResult = { ok: true; moved: number; target: unknown } | { ok: false; reason: 'not_found' | 'same_tag' }
type SceneMergeResult = { ok: true; moved: number; target: unknown } | { ok: false; reason: 'not_found' | 'same_scene' }
export type BookmarkStats = {
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
  byFolder: Array<{ id: string; name: string; count: number }>
  byScene: Array<{ id: string; name: string; count: number }>
  byTag: Array<{ id: string; name: string; count: number }>
  importantCount: number
  recycleCount: number
}
type Timestamped = { createdAt?: Date; updatedAt?: Date }

export type PageResult<T> = {
  items: T[]
  nextCursor: string | null
  /** 当前筛选条件下的总数（分页器「共 y 页」用）；listRecycleBin 等衍生分页可能缺省 */
  total?: number
}

export type InboxPageResult<T> = {
  bookmarks: T[]
  nextCursor: string | null
  total?: number
}

export type IdempotencyRecord = {
  key: string
  actor: string
  requestPath: string
  requestBodyHash: string
  statusCode: number
  responseBody: string
  expiresAt: Date
  createdAt: Date
}

export type SkillUsageKey = {
  date: string
  bucket: 'read' | 'write' | 'blocked'
}

export type SyncQueueItem = {
  id: string
  action: 'create' | 'update' | 'delete'
  targetType: string
  targetId: string
  channel: string
  payload: string | null
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  retryCount: number
  error: string | null
  createdAt: Date
  updatedAt: Date
}

export type BookmarkRepository = {
  create: (input: BookmarkInput) => Promise<unknown>
  list: (filters?: BookmarkFilters, limit?: number, cursor?: string, opts?: { orderBy?: string; sort?: CursorSort }) => Promise<PageResult<unknown>>
  listInbox: (limit?: number, cursor?: string) => Promise<InboxPageResult<unknown>>
  listRecycleBin: (limit?: number, cursor?: string) => Promise<PageResult<unknown>>
  countPending: () => Promise<number>
  createAccessRecord: (input: AccessRecordInput) => Promise<unknown>
  listAccessRecords: (bookmarkId: string) => Promise<unknown[]>
  get: (id: string, includeDeleted?: boolean) => Promise<unknown | undefined>
  findByRaindropId: (raindropId: string) => Promise<unknown | undefined>
  findByRaindropIds: (raindropIds: string[]) => Promise<unknown[]>
  /**
   * 取一批书签已挂的标签 id（2026-10-02，Raindrop 拉取侧回填用）。
   * 拉回时要判断「本地是否已有标签」才能决定回填还是跳过——逐条查 N 次不划算，
   * 且 D1 单次调用有 50 子请求上限，故必须批量。
   */
  findTagIdsByBookmarkIds: (bookmarkIds: string[]) => Promise<Map<string, string[]>>
  findByUrls: (urls: string[]) => Promise<unknown[]>
  updateMany: (patches: Array<{ id: string } & Record<string, unknown>>) => Promise<void>
  createMany: (inputs: BookmarkInput[]) => Promise<unknown[]>
  /**
   * 批量挂标签（2026-10-02，Raindrop 拉回侧专用）。**只插不改**：
   * 拉回来的标签是远端事实，本地若已挂同名标签则命中主键冲突后忽略，
   * 绝不在拉取路径上删除本地已有挂载——那会把「拉取」变成一次破坏性写入。
   * 一次 50 条书签的标签在 D1 上是 1~2 个子请求，不是逐条 N 次。
   */
  attachTagsBatch: (pairs: Array<{ bookmarkId: string; tagIds: string[] }>) => Promise<void>
  /** 导出/同步用的瘦投影：只取推送所需列，一条查询搞定（避免 list 的逐条关联查询） */
  listExportRows: (opts: { onlyWithoutRaindropId?: boolean }, limit?: number, offset?: number) => Promise<unknown[]>
  /**
   * 端侧全量检索的瘦投影（2026-10-02，批次 2）。只取「能被搜到 + 能点开」的字段：
   * id / title / url / domain / note / tagText / folderName / createdAt。
   *
   * **刻意不含 cover、excerpt、body 等大字段**——3412 条的预取是要常驻浏览器内存的，
   * 封面 URL 与摘要是其中最大的冗余，带上会让传输量与内存翻数倍。
   * 命中后由前端按 id 回服务端取完整对象，不靠这份投影渲染列表。
   */
  listSearchIndex: (limit?: number, cursor?: string) => Promise<{ items: unknown[]; nextCursor: string | null; total: number }>
  countWithoutRaindropId: () => Promise<number>
  /** 批量写回远端 raindropId 并标 synced（导出成功 / 队列 create 成功共用） */
  updateRaindropIds: (pairs: Array<{ id: string; raindropId: string }>) => Promise<void>
  markSyncStatus: (bookmarkIds: string[], status: 'pending' | 'synced') => Promise<void>
  listRecentOpened: (limit?: number) => Promise<unknown[]>
  search: (filters: BookmarkFilters, limit?: number, cursor?: string, opts?: { orderBy?: string; sort?: CursorSort }) => Promise<PageResult<unknown>>
  /** 侧栏计数 / 统计聚合（不含回收站；口径见实现注释） */
  stats: () => Promise<BookmarkStats>
  update: (id: string, input: BookmarkUpdate) => Promise<unknown | undefined>
  batchUpdate: (input: BatchUpdate) => Promise<{ updated: unknown[]; skipped: BatchUpdateSkippedItem[] }>
  softDelete: (id: string) => Promise<unknown | undefined>
  restore: (id: string) => Promise<unknown | undefined>
  purgeDeleted: (ids?: string[], before?: Date) => Promise<number>
  idempotency: {
    findReplay: (key: string, actor: string) => Promise<IdempotencyRecord | undefined>
    store: (record: IdempotencyRecord) => Promise<void>
  }
  skillUsage: {
    increment: (bucket: 'read' | 'write' | 'blocked') => Promise<void>
    getDaily: (date: string) => Promise<{ read: number; write: number; blocked: number }>
  }
  scenes: ResourceRepositories['scenes']
  folders: ResourceRepositories['folders']
  tags: ResourceRepositories['tags']
  suggestions: ResourceRepositories['suggestions']
  operationLog: ResourceRepositories['operationLog']
  settings: ResourceRepositories['settings']
  archives: ResourceRepositories['archives']
  archiveJobs: ResourceRepositories['archiveJobs']
  conflicts: ResourceRepositories['conflicts']
  syncQueue: ResourceRepositories['syncQueue']
	  backups: ResourceRepositories['backups']
  navRules: {
    list: () => Promise<unknown[]>
    get: (id: string) => Promise<unknown | undefined>
    create: (data: { id: string; name: string; mode: string; rule?: string; searchQuery?: string; sortOrder?: number; enabled?: boolean; createdAt?: Date; updatedAt?: Date }) => Promise<unknown>
    update: (id: string, data: Record<string, unknown>) => Promise<unknown | undefined>
    remove: (id: string) => Promise<void>
  }
  channelConfig: ResourceRepositories['channelConfig']
}

type ResourceRepositories = {
  scenes: { list: () => Promise<unknown[]>; create: (input: Record<string, unknown>) => Promise<unknown>; update: (id: string, input: Record<string, unknown>) => Promise<unknown | undefined>; remove: (id: string) => Promise<boolean>; merge: (sourceId: string, targetId: string) => Promise<SceneMergeResult> }
  folders: { list: () => Promise<unknown[]>; create: (input: Record<string, unknown>) => Promise<unknown>; update: (id: string, input: Record<string, unknown>) => Promise<unknown | undefined>; remove: (id: string) => Promise<boolean>; ensureByRaindropId: (items: Array<{ raindropId: number; name: string }>) => Promise<{ synced: number; created: number }> }
  tags: { list: () => Promise<unknown[]>; create: (input: Record<string, unknown>) => Promise<unknown>; remove: (id: string) => Promise<boolean>; rename: (id: string, input: { name: string }) => Promise<TagRenameResult>; merge: (sourceId: string, targetId: string) => Promise<TagMergeResult>; ensureMany: (names: string[]) => Promise<Map<string, string>> }
  suggestions: { list: (bookmarkId: string, status?: string) => Promise<PageResult<unknown>>; create: (input: Record<string, unknown>) => Promise<unknown>; resolve: (id: string, status: string) => Promise<unknown | undefined>; accept: (id: string, actor?: string) => Promise<unknown | undefined> }
  operationLog: {
    list: (filters?: Record<string, unknown>) => Promise<unknown[]>
    get: (id: string) => Promise<unknown | undefined>
    append: (input: Record<string, unknown>) => Promise<unknown>
    consumeRevert: (id: string) => Promise<unknown | undefined>
    /** 保留策略清理（v1.15）：按天数与最大条数删旧日志，返回删除总数 */
    cleanup: (opts?: { retentionDays?: number; maxEntries?: number }) => Promise<{ removed: number }>
  }
  settings: { list: () => Promise<unknown[]>; get: (key: string) => Promise<unknown | undefined>; set: (key: string, value: unknown) => Promise<unknown> }
  archives: {
    create: (data: { id: string; bookmarkId: string; type: string; status?: string; error?: string }) => Promise<unknown>
    get: (id: string) => Promise<unknown | undefined>
    listByBookmark: (bookmarkId: string) => Promise<unknown[]>
    updateStatus: (id: string, status: string, data?: { filePath?: string; fileSize?: number; mimeType?: string; error?: string; metadata?: string }) => Promise<unknown | undefined>
    listPending: (limit?: number) => Promise<unknown[]>
    countPending: () => Promise<number>
  }
  archiveJobs: {
    list: (bookmarkId?: string) => Promise<unknown[]>
    get: (id: string) => Promise<unknown | undefined>
    create: (input: Record<string, unknown>) => Promise<unknown>
    update: (id: string, input: Record<string, unknown>) => Promise<unknown | undefined>
    getStatus: (id: string) => Promise<string | undefined>
  }
  channelConfig: {
    list: () => Promise<unknown[]>
    get: (id: string) => Promise<unknown | undefined>
    create: (data: { id: string; channel: string; label: string; config: string; enabled?: boolean }) => Promise<unknown>
    update: (id: string, data: { label?: string; config?: string; enabled?: boolean }) => Promise<unknown | undefined>
    remove: (id: string) => Promise<boolean>
  }
  conflicts: {
    list: (resolution?: string) => Promise<unknown[]>
    get: (id: string) => Promise<unknown | undefined>
    findByRaindropId: (raindropId: string, resolution?: string) => Promise<unknown | undefined>
    findByRaindropIds: (raindropIds: string[], resolution?: string) => Promise<unknown[]>
    create: (data: { id: string; bookmarkId: string | null; raindropId: string; localSnapshot?: string | null; remoteSnapshot?: string | null }) => Promise<unknown>
    createMany: (data: Array<{ id: string; bookmarkId: string | null; raindropId: string; localSnapshot?: string | null; remoteSnapshot?: string | null }>) => Promise<unknown[]>
    resolve: (id: string, resolution: 'kept_local' | 'kept_remote' | 'merged') => Promise<unknown | undefined>
    resolveAll: (resolution: 'kept_local' | 'kept_remote' | 'merged') => Promise<number>
    countPending: () => Promise<number>
  }
  syncQueue: {
    enqueue: (action: string, targetType: string, targetId: string, channel: string, payload?: string | null) => Promise<SyncQueueItem>
    getPending: (limit?: number) => Promise<SyncQueueItem[]>
    /** failed 项（供消费器按指数退避判断后重置回 pending） */
    listFailed: (limit?: number) => Promise<SyncQueueItem[]>
    updateStatus: (id: string, status: 'pending' | 'processing' | 'succeeded' | 'failed', error?: string | null) => Promise<SyncQueueItem | undefined>
    /** 消费器批量回写：failed 整组 retry_count+1，其余清 error */
    updateStatusMany: (entries: Array<{ id: string; status: 'pending' | 'processing' | 'succeeded' | 'failed'; error?: string | null }>) => Promise<void>
    remove: (id: string) => Promise<boolean>
    countPending: () => Promise<number>
    /** failed 计数（重试超限的毒条目在此可见；状态栏同步卡片用） */
    countFailed: () => Promise<number>
  }
  backups: {
    create: (data: { id: string; tier: string; target: string; includes: string }) => Promise<unknown>
    get: (id: string) => Promise<unknown | undefined>
    list: (limit?: number) => Promise<unknown[]>
    updateStatus: (id: string, status: string, data?: { filePath?: string; fileSize?: number; error?: string }) => Promise<unknown | undefined>
  }
}

function now() {
  return new Date()
}

type CursorSort = 'recent' | 'title' | 'domain' | 'important'
type Cursor = { sort: CursorSort; value: string; id: string }

// 游标格式：`<sort>~<encodeURIComponent(value)>~<id>`。value 的语义随 sort 变化：
// recent 为 createdAt 的毫秒时间戳，title/domain 为排序字段值。游标对客户端不透明。
// 排序键写入游标，保证分页与排序一致（否则改排序后翻页会漏项/重项）。
function encodeCursor(sort: CursorSort, value: string, id: string): string {
  return `${sort}~${encodeURIComponent(value)}~${id}`
}

function decodeCursor(cursor: string): Cursor | null {
  const first = cursor.indexOf('~')
  const last = cursor.lastIndexOf('~')
  if (first < 0 || last <= first) return null
  const sort = cursor.slice(0, first)
  if (sort !== 'recent' && sort !== 'title' && sort !== 'domain' && sort !== 'important') return null
  try {
    return { sort, value: decodeURIComponent(cursor.slice(first + 1, last)), id: cursor.slice(last + 1) }
  } catch {
    return null
  }
}

/** title/domain 用 coalesce 归空串，避免 NULL 在升序里的排序歧义与 keyset 漏项 */
function sortColumn(sort: CursorSort) {
  if (sort === 'title') return sql`coalesce(${bookmarks.title}, '')`
  if (sort === 'domain') return sql`coalesce(${bookmarks.domain}, '')`
  return bookmarks.createdAt
}

function sortValueOf(sort: CursorSort, row: any): string {
  const base = row?.bookmarks ?? row
  if (sort === 'title') return String(base?.title ?? '')
  if (sort === 'domain') return String(base?.domain ?? '')
  if (sort === 'important') return `${base?.important ? 1 : 0}:${toCursorMs(base?.createdAt)}`
  const createdAt = base?.createdAt
  return String(createdAt instanceof Date ? createdAt.getTime() : createdAt)
}

function toCursorMs(value: unknown): string {
  if (value instanceof Date) return String(value.getTime())
  return String(Number(value ?? 0))
}

function keysetCondition(cursor: Cursor) {
  if (cursor.sort === 'recent') {
    const value = new Date(Number(cursor.value))
    return or(
      lt(bookmarks.createdAt, value),
      and(eq(bookmarks.createdAt, value), lt(bookmarks.id, cursor.id)),
    )
  }
  if (cursor.sort === 'important') {
    // 排序口径：important DESC → createdAt DESC → id DESC。
    // 游标值形如 `${important}:${createdAtMs}`（"1:1700…" / "0:1700…"），逐级比较取「严格小于游标」的下一页。
    const separator = cursor.value.indexOf(':')
    const cursorImportant = separator === 1 && cursor.value[0] === '1' ? 1 : 0
    const cursorCreatedAt = new Date(Number(cursor.value.slice(separator + 1)))
    return or(
      sql`${bookmarks.important} < ${cursorImportant}`,
      and(
        eq(bookmarks.important, cursorImportant === 1),
        or(
          lt(bookmarks.createdAt, cursorCreatedAt),
          and(eq(bookmarks.createdAt, cursorCreatedAt), lt(bookmarks.id, cursor.id)),
        ),
      ),
    )
  }
  const col = sortColumn(cursor.sort)
  return or(
    sql`${col} > ${cursor.value}`,
    and(sql`${col} = ${cursor.value}`, gt(bookmarks.id, cursor.id)),
  )
}

/** 仅当游标的排序键与本次请求一致时才应用 keyset；否则视为无效游标，回到首页，
 *  避免用另一套排序的边界值去过滤当前排序，产生漏项或重复。 */
function keysetConditionOf(sort: CursorSort, cursor: string) {
  const decoded = decodeCursor(cursor)
  return decoded && decoded.sort === sort ? keysetCondition(decoded) : undefined
}

function paginatedQuery<T>(
  sort: CursorSort,
  rows: T[],
  limit: number,
  cursorOf: (row: T) => { value: string; id: string },
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const last = items[items.length - 1]
  const nextCursor = hasMore && last
    ? (() => { const c = cursorOf(last); return encodeCursor(sort, c.value, c.id) })()
    : null
  return { items, nextCursor }
}

/**
 * 事务执行。
 *
 * Cloudflare D1 **不支持 SQL 级事务**：drizzle 的 d1 session 会发 `BEGIN TRANSACTION`，
 * D1 直接报错（要求改用 Durable Objects 的 storage.transaction()）。若沿用驱动事务，
 * 所有多步写入路径（更新、批量、回收站清理等）在 D1 上都会 500。
 * 故由调用方按运行时传入 useSqlTransaction：D1 为 false，多步写入按序执行
 * （每条语句自身原子，整组不保证原子回滚）；SQLite（Bun / better-sqlite3）为 true，保持真事务。
 */
function transaction(db: Db, action: (tx: Db) => Promise<any>, useSqlTransaction = true) {
  return useSqlTransaction && typeof db.transaction === 'function' ? db.transaction(action) : action(db)
}

async function replaceRelations(tx: Db, bookmarkId: string, input: BookmarkUpdate, at: Date) {
  if (input.sceneIds) {
    await tx.delete(bookmarkScenes).where(eq(bookmarkScenes.bookmarkId, bookmarkId)).run()
    if (input.sceneIds.length) await tx.insert(bookmarkScenes).values(input.sceneIds.map((sceneId) => ({ bookmarkId, sceneId, source: 'user', createdAt: at }))).run()
  }
  if (input.tagIds) {
    await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId)).run()
    if (input.tagIds.length) await tx.insert(bookmarkTags).values(input.tagIds.map((tagId) => ({ bookmarkId, tagId, source: 'user', createdAt: at }))).run()
  }
}

async function readRelations(db: Db, bookmarkId: string) {
  const [sceneRows, tagRows, suggestionRows, bookmarkRow] = await Promise.all([
    db.select({ id: scenes.id, name: scenes.name }).from(bookmarkScenes).innerJoin(scenes, eq(bookmarkScenes.sceneId, scenes.id)).where(eq(bookmarkScenes.bookmarkId, bookmarkId)).all(),
    db.select({ id: tags.id, name: tags.name }).from(bookmarkTags).innerJoin(tags, eq(bookmarkTags.tagId, tags.id)).where(eq(bookmarkTags.bookmarkId, bookmarkId)).all(),
    db.select({ count: count() }).from(suggestions).where(and(eq(suggestions.bookmarkId, bookmarkId), eq(suggestions.status, 'pending'))).all(),
    db.select({ folderId: bookmarks.folderId }).from(bookmarks).where(eq(bookmarks.id, bookmarkId)).all(),
  ])
  const folderId = bookmarkRow[0]?.folderId
  const folder = folderId
    ? (await db.select({ id: folders.id, name: folders.name }).from(folders).where(eq(folders.id, folderId)).all())[0] ?? null
    : null
  return { scenes: sceneRows, tags: tagRows, folder, pendingSuggestionCount: Number(suggestionRows[0]?.count ?? 0) }
}

/**
 * 整页关联批量读取：4 条查询拿回一页所有书签的 Scene/标签/待确认建议数/文件夹，
 * 替代逐条 readRelations（每条 4~5 次查询——50 条一页就是 200+ 次子请求，
 * Workers（轨 A）Free 档单次调用 50 子请求内必炸，列表页整体打不开）。
 * inArray 每条查询 ≤50 个绑定参数，在 D1 单语句 100 参数上限内。
 */
async function readRelationsBatch(db: Db, bookmarkIds: string[]) {
  if (!bookmarkIds.length) return new Map()
  const [sceneRows, tagRows, suggestionRows, folderRows] = await Promise.all([
    db.select({ bookmarkId: bookmarkScenes.bookmarkId, id: scenes.id, name: scenes.name })
      .from(bookmarkScenes).innerJoin(scenes, eq(bookmarkScenes.sceneId, scenes.id))
      .where(inArray(bookmarkScenes.bookmarkId, bookmarkIds)).all(),
    db.select({ bookmarkId: bookmarkTags.bookmarkId, id: tags.id, name: tags.name })
      .from(bookmarkTags).innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(inArray(bookmarkTags.bookmarkId, bookmarkIds)).all(),
    db.select({ bookmarkId: suggestions.bookmarkId })
      .from(suggestions)
      .where(and(inArray(suggestions.bookmarkId, bookmarkIds), eq(suggestions.status, 'pending'))).all(),
    db.select({ id: bookmarks.id, folderId: folders.id, name: folders.name })
      .from(bookmarks).leftJoin(folders, eq(bookmarks.folderId, folders.id))
      .where(inArray(bookmarks.id, bookmarkIds)).all(),
  ])
  const relationMap = new Map<string, { scenes: unknown[]; tags: unknown[]; folder: unknown; pendingSuggestionCount: number }>()
  for (const id of bookmarkIds) relationMap.set(id, { scenes: [], tags: [], folder: null, pendingSuggestionCount: 0 })
  for (const row of sceneRows as Array<{ bookmarkId: string; id: string; name: string }>) {
    relationMap.get(row.bookmarkId)?.scenes.push({ id: row.id, name: row.name })
  }
  for (const row of tagRows as Array<{ bookmarkId: string; id: string; name: string }>) {
    relationMap.get(row.bookmarkId)?.tags.push({ id: row.id, name: row.name })
  }
  for (const row of suggestionRows as Array<{ bookmarkId: string }>) {
    const entry = relationMap.get(row.bookmarkId)
    if (entry) entry.pendingSuggestionCount += 1
  }
  for (const row of folderRows as Array<{ id: string; folderId: string | null; name: string | null }>) {
    const entry = relationMap.get(row.id)
    if (entry && row.folderId && row.name) entry.folder = { id: row.folderId, name: row.name }
  }
  return relationMap
}

/**
 * 过滤条件。关联维度（Scene / Tag / 标签名搜索）一律用 **EXISTS 子查询**，
 * 不用 JOIN：Bookmark↔Scene、Bookmark↔Tag 都是多对多，JOIN 会产生笛卡尔积，
 * 一条挂 2 场景 + 2 标签的书签在按场景/标签筛选或搜索时会重复出现 2~4 次
 * （已实测复现）。EXISTS 结构上不可能产生重复行，且无需 DISTINCT
 * （DISTINCT 会破坏 keyset 分页的边界值），也能用上 bookmark_scenes/tags 的既有索引。
 */
/** id 集条件：≤90 个 id 一片（bookmarkTags 插入同款参数预算口径），包含集 OR 连接、排除集 AND 连接 */
function idSetCondition(ids: string[], mode: 'include' | 'exclude') {
  if (!ids.length) return mode === 'include' ? sql`1 = 0` : undefined
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 90) chunks.push(ids.slice(i, i + 90))
  if (chunks.length === 1) {
    return mode === 'include' ? inArray(bookmarks.id, chunks[0]) : notInArray(bookmarks.id, chunks[0])
  }
  const parts = chunks.map((chunk) => (mode === 'include' ? inArray(bookmarks.id, chunk) : notInArray(bookmarks.id, chunk)))
  return mode === 'include' ? or(...parts) : and(...parts)
}

function filterCondition(filters: BookmarkFilters = {}) {
  const conditions: any[] = []
  if (!filters.includeDeleted) conditions.push(isNull(bookmarks.deletedAt))
  if (filters.status) conditions.push(eq(bookmarks.status, filters.status))
  if (filters.folderId === 'none' || filters.folderId === null) conditions.push(isNull(bookmarks.folderId))
  else if (filters.folderId) conditions.push(eq(bookmarks.folderId, filters.folderId))
  if (filters.important !== undefined) conditions.push(eq(bookmarks.important, filters.important))
  if (filters.source) conditions.push(eq(bookmarks.source, filters.source))
  if (filters.private !== undefined) conditions.push(eq(bookmarks.private, filters.private))
  if (filters.excludeStatus) conditions.push(ne(bookmarks.status, filters.excludeStatus))
  if (filters.createdFrom) conditions.push(gte(bookmarks.createdAt, filters.createdFrom))
  if (filters.createdTo) conditions.push(lte(bookmarks.createdAt, filters.createdTo))
  // 导航展示集过滤：id 集分片成多个 IN 组（D1 单语句 100 绑定参数上限）。
  // 包含集 = 片间 OR；排除集 = 片间 AND NOT IN。空集语义：「在导航展示」恒为空。
  if (filters.navVisibleIds !== undefined) {
    conditions.push(idSetCondition(filters.navVisibleIds, 'include'))
  }
  if (filters.navExcludedIds !== undefined) {
    conditions.push(idSetCondition(filters.navExcludedIds, 'exclude'))
  }
  if (filters.sceneId) {
    conditions.push(sql`exists (select 1 from ${bookmarkScenes} where ${bookmarkScenes.bookmarkId} = ${bookmarks.id} and ${bookmarkScenes.sceneId} = ${filters.sceneId})`)
  }
  // 2026-10-02 批次 1：无状态筛选条件。
  // 'none' 与具体 tagId 是**互斥**的两支——若不 else，「未打标签」会同时叠加
  // EXISTS(tag_id = 'none')（永远查无此标签）与 NOT EXISTS，结果恒为空。
  // 「未打标签」不是「某些标签」，是「一个都没挂」，故用 NOT EXISTS。
  if (filters.tagId === 'none') {
    conditions.push(sql`not exists (select 1 from ${bookmarkTags} where ${bookmarkTags.bookmarkId} = ${bookmarks.id})`)
  } else if (filters.tagId) {
    conditions.push(sql`exists (select 1 from ${bookmarkTags} where ${bookmarkTags.bookmarkId} = ${bookmarks.id} and ${bookmarkTags.tagId} = ${filters.tagId})`)
  }
  // 「近 N 天没打开」：lastOpenedAt 为空（从没打开过）或早于给定时刻。
  // 两点都必要：① 走 lt() 而非裸 sql 模板，让 Drizzle 按列类型绑定时间戳
  // （裸模板传 Date 会撞 SQLite 的 datatype mismatch）；② 显式带上 isNull 分支
  // ——SQLite 里 NULL < cutoff 恒为 false，只写后半句会把「从没打开过」这批
  // （往往正是最该清理的）整个漏掉。
  if (filters.lastOpenedBefore !== undefined) {
    conditions.push(or(
      isNull(bookmarks.lastOpenedAt),
      lt(bookmarks.lastOpenedAt, filters.lastOpenedBefore),
    ))
  }
  if (filters.q) {
    const q = `%${filters.q}%`
    // 标签名命中也走 EXISTS，避免 JOIN tags 带来的重复
    conditions.push(or(
      like(bookmarks.title, q),
      like(bookmarks.url, q),
      like(bookmarks.note, q),
      sql`exists (select 1 from ${bookmarkTags} inner join ${tags} on ${bookmarkTags.tagId} = ${tags.id} where ${bookmarkTags.bookmarkId} = ${bookmarks.id} and ${tags.name} like ${q})`,
    ))
  }
  return conditions.length ? and(...conditions) : undefined
}

/** 运行时写入能力：D1 无 SQL 事务，SQLite 有 */
export type RepositoryOptions = {
  sqlTransactions?: boolean
}

/** create/createMany 共用的字段缺省，保证两条路径落库形状一致 */
function buildBookmarkRecord(input: BookmarkInput, timestamp: Date) {
  return { ...input, source: input.source ?? 'page', note: input.note ?? null, intent: input.intent ?? null, important: input.important ?? false, private: input.private ?? false, syncStatus: input.syncStatus ?? 'pending', version: 1, deletedAt: null, createdAt: input.createdAt ?? timestamp, updatedAt: timestamp }
}

/**
 * 批量执行写语句：D1 走 db.batch（N 条语句 1 次子请求）——Workers 单次调用有
 * 50 子请求上限且 D1 每条查询都计入，逐条执行必超；SQLite（Bun / better-sqlite3）
 * 无子请求概念，顺序执行即可。
 */
async function runBatched(db: Db, statements: Array<{ run: () => Promise<unknown> }>): Promise<void> {
  if (!statements.length) return
  const batch = (db as { batch?: (items: unknown[]) => Promise<unknown> }).batch
  if (typeof batch === 'function') await batch.call(db, statements)
  else for (const statement of statements) await statement.run()
}

/**
 * D1 单条语句最多 100 个绑定参数：多行 VALUES 插入按列数分片（留余量）。
 *
 * **空数组是合法输入，这里已兜住**：`Object.keys(records[0])` 遇 `undefined` 会抛，
 * 而「第二次拉取时全部已存在、records 必为空」是**常态而非边界**——
 * `attachTagsBatch`（整页无标签）、`tags.ensureMany` 与
 * `folders.ensureByRaindropId`（第二次拉取起全部命中已有）都会走到空数组。
 * 判空放在 helper 里而不是各调用方，是为了新增调用点时不会忘记。
 */
function chunkByParamBudget(records: Array<Record<string, unknown>>): Array<Array<Record<string, unknown>>> {
  if (!records.length) return []
  const perChunk = Math.max(1, Math.floor(90 / Math.max(1, Object.keys(records[0]).length)))
  const chunks: Array<Array<Record<string, unknown>>> = []
  for (let i = 0; i < records.length; i += perChunk) chunks.push(records.slice(i, i + perChunk))
  return chunks
}

/**
 * 按 id 集查询并合并结果，id 集过长时**自动分片**（每片 90 个）。
 *
 * 为什么需要：`listSearchIndex` 的 `limit` 允许到 300，
 * `listExportRows` 的候选集是 `count + excludeIds.length`（失败累积越多越大）——
 * 直接 `inArray(ids)` 就会在 D1 上撞 100 绑定参数上限。
 *
 * **SQLite 没有这个限制，所以 node:sqlite 上的测试全是绿的**，
 * 只有真 D1（Workers 部署）才会炸。分片口径与 `idSetCondition` 一致。
 */
async function selectByIds<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  if (!ids.length) return []
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 90) out.push(...await run(ids.slice(i, i + 90)))
  return out
}

export function createD1BookmarkRepository(database: D1Database): BookmarkRepository {
  // D1 无 SQL 事务能力，显式关闭，避免写路径抛 500
  return createBookmarkRepository(drizzleD1(database), { sqlTransactions: false })
}

export function createBookmarkRepository(db: Db, options: RepositoryOptions = {}): BookmarkRepository {
  const useSqlTransaction = options.sqlTransactions ?? true
  /** 本仓库实例的事务包装：按运行时能力决定是否真的开事务 */
  const tx = (action: (t: Db) => Promise<any>) => transaction(db, action, useSqlTransaction)
  const repository = {} as BookmarkRepository
  repository.create = async (input) => {
    const record = buildBookmarkRecord(input, now())
    await db.insert(bookmarks).values(record).run()
    return record
  }
  repository.createMany = async (inputs) => {
    if (!inputs.length) return []
    const timestamp = now()
    const records = inputs.map((input) => buildBookmarkRecord(input, timestamp))
    const created: unknown[] = []
    for (const chunk of chunkByParamBudget(records)) {
      await db.insert(bookmarks).values(chunk).run()
      created.push(...chunk)
    }
    return created
  }
  repository.attachTagsBatch = async (pairs) => {
    const timestamp = now()
    const seen = new Set<string>()
    const records: Array<Record<string, unknown>> = []
    for (const pair of pairs) {
      const unique = Array.from(new Set(pair.tagIds.filter(Boolean)))
      for (const tagId of unique) {
        const key = `${pair.bookmarkId}::${tagId}`
        if (seen.has(key)) continue
        seen.add(key)
        records.push({ bookmarkId: pair.bookmarkId, tagId, source: 'raindrop', createdAt: timestamp })
      }
    }
    for (const chunk of chunkByParamBudget(records)) {
      await db.insert(bookmarkTags).values(chunk).onConflictDoNothing().run()
    }
  }
  repository.list = async (filters = {}, limit = 50, cursor?: string, opts?: { orderBy?: string; sort?: CursorSort }) => {
    const sort: CursorSort = opts?.sort ?? 'recent'
    const filterOnly = filterCondition(filters)
    // 只查 bookmarks 一张表：关联维度的过滤已由 filterCondition 用 EXISTS 表达，
    // 不再 JOIN 多对多表，因此结果里不会有重复行，也无需 DISTINCT。
    const query = db.select().from(bookmarks)
    const orderColumns: SQL[] = (opts?.orderBy === 'lastOpenedAt'
      ? [desc(bookmarks.lastOpenedAt)]
      : sort === 'important'
        // important 排序：important DESC → createdAt DESC（标星优先，组内按时间倒序）
        ? [desc(bookmarks.important), desc(bookmarks.createdAt)]
        : sort === 'recent'
          ? [desc(bookmarks.createdAt)]
          : [asc(sortColumn(sort))])
    const tiebreak: SQL = sort === 'recent' || sort === 'important' || opts?.orderBy === 'lastOpenedAt' ? desc(bookmarks.id) : asc(bookmarks.id)
    const rows = await query.where(cursor ? and(filterOnly, keysetConditionOf(sort, cursor)) : filterOnly)
      .orderBy(...orderColumns, tiebreak).limit(limit + 1).all()
    const page = paginatedQuery(sort, rows, limit, (row: any) => ({ value: sortValueOf(sort, row), id: row.id ?? row.bookmarks?.id }))
    // 总数按「仅筛选条件」统计（不含游标键），供前端分页器显示「共 y 页」
    const totalRows = await db.select({ count: count() }).from(bookmarks).where(filterOnly).all()
    const relationMap = await readRelationsBatch(db, page.items.map((row: any) => row.id ?? row.bookmarks?.id))
    const items = page.items.map((row: any) => {
      const base = row.bookmarks ?? row
      return { ...base, ...(relationMap.get(String(base.id)) ?? { scenes: [], tags: [], folder: null, pendingSuggestionCount: 0 }) }
    })
    return { items, nextCursor: page.nextCursor, total: Number(totalRows[0]?.count ?? 0) }
  }
  repository.listInbox = async (limit = 50, cursor?: string) => {
    const result = await repository.list({ status: 'unread' }, limit, cursor)
    return { bookmarks: result.items, nextCursor: result.nextCursor, total: result.total }
  }
  repository.listRecycleBin = async (limit = 50, cursor?: string) => {
    const result = await repository.list({ includeDeleted: true }, limit, cursor)
    const filtered = result.items.filter((item: any) => item.deletedAt)
    const paginated = paginatedQuery('recent', filtered, limit, (row: any) => ({ value: sortValueOf('recent', row), id: row.id ?? row.bookmarks?.id }))
    return paginated
  }
  repository.countPending = async () => {
    const result = await db.select({ count: count() }).from(bookmarks).where(eq(bookmarks.syncStatus, 'pending')).all()
    return Number(result[0]?.count ?? 0)
  }
  /**
   * 侧栏计数 / 统计面板共用的聚合接口（API 结构表 v1.14）。
   * 口径与 list 一致：不含回收站（deletedAt 非空）；含私密（侧栏是用户自己的视角）。
   * D1 每条聚合算 1 次子请求，共 8 条，Free 档 50 上限内。
   */
  repository.stats = async () => {
    const alive = isNull(bookmarks.deletedAt)
    const [totalRows, statusRows, sourceRows, folderRows, sceneRows, tagRows, importantRows, recycleRows] = await Promise.all([
      db.select({ count: count() }).from(bookmarks).where(alive).all(),
      db.select({ key: bookmarks.status, count: count() }).from(bookmarks).where(alive).groupBy(bookmarks.status).all(),
      db.select({ key: bookmarks.source, count: count() }).from(bookmarks).where(alive).groupBy(bookmarks.source).all(),
      db.select({ id: bookmarks.folderId, name: folders.name, count: count() })
        .from(bookmarks).innerJoin(folders, eq(bookmarks.folderId, folders.id))
        .where(alive).groupBy(bookmarks.folderId, folders.name).all(),
      db.select({ id: bookmarkScenes.sceneId, name: scenes.name, count: count() })
        .from(bookmarkScenes).innerJoin(scenes, eq(bookmarkScenes.sceneId, scenes.id)).innerJoin(bookmarks, eq(bookmarkScenes.bookmarkId, bookmarks.id))
        .where(alive).groupBy(bookmarkScenes.sceneId, scenes.name).all(),
      db.select({ id: bookmarkTags.tagId, name: tags.name, count: count() })
        .from(bookmarkTags).innerJoin(tags, eq(bookmarkTags.tagId, tags.id)).innerJoin(bookmarks, eq(bookmarkTags.bookmarkId, bookmarks.id))
        .where(alive).groupBy(bookmarkTags.tagId, tags.name).all(),
      db.select({ count: count() }).from(bookmarks).where(and(alive, eq(bookmarks.important, true))).all(),
      db.select({ count: count() }).from(bookmarks).where(isNotNull(bookmarks.deletedAt)).all(),
    ])
    return {
      total: Number(totalRows[0]?.count ?? 0),
      byStatus: Object.fromEntries(statusRows.map((row: any) => [String(row.key), Number(row.count)])),
      bySource: Object.fromEntries(sourceRows.map((row: any) => [String(row.key), Number(row.count)])),
      byFolder: folderRows.map((row: any) => ({ id: String(row.id), name: String(row.name), count: Number(row.count) })),
      byScene: sceneRows.map((row: any) => ({ id: String(row.id), name: String(row.name), count: Number(row.count) })),
      byTag: tagRows.map((row: any) => ({ id: String(row.id), name: String(row.name), count: Number(row.count) })),
      importantCount: Number(importantRows[0]?.count ?? 0),
      recycleCount: Number(recycleRows[0]?.count ?? 0),
    }
  }
  repository.createAccessRecord = async (input) => {
    const timestamp = now()
    const record = { ...input, source: input.source ?? 'original', client: input.client ?? 'workbench', openedAt: timestamp }
    await tx(async (tx) => {
      await tx.insert(accessRecords).values(record).run()
      if (typeof tx.update === 'function') await tx.update(bookmarks).set({ lastOpenedAt: timestamp, updatedAt: timestamp }).where(eq(bookmarks.id, input.bookmarkId)).run()
    })
    return record
  }
  repository.listAccessRecords = async (bookmarkId) => db.select().from(accessRecords).where(eq(accessRecords.bookmarkId, bookmarkId)).orderBy(desc(accessRecords.openedAt)).all()
  repository.get = async (id, includeDeleted = false) => {
    const rows = await db.select().from(bookmarks).where(and(eq(bookmarks.id, id), includeDeleted ? undefined : isNull(bookmarks.deletedAt))).all()
    const row = rows[0]
    if (!row) return undefined
    return { ...row, ...(await readRelations(db, id)) }
  }
  repository.findByRaindropId = async (raindropId) => {
    const rows = await db.select().from(bookmarks).where(and(eq(bookmarks.raindropId, raindropId), isNull(bookmarks.deletedAt))).all()
    return rows[0]
  }
  repository.findByRaindropIds = async (raindropIds) => {
    if (!raindropIds.length) return []
    return db.select().from(bookmarks).where(and(inArray(bookmarks.raindropId, raindropIds), isNull(bookmarks.deletedAt))).all()
  }
  repository.findByUrls = async (urls) => {
    const unique = [...new Set(urls.filter(Boolean))]
    if (!unique.length) return []
    return db.select().from(bookmarks).where(and(inArray(bookmarks.url, unique), isNull(bookmarks.deletedAt))).all()
  }
  repository.findTagIdsByBookmarkIds = async (bookmarkIds) => {
    const mapping = new Map<string, string[]>()
    const unique = [...new Set(bookmarkIds.filter(Boolean))]
    for (const id of unique) mapping.set(id, [])
    if (!unique.length) return mapping
    const rows = await db.select({ bookmarkId: bookmarkTags.bookmarkId, tagId: bookmarkTags.tagId })
      .from(bookmarkTags)
      // 分片：批量回填一次可能要查几百条，D1 单语句绑定参数上限约 100
      .where(inArray(bookmarkTags.bookmarkId, unique.slice(0, 90)))
      .all() as Array<{ bookmarkId: string; tagId: string }>
    let chunkStart = 90
    while (chunkStart < unique.length) {
      const more = await db.select({ bookmarkId: bookmarkTags.bookmarkId, tagId: bookmarkTags.tagId })
        .from(bookmarkTags)
        .where(inArray(bookmarkTags.bookmarkId, unique.slice(chunkStart, chunkStart + 90)))
        .all() as Array<{ bookmarkId: string; tagId: string }>
      rows.push(...more)
      chunkStart += 90
    }
    for (const row of rows) mapping.get(row.bookmarkId)?.push(row.tagId)
    return mapping
  }
  repository.updateMany = async (patches) => {
    if (!patches.length) return
    const timestamp = now()
    const allowed = new Set(['title', 'excerpt', 'cover', 'note', 'intent', 'important', 'private', 'status', 'raindropId', 'raindropExtras', 'syncStatus', 'author', 'favicon', 'domain', 'publishedAt', 'broken'])
    await runBatched(db, patches.map((patch) => {
      const { id, ...input } = patch
      const changes = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)))
      return db.update(bookmarks).set({ ...changes, version: sql`${bookmarks.version} + 1`, updatedAt: timestamp }).where(eq(bookmarks.id, id))
    }))
  }
  repository.listExportRows = async (opts = {}, limit = 50, offset = 0) => {
    const conditions: any[] = [isNull(bookmarks.deletedAt)]
    if (opts.onlyWithoutRaindropId) conditions.push(isNull(bookmarks.raindropId))
    // 排序键与 list 一致（createdAt desc + id 兜底），保证分页导出时顺序稳定
    const rows = await db.select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      note: bookmarks.note,
      status: bookmarks.status,
      folderId: bookmarks.folderId,
    })
      .from(bookmarks).where(and(...conditions))
      .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
      .limit(limit).offset(offset).all()
    // 2026-10-02 批次 0：补上标签名与远端 collection id。
    // 此前导出只带 url/title/note，**用户本地整理好的收藏夹与标签在导出时被静默丢掉**——
    // 推回 Raindrop 的是一条「裸链接」，等于整理成果没有出口。
    // 仍维持「一条书签查询 + 两条批量关联查询」，不做逐条关联。
    // 关联查询**分片**：候选集是 count + excludeIds.length，导出失败累积多了就超 D1 绑定参数上限。
    const ids = rows.map((row: any) => String(row.id))
    if (ids.length === 0) return rows
    const tagRows = await selectByIds(ids, (chunk) => db.select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
      .from(bookmarkTags)
      .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(inArray(bookmarkTags.bookmarkId, chunk))
      .all() as Promise<Array<{ bookmarkId: string; name: string }>>)
    const folderIds: string[] = Array.from(new Set(rows.filter((row: any) => row.folderId).map((row: any) => String(row.folderId))))
    const mapped = await selectByIds<{ id: string; raindropId: string | null }>(folderIds, async (chunk) =>
      await db.select({ id: folders.id, raindropId: folders.raindropId })
        .from(folders)
        .where(inArray(folders.id, chunk))
        .all(),
    )
    const raindropIds = new Map<string, string>()
    for (const row of mapped) {
      if (row.raindropId) raindropIds.set(row.id, row.raindropId)
    }
    return rows.map((row: any) => {
      const bookmarkId = String(row.id)
      return {
        ...row,
        tagNames: (tagRows as Array<{ bookmarkId: string; name: string }>)
          .filter((tag) => tag.bookmarkId === bookmarkId)
          .map((tag) => tag.name),
        // 未映射到远端集合时为 null，调用方应留空而不是塞一个错的 id
        collectionId: row.folderId ? (raindropIds.get(String(row.folderId)) ?? null) : null,
      }
    })
  }
  repository.countWithoutRaindropId = async () => {
    const result = await db.select({ count: count() }).from(bookmarks).where(and(isNull(bookmarks.deletedAt), isNull(bookmarks.raindropId))).all()
    return Number(result[0]?.count ?? 0)
  }
  repository.listSearchIndex = async (limit = 100, cursor?: string) => {
    // 排序与游标**复用 list 的 keyset 机制**（sort='recent'：createdAt DESC + id 兜底），
    // 不自己拼游标字符串——手写过一版，把 ISO 串拿去和整型 createdAt 比，
    // 分页不收敛。这里直接走已验证的 paginatedQuery / keysetConditionOf。
    const page = await db.select({
      id: bookmarks.id,
      title: bookmarks.title,
      url: bookmarks.url,
      domain: bookmarks.domain,
      note: bookmarks.note,
      createdAt: bookmarks.createdAt,
    })
      .from(bookmarks)
      .where(and(isNull(bookmarks.deletedAt), cursor ? keysetConditionOf('recent', cursor) : undefined))
      .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
      .limit(limit + 1).all()
    const result = paginatedQuery('recent', page, limit, (row: any) => ({ value: toCursorMs(row.createdAt), id: String(row.id) }))
    const totalRows = await db.select({ count: count() }).from(bookmarks).where(isNull(bookmarks.deletedAt)).all()
    const total = Number(totalRows[0]?.count ?? 0)
    const rows = result.items as any[]
    if (rows.length === 0) return { items: [], nextCursor: null, total }

    // 标签与收藏夹名：批量查询，不逐条关联；**必须分片**（limit 可达 300 > D1 100 参数上限）
    const ids = rows.map((row) => String(row.id))
    const tagRows = await selectByIds(ids, (chunk) => db.select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
      .from(bookmarkTags)
      .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(inArray(bookmarkTags.bookmarkId, chunk))
      .all() as Promise<Array<{ bookmarkId: string; name: string }>>)
    const folderRows = await selectByIds(ids, (chunk) => db.select({ id: bookmarks.id, name: folders.name })
      .from(bookmarks).leftJoin(folders, eq(bookmarks.folderId, folders.id))
      .where(inArray(bookmarks.id, chunk))
      .all() as Promise<Array<{ id: string; name: string | null }>>)
    const tagsByBookmark = new Map<string, string[]>()
    for (const row of tagRows as Array<{ bookmarkId: string; name: string }>) {
      const list = tagsByBookmark.get(row.bookmarkId)
      if (list) list.push(row.name)
      else tagsByBookmark.set(row.bookmarkId, [row.name])
    }
    const folderByBookmark = new Map<string, string>()
    for (const row of folderRows as Array<{ id: string; name: string | null }>) {
      if (row.name) folderByBookmark.set(row.id, row.name)
    }

    const items = rows.map((row) => {
      const id = String(row.id)
      const tagNames = tagsByBookmark.get(id) ?? []
      return {
        id,
        title: row.title,
        url: row.url,
        domain: row.domain ?? null,
        note: row.note ?? null,
        // 预先拼好：MiniSearch 直接吃这个字段，前端不必每次查询再拼
        tagText: tagNames.join(' '),
        tagNames,
        folderName: folderByBookmark.get(id) ?? null,
        createdAt: new Date(row.createdAt).toISOString(),
      }
    })
    return { items, nextCursor: result.nextCursor, total }
  }
  repository.updateRaindropIds = async (pairs) => {
    const timestamp = now()
    await runBatched(db, pairs.map((pair) => db.update(bookmarks).set({
      raindropId: pair.raindropId,
      syncStatus: 'synced',
      version: sql`${bookmarks.version} + 1`,
      updatedAt: timestamp,
    }).where(eq(bookmarks.id, pair.id))))
  }
  repository.markSyncStatus = async (bookmarkIds, status) => {
    const ids = [...new Set(bookmarkIds)].filter(Boolean)
    if (!ids.length) return
    const timestamp = now()
    await runBatched(db, ids.map((id) => db.update(bookmarks).set({
      syncStatus: status,
      version: sql`${bookmarks.version} + 1`,
      updatedAt: timestamp,
    }).where(eq(bookmarks.id, id))))
  }
  repository.listRecentOpened = async (limit = 20) => {
    const rows = await db.select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      favicon: bookmarks.favicon,
      domain: bookmarks.domain,
      openedAt: accessRecords.openedAt,
    }).from(accessRecords)
      .innerJoin(bookmarks, eq(accessRecords.bookmarkId, bookmarks.id))
      .where(and(isNull(bookmarks.deletedAt), eq(bookmarks.private, false), ne(bookmarks.status, 'unread')))
      .orderBy(desc(accessRecords.openedAt))
      .limit(Math.max(limit, 1) * 10)
      .all()
    const seen = new Set<string>()
    const items: unknown[] = []
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      items.push(row)
      if (items.length >= limit) break
    }
    return items
  }
  repository.search = async (filters, limit = 50, cursor?: string, opts?: { orderBy?: string; sort?: CursorSort }) => repository.list(filters, limit, cursor, opts)
  repository.update = async (id, input) => tx(async (tx) => {
    const existing = await tx.select().from(bookmarks).where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt))).all()
    if (!existing[0]) return undefined
    const timestamp = now()
    const allowed = new Set(['title', 'excerpt', 'cover', 'note', 'intent', 'important', 'private', 'status', 'folderId', 'raindropId', 'raindropExtras', 'syncStatus', 'author', 'favicon', 'domain', 'publishedAt', 'broken'])
    const changes = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)))
    await tx.update(bookmarks).set({ ...changes, version: existing[0].version + 1, updatedAt: timestamp }).where(eq(bookmarks.id, id)).run()
    await replaceRelations(tx, id, input, timestamp)
    return repository.get(id)
  })
  repository.batchUpdate = async (input) => tx(async (tx) => {
    const updated: unknown[] = []
    const skipped: BatchUpdateSkippedItem[] = []
    for (const id of input.ids) {
      const existing = await tx.select().from(bookmarks).where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt))).all()
      if (!existing[0]) {
        const deleted = await tx.select().from(bookmarks).where(eq(bookmarks.id, id)).all()
        skipped.push({ id, reason: deleted[0]?.deletedAt ? 'deleted' : 'not_found' })
        continue
      }
      const timestamp = now()
      const changes: Record<string, unknown> = {}
      for (const key of ['status', 'folderId', 'important', 'private']) if (key in input) changes[key] = input[key]
      if (input.deleted) changes.deletedAt = timestamp
      await tx.update(bookmarks).set({ ...changes, version: existing[0].version + 1, updatedAt: timestamp }).where(eq(bookmarks.id, id)).run()
      if (input.addSceneIds?.length) await tx.insert(bookmarkScenes).values(input.addSceneIds.map((sceneId) => ({ bookmarkId: id, sceneId, source: 'user', createdAt: timestamp }))).onConflictDoNothing().run()
      if (input.removeSceneIds?.length) await tx.delete(bookmarkScenes).where(and(eq(bookmarkScenes.bookmarkId, id), inArray(bookmarkScenes.sceneId, input.removeSceneIds))).run()
      if (input.addTagIds?.length) await tx.insert(bookmarkTags).values(input.addTagIds.map((tagId) => ({ bookmarkId: id, tagId, source: 'user', createdAt: timestamp }))).onConflictDoNothing().run()
      if (input.removeTagIds?.length) await tx.delete(bookmarkTags).where(and(eq(bookmarkTags.bookmarkId, id), inArray(bookmarkTags.tagId, input.removeTagIds))).run()
      updated.push({ ...existing[0], ...changes, version: existing[0].version + 1, updatedAt: timestamp })
    }
    return { updated, skipped }
  })
  repository.softDelete = async (id) => {
    const timestamp = now()
    await db.update(bookmarks).set({ deletedAt: timestamp, updatedAt: timestamp, version: sql`${bookmarks.version} + 1` }).where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt))).run()
    return repository.get(id, true)
  }
  repository.restore = async (id) => {
    await db.update(bookmarks).set({ deletedAt: null, updatedAt: now() }).where(and(eq(bookmarks.id, id), isNotNull(bookmarks.deletedAt))).run()
    return repository.get(id)
  }
  repository.purgeDeleted = async (ids, before) => tx(async (tx) => {
    const conditions: any[] = [isNotNull(bookmarks.deletedAt)]
    if (ids?.length) conditions.push(inArray(bookmarks.id, ids))
    if (before) conditions.push(lt(bookmarks.deletedAt, before))
    const rows = await tx.select({ id: bookmarks.id }).from(bookmarks).where(and(...conditions)).all()
    for (const row of rows) {
      await tx.delete(bookmarkScenes).where(eq(bookmarkScenes.bookmarkId, row.id)).run()
      await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, row.id)).run()
      await tx.delete(suggestions).where(eq(suggestions.bookmarkId, row.id)).run()
      await tx.delete(accessRecords).where(eq(accessRecords.bookmarkId, row.id)).run()
      await tx.delete(archiveJobs).where(and(eq(archiveJobs.bookmarkId, row.id), eq(archiveJobs.status, 'pending'))).run()
      await tx.delete(bookmarks).where(eq(bookmarks.id, row.id)).run()
    }
    return rows.length
  })

  repository.scenes = {
    list: async () => db.select().from(scenes).orderBy(scenes.sortOrder, scenes.createdAt).all(),
    create: async (input) => { const timestamp = now(); const record = { ...input, aerr: input.aerr ?? 'reference', enabled: input.enabled ?? true, sortOrder: input.sortOrder ?? 0, createdAt: timestamp, updatedAt: timestamp }; await db.insert(scenes).values(record).run(); return record },
    update: async (id, input) => { const record = { ...input, updatedAt: now() }; await db.update(scenes).set(record).where(eq(scenes.id, id)).run(); return (await db.select().from(scenes).where(eq(scenes.id, id)).all())[0] },
    remove: async (id) => { const members = await db.select().from(bookmarkScenes).where(eq(bookmarkScenes.sceneId, id)).all(); if (members.length) return false; await db.delete(scenes).where(eq(scenes.id, id)).run(); return true },
    /** 合并到目标场景（API 结构表 v1.15）：挂载转移（主键去重）后删除源场景；D1 无事务按序执行 */
    merge: async (sourceId, targetId) => tx(async (t) => {
      if (sourceId === targetId) return { ok: false as const, reason: 'same_scene' as const }
      const [sourceRows, targetRows] = await Promise.all([
        t.select().from(scenes).where(eq(scenes.id, sourceId)).all(),
        t.select().from(scenes).where(eq(scenes.id, targetId)).all(),
      ])
      const source = sourceRows[0]
      const target = targetRows[0]
      if (!source || !target) return { ok: false as const, reason: 'not_found' as const }
      const mountings = await t.select().from(bookmarkScenes).where(eq(bookmarkScenes.sceneId, sourceId)).all()
      if (mountings.length) {
        const remapped = mountings.map((row: any) => ({ bookmarkId: row.bookmarkId, sceneId: targetId, source: row.source, createdAt: row.createdAt }))
        await runBatched(t, remapped.map((row: { bookmarkId: string; sceneId: string; source: string; createdAt: unknown }) => t.insert(bookmarkScenes).values(row).onConflictDoNothing()))
      }
      await t.delete(bookmarkScenes).where(eq(bookmarkScenes.sceneId, sourceId)).run()
      await t.delete(scenes).where(eq(scenes.id, sourceId)).run()
      return { ok: true as const, moved: mountings.length, target }
    }),
  }
  repository.folders = {
    list: async () => db.select().from(folders).orderBy(folders.sortOrder, folders.createdAt).all(),
    create: async (input) => { const timestamp = now(); const record = { ...input, parentId: input.parentId ?? null, sortOrder: input.sortOrder ?? 0, createdAt: timestamp, updatedAt: timestamp }; await db.insert(folders).values(record).run(); return record },
    update: async (id, input) => { await db.update(folders).set({ ...input, updatedAt: now() }).where(eq(folders.id, id)).run(); return (await db.select().from(folders).where(eq(folders.id, id)).all())[0] },
    remove: async (id) => { await db.update(bookmarks).set({ folderId: null, updatedAt: now() }).where(eq(bookmarks.folderId, id)).run(); await db.delete(folders).where(eq(folders.id, id)).run(); return true },
    /**
     * 按远端 Raindrop 集合 id 批量确保本地 folder 存在（2026-10-02，批次 0 拉取侧）。
     * 写 `folders.raindrop_id` 建立双向映射——该列 M5 阶段就预留了，此前一直为空。
     * 已存在同 `raindrop_id` 的**不重复创建**；同名的本地 folder 也不覆盖
     * （用户自己建的同名文件夹是用户的，不因为远端也有一个就吞掉）。
     */
    ensureByRaindropId: async (items) => {
      if (!items.length) return { synced: 0, created: 0 }
      const timestamp = now()
      const existing = await db.select({ id: folders.id, raindropId: folders.raindropId }).from(folders).all()
      const known = new Set(existing.map((row: any) => String(row.raindropId ?? '')).filter(Boolean))
      const seen = new Set<string>()
      const records: Array<Record<string, unknown>> = []
      for (const item of items) {
        const key = String(item.raindropId)
        if (known.has(key) || seen.has(key)) continue
        const name = item.name.trim()
        if (!name) continue
        seen.add(key)
        records.push({ id: crypto.randomUUID(), name, parentId: null, sortOrder: 0, raindropId: key, createdAt: timestamp, updatedAt: timestamp })
      }
      for (const chunk of chunkByParamBudget(records)) {
        await db.insert(folders).values(chunk).run()
      }
      return { synced: items.length, created: records.length }
    },
  }
  repository.tags = {
    list: async () => db.select().from(tags).orderBy(tags.name).all(),
    create: async (input) => { const name = String(input.name); const nameKey = String(input.nameKey ?? name.toLowerCase()); const found = await db.select().from(tags).where(eq(tags.nameKey, nameKey)).all(); if (found[0]) return found[0]; const record = { id: input.id, name, nameKey, createdAt: now() }; await db.insert(tags).values(record).run(); return record },
    /**
     * 按名字批量确保标签存在，返回 `nameKey → tagId` 映射（2026-10-02，批次 0 拉取侧）。
     *
     * 为什么要批量：一次拉回 50 条书签可能带 100+ 个不重复标签，逐条 `create`
     * 就是 100+ 次子请求，**必然超出 Workers Free 档单次调用 50 子请求的上限**。
     * 这里走「1 次 list 查全量 + 1~2 次分片插入」。
     *
     * 键口径：Raindrop 的标签**本身就是字符串名**，没有独立 id，所以 `name_key`（小写）
     * 就是天然的映射键——这也是批次 0 能做到零 schema 改动的原因。
     */
    ensureMany: async (names) => {
      const wanted = Array.from(new Set(names.map((n) => String(n ?? '').trim()).filter(Boolean)))
      if (!wanted.length) return new Map<string, string>()
      const existing = await db.select({ id: tags.id, name: tags.name, nameKey: tags.nameKey }).from(tags).all()
      const mapping = new Map<string, string>()
      for (const row of existing as Array<{ id: string; name: string; nameKey: string }>) {
        if (!mapping.has(row.nameKey)) mapping.set(row.nameKey, row.id)
      }
      const timestamp = now()
      const records = wanted
        .filter((name) => !mapping.has(name.toLowerCase()))
        .map((name) => ({ id: crypto.randomUUID(), name, nameKey: name.toLowerCase(), createdAt: timestamp }))
      for (const chunk of chunkByParamBudget(records)) {
        await db.insert(tags).values(chunk).onConflictDoNothing().run()
      }
      // 插入后回读一次：拿到新标签的 id（D1 的 RETURNING 行为与 SQLite 并不一致，回读最稳）
      if (records.length) {
        const inserted = await db.select({ id: tags.id, nameKey: tags.nameKey }).from(tags).where(inArray(tags.nameKey, records.map((r) => r.nameKey))).all()
        for (const row of inserted as Array<{ id: string; nameKey: string }>) {
          if (!mapping.has(row.nameKey)) mapping.set(row.nameKey, row.id)
        }
      }
      return mapping
    },
    remove: async (id) => { await db.delete(bookmarkTags).where(eq(bookmarkTags.tagId, id)).run(); await db.delete(tags).where(eq(tags.id, id)).run(); return true },
    /** 改名（API 结构表 v1.14）：name_key 唯一，撞名返回 name_conflict；标签按 id 挂载，改名对所有书签即时生效 */
    rename: async (id, input) => tx(async (t) => {
      const name = String(input.name).trim()
      if (!name) return { ok: false as const, reason: 'not_found' as const }
      const nameKey = name.toLowerCase()
      const conflict = await t.select().from(tags).where(and(eq(tags.nameKey, nameKey), ne(tags.id, id))).all()
      if (conflict[0]) return { ok: false as const, reason: 'name_conflict' as const }
      await t.update(tags).set({ name, nameKey }).where(eq(tags.id, id)).run()
      const record = (await t.select().from(tags).where(eq(tags.id, id)).all())[0]
      return record ? { ok: true as const, record } : { ok: false as const, reason: 'not_found' as const }
    }),
    /**
     * 合并到目标标签（API 结构表 v1.14）：源标签挂载转移到目标（主键去重，已挂目标的保留原状），
     * 随后删除源挂载与源标签。D1 无事务，按序执行；插入走 runBatched 分片（4 列 ≤22 行/片）。
     */
    merge: async (sourceId, targetId) => tx(async (t) => {
      if (sourceId === targetId) return { ok: false as const, reason: 'same_tag' as const }
      const [sourceRows, targetRows] = await Promise.all([
        t.select().from(tags).where(eq(tags.id, sourceId)).all(),
        t.select().from(tags).where(eq(tags.id, targetId)).all(),
      ])
      const source = sourceRows[0]
      const target = targetRows[0]
      if (!source || !target) return { ok: false as const, reason: 'not_found' as const }
      const mountings = await t.select().from(bookmarkTags).where(eq(bookmarkTags.tagId, sourceId)).all()
      if (mountings.length) {
        const remapped = mountings.map((row: any) => ({ bookmarkId: row.bookmarkId, tagId: targetId, source: row.source, createdAt: row.createdAt }))
        await runBatched(t, remapped.map((row: { bookmarkId: string; tagId: string; source: string; createdAt: unknown }) => t.insert(bookmarkTags).values(row).onConflictDoNothing()))
      }
      await t.delete(bookmarkTags).where(eq(bookmarkTags.tagId, sourceId)).run()
      await t.delete(tags).where(eq(tags.id, sourceId)).run()
      return { ok: true as const, moved: mountings.length, target }
    }),
  }
  repository.suggestions = {
    list: async (bookmarkId, status) => {
      const items = await db.select().from(suggestions).where(and(eq(suggestions.bookmarkId, bookmarkId), status ? eq(suggestions.status, status) : undefined)).orderBy(desc(suggestions.createdAt)).all()
      return { items, nextCursor: null }
    },
    create: async (input) => { const record = { ...input, status: input.status ?? 'pending', createdAt: input.createdAt ?? now(), resolvedAt: null }; await db.insert(suggestions).values(record).run(); return record },
    resolve: async (id, status) => { const record = { status, resolvedAt: now() }; await db.update(suggestions).set(record).where(eq(suggestions.id, id)).run(); return (await db.select().from(suggestions).where(eq(suggestions.id, id)).all())[0] },
    accept: async (id, actor = 'user') => tx(async (tx) => {
      const suggestion = (await tx.select().from(suggestions).where(and(eq(suggestions.id, id), eq(suggestions.status, 'pending'))).all())[0]
      if (!suggestion) return undefined
      const timestamp = now()
      if (suggestion.kind === 'scene' && suggestion.targetId) await tx.insert(bookmarkScenes).values({ bookmarkId: suggestion.bookmarkId, sceneId: suggestion.targetId, source: 'ai_accepted', createdAt: timestamp }).onConflictDoNothing().run()
      if (suggestion.kind === 'tag' && suggestion.targetId) await tx.insert(bookmarkTags).values({ bookmarkId: suggestion.bookmarkId, tagId: suggestion.targetId, source: 'ai_accepted', createdAt: timestamp }).onConflictDoNothing().run()
      if (suggestion.kind === 'folder' && suggestion.targetId) await tx.update(bookmarks).set({ folderId: suggestion.targetId, updatedAt: timestamp }).where(eq(bookmarks.id, suggestion.bookmarkId)).run()
      await tx.update(suggestions).set({ status: 'accepted', resolvedAt: timestamp }).where(eq(suggestions.id, id)).run()
      await tx.insert(operationLog).values({ id: crypto.randomUUID(), actor, action: 'accept_suggestion', targetType: 'suggestion', targetId: id, detail: null, createdAt: timestamp }).run()
      return { ...suggestion, status: 'accepted', resolvedAt: timestamp }
    }),
  }
  repository.operationLog = {
    list: async (filters = {}) => { const conditions: any[] = []; if (typeof filters.actor === 'string') conditions.push(eq(operationLog.actor, filters.actor)); if (typeof filters.action === 'string') conditions.push(eq(operationLog.action, filters.action)); return db.select().from(operationLog).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(operationLog.createdAt)).all() },
    get: async (id) => (await db.select().from(operationLog).where(eq(operationLog.id, id)).all())[0],
    append: async (input) => { const record = { ...input, id: input.id ?? crypto.randomUUID(), createdAt: input.createdAt ?? now(), detail: input.detail ?? null, revertToken: input.revertToken ?? null }; await db.insert(operationLog).values(record).run(); return record },
    consumeRevert: async (id) => {
      const row = (await db.select().from(operationLog).where(eq(operationLog.id, id)).all())[0]
      if (!row?.revertToken) return undefined
      await db.update(operationLog).set({ revertToken: null }).where(eq(operationLog.id, id)).run()
      return row
    },
    /**
     * 保留策略清理（API 结构表 v1.15，§4.2.12）：删除 `retentionDays` 天前的记录，
     * 再删超出 `maxEntries` 的最旧记录（子查询取第 N 新之后的 id）。两段各自
     * 先 count 后 delete，D1 每条 1 子请求共 4 条，仅由 Cron / 手动清理触发。
     */
    cleanup: async (opts = {}) => {
      let removed = 0
      if (opts.retentionDays !== undefined && opts.retentionDays > 0) {
        const cutoff = new Date(Date.now() - opts.retentionDays * 86400000)
        const expired = await db.select({ count: count() }).from(operationLog).where(lt(operationLog.createdAt, cutoff)).all()
        const expiredCount = Number(expired[0]?.count ?? 0)
        if (expiredCount > 0) {
          await db.delete(operationLog).where(lt(operationLog.createdAt, cutoff)).run()
          removed += expiredCount
        }
      }
      if (opts.maxEntries !== undefined && opts.maxEntries > 0) {
        const over = await db.select({ count: count() }).from(operationLog).where(sql`id in (select id from ${operationLog} order by ${operationLog.createdAt} desc limit -1 offset ${opts.maxEntries})`).all()
        const overCount = Number(over[0]?.count ?? 0)
        if (overCount > 0) {
          await db.delete(operationLog).where(sql`id in (select id from ${operationLog} order by ${operationLog.createdAt} desc limit -1 offset ${opts.maxEntries})`).run()
          removed += overCount
        }
      }
      return { removed }
    },
  }
  repository.settings = {
    list: async () => db.select().from(settings).all(),
    get: async (key) => (await db.select().from(settings).where(eq(settings.key, key)).all())[0],
    set: async (key, value) => { const record = { key, value: typeof value === 'string' ? value : JSON.stringify(value), updatedAt: now() }; await db.insert(settings).values(record).onConflictDoUpdate({ target: settings.key, set: { value: record.value, updatedAt: record.updatedAt } }).run(); return record },
  }
  repository.archives = {
    create: async (data) => {
      const timestamp = now()
      const record = {
        id: data.id,
        bookmarkId: data.bookmarkId,
        type: data.type,
        status: data.status ?? 'pending',
        error: data.error ?? null,
        filePath: null,
        fileSize: null,
        mimeType: null,
        metadata: null,
        completedAt: null,
        createdAt: timestamp,
      }
      await db.insert(archives).values(record).run()
      return record
    },
    get: async (id) => {
      const rows = await db.select().from(archives).where(eq(archives.id, id)).all()
      return rows[0]
    },
    listByBookmark: async (bookmarkId) => {
      return db.select().from(archives).where(eq(archives.bookmarkId, bookmarkId)).orderBy(desc(archives.createdAt)).all()
    },
    updateStatus: async (id, status, data) => {
      const timestamp = now()
      const setData: Record<string, unknown> = { status }
      if (data?.filePath !== undefined) setData.filePath = data.filePath
      if (data?.fileSize !== undefined) setData.fileSize = data.fileSize
      if (data?.mimeType !== undefined) setData.mimeType = data.mimeType
      if (data?.error !== undefined) setData.error = data.error
      if (data?.metadata !== undefined) setData.metadata = data.metadata
      if (status === 'completed') setData.completedAt = timestamp
      await db.update(archives).set(setData).where(eq(archives.id, id)).run()
      const rows = await db.select().from(archives).where(eq(archives.id, id)).all()
      return rows[0]
    },
    listPending: async (limit = 10) => {
      return db.select().from(archives).where(eq(archives.status, 'pending')).orderBy(archives.createdAt).limit(limit).all()
    },
    countPending: async () => {
      const result = await db.select({ count: count() }).from(archives).where(eq(archives.status, 'pending')).all()
      return Number(result[0]?.count ?? 0)
    },
  }
  repository.archiveJobs = {
    list: async (bookmarkId) => db.select().from(archiveJobs).where(bookmarkId ? eq(archiveJobs.bookmarkId, bookmarkId) : undefined).orderBy(desc(archiveJobs.createdAt)).all(),
    get: async (id) => (await db.select().from(archiveJobs).where(eq(archiveJobs.id, id)).all())[0],
    create: async (input) => {
      const timestamp = now()
      const record = {
        ...input,
        type: input.type ?? 'snapshot',
        status: input.status ?? 'pending',
        retryCount: input.retryCount ?? 0,
        createdAt: input.createdAt ?? timestamp,
        updatedAt: timestamp,
      }
      await db.insert(archiveJobs).values(record).run()
      return record
    },
    update: async (id, input) => {
      const timestamp = now()
      if (input.status === 'pending' && 'retryCount' in input === false) {
        // Increment retry count when retrying
        const current = await db.select({ retryCount: archiveJobs.retryCount }).from(archiveJobs).where(eq(archiveJobs.id, id)).all()
        const count = current[0]?.retryCount ?? 0
        await db.update(archiveJobs).set({ ...input, retryCount: count + 1, updatedAt: timestamp }).where(eq(archiveJobs.id, id)).run()
      } else {
        await db.update(archiveJobs).set({ ...input, updatedAt: timestamp }).where(eq(archiveJobs.id, id)).run()
      }
      return (await db.select().from(archiveJobs).where(eq(archiveJobs.id, id)).all())[0]
    },
    getStatus: async (id) => {
      const row = (await db.select({ status: archiveJobs.status }).from(archiveJobs).where(eq(archiveJobs.id, id)).all())[0]
      return row?.status
    },
  }

  repository.conflicts = {
    list: async (resolution) =>
      db.select().from(conflicts).where(resolution ? eq(conflicts.resolution, resolution) : undefined)
        .orderBy(desc(conflicts.createdAt)).all(),
    get: async (id) => (await db.select().from(conflicts).where(eq(conflicts.id, id)).all())[0],
    findByRaindropId: async (raindropId, resolution) =>
      (await db.select().from(conflicts).where(and(eq(conflicts.raindropId, raindropId), resolution ? eq(conflicts.resolution, resolution) : undefined)).all())[0],
    findByRaindropIds: async (raindropIds, resolution) => {
      if (!raindropIds.length) return []
      return db.select().from(conflicts).where(and(inArray(conflicts.raindropId, raindropIds), resolution ? eq(conflicts.resolution, resolution) : undefined)).all()
    },
    create: async (data) => {
      const timestamp = now()
      const record = {
        id: data.id,
        bookmarkId: data.bookmarkId,
        raindropId: data.raindropId,
        localSnapshot: data.localSnapshot ?? null,
        remoteSnapshot: data.remoteSnapshot ?? null,
        resolution: 'pending',
        createdAt: timestamp,
        resolvedAt: null,
      }
      await db.insert(conflicts).values(record).run()
      return record
    },
    createMany: async (data) => {
      if (!data.length) return []
      const timestamp = now()
      const records = data.map((row) => ({
        id: row.id,
        bookmarkId: row.bookmarkId,
        raindropId: row.raindropId,
        localSnapshot: row.localSnapshot ?? null,
        remoteSnapshot: row.remoteSnapshot ?? null,
        resolution: 'pending',
        createdAt: timestamp,
        resolvedAt: null,
      }))
      for (const chunk of chunkByParamBudget(records)) {
        await db.insert(conflicts).values(chunk).run()
      }
      return records
    },
    resolve: async (id, resolution) => {
      await db.update(conflicts).set({ resolution, resolvedAt: now() }).where(eq(conflicts.id, id)).run()
      return (await db.select().from(conflicts).where(eq(conflicts.id, id)).all())[0]
    },
    resolveAll: async (resolution) => {
      const pending = await db.select().from(conflicts).where(eq(conflicts.resolution, 'pending')).all()
      for (const row of pending) {
        await db.update(conflicts).set({ resolution, resolvedAt: now() }).where(eq(conflicts.id, (row as any).id)).run()
      }
      return pending.length
    },
    countPending: async () => {
      const result = await db.select({ count: count() }).from(conflicts).where(eq(conflicts.resolution, 'pending')).all()
      return Number(result[0]?.count ?? 0)
    },
  }

  repository.syncQueue = {
    enqueue: async (action, targetType, targetId, channel, payload = null) => {
      const timestamp = now()
      const id = crypto.randomUUID()
      const record = { id, action, targetType, targetId, channel, payload, status: 'pending', retryCount: 0, error: null, createdAt: timestamp, updatedAt: timestamp }
      await db.insert(syncQueue).values(record).run()
      return record as SyncQueueItem
    },
    getPending: async (limit = 50) => {
      const rows = await db.select().from(syncQueue).where(eq(syncQueue.status, 'pending')).orderBy(syncQueue.createdAt).limit(limit).all()
      return rows as SyncQueueItem[]
    },
    listFailed: async (limit = 100) => {
      const rows = await db.select().from(syncQueue).where(eq(syncQueue.status, 'failed')).orderBy(syncQueue.updatedAt).limit(limit).all()
      return rows as SyncQueueItem[]
    },
    updateStatus: async (id, status, error = null) => {
      const timestamp = now()
      const setData: Record<string, unknown> = { status, updatedAt: timestamp }
      if (error !== undefined) setData.error = error
      if (status === 'failed') setData.retryCount = sql`${syncQueue.retryCount} + 1`
      await db.update(syncQueue).set(setData).where(eq(syncQueue.id, id)).run()
      const row = (await db.select().from(syncQueue).where(eq(syncQueue.id, id)).all())[0]
      return row as SyncQueueItem | undefined
    },
    updateStatusMany: async (entries) => {
      const clean = entries.filter((entry) => entry && entry.id)
      if (!clean.length) return
      const timestamp = now()
      // failed 与非 failed 分组：整条语句统一 retry_count+1 只适用于 failed
      await runBatched(db, [
        ...clean.filter((entry) => entry.status !== 'failed').map((entry) => db.update(syncQueue).set({ status: entry.status, error: entry.error ?? null, updatedAt: timestamp }).where(eq(syncQueue.id, entry.id))),
        ...clean.filter((entry) => entry.status === 'failed').map((entry) => db.update(syncQueue).set({ status: 'failed', error: entry.error ?? null, retryCount: sql`${syncQueue.retryCount} + 1`, updatedAt: timestamp }).where(eq(syncQueue.id, entry.id))),
      ])
    },
    remove: async (id) => {
      await db.delete(syncQueue).where(eq(syncQueue.id, id)).run()
      return true
    },
    countPending: async () => {
      const result = await db.select({ count: count() }).from(syncQueue).where(eq(syncQueue.status, 'pending')).all()
      return Number(result[0]?.count ?? 0)
    },
    countFailed: async () => {
      const result = await db.select({ count: count() }).from(syncQueue).where(eq(syncQueue.status, 'failed')).all()
      return Number(result[0]?.count ?? 0)
    },
  }

  repository.backups = {
    create: async (data) => {
      const timestamp = now()
      const record = {
        id: data.id,
        tier: data.tier,
        target: data.target,
        status: 'pending',
        filePath: null,
        fileSize: null,
        includes: data.includes,
        error: null,
        completedAt: null,
        createdAt: timestamp,
      }
      await db.insert(backups).values(record).run()
      return record
    },
    get: async (id) => {
      const rows = await db.select().from(backups).where(eq(backups.id, id)).all()
      return rows[0]
    },
    list: async (limit = 50) => {
      return db.select().from(backups).orderBy(desc(backups.createdAt)).limit(limit).all()
    },
    updateStatus: async (id, status, data) => {
      const timestamp = now()
      const setData: Record<string, unknown> = { status }
      if (data?.filePath !== undefined) setData.filePath = data.filePath
      if (data?.fileSize !== undefined) setData.fileSize = data.fileSize
      if (data?.error !== undefined) setData.error = data.error
      if (status === 'completed') setData.completedAt = timestamp
      await db.update(backups).set(setData).where(eq(backups.id, id)).run()
      const rows = await db.select().from(backups).where(eq(backups.id, id)).all()
      return rows[0]
    },
  }

  repository.channelConfig = {
    list: async () => db.select().from(channelConfig).orderBy(desc(channelConfig.createdAt)).all(),
    get: async (id) => (await db.select().from(channelConfig).where(eq(channelConfig.id, id)).all())[0],
    create: async (data) => {
      const timestamp = now()
      const record = {
        id: data.id,
        channel: data.channel,
        label: data.label,
        config: data.config,
        enabled: data.enabled ?? true,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await db.insert(channelConfig).values(record).run()
      return record
    },
    update: async (id, data) => {
      const existing = (await db.select().from(channelConfig).where(eq(channelConfig.id, id)).all())[0]
      if (!existing) return undefined
      const timestamp = now()
      const setData: Record<string, unknown> = { updatedAt: timestamp }
      if (data.label !== undefined) setData.label = data.label
      if (data.config !== undefined) setData.config = data.config
      if (data.enabled !== undefined) setData.enabled = data.enabled
      await db.update(channelConfig).set(setData).where(eq(channelConfig.id, id)).run()
      return (await db.select().from(channelConfig).where(eq(channelConfig.id, id)).all())[0]
    },
    remove: async (id) => {
      await db.delete(channelConfig).where(eq(channelConfig.id, id)).run()
      return true
    },
  }

  repository.navRules = {
    list: async () => db.select().from(navRules).orderBy(navRules.sortOrder, navRules.createdAt).all(),
    get: async (id) => {
      const rows = await db.select().from(navRules).where(eq(navRules.id, id)).all()
      return rows[0]
    },
    create: async (data) => {
      const record = { ...data, rule: data.rule ?? null, searchQuery: data.searchQuery ?? null, enabled: data.enabled ?? true, createdAt: data.createdAt ?? now(), updatedAt: data.updatedAt ?? now() }
      await db.insert(navRules).values(record).run()
      return record
    },
    update: async (id, data) => {
      await db.update(navRules).set(data).where(eq(navRules.id, id)).run()
      return (await db.select().from(navRules).where(eq(navRules.id, id)).all())[0]
    },
    remove: async (id) => {
      await db.delete(navRules).where(eq(navRules.id, id)).run()
    },
  }

  repository.idempotency = {
    findReplay: async (key, actor) => {
      const rows = await db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.actor, actor))).all()
      if (!rows[0]) return undefined
      if (rows[0].expiresAt < new Date()) {
        await db.delete(idempotencyKeys).where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.actor, actor))).run()
        return undefined
      }
      return rows[0] as IdempotencyRecord
    },
    store: async (record) => {
      await db.insert(idempotencyKeys).values(record).run()
    },
  }

  repository.skillUsage = {
    increment: async (bucket) => {
      const today = new Date().toISOString().split('T')[0]
      await db.insert(skillUsage).values({ date: today, bucket, count: 1, updatedAt: now() })
        .onConflictDoUpdate({ target: [skillUsage.date, skillUsage.bucket], set: { count: sql`${skillUsage.count} + 1`, updatedAt: now() } })
        .run()
    },
    getDaily: async (date) => {
      const result = { read: 0, write: 0, blocked: 0 }
      const rows = await db.select().from(skillUsage).where(eq(skillUsage.date, date)).all()
      for (const row of rows) {
        if (row.bucket in result) (result as any)[row.bucket] += row.count
      }
      return result
    },
  }

  return repository
}
