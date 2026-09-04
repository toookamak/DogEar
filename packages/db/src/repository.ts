import { and, count, desc, eq, inArray, isNotNull, isNull, like, lt, or, sql } from 'drizzle-orm'
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
  status: 'unread'
  source?: 'page' | 'agent' | 'extension'
  note?: string | null
  intent?: string | null
  important?: boolean
  private?: boolean
  syncStatus?: 'pending' | 'synced'
}
type AccessRecordInput = { id: string; bookmarkId: string; source?: 'original' | 'snapshot'; client?: string }
type BookmarkFilters = {
  status?: string
  sceneId?: string
  folderId?: string | null | 'none'
  tagId?: string
  important?: boolean
  source?: string
  q?: string
  includeDeleted?: boolean
}
type BookmarkUpdate = Record<string, unknown> & { folderId?: string | null; tagIds?: string[]; sceneIds?: string[] }
type BatchUpdate = BookmarkUpdate & { ids: string[]; addSceneIds?: string[]; removeSceneIds?: string[]; addTagIds?: string[]; removeTagIds?: string[]; deleted?: boolean }
type BatchUpdateSkippedItem = { id: string; reason: 'not_found' | 'deleted' }
type Timestamped = { createdAt?: Date; updatedAt?: Date }

export type PageResult<T> = {
  items: T[]
  nextCursor: string | null
}

export type InboxPageResult<T> = {
  bookmarks: T[]
  nextCursor: string | null
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
  list: (filters?: BookmarkFilters, limit?: number, cursor?: string, opts?: { orderBy?: string }) => Promise<PageResult<unknown>>
  listInbox: (limit?: number, cursor?: string) => Promise<InboxPageResult<unknown>>
  listRecycleBin: (limit?: number, cursor?: string) => Promise<PageResult<unknown>>
  countPending: () => Promise<number>
  createAccessRecord: (input: AccessRecordInput) => Promise<unknown>
  listAccessRecords: (bookmarkId: string) => Promise<unknown[]>
  get: (id: string, includeDeleted?: boolean) => Promise<unknown | undefined>
  findByRaindropId: (raindropId: string) => Promise<unknown | undefined>
  search: (filters: BookmarkFilters, limit?: number, cursor?: string) => Promise<PageResult<unknown>>
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
  syncQueue: ResourceRepositories['syncQueue']
	  backups: ResourceRepositories['backups']
  navRules: {
    list: () => Promise<unknown[]>
    get: (id: string) => Promise<unknown | undefined>
    create: (data: { id: string; name: string; mode: string; rule?: string; searchQuery?: string; sortOrder?: number; enabled?: boolean; createdAt?: number; updatedAt?: number }) => Promise<unknown>
    update: (id: string, data: Record<string, unknown>) => Promise<unknown | undefined>
    remove: (id: string) => Promise<void>
  }
  channelConfig: ResourceRepositories['channelConfig']
}

