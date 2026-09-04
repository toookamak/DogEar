const BASE_URL = 'https://api.raindrop.io/rest/v1'

export interface RaindropBookmark {
  _id: number
  link: string
  title: string
  excerpt?: string
  note?: string
  tags?: string[]
  collection: {
    $id: number
  }
  created: string
  lastUpdate: string
  type?: string
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
      throw new Error(`Rate limit exceeded, retry after ${waitSeconds} seconds`)
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid or expired Raindrop API token')
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
