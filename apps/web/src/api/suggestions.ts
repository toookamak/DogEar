import { api } from './client.js'
import type { SuggestionResponse, PageResult } from '../types/api.js'

export const suggestionsApi = {
  list: (bookmarkId: string, status?: string) => api.get<PageResult<SuggestionResponse>>(`/api/bookmarks/${bookmarkId}/suggestions`, status ? { status } : undefined),
  accept: (id: string) => api.post<{ ok: boolean; suggestion: SuggestionResponse }>(`/api/suggestions/${id}/accept`),
  defer: (id: string) => api.post<{ ok: boolean; suggestion: SuggestionResponse }>(`/api/suggestions/${id}/defer`),
  dismiss: (id: string) => api.post<{ ok: boolean; suggestion: SuggestionResponse }>(`/api/suggestions/${id}/dismiss`),
}