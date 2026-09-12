import { api } from './client.js'

export interface NavRule {
  id: string
  name: string
  mode: 'all' | 'rule' | 'search' | 'hide'
  rule: string | null
  searchQuery: string | null
  sortOrder: number
  enabled: boolean
}

export const navApi = {
  rules: {
    list: () => api.get<{ items: NavRule[] }>('/api/nav/rules'),
    create: (data: { name: string; mode: string; rule?: string; searchQuery?: string; sortOrder?: number }) =>
      api.post<NavRule>('/api/nav/rules', data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch<NavRule>(`/api/nav/rules/${id}`, data),
    remove: (id: string) => api.delete<{ ok: boolean }>(`/api/nav/rules/${id}`),
  },
  /**
   * v1.6 按规则求值后的展示集合（导航页主数据源）。
   * offset 分页（服务端内存集合，非 keyset）。
   */
  feed: (limit?: number, offset?: number) =>
    api.get<{ items: any[]; nextCursor: string | null }>('/api/nav/feed', {
      limit: limit?.toString(),
      offset: offset?.toString(),
    }),
  /**
   * @deprecated v1.6 起被 feed 取代（固定投影、不做规则求值）；服务端保留兼容，前端不再使用
   */
  bookmarks: (limit?: number, cursor?: string) =>
    api.get<{ items: any[]; nextCursor: string | null }>('/api/nav/bookmarks', {
      limit: limit?.toString(),
      cursor,
    }),
  recent: (limit?: number) =>
    api.get<{ items: any[] }>('/api/nav/recent', { limit: limit?.toString() }),
}
