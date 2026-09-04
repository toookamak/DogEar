import { api } from './client.js'

export const archiveApi = {
  create: (bookmarkId: string, type: 'snapshot' | 'reader' | 'metadata' = 'snapshot') =>
    api.post<{ jobId: string; snapshotStatus: string }>('/api/archive', { bookmarkId, type }),
  get: (id: string) => api.get<any>(`/api/archive/${id}`),
  listByBookmark: (bookmarkId: string) => api.get<{ items: any[] }>(`/api/archive/bookmark/${bookmarkId}`),
  retry: (id: string) => api.post(`/api/archive/${id}/retry`),
  cancel: (id: string) => api.post(`/api/archive/${id}/cancel`),
}