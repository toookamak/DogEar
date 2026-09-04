import { api } from './client.js'
import type { BookmarkResponse, PageResult } from '../types/api.js'

export const recycleBinApi = {
  list: (params?: { limit?: number; cursor?: string }) => api.get<PageResult<BookmarkResponse>>('/api/recycle-bin', params as Record<string, string | undefined>),
  restore: (id: string) => api.post<{ ok: boolean; bookmark: BookmarkResponse }>(`/api/recycle-bin/${id}/restore`),
  purge: (id: string) => api.delete<{ ok: boolean }>(`/api/recycle-bin/${id}`),
  empty: (data?: { onlyExpired?: boolean }) => api.post<{ ok: boolean; purged: number }>('/api/recycle-bin/empty', data),
}