import { api } from './client.js'

/** GET /api/stats 回执（API 结构表 v1.14） */
export interface StatsResponse {
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
  byFolder: Array<{ id: string; name: string; count: number }>
  byScene: Array<{ id: string; name: string; count: number }>
  byTag: Array<{ id: string; name: string; count: number }>
  importantCount: number
  recycleCount: number
}

export const statsApi = {
  get: () => api.get<StatsResponse>('/api/stats'),
}
