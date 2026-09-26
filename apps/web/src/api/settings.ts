import { api } from './client.js'
import type { SettingResponse, SkillUsageResponse, SettingsWhitelist, OperationLogResponse } from '../types/api.js'

export const settingsApi = {
  list: () => api.get<{ items: SettingResponse[] }>('/api/settings'),
  update: (data: SettingsWhitelist) => api.put<{ items: SettingResponse[] }>('/api/settings', data),
  capabilities: () => api.put<{ read: boolean; write_new: boolean; update_existing: boolean }>('/api/skill/capabilities'),
  usage: () => api.get<SkillUsageResponse>('/api/skill/usage'),
  tokenStatus: () => api.get<{ configured: boolean; fromEnv: boolean; fromSettings: boolean }>('/api/skill/token'),
  rotateToken: () => api.post<{ token: string; configured: boolean }>('/api/skill/token'),
  operationLog: (params?: { actor?: string; action?: string }) => api.get<{ items: OperationLogResponse[]; nextCursor: string | null }>('/api/operation-log', params as Record<string, string | undefined>),
  revertOperation: (id: string) => api.post<{ ok: boolean }>(`/api/operation-log/${id}/revert`),
  /** 手动触发日志保留清理（v1.15），回执带生效配置 */
  cleanupLog: () => api.post<{ ok: boolean; removed: number; retentionDays: number; maxEntries: number }>('/api/operation-log/cleanup'),
}