import {
  archiveJobStatusSchema,
  batchUpdateRequestSchema,
  bookmarkListQuerySchema,
  bookmarkVersionConflictErrorSchema,
  folderCreateInputSchema,
  folderUpdateInputSchema,
  getStatsSkillInputSchema,
  listBookmarksSkillInputSchema,
  loginRequestSchema,
  paginationQuerySchema,
  recycleBinEmptyRequestSchema,
  saveBookmarkSkillInputSchema,
  sceneCreateInputSchema,
  sceneUpdateInputSchema,
  searchBookmarksSkillInputSchema,
  settingsWhitelistSchema,
  skillCapabilitiesBodySchema,
  skillUsageResponseSchema,
  suggestSceneSkillInputSchema,
  sceneMergeInputSchema,
  tagCreateInputSchema,
  tagMergeInputSchema,
  tagRenameInputSchema,
  triggerArchiveSkillInputSchema,
  updateBookmarkSkillInputSchema,
  searchIndexQuerySchema,
  workbenchCreateBookmarkInputSchema,
  workbenchPatchBookmarkInputSchema,
} from '@dogear/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { BookmarkRepository } from '@dogear/db'
import { randomUUID } from 'node:crypto'
import { hasValidSession, signSession } from './auth/session-crypto.js'
import { createArchiveRoutes } from './archive/archive-routes.js'
import { ChannelConfigManager } from './channels/index.js'
import { RaindropClient } from './channels/raindrop.js'
import { createChannelRoutes } from './channels-routes.js'
import { createMetadataRoutes } from './archive/metadata-routes.js'
import { createNavRoutes } from './nav/nav-routes.js'
import { evaluateNavFeed } from './nav/evaluator.js'
import { extractMetadata } from './archive/metadata.js'
import { coverFromRaindropExtras, pickCoverUrl, resolveCoverUrl } from './archive/cover-url.js'
import { coverBodyInit, loadCoverBytes } from './archive/cover-cache.js'
import type { CoverStore } from './archive/cover-store.js'
import { processSyncQueue, resolveRaindropClient } from './sync/consumer.js'
import { computeSyncDiff } from './sync/raindrop-diff.js'
import { pullFromRaindrop } from './sync/raindrop-pull.js'
import { generateSkillToken, hashSkillToken, readStoredHash, tokensEqual } from './auth/skill-token.js'

const sessionCookie = 'dogear_session'
const user = { id: 'user' }

type AppOptions = {
  password?: string
  skillToken?: string
  sessionTtlSeconds?: number
  now?: () => number
  rateLimits?: { read?: number; write?: number; batch?: number }
  /**
   * 备份路由工厂。备份要写本地文件（node:fs），Cloudflare Workers 不支持，
   * 因此不在此静态导入，而由各运行时入口注入：
   * Bun/Docker 入口注入本地文件实现；Workers 入口不注入，落到「不支持」回执。
   * 这样 node:fs 不会进入 Workers 的模块图。
   */
  backupRoutes?: (repository: BookmarkRepository) => Hono
  /** 允许携带 Cookie 的工作台来源；默认本地开发地址，生产由入口按环境注入 */
  corsOrigin?: string
  /**
   * 元数据增强提取器（Track B 注入，metascraper 规则组，见 archive/metadata-enhancer.ts）。
   * 注入后保存书签的元数据提取先用它，失败自动回退内置轻量提取；Workers 不注入、行为不变。
   */
  metadataEnhancer?: (url: string) => Promise<Record<string, unknown>>
  /** 保存接口最多等抓页多少毫秒再 201；缺省 0（单测不挡）。线上入口注入 6000。 */
  metadataWaitMs?: number
  /**
   * 快照执行器。注入后 `POST /api/archive/process` 消费 pending 快照 Job。
   * Track B 注入 monolith；Track A 注入 fetch 轻量抓取（见 archive/snapshot-fetch.ts）。
   * Skill `snapshot=true` 仍只入队，由工作台触发 process。
   */
  snapshotProcessor?: (repository: BookmarkRepository) => Promise<{ processed: number; succeeded: number; failed: number }>
  /** 封面对象存储：轨 A 注入 R2，轨 B 注入本地目录；未注入时 /cover 仍回源但不落盘 */
  coverStore?: CoverStore
}

type SkillLimit = 'read' | 'write' | 'batch'

const skillDefinitions = [
  { name: 'save_bookmark', write: true, capability: 'write_new', input: 'url, note?, intent?, snapshot?, source?, title?, excerpt?, favicon?', notes: 'Writes one bookmark to the source database. source: agent (default) | extension (Chrome extension). Optional title/excerpt/favicon from the caller (browser extension) are stored immediately; remaining metadata is filled asynchronously.' },
  { name: 'search_bookmarks', write: false, capability: 'read', input: 'query?, filters?, limit?, cursor?', notes: 'Searches active non-private bookmarks by default.' },
  { name: 'update_bookmark', write: true, capability: 'update_existing', input: 'id plus editable fields', notes: 'Disabled by default; structure changes require confirmation.' },
  { name: 'list_bookmarks', write: false, capability: 'read', input: 'filters?, limit?, cursor?', notes: 'Lists active bookmarks.' },
  { name: 'get_stats', write: false, capability: 'read', input: '{}', notes: 'Returns active bookmark counts.' },
  { name: 'trigger_archive', write: true, capability: 'write_new', input: 'bookmarkId, type?', notes: 'Queues a browser-side snapshot job only.' },
  { name: 'suggest_scene', write: false, capability: 'read', input: 'bookmarkId or bookmarkIds', notes: 'Stores pending suggestions without changing structure.' },
] as const

function unauthorized(c: { json: (body: unknown, status: 401) => Response }) {
  return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
}

function invalidRequest(c: { json: (body: unknown, status: 400) => Response }, details?: unknown) {
  return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', ...(details ? { details } : {}) } }, 400)
}

/**
 * 无本地文件存储的运行时（Cloudflare Workers）上的备份回执。
 * 返回 501 而非 404：让「本运行时无此能力」与「路径写错」可区分，
 * 工作台据此提示，而不是静默失败。
 */
function createUnsupportedBackupRoutes() {
  const app = new Hono()
  const unsupported = (c: any) =>
    c.json({
      error: {
        code: 'NOT_SUPPORTED',
        message: 'File-based backup is unavailable on this runtime. Use the Docker (Track B) deployment to create and download backup files.',
      },
    }, 501)
  app.get('/', unsupported)
  app.post('/', unsupported)
  app.get('/:id', unsupported)
  app.get('/:id/download', unsupported)
  // 本地导出/导入（ZIP/CSV）依赖文件备份体系（回滚点），与上面同属 Track B 能力
  app.get('/export-zip', unsupported)
  app.post('/import', unsupported)
  return app
}

function skillError(c: { json: (body: unknown, status: number) => Response }, code: string, status: number, message: string) {
  return c.json({ error: { code, message } }, status)
}

function jsonBody(c: Parameters<NonNullable<Parameters<Hono['use']>[1]>>[0]) {
  return c.req.json().catch(() => undefined)
}

function cookieValue(header: string | undefined) {
  return header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1)
}

function setSessionCookie(value: string, maxAge: number) {
  return `${sessionCookie}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`
}

function timestamp(value: unknown) {
  return value instanceof Date ? value.getTime() : Number(value)
}

function serializeBookmark(record: any) {
  const pageUrl = typeof record?.url === 'string' ? record.url : null
  let excerpt = record?.excerpt ?? null
  let cover = pickCoverUrl([typeof record?.cover === 'string' ? record.cover : null], pageUrl)
  if ((!excerpt || !cover) && record?.raindropExtras) {
    try {
      const extras = typeof record.raindropExtras === 'string' ? JSON.parse(record.raindropExtras) : record.raindropExtras
      if (!excerpt && typeof extras?.excerpt === 'string' && extras.excerpt.trim()) excerpt = extras.excerpt
      if (!cover) cover = coverFromRaindropExtras(extras, pageUrl)
    } catch { /* extras 不是 JSON 时忽略 */ }
  }
  return { ...record, excerpt, cover, createdAt: timestamp(record.createdAt), updatedAt: timestamp(record.updatedAt) }
}

function serializeAccessRecord(record: any) {
  return { ...record, openedAt: timestamp(record.openedAt) }
}

type ExistingPageMeta = {
  title?: string | null
  excerpt?: string | null
  cover?: string | null
  favicon?: string | null
}

function domainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname || undefined
  } catch {
    return undefined
  }
}

