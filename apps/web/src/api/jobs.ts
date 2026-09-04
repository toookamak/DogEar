import { api } from './client.js'
import type { JobResponse } from '../types/api.js'

export const jobsApi = {
  list: (bookmarkId?: string) => api.get<{ items: JobResponse[]; nextCursor: string | null }>('/api/jobs', bookmarkId ? { bookmarkId } : undefined),
  retry: (id: string) => api.post<JobResponse>(`/api/jobs/${id}/retry`),
  cancel: (id: string) => api.post<JobResponse>(`/api/jobs/${id}/cancel`),
}