import { api } from './client.js'
import type { SyncQueueItemResponse } from '../types/api.js'

export interface PullSummary {
  pages: number
  scanned: number
  created: number
  skipped: number
  conflicts: number
  errors: string[]
  /** 2026-10-02 批次 0：本次写入 folders.raindrop_id 的远端根集合数 / 新建的本地 folder 数 */
  collections: number
  foldersCreated: number
  /** 本次写入 bookmark_tags 的挂载条数 */
  tagged: number
  /** 映射不到归属的远端集合数（如落在 Raindrop 子集合里）——如实上报，不静默 */
  unmappedCollections: number
  hasMore: boolean
}

export interface ConflictRecord {
  id: string
  bookmarkId: string | null
  raindropId: string
  localSnapshot: string | null
  remoteSnapshot: string | null
  resolution: 'pending' | 'kept_local' | 'kept_remote' | 'merged'
  createdAt: number
  resolvedAt: number | null
}

export type ConflictChoice = 'kept_local' | 'kept_remote' | 'merged'

/** /api/sync/status 聚合（状态栏同步卡片数据源） */
export interface SyncStatusResponse {
  pendingPush: number
  failedPush: number
  pendingConflicts: number
  /** epoch ms；从未同步过为 null */
  lastPushAt: number | null
  lastPullAt: number | null
}

/** /api/sync/diff 双向差异探测（计划 §3.5）。纯只读：1 次远端 GET + 1 次本地查询 */
export interface SyncDiffResponse {
  /** 领先：本地改了还没回写 */
  ahead: number
  /** 落后：远端有、本地还没有——是下界，不是总数（见 behindIsExact） */
  behind: number
  /** behind 是否准确值；false 时界面须显示「至少 N」 */
  behindIsExact: boolean
  failed: number
  lastPushAt: number | null
  lastPullAt: number | null
  aheadBreakdown?: { tags: number; folder: number; title: number; note: number; other: number }
  /** 探测失败（未配 Token / 远端报错）：behind 不可信，不得显示成 0 */
  probeError?: string
}

export const syncApi = {
  pendingCount: () => api.get<{ pendingCount: number }>('/api/sync/pending-count'),
  status: () => api.get<SyncStatusResponse>('/api/sync/status'),
  listQueue: (limit?: number) => api.get<{ items: SyncQueueItemResponse[] }>('/api/sync/queue', limit ? { limit: String(limit) } : undefined),
  /** 消费一批（服务端 max=10）：返回含 remaining，推送按钮按它判断是否循环 */
  process: () => api.post<{ processed: number; succeeded: number; failed: number; requeued: number; remaining: number }>('/api/sync/process'),
  /**
   * Raindrop 拉回。默认单页（50 条，防风控）；`catchUp: true` 由服务端连续翻页
   * 直到追平或安全上限（40 页 / 2000 条）——「拉取」=「追平」，响应 hasMore
   * 如实告知是否还有剩余。
   */
  pull: (opts?: { intoInbox?: boolean; catchUp?: boolean }) =>
    api.post<PullSummary>('/api/sync/pull', { intoInbox: opts?.intoInbox ?? true, catchUp: opts?.catchUp === true }),
  /** 差异探测。**不要轮询**（额度保护 §3.6.2）：仅在打开/展开胶囊与同步动作后取一次 */
  diff: () => api.get<SyncDiffResponse>('/api/sync/diff'),
  conflicts: {
    list: (resolution = 'pending') =>
      api.get<{ items: ConflictRecord[] }>('/api/conflicts', { resolution }),
    resolve: (id: string, choice: ConflictChoice) =>
      api.post<ConflictRecord>(`/api/conflicts/${id}/resolve`, { choice }),
    resolveAll: (choice: ConflictChoice) =>
      api.post<{ resolved: number }>('/api/conflicts/resolve-all', { choice }),
  },
}