function hasFetchedPageMeta(meta: Record<string, unknown>): boolean {
  return Boolean(meta.title || meta.description || meta.image || meta.author || meta.favicon)
}

/**
 * Workers 在返回响应后会冻结 isolate；必须 waitUntil 才能把事后抓页做完。
 * Node / Bun / 单测没有 ExecutionContext，退回 fire-and-forget。
 */

function scheduleBackground(
  c: { executionCtx: { waitUntil: (promise: Promise<unknown>) => void } },
  task: Promise<unknown>,
): void {
  try {
    c.executionCtx.waitUntil(task)
  } catch {
    void task
  }
}

/** 先等抓页最多 6 秒，让 201 尽量带上标题/简介；没跑完的继续 waitUntil。 */
async function completeMetadata(
  c: { executionCtx: { waitUntil: (promise: Promise<unknown>) => void } },
  repository: BookmarkRepository,
  options: AppOptions,
  bookmarkId: string,
  url: string,
  existing: ExistingPageMeta = {},
): Promise<void> {
  const task = extractMetadataInto(repository, options, bookmarkId, url, existing)
  scheduleBackground(c, task)
  const waitMs = options.metadataWaitMs ?? 0
  if (waitMs <= 0) return
  await Promise.race([
    task,
    new Promise<void>((resolve) => setTimeout(resolve, waitMs)),
  ])
}

/**
 * 保存后的异步元数据提取：优先用注入的增强提取器（Track B 的 metascraper 规则组），
 * 失败、未注入、或增强器只拿到域名时回退内置轻量提取。
 * 调用方已经写入的 title/excerpt/cover/favicon 不覆盖（插件当场拿到的标题优先）。
 * 任何失败都静默——部分元数据比失败响应更重要。
 */
