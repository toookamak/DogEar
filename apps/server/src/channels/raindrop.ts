import { pickCoverUrl } from '../archive/cover-url.js'
const BASE_URL = 'https://api.raindrop.io/rest/v1'

export interface RaindropBookmark {
  _id: number
  link: string
  title: string
  excerpt?: string
  note?: string
  cover?: string
  media?: Array<{ link?: string; type?: string }>
  tags?: string[]
  collection: {
    $id: number
  }
  created: string
  lastUpdate: string
  type?: string
}
/** Raindrop 条目 → 本地书签字段（导入与拉回共用，excerpt 写入独立列而不是只塞 extras） */
export function mapRaindropBookmark(rd: RaindropBookmark) {
  let domain: string | null = null
  try { domain = new URL(rd.link).hostname } catch { /* ignore */ }
  const type: 'link' | 'article' | 'video' | 'image' =
    rd.type === 'article' || rd.type === 'video' || rd.type === 'image' ? rd.type : 'link'
  const excerpt = (rd.excerpt || '').trim() || null
  const note = (rd.note || '').trim() || null
  // 2026-10-02 补：此前 tags 与 collectionId 被整体丢弃，导致拉回来的书签全是「无标签、无收藏夹」
  const tags = Array.from(new Set((rd.tags ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)))
  const rawCollectionId = typeof rd.collection?.$id === 'number' ? rd.collection.$id : null
  // Raindrop 系统集合：-1 = Unsorted（无归属）、-99 = Trash。本地一律视为「无收藏夹」，
  // 不为它们建同名 folder，否则会凭空多出两个用户没建过的分类。
  const collectionId = rawCollectionId !== null && rawCollectionId > 0 ? rawCollectionId : null
  return {
    url: rd.link,
    title: (rd.title || '').trim() || rd.link,
    excerpt,
    note,
    cover: pickCoverUrl([rd.cover, ...(rd.media ?? []).map((item) => item.link)], rd.link),
    type,
    domain,
    raindropId: String(rd._id),
    /**
     * Raindrop 原始集合 id。**不直接写进 bookmarks.folder_id**——本地 folderId 是 UUID，
     * 必须经 `folders.raindrop_id` 映射后才安全（数据库结构表禁止拿 Raindrop `_id` 当本地主键）。
     * 映射不到时调用方留 `folderId = null` 并如实上报，不静默塞错的 folder。
     */
    collectionId,
    /** 去空白、去空串、去重后的原始标签名；由调用方按 `tags.name_key` 映射到本地标签 id */
    tags,
    raindropExtras: JSON.stringify({
      excerpt: rd.excerpt,
      type: rd.type,
      created: rd.created,
      lastUpdate: rd.lastUpdate,
      collectionId: rd.collection?.$id,
      cover: rd.cover || rd.media?.[0]?.link,
      media: rd.media,
    }),
  }
}

export interface RaindropCollection {
  _id: number
  title: string
  count: number
  parent?: {
    $id: number
  }
  sort: number
  public: boolean
}

export interface RaindropTag {
  _id: number
  name: string
  count: number
}

export interface RaindropResponse<T> {
  result: boolean
  error?: string
  items?: T
  count?: number
  page?: number
  perpage?: number
}

export class RaindropClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  /** Step 3 of the OAuth code flow: exchange an authorization code for an access token. */
  static async exchangeCode(params: { clientId: string; clientSecret: string; code: string; redirectUri: string }): Promise<string> {
    const response = await fetch('https://raindrop.io/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    })
    const data = await response.json().catch(() => undefined) as { access_token?: string; error?: string; error_description?: string } | undefined
    if (!response.ok || !data?.access_token) {
      throw new Error(data?.error_description || data?.error || `Raindrop OAuth token exchange failed: ${response.status} ${response.statusText}`)
    }
    return data.access_token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    let response: Response
    try {
      response = await fetch(url, { ...options, headers })
    } catch (e) {
      throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60
      // 带 status 供队列消费器识别限流并按指数退避重试（1s/2s/4s 封顶）
      throw Object.assign(
        new Error(`Rate limit exceeded, retry after ${waitSeconds} seconds`),
        { status: 429 },
      )
    }

    if (response.status === 401 || response.status === 403) {
      throw Object.assign(
        new Error('Invalid or expired Raindrop API token'),
        { status: response.status },
      )
    }

    if (!response.ok) {
      let errorMessage = `Raindrop API error: ${response.status} ${response.statusText}`
      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorMessage = `Raindrop API error: ${errorBody.error}`
        }
      } catch {
        // ignore
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    if (!data.result) {
      throw new Error(data.error || 'Raindrop API request failed')
    }

    return data
  }

  async fetchBookmarks(page = 0, perPage = 50): Promise<{ items: RaindropBookmark[]; total: number }> {
    const response = await this.request<RaindropResponse<RaindropBookmark[]>>(`/raindrops/0?page=${page}&perpage=${perPage}`)
    return {
      items: response.items || [],
      total: response.count || 0,
    }
  }

  async createBookmark(data: { url: string; title?: string; note?: string; tags?: string[] }): Promise<RaindropBookmark> {
    const body = {
      link: data.url,
      title: data.title,
      note: data.note,
      tags: data.tags,
    }

    const response = await this.request<{ result: boolean; item: RaindropBookmark }>('/raindrop', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return response.item
  }

  async updateBookmark(raindropId: number, data: Record<string, unknown>): Promise<RaindropBookmark> {
    const response = await this.request<{ result: boolean; item: RaindropBookmark }>(`/raindrop/${raindropId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })

    return response.item
  }

  async deleteBookmark(raindropId: number): Promise<void> {
    await this.request(`/raindrop/${raindropId}`, {
      method: 'DELETE',
    })
  }

  async getCollections(): Promise<RaindropCollection[]> {
    const response = await this.request<RaindropResponse<RaindropCollection[]>>('/collections')
    return response.items || []
  }

  async getTags(): Promise<RaindropTag[]> {
    const response = await this.request<RaindropResponse<RaindropTag[]>>('/tags')
    return response.items || []
  }

  async testConnection(): Promise<void> {
    await this.request('/user')
  }
}
