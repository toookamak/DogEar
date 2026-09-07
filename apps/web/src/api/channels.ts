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
  import: (id: string) => api.post<ImportResponse>(`/api/channels/${id}/import`),
  export: (id: string) => api.post<ExportResponse>(`/api/channels/${id}/export`),
  test: (id: string) => api.post<TestResponse>(`/api/channels/${id}/test`),
  oauthExchange: (req: OAuthExchangeRequest) => api.post<OAuthExchangeResponse>('/api/channels/oauth/exchange', req),
}