type ResourceRepositories = {
  scenes: { list: () => Promise<unknown[]>; create: (input: Record<string, unknown>) => Promise<unknown>; update: (id: string, input: Record<string, unknown>) => Promise<unknown | undefined>; remove: (id: string) => Promise<boolean> }
  folders: { list: () => Promise<unknown[]>; create: (input: Record<string, unknown>) => Promise<unknown>; update: (id: string, input: Record<string, unknown>) => Promise<unknown | undefined>; remove: (id: string) => Promise<boolean> }
  tags: { list: () => Promise<unknown[]>; create: (input: Record<string, unknown>) => Promise<unknown>; remove: (id: string) => Promise<boolean> }
  suggestions: { list: (bookmarkId: string, status?: string) => Promise<PageResult<unknown>>; create: (input: Record<string, unknown>) => Promise<unknown>; resolve: (id: string, status: string) => Promise<unknown | undefined>; accept: (id: string, actor?: string) => Promise<unknown | undefined> }
  operationLog: { list: (filters?: Record<string, unknown>) => Promise<unknown[]>; append: (input: Record<string, unknown>) => Promise<unknown> }
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
  syncQueue: {
    enqueue: (action: string, targetType: string, targetId: string, channel: string, payload?: string | null) => Promise<SyncQueueItem>
    getPending: (limit?: number) => Promise<SyncQueueItem[]>
    updateStatus: (id: string, status: string, error?: string | null) => Promise<SyncQueueItem | undefined>
    remove: (id: string) => Promise<boolean>
    countPending: () => Promise<number>
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

function encodeCursor(createdAt: Date, id: string): string {
  const ts = createdAt.getTime().toString(36)
  return `${ts}_${id}`
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const idx = cursor.indexOf('_')
  if (idx < 0) return null
  const ts = Number.parseInt(cursor.slice(0, idx), 36)
  if (Number.isNaN(ts)) return null
  return { createdAt: new Date(ts), id: cursor.slice(idx + 1) }
}

function keysetCondition(createdAt: Date, id: string) {
  return or(
    lt(bookmarks.createdAt, createdAt),
    and(eq(bookmarks.createdAt, createdAt), lt(bookmarks.id, id)),
  )
}

function paginatedQuery<T>(rows: T[], limit: number, getCursor: (row: T) => { createdAt: Date; id: string }): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const nextCursor = hasMore && items.length > 0
    ? encodeCursor(getCursor(items[items.length - 1]).createdAt, getCursor(items[items.length - 1]).id)
    : null
  return { items, nextCursor }
}

function transaction(db: Db, action: (tx: Db) => Promise<any>) {
  return typeof db.transaction === 'function' ? db.transaction(action) : action(db)
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
  const [sceneRows, tagRows, suggestionRows] = await Promise.all([
    db.select({ id: scenes.id, name: scenes.name }).from(bookmarkScenes).innerJoin(scenes, eq(bookmarkScenes.sceneId, scenes.id)).where(eq(bookmarkScenes.bookmarkId, bookmarkId)).all(),
    db.select({ id: tags.id, name: tags.name }).from(bookmarkTags).innerJoin(tags, eq(bookmarkTags.tagId, tags.id)).where(eq(bookmarkTags.bookmarkId, bookmarkId)).all(),
    db.select({ count: count() }).from(suggestions).where(and(eq(suggestions.bookmarkId, bookmarkId), eq(suggestions.status, 'pending'))).all(),
  ])
  return { scenes: sceneRows, tags: tagRows, pendingSuggestionCount: Number(suggestionRows[0]?.count ?? 0) }
}

function filterCondition(filters: BookmarkFilters = {}) {
  const conditions: any[] = []
  if (!filters.includeDeleted) conditions.push(isNull(bookmarks.deletedAt))
  if (filters.status) conditions.push(eq(bookmarks.status, filters.status))
  if (filters.folderId === 'none' || filters.folderId === null) conditions.push(isNull(bookmarks.folderId))
  else if (filters.folderId) conditions.push(eq(bookmarks.folderId, filters.folderId))
  if (filters.important !== undefined) conditions.push(eq(bookmarks.important, filters.important))
  if (filters.source) conditions.push(eq(bookmarks.source, filters.source))
  if (filters.sceneId) conditions.push(eq(bookmarkScenes.sceneId, filters.sceneId))
  if (filters.tagId) conditions.push(eq(bookmarkTags.tagId, filters.tagId))
  if (filters.q) {
    const q = `%${filters.q}%`
    conditions.push(or(like(bookmarks.title, q), like(bookmarks.url, q), like(bookmarks.note, q), like(tags.name, q)))
  }
  return conditions.length ? and(...conditions) : undefined
}

export function createD1BookmarkRepository(database: D1Database): BookmarkRepository {
  return createBookmarkRepository(drizzleD1(database))
}

export function createBookmarkRepository(db: Db): BookmarkRepository {
  const repository = {} as BookmarkRepository
  repository.create = async (input) => {
    const timestamp = now()
    const record = { ...input, source: input.source ?? 'page', note: input.note ?? null, intent: input.intent ?? null, important: input.important ?? false, private: input.private ?? false, syncStatus: input.syncStatus ?? 'pending', version: 1, deletedAt: null, createdAt: timestamp, updatedAt: timestamp }
    await db.insert(bookmarks).values(record).run()
    return record
  }
  repository.list = async (filters = {}, limit = 50, cursor?: string, opts?: { orderBy?: string }) => {
    const conditions = [filterCondition(filters)]
    if (cursor) {
      const decoded = decodeCursor(cursor)
      if (decoded) conditions.push(keysetCondition(decoded.createdAt, decoded.id))
    }
    const whereClause = conditions.length > 1 ? and(...conditions.filter(Boolean)) : conditions[0]
    const query = filters.sceneId || filters.tagId || filters.q ? db.select().from(bookmarks).leftJoin(bookmarkScenes, eq(bookmarks.id, bookmarkScenes.bookmarkId)).leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId)).leftJoin(tags, eq(bookmarkTags.tagId, tags.id)) : db.select().from(bookmarks)
    const orderBy = opts?.orderBy === 'lastOpenedAt' ? desc(bookmarks.lastOpenedAt) : desc(bookmarks.createdAt)
    const rows = await query.where(whereClause).orderBy(orderBy, desc(bookmarks.id)).limit(limit + 1).all()
    return paginatedQuery(rows, limit, (row: any) => ({ createdAt: row.createdAt ?? row.bookmarks?.createdAt, id: row.id ?? row.bookmarks?.id }))
  }
  repository.listInbox = async (limit = 50, cursor?: string) => {
    const result = await repository.list({ status: 'unread' }, limit, cursor)
    return { bookmarks: result.items, nextCursor: result.nextCursor }
  }
  repository.listRecycleBin = async (limit = 50, cursor?: string) => {
    const result = await repository.list({ includeDeleted: true }, limit, cursor)
    const filtered = result.items.filter((item: any) => item.deletedAt)
    const paginated = paginatedQuery(filtered, limit, (row: any) => ({ createdAt: row.createdAt ?? row.bookmarks?.createdAt, id: row.id ?? row.bookmarks?.id }))
    return paginated
  }
  repository.countPending = async () => {
    const result = await db.select({ count: count() }).from(bookmarks).where(eq(bookmarks.syncStatus, 'pending')).all()
    return Number(result[0]?.count ?? 0)
  }
  repository.createAccessRecord = async (input) => {
    const timestamp = now()
    const record = { ...input, source: input.source ?? 'original', client: input.client ?? 'workbench', openedAt: timestamp }
    await transaction(db, async (tx) => {
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
  repository.search = async (filters, limit = 50, cursor?: string) => repository.list(filters, limit, cursor)
  repository.update = async (id, input) => transaction(db, async (tx) => {
    const existing = await tx.select().from(bookmarks).where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt))).all()
    if (!existing[0]) return undefined
    const timestamp = now()
    const allowed = new Set(['title', 'excerpt', 'cover', 'note', 'intent', 'important', 'private', 'status', 'folderId', 'raindropId', 'raindropExtras', 'syncStatus', 'author', 'favicon', 'domain', 'publishedAt', 'broken'])
    const changes = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)))
    await tx.update(bookmarks).set({ ...changes, version: existing[0].version + 1, updatedAt: timestamp }).where(eq(bookmarks.id, id)).run()
    await replaceRelations(tx, id, input, timestamp)
    return repository.get(id)
  })
  repository.batchUpdate = async (input) => transaction(db, async (tx) => {
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
  repository.purgeDeleted = async (ids, before) => transaction(db, async (tx) => {
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
  }
  repository.folders = {
    list: async () => db.select().from(folders).orderBy(folders.sortOrder, folders.createdAt).all(),
    create: async (input) => { const timestamp = now(); const record = { ...input, parentId: input.parentId ?? null, sortOrder: input.sortOrder ?? 0, createdAt: timestamp, updatedAt: timestamp }; await db.insert(folders).values(record).run(); return record },
    update: async (id, input) => { await db.update(folders).set({ ...input, updatedAt: now() }).where(eq(folders.id, id)).run(); return (await db.select().from(folders).where(eq(folders.id, id)).all())[0] },
    remove: async (id) => { await db.update(bookmarks).set({ folderId: null, updatedAt: now() }).where(eq(bookmarks.folderId, id)).run(); await db.delete(folders).where(eq(folders.id, id)).run(); return true },
  }
  repository.tags = {
    list: async () => db.select().from(tags).orderBy(tags.name).all(),
    create: async (input) => { const name = String(input.name); const nameKey = String(input.nameKey ?? name.toLowerCase()); const found = await db.select().from(tags).where(eq(tags.nameKey, nameKey)).all(); if (found[0]) return found[0]; const record = { id: input.id, name, nameKey, createdAt: now() }; await db.insert(tags).values(record).run(); return record },
    remove: async (id) => { await db.delete(bookmarkTags).where(eq(bookmarkTags.tagId, id)).run(); await db.delete(tags).where(eq(tags.id, id)).run(); return true },
  }
  repository.suggestions = {
    list: async (bookmarkId, status) => {
      const items = await db.select().from(suggestions).where(and(eq(suggestions.bookmarkId, bookmarkId), status ? eq(suggestions.status, status) : undefined)).orderBy(desc(suggestions.createdAt)).all()
      return { items, nextCursor: null }
    },
    create: async (input) => { const record = { ...input, status: input.status ?? 'pending', createdAt: input.createdAt ?? now(), resolvedAt: null }; await db.insert(suggestions).values(record).run(); return record },
    resolve: async (id, status) => { const record = { status, resolvedAt: now() }; await db.update(suggestions).set(record).where(eq(suggestions.id, id)).run(); return (await db.select().from(suggestions).where(eq(suggestions.id, id)).all())[0] },
    accept: async (id, actor = 'user') => transaction(db, async (tx) => {
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
    append: async (input) => { const record = { ...input, id: input.id ?? crypto.randomUUID(), createdAt: input.createdAt ?? now(), detail: input.detail ?? null, revertToken: input.revertToken ?? null }; await db.insert(operationLog).values(record).run(); return record },
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
    updateStatus: async (id, status, error = null) => {
      const timestamp = now()
      const setData: Record<string, unknown> = { status, updatedAt: timestamp }
      if (error !== undefined) setData.error = error
      if (status === 'failed') setData.retryCount = sql`${syncQueue.retryCount} + 1`
      await db.update(syncQueue).set(setData).where(eq(syncQueue.id, id)).run()
      const row = (await db.select().from(syncQueue).where(eq(syncQueue.id, id)).all())[0]
      return row as SyncQueueItem | undefined
    },
    remove: async (id) => {
      await db.delete(syncQueue).where(eq(syncQueue.id, id)).run()
      return true
    },
    countPending: async () => {
      const result = await db.select({ count: count() }).from(syncQueue).where(eq(syncQueue.status, 'pending')).all()
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
