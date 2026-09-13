import { api } from './client.js'

export interface ChannelConfigItem {
  id: string
  channel: 'raindrop' | 's3' | 'webdav'
  label: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface ListChannelsResponse {
  items: ChannelConfigItem[]
}

export interface ImportResponse {
  imported: number
  skipped: number
  errors: string[]
}

/** 按页导入的单页回执（API 结构表 v1.9）：前端逐页调用，直到 hasMore=false */
export interface ImportPageResponse {
  page: number
  imported: number
  skipped: number
  errors: string[]
  /** Raindrop 侧书签总数；不可知为 0 */
  total: number
  hasMore: boolean
}

export interface ExportResponse {
  exported: number
  failed: number
}

export interface TestResponse {
  ok: boolean
  message?: string
}

export interface OAuthExchangeRequest {
  channelId: string
  code: string
  redirectUri: string
}

export interface OAuthExchangeResponse {
  ok: boolean
  channel: ChannelConfigItem
}

export interface SaveChannelRequest {
  channel: 'raindrop' | 's3' | 'webdav'
  label: string
  config: string
  enabled?: boolean
}

export const channelsApi = {
  list: () => api.get<ListChannelsResponse>('/api/channels'),
  save: (config: SaveChannelRequest, id?: string) =>
    id
      ? api.patch<ChannelConfigItem>(`/api/channels/${id}`, config)
      : api.post<{ ok: boolean; id: string }>('/api/channels', config),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/api/channels/${id}`),
  /** 按页导入：只导指定页（从 0 计），由调用方循环驱动直到 hasMore=false */
  importPage: (id: string, page: number) => api.post<ImportPageResponse>(`/api/channels/${id}/import`, { page }),
  export: (id: string) => api.post<ExportResponse>(`/api/channels/${id}/export`),
  test: (id: string) => api.post<TestResponse>(`/api/channels/${id}/test`),
  oauthExchange: (req: OAuthExchangeRequest) => api.post<OAuthExchangeResponse>('/api/channels/oauth/exchange', req),
}
