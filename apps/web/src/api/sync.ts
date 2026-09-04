import { api } from './client.js'
import type { SyncQueueItemResponse } from '../types/api.js'

export const syncApi = {
  pendingCount: () => api.get<{ pendingCount: number }>('/api/sync/pending-count'),
  listQueue: (limit?: number) => api.get<{ items: SyncQueueItemResponse[] }>('/api/sync/queue', limit ? { limit: String(limit) } : undefined),
  process: () => api.post<{ processed: number; item: SyncQueueItemResponse | null }>('/api/sync/process'),
}