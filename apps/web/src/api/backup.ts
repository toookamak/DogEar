import { api } from './client.js'
import type { BackupResponse } from '../types/api.js'

export type BackupRestoreResult = {
  ok: true
  restored: number
  removed: number
  createdTags: number
  createdScenes: number
  rollbackBackupId: string | null
}

export const backupApi = {
  create: (tier: 'light' | 'medium' | 'full' = 'light', target: string = 'local') =>
    api.post<BackupResponse>('/api/backup', { tier, target }),
  list: () => api.get<{ items: BackupResponse[] }>('/api/backup'),
  get: (id: string) => api.get<BackupResponse>(`/api/backup/${id}`),
  downloadUrl: (id: string) => `/api/backup/${id}/download`,
  /** 从备份恢复（全量替换）。服务端要求显式 confirm，防误触清库。 */
  restore: (id: string) =>
    api.post<BackupRestoreResult>(`/api/backup/${id}/restore`, { bookmarks: true, confirm: true }),
}