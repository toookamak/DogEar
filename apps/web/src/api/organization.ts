import { api } from './client.js'
import type { SceneResponse, FolderResponse, TagResponse } from '../types/api.js'

export const organizationApi = {
  scenes: {
    list: () => api.get<{ items: SceneResponse[] }>('/api/scenes'),
    create: (data: { name: string; icon?: string; aerr?: string; sortOrder?: number }) => api.post<SceneResponse>('/api/scenes', data),
    update: (id: string, data: Record<string, unknown>) => api.patch<SceneResponse>(`/api/scenes/${id}`, data),
    /** 合并到目标场景（API 结构表 v1.15），回执 {ok, moved, target}；不可撤销 */
    merge: (id: string, targetId: string) => api.post<{ ok: boolean; moved: number; target: { id: string; name: string } }>(`/api/scenes/${id}/merge`, { targetId }),
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
    /** 改名（API 结构表 v1.14）；撞已有 name_key 服务端返回 409 CONFLICT */
    rename: (id: string, data: { name: string }) => api.patch<TagResponse>(`/api/tags/${id}`, data),
    /** 合并到目标标签（API 结构表 v1.14），回执 {ok, moved, target}；不可撤销 */
    merge: (id: string, targetId: string) => api.post<{ ok: boolean; moved: number; target: { id: string; name: string } }>(`/api/tags/${id}/merge`, { targetId }),
    remove: (id: string) => api.delete<{ ok: boolean }>(`/api/tags/${id}`),
  },
}