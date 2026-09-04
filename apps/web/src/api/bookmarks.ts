import { api } from './client.js'
import type { BookmarkResponse, PageResult, InboxResult, BatchUpdateResponse, AccessRecordResponse } from '../types/api.js'

export interface BookmarkListParams {
  limit?: number
  cursor?: string
  status?: string
  sceneId?: string
  folderId?: string
  tagId?: string
  important?: string
  source?: string
  q?: string
}

export const bookmarksApi = {
  list: (params?: BookmarkListParams) => api.get<PageResult<BookmarkResponse>>('/api/bookmarks', params as Record<string, string | undefined>),
  search: (params?: BookmarkListParams) => api.get<PageResult<BookmarkResponse>>('/api/bookmarks/search', params as Record<string, string | undefined>),
  inbox: (params?: { limit?: number; cursor?: string }) => api.get<InboxResult<BookmarkResponse>>('/api/inbox', params as Record<string, string | undefined>),
  get: (id: string) => api.get<BookmarkResponse>(`/api/bookmarks/${id}`),
  create: (data: { url: string; note?: string | null; intent?: string | null; important?: boolean; private?: boolean }) => api.post<BookmarkResponse>('/api/bookmarks', data),
  update: (id: string, data: Record<string, unknown>) => api.patch<BookmarkResponse>(`/api/bookmarks/${id}`, data),
  delete: (id: string) => api.delete<{ ok: boolean; deletedAt: number | null }>(`/api/bookmarks/${id}`),
  batchUpdate: (data: { ids: string[]; status?: string; folderId?: string | null; addSceneIds?: string[]; removeSceneIds?: string[]; addTagIds?: string[]; removeTagIds?: string[]; deleted?: boolean }) => api.patch<BatchUpdateResponse>('/api/bookmarks/batch', data),
  listAccessRecords: (bookmarkId: string) => api.get<{ records: AccessRecordResponse[] }>(`/api/bookmarks/${bookmarkId}/access-records`),
  createAccessRecord: (bookmarkId: string, data?: { source?: 'original' | 'snapshot'; client?: 'workbench' | 'navigation' | 'plugin' | 'unknown' }) =>
    api.post<AccessRecordResponse>(`/api/bookmarks/${bookmarkId}/access-records`, data ?? {}),
  pendingCount: () => api.get<{ pendingCount: number }>('/api/sync/pending-count'),
}