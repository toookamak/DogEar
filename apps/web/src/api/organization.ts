import { api } from './client.js'
import type { SceneResponse, FolderResponse, TagResponse } from '../types/api.js'

export const organizationApi = {
  scenes: {
    list: () => api.get<{ items: SceneResponse[] }>('/api/scenes'),
    create: (data: { name: string; icon?: string; aerr?: string; sortOrder?: number }) => api.post<SceneResponse>('/api/scenes', data),
    update: (id: string, data: Record<string, unknown>) => api.patch<SceneResponse>(`/api/scenes/${id}`, data),
    remove: (id: string) => api.delete<{ ok: boolean }>(`/api/scenes/${id}`),
  },
  folders: {
    list: () => api.get<{ items: FolderResponse[] }>('/api/folders'),
    create: (data: { name: string; parentId?: string }) => api.post<FolderResponse>('/api/folders', data),
    update: (id: string, data: Record<string, unknown>) => api.patch<FolderResponse>(`/api/folders/${id}`, data),
    remove: (id: string) => api.delete<{ ok: boolean }>(`/api/folders/${id}`),
  },
  tags: {
    list: () => api.get<{ items: TagResponse[] }>('/api/tags'),
    create: (data: { name: string }) => api.post<TagResponse>('/api/tags', data),
    remove: (id: string) => api.delete<{ ok: boolean }>(`/api/tags/${id}`),
  },
}