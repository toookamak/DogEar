import type { BookmarkRepository } from '@dogear/db'
import type { RaindropBookmark } from '../channels/raindrop.js'

/**
 * 端侧双向差异探测（计划 §3.5，2026-10-02）。
 *
 * 现状只有一个「待同步 N」，而它**只代表本地领先**。「远端有、本地还没有」
 * 这个数字根本不存在，所以界面无法回答「Raindrop 那边变了什么」。
 *
 * **本模块是纯只读的**（远端 GET + 本地查询），不产生任何写入、
 * 不入 `sync_queue`、不碰推送路径——因此**不依赖 §8.1 的 0.0 PUT 语义实测**。
 */

/** 探测页大小。50 是 Raindrop 单页上限，也是一页内比对的成本上限。 */
const PROBE_PAGE = 50

export interface SyncDiffClient {
  fetchBookmarks(page?: number, perPage?: number, sort?: string): Promise<{ items: RaindropBookmark[]; total: number }>
}

export interface AheadBreakdown {
  /** 改过标签（含新增标签挂载） */
  tags: number
  /** 改过收藏夹 */
  folder: number
  title: number
  note: number
  /** 其它（新增 / 删除 / 未知 payload） */
  other: number
}

export interface SyncDiffResult {
  /** 领先：本地改了还没回写的条数 */
  ahead: number
  /** 落后：远端有、本地还没有的条数——**是下界，不是总数**（见 behindIsExact） */
  behind: number
  /**
   * behind 是否为准确值。
   * - true：探测页内没有未知条目 ⇒ 落后确为 0（排序保证新的在首页，故后面的也没有）
   * - false：探测页内就有未知条目 ⇒ 真实值 ≥ behind，**宁可少报不谎报**
   */
  behindIsExact: boolean
  /** 上传失败（退避重试中或已超限） */
  failed: number
  lastPushAt: number | null
  lastPullAt: number | null
  /** 按需返回：领先明细。只在调用方显式要时才计算（要读全部 pending payload，代价更高） */
  aheadBreakdown?: AheadBreakdown
  /** 探测失败（未配 Token / 远端报错）：此时 behind 不可信，用 error 说明，不要显示 0 */
  probeError?: string
}

function readTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function emptyBreakdown(): AheadBreakdown {
  return { tags: 0, folder: 0, title: 0, note: 0, other: 0 }
}

/**
 * 从 sync_queue 的 payload 聚合出「这批改动都在改什么」。
 * 计数是**按队列条目**而非按字段：一条改了两个字段（标签 + 收藏夹）会同时计入两项，
 * 各项之和可能大于 ahead——界面上要按「有改动」的说法展示，不能暗示它们可加。
 */
export function summarizeAhead(payloads: Array<string | null | undefined>): AheadBreakdown {
  const breakdown = emptyBreakdown()
  for (const raw of payloads) {
    if (!raw) { breakdown.other += 1; continue }
    let parsed: Record<string, unknown>
    try {
      const value = JSON.parse(raw)
      parsed = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    } catch {
      breakdown.other += 1
      continue
    }
    let touched = false
    if (parsed.tags !== undefined) { breakdown.tags += 1; touched = true }
    if (parsed.collectionId !== undefined || parsed.folderId !== undefined) { breakdown.folder += 1; touched = true }
    if (typeof parsed.title === 'string' && parsed.title) { breakdown.title += 1; touched = true }
    if (typeof parsed.note === 'string' && parsed.note) { breakdown.note += 1; touched = true }
    if (!touched) breakdown.other += 1
  }
  return breakdown
}

export async function computeSyncDiff(
  repository: BookmarkRepository,
  client: SyncDiffClient | null,
  options: { withBreakdown?: boolean } = {},
): Promise<SyncDiffResult> {
  const [ahead, failed, lastPushAt, lastPullAt] = await Promise.all([
    repository.syncQueue.countPending(),
    repository.syncQueue.countFailed(),
    repository.settings.get('sync.last_push_at'),
    repository.settings.get('sync.last_pull_at'),
  ])

  const result: SyncDiffResult = {
    ahead,
    behind: 0,
    behindIsExact: true,
    failed,
    lastPushAt: readTimestamp(lastPushAt),
    lastPullAt: readTimestamp(lastPullAt),
  }

  // 领先明细：读全部 pending 的 payload，代价高于两个 count，故按需
  if (options.withBreakdown) {
    const pending = await repository.syncQueue.getPending(ahead > 0 ? ahead : 1)
    result.aheadBreakdown = summarizeAhead(pending.map((item) => item.payload))
  }

  if (!client) {
    // 未配 Token：behind 无从谈起。**不报 0**——那会被读成「远端没有新东西」，
    // 与事实相反（我们只是不知道）。
    result.probeError = '未连接 Raindrop，无法探测远端差异'
    result.behindIsExact = false
    return result
  }

  try {
    // 方案 B：按最近修改取首屏，比对本地已知 raindropId。
    // 排序是这个方案成立的前提——用默认的 -created 就废了。
    const page = await client.fetchBookmarks(0, PROBE_PAGE, '-lastUpdate')
    const remoteIds = page.items.map((item) => String(item._id))
    const known = await repository.findByRaindropIds(remoteIds)
    const knownSet = new Set(known.map((row) => String((row as { raindropId?: unknown }).raindropId ?? '')))
    const unknownCount = remoteIds.filter((id) => !knownSet.has(id)).length
    result.behind = unknownCount
    result.behindIsExact = unknownCount === 0
  } catch (error) {
    result.probeError = error instanceof Error ? error.message : String(error)
    result.behindIsExact = false
  }

  return result
}
