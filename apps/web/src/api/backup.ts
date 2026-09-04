import { api } from './client.js'
import type { BackupResponse } from '../types/api.js'

export const backupApi = {
  create: (tier: 'light' | 'medium' | 'full' = 'light', target: string = 'local') =>
    api.post<BackupResponse>('/api/backup', { tier, target }),
  list: () => api.get<{ items: BackupResponse[] }>('/api/backup'),
  get: (id: string) => api.get<BackupResponse>(`/api/backup/${id}`),
}