import { api } from './client.js'
import type { SyncQueueItemResponse } from '../types/api.js'

export interface PullSummary {
  pages: number
  scanned: number
  created: number
  skipped: number
  conflicts: number
  errors: string[]
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

export const syncApi = {
  pendingCount: () => api.get<{ pendingCount: number }>('/api/sync/pending-count'),
  status: () => api.get<SyncStatusResponse>('/api/sync/status'),
  listQueue: (limit?: number) => api.get<{ items: SyncQueueItemResponse[] }>('/api/sync/queue', limit ? { limit: String(limit) } : undefined),
  /** 消费一批（服务端 max=10）：返回含 remaining，推送按钮按它判断是否循环 */
  process: () => api.post<{ processed: number; succeeded: number; failed: number; requeued: number; remaining: number }>('/api/sync/process'),
  /** Raindrop 拉回：每次只拉一页（50 条），防 API 风控；有更多时响应里 hasMore=true */
  pull: (intoInbox = true) => api.post<PullSummary>('/api/sync/pull', { intoInbox }),
  conflicts: {
    list: (resolution = 'pending') =>
      api.get<{ items: ConflictRecord[] }>('/api/conflicts', { resolution }),
    resolve: (id: string, choice: ConflictChoice) =>
      api.post<ConflictRecord>(`/api/conflicts/${id}/resolve`, { choice }),
    resolveAll: (choice: ConflictChoice) =>
      api.post<{ resolved: number }>('/api/conflicts/resolve-all', { choice }),
  },
}