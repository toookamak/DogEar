import { api } from './client.js'

export const navApi = {
  rules: {
    list: () => api.get<{ items: any[] }>('/api/nav/rules'),
    create: (data: { name: string; mode: string; rule?: string; searchQuery?: string }) =>
      api.post('/api/nav/rules', data),
    update: (id: string, data: Record<string, unknown>) =>
      api.patch(`/api/nav/rules/${id}`, data),
    remove: (id: string) => api.delete(`/api/nav/rules/${id}`),
  },
  bookmarks: (limit?: number, cursor?: string) =>
    api.get<{ items: any[]; nextCursor: string | null }>('/api/nav/bookmarks', {
      limit: limit?.toString(),
      cursor,
    }),
  recent: (limit?: number) =>
    api.get<{ items: any[] }>('/api/nav/recent', { limit: limit?.toString() }),
}