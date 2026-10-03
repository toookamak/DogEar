import { api } from './client.js'
import type { SearchIndexResponse } from '@dogear/shared'
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
  /** 排序：recent（默认）| title | domain | important（收藏标星优先），由服务端排序 */
  sort?: string
  /** 时间范围筛选下限（ISO；v1.14） */
  createdFrom?: string
  /** 时间范围筛选上限（ISO；v1.14） */
  createdTo?: string
  /** 是否在导航页展示（按 nav_rules 求值集过滤；v1.14） */
  navVisible?: 'true' | 'false'
  /** 「近 N 天没打开」的**天数**（v1.16；服务端自己换算成时点，不要传绝对时间戳） */
  lastOpenedBefore?: string
}

export const bookmarksApi = {
  list: (params?: BookmarkListParams) => api.get<PageResult<BookmarkResponse>>('/api/bookmarks', params as Record<string, string | undefined>),
  search: (params?: BookmarkListParams) => api.get<PageResult<BookmarkResponse>>('/api/bookmarks/search', params as Record<string, string | undefined>),
  /**
   * 全选匹配项的数据源（P1b 集合操作，2026-10-03）：按当前筛选取**全部** id 的瘦投影。
   * 筛选口径与 /api/bookmarks 完全一致——列表里看到的就是选中的。2000 条 CAP 截断时
   * `truncated=true`，界面必须如实提示而不是暗示「这就是全部」。
   */
  ids: (params?: BookmarkListParams) =>
    api.get<{ ids: string[]; total: number; truncated: boolean }>('/api/bookmarks/ids', params as Record<string, string | undefined>),
  /**
   * 端侧全量检索的瘦投影（2026-10-02，批次 2）。刻意不含 cover / excerpt：
   * 3412 条要常驻浏览器内存，带大字段会让传输量与占用翻数倍。
   */
  searchIndex: (params?: { limit?: number; cursor?: string }) =>
    api.get<SearchIndexResponse>('/api/bookmarks/search-index', params as Record<string, string | undefined>),  inbox: (params?: { limit?: number; cursor?: string }) => api.get<InboxResult<BookmarkResponse>>('/api/inbox', params as Record<string, string | undefined>),
  get: (id: string) => api.get<BookmarkResponse>(`/api/bookmarks/${id}`),
  create: (data: { url: string; note?: string | null; intent?: string | null; important?: boolean; private?: boolean }) => api.post<BookmarkResponse>('/api/bookmarks', data),
  update: (id: string, data: Record<string, unknown>) => api.patch<BookmarkResponse>(`/api/bookmarks/${id}`, data),
  delete: (id: string) => api.delete<{ ok: boolean; deletedAt: number | null; undoId?: string | null }>(`/api/bookmarks/${id}`),
  batchUpdate: (data: { ids: string[]; status?: string; folderId?: string | null; addSceneIds?: string[]; removeSceneIds?: string[]; addTagIds?: string[]; removeTagIds?: string[]; deleted?: boolean }) => api.patch<BatchUpdateResponse & { undoId?: string }>('/api/bookmarks/batch', data),
  revert: (undoId: string) => api.post<{ ok: boolean }>(`/api/operation-log/${undoId}/revert`),
  listAccessRecords: (bookmarkId: string) => api.get<{ records: AccessRecordResponse[] }>(`/api/bookmarks/${bookmarkId}/access-records`),
  createAccessRecord: (bookmarkId: string, data?: { source?: 'original' | 'snapshot'; client?: 'workbench' | 'navigation' | 'plugin' | 'unknown' }) =>
    api.post<AccessRecordResponse>(`/api/bookmarks/${bookmarkId}/access-records`, data ?? {}),
  pendingCount: () => api.get<{ pendingCount: number }>('/api/sync/pending-count'),
}