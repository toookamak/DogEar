import { api } from './client.js'
import type { SettingResponse, SkillUsageResponse, SettingsWhitelist, OperationLogResponse } from '../types/api.js'

export const settingsApi = {
  list: () => api.get<{ items: SettingResponse[] }>('/api/settings'),
  update: (data: SettingsWhitelist) => api.put<{ items: SettingResponse[] }>('/api/settings', data),
  capabilities: () => api.put<{ read: boolean; write_new: boolean; update_existing: boolean }>('/api/skill/capabilities'),
  usage: () => api.get<SkillUsageResponse>('/api/skill/usage'),
  operationLog: (params?: { actor?: string; action?: string }) => api.get<{ items: OperationLogResponse[]; nextCursor: string | null }>('/api/operation-log', params as Record<string, string | undefined>),
  revertOperation: (id: string) => api.post<{ ok: boolean }>(`/api/operation-log/${id}/revert`),
}