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
  /** 2026-10-02 批次 0：本页写入 bookmark_tags 的挂载条数 */
  tagged: number
  /** 本页同步的远端根集合数 / 新建的本地 folder 数（仅第 0 页非零） */
  collections: number
  foldersCreated: number
  /** 映射不到归属的远端集合数——如实上报，不静默归到「未分类」 */
  unmappedCollections: number
  /** Raindrop 侧书签总数；不可知为 0 */
  total: number
  hasMore: boolean
}

/** 按页导出的单轮回执（API 结构表 v1.10）：前端逐轮调用，直到 processed=0 */
export interface ExportPageResponse {
  exported: number
  failed: number
  processed: number
  total: number
  hasMore: boolean
  errors: string[]
  /** 本轮失败的本地书签 id：下一轮原样传回 excludeIds */
  failedIds: string[]
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
  /** 按页导出：只推一页（20 条），传回上一轮失败 id 以跳过；直到 processed=0 */
  exportPage: (id: string, excludeIds: string[]) => api.post<ExportPageResponse>(`/api/channels/${id}/export`, { excludeIds }),
  test: (id: string) => api.post<TestResponse>(`/api/channels/${id}/test`),
  oauthExchange: (req: OAuthExchangeRequest) => api.post<OAuthExchangeResponse>('/api/channels/oauth/exchange', req),
}
