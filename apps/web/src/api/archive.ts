import { api } from './client.js'

export const archiveApi = {
  create: (bookmarkId: string, type: 'snapshot' | 'reader' | 'metadata' = 'snapshot') =>
    api.post<{ jobId: string; snapshotStatus: string }>('/api/archive', { bookmarkId, type }),
  process: () => api.post<{ processed: number; succeeded: number; failed: number }>('/api/archive/process'),
  get: (id: string) => api.get<{ id: string; status: string; error?: string | null }>(`/api/archive/${id}`),
  listByBookmark: (bookmarkId: string) => api.get<{ items: any[] }>(`/api/archive/bookmark/${bookmarkId}`),
  retry: (id: string) => api.post(`/api/archive/${id}/retry`),
  cancel: (id: string) => api.post(`/api/archive/${id}/cancel`),
}