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

export const syncApi = {
  pendingCount: () => api.get<{ pendingCount: number }>('/api/sync/pending-count'),
  listQueue: (limit?: number) => api.get<{ items: SyncQueueItemResponse[] }>('/api/sync/queue', limit ? { limit: String(limit) } : undefined),
  process: () => api.post<{ processed: number; item: SyncQueueItemResponse | null }>('/api/sync/process'),
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