async function extractMetadataInto(
  repository: BookmarkRepository,
  options: AppOptions,
  bookmarkId: string,
  url: string,
  existing: ExistingPageMeta = {},
): Promise<void> {
  const applyUpdates = async (meta: Record<string, unknown>) => {
    const updates: Record<string, unknown> = {}
    if (meta.title && !existing.title) updates.title = meta.title
    if (meta.description && !existing.excerpt) updates.excerpt = meta.description
    if (meta.image && !existing.cover) updates.cover = meta.image
    if (meta.author) updates.author = meta.author
    if (meta.domain) updates.domain = meta.domain
    if (meta.favicon && !existing.favicon) updates.favicon = meta.favicon
    if (meta.publishedAt) {
      const d = new Date(String(meta.publishedAt))
      if (!Number.isNaN(d.getTime())) updates.publishedAt = d
    }
    if (Object.keys(updates).length > 0) {
      try {
        await repository.update(bookmarkId, updates)
      } catch {
        const { publishedAt: _publishedAt, ...rest } = updates
        if (Object.keys(rest).length > 0) {
          try { await repository.update(bookmarkId, rest) } catch { /* 回填失败不阻断保存 */ }
        }
      }
    }
  }
  if (options.metadataEnhancer) {
    try {
      const enhanced = await options.metadataEnhancer(url) as Record<string, unknown>
      await applyUpdates(enhanced)
      if (hasFetchedPageMeta(enhanced)) return
    } catch {
      // 增强提取失败，回退内置轻量提取
    }
  }
  try {
    await applyUpdates(await extractMetadata(url) as unknown as Record<string, unknown>)
  } catch {
    // Metadata extraction failed silently - partial metadata is fine
  }
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

/** 收集方式的中文标签，导出文件给人看，不直接暴露枚举值 */
const sourceLabels: Record<string, string> = {
  page: '工作台',
  agent: 'Agent',
  extension: '插件',
}

export function createApp(repository: BookmarkRepository, options: AppOptions = {}) {
  const password = options.password ?? process.env.DOGEAR_PASSWORD ?? ''
  const sessionTtlSeconds = options.sessionTtlSeconds ?? 60 * 60 * 24 * 7
  const now = options.now ?? Date.now
  const revokedSessions = new Set<string>()
  const app = new Hono()
  app.use('/api/*', cors({
    origin: (origin) => {
      const allowed = (options.corsOrigin ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean)
      return origin && allowed.includes(origin) ? origin : ''
    },
    credentials: true,
  }))

  // ---- 通道同步入队（L2）：书签写操作成功后，按已启用的 Raindrop 通道入队推送 ----
  // 队列只承载 Raindrop 书签级推送；S3/WebDAV 是文件级导出，保持手动触发（见同步设计 §3.1）。
  const channelManager = new ChannelConfigManager(repository)

  // 同步时间戳（settings 表，key 形如 sync.last_push_at）：推送消费成功 / 拉取完成后写入，
  // 供状态栏卡片显示「上次同步」。写入失败静默——时间戳只是展示，不能拖垮主流程。
  async function readSyncTimestamp(key: string): Promise<number | null> {
    try {
      const row = await repository.settings.get(key) as { value?: unknown } | undefined
      const n = Number(row?.value)
      return Number.isFinite(n) && n > 0 ? n : null
    } catch {
      return null
    }
  }

  async function writeSyncTimestamp(key: string): Promise<void> {
    try {
      await repository.settings.set(key, String(Date.now()))
    } catch { /* 展示性数据，失败不重试 */ }
  }

  async function hasEnabledRaindropChannel(): Promise<boolean> {
    try {
      const channels = await channelManager.getAllChannels()
      return channels.some((c) => c.channel === 'raindrop' && c.enabled && String(c.config.token ?? ''))
    } catch {
      return false
    }
  }

  /**
   * 书签写操作后的推送入队；任何失败都不影响主写操作（队列消费侧对未入队变更无感知）。
   *
   * payload 契约（批次 0.5/0.6，语义实测见同步设计 §3.1.1）：
   * - url / raindropId 是定位符，恒带；
   * - title / note / tags / folderId **只在被编辑时携带**——单条 PUT 不带的字段远端保持
   *   原值（部分更新语义），tags 一旦携带必须是全量集合（整体替换，[] = 清空）；
   * - addTags + srcCollection 是批量加标签的攒批形态（追加语义），两者必须成对出现；
   * - folderId 存本地 id，消费时反查 folders.raindrop_id（映射可能在排队期间才建立）。
   */
  async function enqueueRaindropSync(
    action: 'create' | 'update' | 'delete',
    bookmark: {
      id: string
      url?: string | null
      title?: string | null
      note?: string | null
      raindropId?: string | null
      tags?: string[]
      addTags?: string[]
      srcCollection?: number
      folderId?: string | null
    },
  ): Promise<boolean> {
    try {
      if (!(await hasEnabledRaindropChannel())) return false
      const payload: Record<string, unknown> = {
        url: bookmark.url ?? undefined,
        raindropId: bookmark.raindropId ?? undefined,
      }
      if ('title' in bookmark) payload.title = bookmark.title ?? undefined
      if ('note' in bookmark) payload.note = bookmark.note ?? undefined
      if ('tags' in bookmark) payload.tags = bookmark.tags ?? undefined
      if ('folderId' in bookmark) payload.folderId = bookmark.folderId ?? null
      if ('addTags' in bookmark) payload.addTags = bookmark.addTags
      if ('srcCollection' in bookmark) payload.srcCollection = bookmark.srcCollection
      await repository.syncQueue.enqueue(action, 'bookmark', bookmark.id, 'raindrop', JSON.stringify(payload))
      // 入队即视为「待推送」，直到消费成功后由消费器标回 synced
      if (action !== 'delete') await repository.update(bookmark.id, { syncStatus: 'pending' })
      return true
    } catch {
      return false
    }
  }

  /**
   * 批量加标签攒批的分组依据：书签远端当前所在集合。
   * 优先本地 folder 映射（最新、最权威）；folder 未建/未映射时退回拉取时记录的
   * raindropExtras.collectionId（覆盖「从 Unsorted 拉回」「收藏夹被删后 folder 置空」；
   * -99 Trash 不可作作用域，排除）。都拿不到返回 null → 该条退回单条全量路径。
   * 依赖调用方传入 folderRaindropMap（一次 folders.list() 的内存映射，Map<folderId, raindropId|null>）。
   */
  function resolveSrcCollection(
    record: { folderId?: string | null; raindropExtras?: unknown },
    folderRaindropMap: Map<string, number | null>,
  ): number | null {
    if (record.folderId) {
      const mapped = folderRaindropMap.get(record.folderId)
      if (mapped !== undefined && mapped !== null) return mapped
    }
    if (typeof record.raindropExtras === 'string' && record.raindropExtras) {
      try {
        const extras = JSON.parse(record.raindropExtras) as { collectionId?: unknown }
        const id = Number(extras.collectionId)
        if (Number.isInteger(id) && id !== 0 && id !== -99) return id
      } catch { /* extras 不是 JSON 时忽略 */ }
    }
    return null
  }

  app.get('/health', (c) => c.json({ ok: true }))

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => undefined)
    const input = loginRequestSchema.safeParse(body)
    if (!password || !input.success || input.data.password !== password) return unauthorized(c)
    c.header('Set-Cookie', setSessionCookie(await signSession(now(), password), sessionTtlSeconds))
    return c.json({ user })
  })

  app.get('/api/auth/me', async (c) => {
    if (!await hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    return c.json({ user })
  })

  app.post('/api/auth/logout', (c) => {
    const cookie = cookieValue(c.req.header('Cookie'))
    if (cookie) {
      revokedSessions.add(cookie)
      c.header('Set-Cookie', setSessionCookie('', 0))
    }
    return c.json({ ok: true })
  })

  const requireSession = async (c: Parameters<NonNullable<Parameters<typeof app.use>[1]>>[0], next: Parameters<NonNullable<Parameters<typeof app.use>[1]>>[1]) => {
    if (!await hasValidSession(cookieValue(c.req.header('Cookie')), password, now, sessionTtlSeconds, revokedSessions)) return unauthorized(c)
    await next()
  }

  app.use('/api/bookmarks', requireSession)
  app.use('/api/bookmarks/*', requireSession)
  app.use('/api/inbox', requireSession)
  app.use('/api/sync/*', requireSession)
  app.use('/api/metadata/*', requireSession)

/**
 * 「是否在导航页展示」筛选（API 结构表 v1.14）：展示集不是字段而是 nav_rules
 * 求值结果，先跑 evaluateNavFeed 得到 id 集，再交由仓储以分片 IN 过滤。
 * 求值器候选上限 1000 条（既有口径），600 条基线内即全集。
 */
/**
 * 「近 N 天没打开」的时间参数（2026-10-02 批次 1）。
 * 只接受**天数**而非绝对时间戳：调用方要表达的是「最近一年没碰过」这种
 * 相对语义，交给前端算时间戳会因时区与时钟漂移产生歧义。
 * 非法值返回 undefined —— 条件不生效，而不是整个请求 400：
 * 筛选是收敛手段，不该因为一个手滑的参数让整页加载不出来。
 */
function parseLastOpenedBefore(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const days = Number(value)
  if (!Number.isFinite(days) || days <= 0) return undefined
  return new Date(Date.now() - days * 86_400_000)
}

async function navVisibilityFilter(repository: BookmarkRepository, visible: boolean): Promise<{ navVisibleIds?: string[]; navExcludedIds?: string[] }> {
  const feed = await evaluateNavFeed(repository)
  const ids = feed.map((row) => String((row as Record<string, unknown>)?.id ?? '')).filter(Boolean)
  return visible ? { navVisibleIds: ids } : { navExcludedIds: ids }
}

  app.get('/api/bookmarks', async (c) => {
    const query = bookmarkListQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor, sort, createdFrom, createdTo, navVisible } = query.data
    const importantQuery = c.req.query('important')
    const navFilter = navVisible !== undefined ? await navVisibilityFilter(repository, navVisible === 'true') : {}
    const result = await repository.list({
      q: c.req.query('q'),
      status: c.req.query('status'),
      sceneId: c.req.query('sceneId'),
      folderId: c.req.query('folderId') === 'none' ? 'none' : c.req.query('folderId'),
      tagId: c.req.query('tagId'),
      lastOpenedBefore: parseLastOpenedBefore(c.req.query('lastOpenedBefore')),
      important: importantQuery === 'true' ? true : importantQuery === 'false' ? false : undefined,
      source: c.req.query('source'),
      createdFrom,
      createdTo,
      ...navFilter,
    }, limit, cursor, { sort })
    return c.json({ items: result.items.map(serializeBookmark), nextCursor: result.nextCursor, total: result.total })
  })

  app.post('/api/bookmarks', async (c) => {
    const input = workbenchCreateBookmarkInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!input.success) return invalidRequest(c)
    const idempotencyKey = c.req.header('Idempotency-Key')
    const actor = 'user'
    if (idempotencyKey) {
      const replay = await repository.idempotency.findReplay(idempotencyKey, actor)
      if (replay) {
        const keyEntry = (await repository.get(JSON.parse(replay.responseBody).id))
        return c.json({ bookmark: serializeBookmark(keyEntry ?? {}), idempotent: true, replay: true }, 201)
      }
    }
    const id = randomUUID()
    const record = await repository.create({
      id, url: input.data.url, status: 'unread',
      note: input.data.note ?? null, intent: input.data.intent ?? null,
      important: input.data.important ?? false, private: input.data.private ?? false,
      domain: domainFromUrl(input.data.url) ?? null,
      syncStatus: 'synced',
    })
    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await repository.idempotency.store({
        key: idempotencyKey, actor,
        requestPath: c.req.path, requestBodyHash: '',
        statusCode: 201, responseBody: JSON.stringify(record),
        expiresAt, createdAt: new Date(),
      })
    }
    await repository.operationLog.append({ actor, action: 'create', targetType: 'bookmark', targetId: id })
    // 已启用 Raindrop 通道时入队推送；回执与库内状态同步标 pending
    if (await enqueueRaindropSync('create', record as { id: string; url: string })) {
      ;(record as { syncStatus?: string }).syncStatus = 'pending'
    }

    // Async metadata extraction - don't block the response
    await completeMetadata(c, repository, options, id, input.data.url)
    const filled = (await repository.get(id)) ?? record

    return c.json(serializeBookmark(filled), 201)
  })

  app.get('/api/inbox', async (c) => {
    const query = paginationQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor } = query.data
    const result = await repository.listInbox(limit, cursor)
    return c.json({ bookmarks: result.bookmarks.map(serializeBookmark), nextCursor: result.nextCursor, total: result.total })
  })

  app.get('/api/sync/pending-count', async (c) => {
    const count = await repository.syncQueue.countPending()
    return c.json({ pendingCount: count })
  })

  // 同步状态聚合（状态栏卡片）：一次请求带回推送/拉回/冲突/上次同步时间，
  // 替代前端分别探测 pending-count、conflicts、队列的三次往返
  app.get('/api/sync/status', async (c) => {
    const [pendingPush, failedPush, pendingConflicts, lastPushAt, lastPullAt] = await Promise.all([
      repository.syncQueue.countPending(),
      repository.syncQueue.countFailed(),
      repository.conflicts.countPending(),
      readSyncTimestamp('sync.last_push_at'),
      readSyncTimestamp('sync.last_pull_at'),
    ])
    return c.json({ pendingPush, failedPush, pendingConflicts, lastPushAt, lastPullAt })
  })

  /**
   * 双向差异探测（2026-10-02，计划 §3.5）。
   *
   * 与 `/api/sync/status` 的分工：那个回答「队列里有多少、失败了没有」，
   * 这个回答「**本地与 Raindrop 各差多少、差在改什么**」——即屏 5 胶囊的折叠态与浮条。
   *
   * **纯只读**：只做一次远端 GET + 一次本地 id 比对，不入队、不写库，
   * 因此不依赖 PUT 语义实测，可在推送侧落地前先上。
   *
   * `?breakdown=1` 才计算领先明细：要读全部 pending 的 payload，比两个 count 贵得多，
   * 胶囊悬停这种高频路径不该付这个代价。
   */
  app.get('/api/sync/diff', async (c) => {
    // 差异探测要 fetchBookmarks，而 resolveRaindropClient 返回的是推送用的窄接口
    // （create/update/delete），故这里按 pull 路由的做法直接取 token 构造真实客户端。
    const channels = await channelManager.getAllChannels()
    const raindrop = channels.find((ch) => ch.channel === 'raindrop' && ch.enabled && String(ch.config.token ?? ''))
    const client = raindrop ? new RaindropClient(String(raindrop.config.token)) : null
    const diff = await computeSyncDiff(repository, client, {
      withBreakdown: c.req.query('breakdown') === '1',
    })
    return c.json(diff)
  })

  app.get('/api/sync/queue', async (c) => {
    const limit = Number(c.req.query('limit')) || 50
    const items = await repository.syncQueue.getPending(limit)
    return c.json({ items })
  })

  // Raindrop 拉回（双向同步的远端→本地侧）：每次只拉一页（50 条），防 API 风控；
  // 新书签进 Inbox（source=raindrop），已有书签内容冲突时本地赢并记入 conflicts
  app.post('/api/sync/pull', async (c) => {
    // 拉取需要完整的 Raindrop 读接口（fetchBookmarks），不走推送用的结构化解析器
    const channels = await channelManager.getAllChannels()
    const raindrop = channels.find((ch) => ch.channel === 'raindrop' && ch.enabled && String(ch.config.token ?? ''))
    if (!raindrop) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: '没有已启用且配置了 Token 的 Raindrop 通道' } }, 400)
    }
    const client = new RaindropClient(String(raindrop.config.token))
    const body = await c.req.json().catch(() => ({})) as { intoInbox?: boolean; maxPages?: number }
    const summary = await pullFromRaindrop(repository, client, {
      intoInbox: body.intoInbox,
      maxPages: typeof body.maxPages === 'number' ? body.maxPages : 1,
    })
    if (summary.conflicts > 0) {
      await repository.operationLog.append({
        actor: 'user', action: 'pull', targetType: 'channel', targetId: 'raindrop',
        detail: `拉回 ${summary.created} 条新增，${summary.conflicts} 条冲突记入待处理`,
      })
    }
    await writeSyncTimestamp('sync.last_pull_at')
    return c.json(summary)
  })

  app.post('/api/sync/process', async (c) => {
    // L2：真实消费一批队列项（先按指数退避重置到期的失败项，再逐条推送到通道）
    const summary = await processSyncQueue(repository, async () => {
      const channels = await channelManager.getAllChannels()
      return resolveRaindropClient(channels)
    }, 10)
    if (summary.succeeded > 0) await writeSyncTimestamp('sync.last_push_at')
    return c.json(summary)
  })

  // 同步冲突（拉回侧，本地赢自动记录）：列表 + 单条/批量解决
  app.get('/api/conflicts', async (c) => {
    const resolution = c.req.query('resolution')
    const items = await repository.conflicts.list(resolution)
    return c.json({ items })
  })

  app.get('/api/conflicts/pending-count', async (c) => {
    return c.json({ pendingCount: await repository.conflicts.countPending() })
  })

  app.post('/api/conflicts/resolve-all', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { choice?: string }
    const choice = body.choice
    if (!['kept_local', 'kept_remote', 'merged'].includes(choice ?? '')) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'choice must be kept_local/kept_remote/merged' } }, 400)
    }
    const resolved = await repository.conflicts.resolveAll(choice as 'kept_local' | 'kept_remote' | 'merged')
    await repository.operationLog.append({ actor: 'user', action: 'resolve', targetType: 'conflict', targetId: 'all', detail: `批量解决 ${resolved} 条（${choice}）` })
    return c.json({ resolved })
  })

  app.post('/api/conflicts/:id/resolve', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { choice?: string }
    const choice = body.choice
    if (!['kept_local', 'kept_remote', 'merged'].includes(choice ?? '')) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'choice must be kept_local/kept_remote/merged' } }, 400)
    }
    const conflict = await repository.conflicts.get(c.req.param('id')) as Record<string, unknown> | undefined
    if (!conflict) return c.json({ error: { code: 'NOT_FOUND', message: 'Conflict not found' } }, 404)

    if (choice === 'kept_remote' || choice === 'merged') {
      // 用远端覆盖（kept_remote）或以本地为基补齐远端非空字段（merged）
      const remote = typeof conflict.remoteSnapshot === 'string' ? JSON.parse(conflict.remoteSnapshot) as Record<string, unknown> : {}
      const local = typeof conflict.localSnapshot === 'string' ? JSON.parse(conflict.localSnapshot) as Record<string, unknown> : {}
      const bookmarkId = String(conflict.bookmarkId ?? '')
      if (bookmarkId && await repository.get(bookmarkId, true)) {
        const title = choice === 'kept_remote' ? remote.title : (local.title || remote.title)
        const note = choice === 'kept_remote' ? remote.note : (local.note || remote.note)
        await repository.update(bookmarkId, {
          ...(title ? { title: String(title) } : {}),
          ...(note !== undefined ? { note: note ? String(note) : null } : {}),
        })
      }
    }
    const resolved = await repository.conflicts.resolve(c.req.param('id'), choice as 'kept_local' | 'kept_remote' | 'merged')
    await repository.operationLog.append({ actor: 'user', action: 'resolve', targetType: 'conflict', targetId: c.req.param('id'), detail: `冲突解决（${choice}）` })
    return c.json(resolved)
  })

  const workbenchPaths = [
    '/api/recycle-bin', '/api/recycle-bin/*', '/api/scenes', '/api/scenes/*',
    '/api/folders', '/api/folders/*', '/api/tags', '/api/tags/*',
    '/api/suggestions/*', '/api/operation-log', '/api/operation-log/*', '/api/settings', '/api/settings/*',
    '/api/jobs', '/api/jobs/*', '/api/channels', '/api/channels/*',
    '/api/archive', '/api/archive/*', '/api/backup', '/api/backup/*',
    '/api/nav', '/api/nav/*',
    '/api/conflicts', '/api/conflicts/*',
    '/api/stats',
    '/api/skill/usage', '/api/skill/capabilities', '/api/skill/token',
  ]
  for (const path of workbenchPaths) app.use(path, requireSession)

  app.get('/api/bookmarks/search', async (c) => {
    const query = bookmarkListQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor, sort, createdFrom, createdTo, navVisible } = query.data
    const navFilter = navVisible !== undefined ? await navVisibilityFilter(repository, navVisible === 'true') : {}
    const items = await repository.search({
      q: c.req.query('q'), status: c.req.query('status'), sceneId: c.req.query('sceneId'),
      folderId: c.req.query('folderId') === 'none' ? 'none' : c.req.query('folderId'),
      tagId: c.req.query('tagId'),
      lastOpenedBefore: parseLastOpenedBefore(c.req.query('lastOpenedBefore')), important: c.req.query('important') === undefined ? undefined : c.req.query('important') === 'true',
      source: c.req.query('source'), includeDeleted: false,
      createdFrom, createdTo, ...navFilter,
    }, limit, cursor, { sort })
    return c.json({ items: items.items.map(serializeBookmark), nextCursor: items.nextCursor, total: items.total })
  })

  app.get('/api/bookmarks/search-index', async (c) => {
    // 2026-10-02 批次 2：端侧全量检索的瘦投影。与 /api/bookmarks/search 的分工：
    // 那个是「带条件的分页查询」（按条件命中多少取多少），这个是「一次拿全建本地索引」。
    // 刻意不含 cover / excerpt——3412 条要常驻浏览器内存，带大字段会让传输量翻数倍。
    const query = searchIndexQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const result = await repository.listSearchIndex(query.data.limit, query.data.cursor)
    return c.json(result)
  })

  app.patch('/api/bookmarks/batch', async (c) => {
    const body = batchUpdateRequestSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return invalidRequest(c)
    const snapshots = []
    for (const id of body.data.ids) {
      const existing = await repository.get(id, true) as { id: string; status?: string; folderId?: string | null; deletedAt?: unknown } | undefined
      if (existing) snapshots.push({ id: existing.id, status: existing.status ?? 'unread', folderId: existing.folderId ?? null, deleted: Boolean(existing.deletedAt) })
    }
    const result = await repository.batchUpdate(body.data as any)
    // 批量同样按通道入队：删除走远端删除；更新只在触及回写范围（folder/tag）时入队——
    // status/scene 等本地维度不回写（决策二/§3.3），不为一堆 no-op PUT 浪费 Raindrop 额度
    if (body.data.deleted) {
      for (const updated of result.updated) {
        await enqueueRaindropSync('delete', updated as { id: string; raindropId?: string | null })
      }
    } else if (await hasEnabledRaindropChannel()) {
      const touchesFolder = 'folderId' in body.data
      const touchesTags = (body.data.addTagIds?.length ?? 0) > 0 || (body.data.removeTagIds?.length ?? 0) > 0
      if (touchesFolder || touchesTags) {
        type BatchRow = { id: string; url: string; raindropId: string | null; folderId: string | null; raindropExtras: string | null }
        // 各映射一次取全，循环内只做内存查表（D1 子请求预算）
        const folderRows = (await repository.folders.list()) as Array<{ id: string; raindropId: string | null }>
        const folderRemote = new Map(folderRows.map((f) => [f.id, f.raindropId ? Number(f.raindropId) : null]))
        const tagRows = touchesTags ? (await repository.tags.list()) as Array<{ id: string; name: string }> : []
        const nameOfTag = new Map(tagRows.map((t) => [t.id, t.name]))
        // 纯追加 = 只加标签、不动收藏夹也不删标签：可入 addTags 攒批路径
        const addedNames = (body.data.addTagIds ?? []).map((id) => nameOfTag.get(id)).filter((n): n is string => Boolean(n))
        const pureAdd = touchesTags && !(body.data.removeTagIds?.length) && !touchesFolder && addedNames.length > 0
        const rows = result.updated as BatchRow[]
        // 不能攒批的（无 raindropId / 源集合解析不到 / 非纯追加）退回全量替换路径，需查编辑后完整标签集
        const needFullSet = touchesTags
          ? rows.filter((row) => !pureAdd || !row.raindropId || resolveSrcCollection(row, folderRemote) === null)
          : []
        const tagIdsByBookmark = needFullSet.length ? await repository.findTagIdsByBookmarkIds(needFullSet.map((row) => row.id)) : new Map<string, string[]>()
        for (const row of rows) {
          const syncInput: Parameters<typeof enqueueRaindropSync>[1] = { id: row.id, url: row.url, raindropId: row.raindropId }
          if (touchesFolder) syncInput.folderId = row.folderId
          if (touchesTags) {
            const bulkable = pureAdd && row.raindropId && resolveSrcCollection(row, folderRemote) !== null
            if (bulkable) {
              syncInput.addTags = addedNames
              syncInput.srcCollection = resolveSrcCollection(row, folderRemote) as number
            } else {
              syncInput.tags = (tagIdsByBookmark.get(row.id) ?? []).map((id) => nameOfTag.get(id)).filter((n): n is string => Boolean(n))
            }
          }
          await enqueueRaindropSync('update', syncInput)
        }
      }
    }
    const log = await repository.operationLog.append({
      actor: 'user',
      action: body.data.deleted ? 'delete' : 'update',
      targetType: 'bookmark',
      targetId: body.data.ids[0],
      detail: JSON.stringify({ ids: body.data.ids }),
      revertToken: JSON.stringify({ kind: 'batch', snapshots }),
    }) as { id: string }
    return c.json({ updated: result.updated.map(serializeBookmark), skipped: result.skipped, undoId: log.id })
  })

  app.get('/api/bookmarks/:bookmarkId', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    return record ? c.json(serializeBookmark(record)) : skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
  })

  /** 封面：优先 R2/本地缓存，未命中再拉远端并落下（cover 列仍是原 URL，不写进 Raindrop）。 */
  app.get('/api/bookmarks/:bookmarkId/cover', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    if (!record) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const cover = serializeBookmark(record).cover as string | null
    if (!cover) return skillError(c, 'NOT_FOUND', 404, 'Cover not found')
    const loaded = await loadCoverBytes({
      bookmarkId: c.req.param('bookmarkId'),
      sourceUrl: cover,
      store: options.coverStore,
    })
    if (!loaded.ok) return skillError(c, 'NOT_FOUND', 404, loaded.error)
    return new Response(coverBodyInit(loaded.body), {
      status: 200,
      headers: {
        'Content-Type': loaded.contentType,
        'Cache-Control': 'private, max-age=86400',
        'X-Cover-Cache': loaded.cache,
      },
    })
  })

  app.patch('/api/bookmarks/:bookmarkId', async (c) => {
    const input = workbenchPatchBookmarkInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const existing = await repository.get(c.req.param('bookmarkId'), true)
    if (!existing) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    if ((existing as any).deletedAt) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    if (input.data.version !== undefined && (existing as any).version !== input.data.version) {
      return c.json({
        error: { code: 'CONFLICT' as const, message: 'Version conflict', details: { currentVersion: (existing as any).version } },
      }, 409)
    }
    const { confirmStructure: _confirmStructure, version: _version, ...changes } = input.data
    const updated = await repository.update(c.req.param('bookmarkId'), changes) as
      | { id: string; url: string; title: string | null; note: string | null; raindropId: string | null; folderId: string | null; tags?: Array<{ id: string; name: string }> }
      | undefined
    if (!updated) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    await repository.operationLog.append({ actor: 'user', action: 'update', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    // 只在编辑触及回写范围（title/note/folder/tag）时入队：status/scene/important 等
    // 本地维度不回写 Raindrop（决策二/§3.3），推一次 no-op PUT 只是浪费额度
    const touchCount = ['title', 'note', 'folderId', 'tagIds'].filter((key) => key in changes).length
    if (touchCount > 0) {
      await enqueueRaindropSync('update', {
        id: updated.id,
        url: updated.url,
        raindropId: updated.raindropId ?? null,
        ...('title' in changes ? { title: updated.title } : {}),
        ...('note' in changes ? { note: updated.note } : {}),
        ...('folderId' in changes ? { folderId: updated.folderId ?? null } : {}),
        // updated.tags 经 readRelations 回读，是编辑后的完整集合（替换语义）
        ...('tagIds' in changes ? { tags: ((updated.tags ?? []) as Array<{ name: string }>).map((t) => t.name) } : {}),
      })
    }
    return c.json(serializeBookmark(updated))
  })

  app.delete('/api/bookmarks/:bookmarkId', async (c) => {
    const deleted = await repository.softDelete(c.req.param('bookmarkId'))
    if (!deleted) return c.json({ ok: true, deletedAt: null, undoId: null })
    const log = await repository.operationLog.append({
      actor: 'user',
      action: 'delete',
      targetType: 'bookmark',
      targetId: c.req.param('bookmarkId'),
      revertToken: JSON.stringify({ kind: 'undelete', ids: [c.req.param('bookmarkId')] }),
    }) as { id: string }
    // 已推送过的书签才需要在远端删除（payload 带 raindropId；缺失时消费侧视为成功）
    await enqueueRaindropSync('delete', deleted as { id: string; raindropId?: string | null })
    return c.json({ ok: true, deletedAt: timestamp((deleted as any).deletedAt), undoId: log.id })
  })

  app.get('/api/recycle-bin', async (c) => {
    const query = paginationQuerySchema.safeParse(c.req.query())
    if (!query.success) return invalidRequest(c)
    const { limit, cursor } = query.data
    const result = await repository.listRecycleBin(limit, cursor)
    return c.json({ items: result.items.map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/recycle-bin/:bookmarkId/restore', async (c) => {
    const restored = await repository.restore(c.req.param('bookmarkId'))
    if (!restored) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    await repository.operationLog.append({ actor: 'user', action: 'restore', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json({ ok: true, bookmark: serializeBookmark(restored) })
  })

  app.delete('/api/recycle-bin/:bookmarkId', async (c) => {
    const count = await repository.purgeDeleted([c.req.param('bookmarkId')])
    if (!count) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    await repository.operationLog.append({ actor: 'user', action: 'purge', targetType: 'bookmark', targetId: c.req.param('bookmarkId') })
    return c.json({ ok: true })
  })

  app.post('/api/recycle-bin/empty', async (c) => {
    const body = recycleBinEmptyRequestSchema.safeParse(await c.req.json().catch(() => ({})))
    const onlyExpired = body.success ? body.data.onlyExpired : true
    let before: Date | undefined
    if (onlyExpired !== false) {
      const setting = await repository.settings.get('recycle.retention_days') as any
      const days = Number(setting?.value ?? 7)
      before = new Date(Date.now() - days * 86400000)
    }
    const count = await repository.purgeDeleted(undefined, before)
    await repository.operationLog.append({ actor: 'user', action: 'purge', targetType: 'bookmark', targetId: 'recycle-bin' })
    return c.json({ ok: true, purged: count })
  })

  /**
   * 组织维度路由。此前这里没有任何 schema，直接把 `{ ...body }` 展开进 create()，
   * 导致 `aer`（应为 `aerr`）、`enabld`（应为 `enabled`）、`parentid` 之类打字错误
   * 被接受并静默丢弃，接口仍返回 201。现按 `docs/API结构表.md` §8.4 的白名单校验，
   * 未知字段返回 VALIDATION_ERROR（strict）。
   *
   * 用结构化的最小接口声明 schema 类型，避免在联合类型上调用 safeParse 触发 TS 报错。
   */
  type InputSchema = {
    safeParse: (value: unknown) => { success: true; data: unknown } | { success: false; error: unknown }
  }
  const orgInputSchemas: Record<string, { create: InputSchema; update: InputSchema | null }> = {
    scenes: { create: sceneCreateInputSchema, update: sceneUpdateInputSchema },
    folders: { create: folderCreateInputSchema, update: folderUpdateInputSchema },
    tags: { create: tagCreateInputSchema, update: null },
  }

  const resourceRoutes = [
    ['scenes', repository.scenes], ['folders', repository.folders], ['tags', repository.tags],
  ] as const
  for (const [name, resource] of resourceRoutes) {
    const schemas = orgInputSchemas[name]
    app.get(`/api/${name}`, async (c) => c.json({ items: await resource.list() }))
    app.post(`/api/${name}`, async (c) => {
      const parsed = schemas.create.safeParse(await c.req.json().catch(() => undefined))
      if (!parsed.success) return invalidRequest(c)
      const body = parsed.data as Record<string, unknown>
      const record = await resource.create({ ...body, id: body.id ?? randomUUID() })
      await repository.operationLog.append({ actor: 'user', action: 'create', targetType: name.slice(0, -1), targetId: String((record as any).id) })
      return c.json(record, 201)
    })
    // `name !== 'tags'` 同时承担类型收窄（tags 资源没有 update 方法）
    if (name !== 'tags' && schemas.update) {
      const updateSchema = schemas.update
      app.patch(`/api/${name}/:id`, async (c) => {
        const parsed = updateSchema.safeParse(await c.req.json().catch(() => undefined))
        if (!parsed.success) return invalidRequest(c)
        const record = await resource.update(c.req.param('id'), parsed.data as Record<string, unknown>)
        return record ? c.json(record) : skillError(c, 'NOT_FOUND', 404, 'Resource not found')
      })
    }
    app.delete(`/api/${name}/:id`, async (c) => {
      const removed = await resource.remove(c.req.param('id'))
      if (!removed) return skillError(c, name === 'scenes' ? 'SCENE_IN_USE' : 'NOT_FOUND', 409, name === 'scenes' ? 'Scene is in use' : 'Resource not found')
      await repository.operationLog.append({ actor: 'user', action: 'delete', targetType: name.slice(0, -1), targetId: c.req.param('id') })
      return c.json({ ok: true })
    })
  }

  // 标签改名 / 合并（API 结构表 v1.14）：此前标签只有新建与删除，
  // 打错名只能删了重建并丢失全部挂载。改名按 id 挂载天然同步；合并不可撤销。
  app.patch('/api/tags/:id', async (c) => {
    const parsed = tagRenameInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success) return invalidRequest(c)
    const result = await repository.tags.rename(c.req.param('id'), parsed.data)
    if (!result.ok) {
      return result.reason === 'name_conflict'
        ? skillError(c, 'CONFLICT', 409, 'A tag with this name already exists')
        : skillError(c, 'NOT_FOUND', 404, 'Tag not found')
    }
    const record = result.record as { id: string; name: string; nameKey: string }
    await repository.operationLog.append({ actor: 'user', action: 'rename_tag', targetType: 'tag', targetId: c.req.param('id'), detail: record.name })
    return c.json(record)
  })

  app.post('/api/tags/:id/merge', async (c) => {
    const parsed = tagMergeInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success) return invalidRequest(c)
    const result = await repository.tags.merge(c.req.param('id'), parsed.data.targetId)
    if (!result.ok) {
      return result.reason === 'same_tag'
        ? skillError(c, 'VALIDATION_ERROR', 400, 'Cannot merge a tag into itself')
        : skillError(c, 'NOT_FOUND', 404, 'Tag not found')
    }
    const target = result.target as { id: string; name: string }
    await repository.operationLog.append({ actor: 'user', action: 'merge_tag', targetType: 'tag', targetId: c.req.param('id'), detail: `合并到「${target.name}」，迁移 ${result.moved} 条挂载` })
    return c.json({ ok: true, moved: result.moved, target: { id: target.id, name: target.name } })
  })

  // 侧栏计数 / 统计聚合（API 结构表 v1.14）：一次返回全部分维度计数
  app.get('/api/stats', async (c) => {
    const stats = await repository.stats()
    return c.json(stats)
  })

  // 场景合并（API 结构表 v1.15，§2.0.1）：源场景挂载转移（主键去重）后删除源场景。
  // 与标签合并同款语义；场景没有 name_key 唯一约束，重名合并不受限。
  app.post('/api/scenes/:id/merge', async (c) => {
    const parsed = sceneMergeInputSchema.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success) return invalidRequest(c)
    const result = await repository.scenes.merge(c.req.param('id'), parsed.data.targetId)
    if (!result.ok) {
      return result.reason === 'same_scene'
        ? skillError(c, 'VALIDATION_ERROR', 400, 'Cannot merge a scene into itself')
        : skillError(c, 'NOT_FOUND', 404, 'Scene not found')
    }
    const target = result.target as { id: string; name: string }
    await repository.operationLog.append({ actor: 'user', action: 'merge_scene', targetType: 'scene', targetId: c.req.param('id'), detail: `合并到「${target.name}」，迁移 ${result.moved} 条挂载` })
    return c.json({ ok: true, moved: result.moved, target: { id: target.id, name: target.name } })
  })

  // 操作日志保留策略清理（API 结构表 v1.15，§4.2.12）：读 settings（缺省 30 天 / 5000 条）
  // 后删除过期与超额记录。Cron / 自托管定时器也会低频调用；此路由供设置页手动触发。
  app.post('/api/operation-log/cleanup', async (c) => {
    const [retentionSetting, maxEntriesSetting] = await Promise.all([
      repository.settings.get('log.retention_days'),
      repository.settings.get('log.max_entries'),
    ])
    const retentionDays = Number((retentionSetting as { value?: unknown } | undefined)?.value ?? 30) || 30
    const maxEntries = Number((maxEntriesSetting as { value?: unknown } | undefined)?.value ?? 5000) || 5000
    const result = await repository.operationLog.cleanup({ retentionDays, maxEntries })
    if (result.removed > 0) {
      await repository.operationLog.append({ actor: 'system', action: 'cleanup_log', targetType: 'operation_log', targetId: 'operation-log', detail: `清理 ${result.removed} 条（保留 ${retentionDays} 天 / 最多 ${maxEntries} 条）` })
    }
    return c.json({ ok: true, removed: result.removed, retentionDays, maxEntries })
  })

  app.get('/api/bookmarks/:bookmarkId/suggestions', async (c) => {
    const result = await repository.suggestions.list(c.req.param('bookmarkId'), c.req.query('status'))
    return c.json({ items: result.items, nextCursor: result.nextCursor })
  })
  for (const action of ['accept', 'defer', 'dismiss'] as const) app.post(`/api/suggestions/:id/${action}`, async (c) => {
    const result = action === 'accept' ? await repository.suggestions.accept(c.req.param('id'), 'user') : await repository.suggestions.resolve(c.req.param('id'), action === 'defer' ? 'deferred' : 'dismissed')
    if (!result) return skillError(c, 'NOT_FOUND', 404, 'Suggestion not found')
    if (action !== 'accept') await repository.operationLog.append({ actor: 'user', action: action === 'dismiss' ? 'dismiss_suggestion' : 'update', targetType: 'suggestion', targetId: c.req.param('id') })
    return c.json({ ok: true, suggestion: result })
  })

  app.get('/api/operation-log', async (c) => c.json({ items: await repository.operationLog.list({ actor: c.req.query('actor'), action: c.req.query('action') }), nextCursor: null }))
  app.post('/api/operation-log/:id/revert', async (c) => {
    const row = await repository.operationLog.consumeRevert(c.req.param('id')) as { revertToken?: string | null } | undefined
    if (!row?.revertToken) return skillError(c, 'CONFLICT', 409, 'Nothing to undo')
    let payload: { kind?: string; ids?: string[]; snapshots?: Array<{ id: string; status: string; folderId: string | null; deleted: boolean }> }
    try {
      payload = JSON.parse(row.revertToken)
    } catch {
      return invalidRequest(c)
    }
    if (payload.kind === 'undelete') {
      for (const id of payload.ids ?? []) await repository.restore(id)
    } else if (payload.kind === 'batch') {
      for (const snapshot of payload.snapshots ?? []) {
        if (snapshot.deleted) continue
        await repository.restore(snapshot.id)
        await repository.update(snapshot.id, { status: snapshot.status, folderId: snapshot.folderId })
      }
    } else {
      return invalidRequest(c)
    }
    return c.json({ ok: true })
  })

  app.route('/api/channels', createChannelRoutes(repository))
  // process 必须挂在 archive 子路由之前，避免被 /api/archive/:id 吞掉
  app.post('/api/archive/process', async (c) => {
    if (!options.snapshotProcessor) {
      return c.json({
        error: {
          code: 'NOT_SUPPORTED',
          message: 'Server-side snapshot processing is not available on this deployment.',
        },
      }, 501)
    }
    const summary = await options.snapshotProcessor(repository)
    return c.json(summary)
  })
  app.route('/api/archive', createArchiveRoutes(repository))
  app.route('/api/backup', options.backupRoutes ? options.backupRoutes(repository) : createUnsupportedBackupRoutes())
  app.route('/api/metadata', createMetadataRoutes())
  app.route('/api/nav', createNavRoutes(repository))

  app.get('/api/settings', async (c) => {
    const rows = await repository.settings.list() as { key: string; value: unknown; updatedAt?: unknown }[]
    const items = rows.filter((row) => !row.key.includes('token') && !row.key.includes('password') && row.key !== 'skill.token_hash')
    return c.json({ items })
  })
  app.put('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined
    if (!body) return invalidRequest(c)
    const validated = settingsWhitelistSchema.safeParse(body)
    if (!validated.success) return invalidRequest(c, validated.error.flatten())
    const entries = Object.entries(validated.data).filter(([key]) => !key.includes('token') && !key.includes('password'))
    const items = await Promise.all(entries.map(([key, value]) => repository.settings.set(key, value)))
    return c.json({ items })
  })
  app.get('/api/jobs', async (c) => c.json({ items: await repository.archiveJobs.list(c.req.query('bookmarkId')), nextCursor: null }))
  app.post('/api/jobs/:id/retry', async (c) => {
    const currentStatus = await repository.archiveJobs.getStatus(c.req.param('id'))
    if (!currentStatus) return skillError(c, 'NOT_FOUND', 404, 'Job not found')
    if (currentStatus !== 'failed') {
      return c.json({ error: { code: 'CONFLICT' as const, message: 'Only failed jobs can be retried' } }, 409)
    }
    return c.json(await repository.archiveJobs.update(c.req.param('id'), { status: 'pending' }))
  })
  app.post('/api/jobs/:id/cancel', async (c) => {
    const currentStatus = await repository.archiveJobs.getStatus(c.req.param('id'))
    if (!currentStatus) return skillError(c, 'NOT_FOUND', 404, 'Job not found')
    if (!['pending', 'running'].includes(currentStatus)) {
      return c.json({ error: { code: 'CONFLICT' as const, message: 'Only pending or running jobs can be cancelled' } }, 409)
    }
    return c.json(await repository.archiveJobs.update(c.req.param('id'), { status: 'cancelled' }))
  })
  app.post('/api/bookmarks/:bookmarkId/archives', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { type?: string }
    if (body.type && body.type !== 'snapshot') return skillError(c, 'NOT_SUPPORTED', 400, 'Archive type is not supported')
    if (!await repository.get(c.req.param('bookmarkId'))) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: c.req.param('bookmarkId'), source: 'manual', type: 'snapshot' }) as any
    return c.json({ ...job, snapshotStatus: 'queued_pending_browser' }, 202)
  })

  app.post('/api/bookmarks/:bookmarkId/access-records', async (c) => {
    const bookmarkId = c.req.param('bookmarkId')
    if (!bookmarkId) return invalidRequest(c)
    if (!await repository.get(bookmarkId, true)) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const body = await c.req.json().catch(() => ({})) as { source?: string; client?: string }
    const source = body.source === 'snapshot' ? 'snapshot' : 'original'
    const client = ['workbench', 'navigation', 'plugin', 'unknown'].includes(body.client ?? '') ? body.client : 'workbench'
    const record = await repository.createAccessRecord({ id: randomUUID(), bookmarkId, source, client })
    return c.json(serializeAccessRecord(record), 201)
  })

  app.get('/api/bookmarks/:bookmarkId/access-records', async (c) => {
    const records = await repository.listAccessRecords(c.req.param('bookmarkId'))
    return c.json({ records: records.map(serializeAccessRecord) })
  })

  app.get('/api/bookmarks/:bookmarkId/export/html', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    if (!record) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const anyRecord = record as Record<string, any>
    const title = anyRecord.title || anyRecord.url || 'bookmark'
    const domain = anyRecord.domain || ''
    const createdAt = anyRecord.createdAt ? new Date(anyRecord.createdAt instanceof Date ? anyRecord.createdAt.getTime() : Number(anyRecord.createdAt)).toISOString() : ''
    const author = anyRecord.author || ''
    const note = anyRecord.note || ''
    const url = anyRecord.url || ''
    const excerpt = anyRecord.excerpt || ''
    const sourceLabel = sourceLabels[String(anyRecord.source ?? '')] ?? anyRecord.source ?? ''
    const scenes = (anyRecord.scenes ?? []).map((s: any) => s?.name).filter(Boolean) as string[]
    const tags = (anyRecord.tags ?? []).map((t: any) => t?.name).filter(Boolean) as string[]
    // 空值不再渲染成「标签: 」这样的空行——导出文件是给人看的，空字段直接省略
    const metaRow = (label: string, value: string) => (value ? `    <p>${label}: ${escapeHtml(value)}</p>\n` : '')
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="author" content="${escapeHtml(author)}">
  <meta name="description" content="${escapeHtml(excerpt)}">
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    a { color: #0066cc; }
    .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h1>
  <div class="meta">
${metaRow('收集方式', sourceLabel)}${metaRow('域名', domain)}${metaRow('保存时间', createdAt)}${metaRow('作者', author)}${metaRow('场景', scenes.join('、'))}${metaRow('标签', tags.join('、'))}  </div>
${excerpt ? `  <p>${escapeHtml(excerpt)}</p>\n` : ''}${note ? `  <div><h2>备注</h2><p>${escapeHtml(note)}</p></div>\n` : ''}</body>
</html>`
    return c.newResponse(html, 200, { 'Content-Type': 'text/html; charset=utf-8' })
  })

  app.get('/api/bookmarks/:bookmarkId/export/markdown', async (c) => {
    const record = await repository.get(c.req.param('bookmarkId'))
    if (!record) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const anyRecord = record as Record<string, any>
    const title = anyRecord.title || anyRecord.url || 'bookmark'
    const url = anyRecord.url || ''
    const domain = anyRecord.domain || ''
    const createdAt = anyRecord.createdAt ? new Date(anyRecord.createdAt instanceof Date ? anyRecord.createdAt.getTime() : Number(anyRecord.createdAt)).toISOString() : ''
    const author = anyRecord.author || ''
    const note = anyRecord.note || ''
    const excerpt = anyRecord.excerpt || ''
    const sourceLabel = sourceLabels[String(anyRecord.source ?? '')] ?? anyRecord.source ?? ''
    const scenes = (anyRecord.scenes ?? []).map((s: any) => s?.name).filter(Boolean) as string[]
    const tags = (anyRecord.tags ?? []).map((t: any) => t?.name).filter(Boolean) as string[]
    // 空值不渲染成空条目
    const bullet = (label: string, value: string) => (value ? `- ${label}: ${value}\n` : '')
    const md = `# [${title}](${url})

${bullet('收集方式', sourceLabel)}${bullet('域名', domain)}${bullet('保存时间', createdAt)}${bullet('作者', author)}${bullet('场景', scenes.join('、'))}${bullet('标签', tags.join('、'))}${excerpt ? `\n${excerpt}\n` : ''}${note ? `\n## 备注\n\n${note}\n` : ''}`
    return c.newResponse(md, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  })

  const configuredSkillToken = options.skillToken ?? process.env.DOGEAR_SKILL_TOKEN ?? ''
  const limits = { read: options.rateLimits?.read ?? 60, write: options.rateLimits?.write ?? 30, batch: options.rateLimits?.batch ?? 10 }
  const usage = { read: 0, write: 0, batch: 0 }
  const capabilities = { read: true, write_new: true, update_existing: false }
  const skillLimit = (name: string): SkillLimit => name === 'update_bookmark' ? 'batch' : ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene'].includes(name) ? 'read' : 'write'
  const skillCapability = (name: string) => name === 'update_bookmark' ? 'update_existing' : ['search_bookmarks', 'list_bookmarks', 'get_stats', 'suggest_scene'].includes(name) ? 'read' : 'write_new'
  const skillRouteNames = new Set(skillDefinitions.map((skill) => skill.name))
  const requireSkill = async (c: any, next: any) => {
    const name = c.req.param('name')
    if (!name || !skillRouteNames.has(name)) return next()
    const authorization = c.req.header('Authorization') ?? ''
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const envOk = Boolean(configuredSkillToken) && tokensEqual(bearer, configuredSkillToken)
    let hashOk = false
    if (!envOk && bearer && repository.settings && typeof repository.settings.get === 'function') {
      const stored = readStoredHash(await repository.settings.get('skill.token_hash'))
      hashOk = Boolean(stored) && tokensEqual(hashSkillToken(bearer), stored)
    }
    if (!envOk && !hashOk) return skillError(c, 'UNAUTHORIZED', 401, 'Unauthorized')
    const configured = repository.settings && typeof repository.settings.get === 'function' ? await repository.settings.get('skill.capabilities') : undefined
    let configuredCapabilities = capabilities
    if (configured && typeof configured === 'object' && 'value' in configured) {
      try { configuredCapabilities = JSON.parse(String((configured as { value: unknown }).value)) } catch { configuredCapabilities = capabilities }
    }
    const capability = skillCapability(name) as keyof typeof capabilities
    if (!configuredCapabilities[capability]) {
      await repository.skillUsage.increment('blocked')
      return skillError(c, 'CAPABILITY_DISABLED', 403, 'Skill capability is disabled')
    }
    const limit = skillLimit(name)
    usage[limit] += 1
    if (usage[limit] > limits[limit]) {
      await repository.skillUsage.increment('blocked')
      return skillError(c, 'RATE_LIMITED', 429, 'Skill rate limit exceeded')
    }
    const bucket = limit === 'read' ? 'read' : 'write'
    await repository.skillUsage.increment(bucket)
    await next()
  }

  app.get('/.well-known/capabilities', (c) => c.json({ name: 'DogEar', version: 'v1', auth: 'Bearer token', skills: skillDefinitions }))
  app.use('/api/skill/:name', requireSkill)

  app.put('/api/skill/capabilities', async (c) => {
    const body = skillCapabilitiesBodySchema.safeParse(await jsonBody(c))
    if (!body.success) return invalidRequest(c, body.error.flatten())
    await repository.settings.set('skill.capabilities', body.data)
    return c.json(body.data)
  })

  app.get('/api/skill/token', async (c) => {
    const row = repository.settings && typeof repository.settings.get === 'function'
      ? await repository.settings.get('skill.token_hash')
      : undefined
    const fromSettings = Boolean(readStoredHash(row))
    const fromEnv = Boolean(configuredSkillToken)
    return c.json({ configured: fromEnv || fromSettings, fromEnv, fromSettings })
  })
  app.post('/api/skill/token', async (c) => {
    const token = generateSkillToken()
    await repository.settings.set('skill.token_hash', hashSkillToken(token))
    await repository.operationLog.append({ actor: 'user', action: 'update', targetType: 'setting', targetId: 'skill.token' })
    return c.json({ token, configured: true })
  })

  app.get('/api/skill/usage', async (c) => {
    const today = new Date().toISOString().split('T')[0]
    const usage = await repository.skillUsage.getDaily(today)
    return c.json({ date: today, requests: usage.read, writes: usage.write, blocked: usage.blocked })
  })

  app.post('/api/skill/save_bookmark', async (c) => {
    const input = saveBookmarkSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    await repository.skillUsage.increment('write')
    const idempotencyKey = c.req.header('Idempotency-Key')
    const actor = 'agent'
    if (idempotencyKey) {
      const replay = await repository.idempotency.findReplay(idempotencyKey, actor)
      if (replay) {
        const keyEntry = (await repository.get(JSON.parse(replay.responseBody).id))
        return c.json({ bookmark: serializeBookmark(keyEntry ?? {}), idempotent: true, replay: true }, 201)
      }
    }
    const id = randomUUID()
    // 来源：Chrome 扩展传 source:'extension'，缺省仍为 agent（契约向后兼容）
    const record = await repository.create({
      id,
      url: input.data.url,
      status: 'unread',
      source: input.data.source ?? 'agent',
      note: input.data.note,
      intent: input.data.intent,
      title: input.data.title,
      excerpt: input.data.excerpt ?? null,
      favicon: input.data.favicon ?? null,
      domain: domainFromUrl(input.data.url) ?? null,
      syncStatus: 'synced',
    })
    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await repository.idempotency.store({
        key: idempotencyKey, actor,
        requestPath: c.req.path, requestBodyHash: '',
        statusCode: 201, responseBody: JSON.stringify(record),
        expiresAt, createdAt: new Date(),
      })
    }
    const saved = { ...serializeBookmark(record), snapshotStatus: 'not_requested', suggestions: [] }
    if (input.data.snapshot && repository.archiveJobs) {
      const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: saved.id, source: 'agent', type: 'snapshot' }) as any
      saved.snapshotStatus = 'queued_pending_browser'
      saved.jobId = job.id
    }
    if (repository.operationLog) await repository.operationLog.append({ actor: 'agent', action: 'save_bookmark', targetType: 'bookmark', targetId: saved.id })
    // Agent 保存同样走通道推送入队（与工作台保存一致）
    await enqueueRaindropSync('create', saved as { id: string; url: string; title?: string | null; note?: string | null })

    // Async metadata extraction - don't block the response
    await completeMetadata(c, repository, options, saved.id, saved.url, {
      title: saved.title,
      excerpt: saved.excerpt,
      favicon: saved.favicon,
    })
    const filled = (await repository.get(saved.id)) ?? record
    const receipt = { ...serializeBookmark(filled), snapshotStatus: saved.snapshotStatus, suggestions: saved.suggestions } as Record<string, unknown>
    if (saved.jobId) receipt.jobId = saved.jobId

    return c.json(receipt, 201)
  })

  app.post('/api/skill/search_bookmarks', async (c) => {
    const input = searchBookmarksSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const filters = { ...(input.data.filters ?? {}), q: input.data.query, includeDeleted: false }
    const result = await repository.search(filters, input.data.limit)
    return c.json({ items: result.items.filter((item: any) => input.data.filters?.includePrivate || !item.private).map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/skill/list_bookmarks', async (c) => {
    const input = listBookmarksSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const result = await repository.list({ ...input.data, includeDeleted: false }, input.data.limit)
    return c.json({ items: result.items.filter((item: any) => !item.private).map(serializeBookmark), nextCursor: result.nextCursor })
  })

  app.post('/api/skill/get_stats', async (c) => {
    const input = getStatsSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const result = await repository.list()
    const statuses = Object.fromEntries(['unread', 'saved', 'archived'].map((status) => [status, result.items.filter((item: any) => item.status === status).length]))
    return c.json({ total: result.items.length, inbox: statuses.unread, statuses, scenes: [] })
  })

  app.post('/api/skill/trigger_archive', async (c) => {
    const input = triggerArchiveSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    if (input.data.type === 'reader') return skillError(c, 'NOT_SUPPORTED', 400, 'Reader archive is not supported')
    const bookmark = await repository.get(input.data.bookmarkId)
    if (!bookmark) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const job = await repository.archiveJobs.create({ id: randomUUID(), bookmarkId: input.data.bookmarkId, type: 'snapshot', source: 'agent' }) as any
    return c.json({ jobId: job.id, snapshotStatus: 'queued_pending_browser' })
  })

  app.post('/api/skill/suggest_scene', async (c) => {
    const input = suggestSceneSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const bookmarkIds = 'bookmarkId' in input.data ? [input.data.bookmarkId] : input.data.bookmarkIds
    const suggestions: unknown[] = []
    for (const bookmarkId of bookmarkIds) {
      if (!await repository.get(bookmarkId)) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
      if (repository.suggestions) {
        const suggestion = await repository.suggestions.create({ id: randomUUID(), bookmarkId, kind: 'scene', targetId: null, targetLabel: null, confidence: null, rationale: null })
        suggestions.push(suggestion)
      }
    }
    return c.json({ suggestions })
  })

  app.post('/api/skill/update_bookmark', async (c) => {
    const input = updateBookmarkSkillInputSchema.safeParse(await jsonBody(c))
    if (!input.success) return invalidRequest(c, input.error.flatten())
    const existing = await repository.get(input.data.id)
    if (!existing) return skillError(c, 'NOT_FOUND', 404, 'Bookmark not found')
    const structure = 'sceneIds' in input.data || 'tagIds' in input.data || 'folderId' in input.data
    if (structure && !input.data.confirmStructure) return c.json({ applied: false, suggestions: [] })
    const { id, confirmStructure, ...changes } = input.data
    const updated = await repository.update(id, changes)
    if (!updated) return skillError(c, 'BOOKMARK_DELETED', 409, 'Bookmark is deleted')
    if (repository.operationLog) await repository.operationLog.append({ actor: 'agent', action: 'update_bookmark', targetType: 'bookmark', targetId: id })
    return c.json({ applied: true, bookmark: serializeBookmark(updated) })
  })

  return app
}
