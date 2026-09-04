export interface WebDAVConfig {
  url: string
  username: string
  password: string
}

export class WebDAVClient {
  private url: string
  private username: string
  private password: string

  constructor(config: WebDAVConfig) {
    // Normalize: ensure trailing slash for base URL
    this.url = config.url.endsWith('/') ? config.url : config.url + '/'
    this.username = config.username
    this.password = config.password
  }

  private get authHeader(): string {
    const encoded = Buffer.from(`${this.username}:${this.password}`).toString('base64')
    return `Basic ${encoded}`
  }

  private async request(method: string, path: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = path.startsWith('http') ? path : `${this.url}${path.replace(/^\//, '')}`
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      ...(options.headers as Record<string, string> || {}),
    }

    let response: Response
    try {
      response = await fetch(fullUrl, { ...options, method, headers })
    } catch (e) {
      throw new Error(`WebDAV network error: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (response.status === 401) {
      throw new Error('WebDAV authentication failed')
    }

    if (response.status === 404) {
      throw new Error(`WebDAV resource not found: ${path}`)
    }

    if (response.status === 409) {
      throw new Error('WebDAV conflict: resource already exists')
    }

    if (response.status === 507) {
      throw new Error('WebDAV insufficient storage')
    }

    if (response.status === 207) return response
    if (!response.ok) {
      throw new Error(`WebDAV error: ${response.status} ${response.statusText}`)
    }

    return response
  }

  /**
   * Test connectivity by sending PROPFIND to the root.
   */
  async testConnection(): Promise<void> {
    await this.request('PROPFIND', '', {
      headers: { Depth: '0' },
    })
  }

  /**
   * Check if a file exists at the given path.
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const response = await this.request('PROPFIND', path, {
        headers: { Depth: '0' },
      })
      return response.ok
    } catch (e) {
      if (e instanceof Error && e.message.includes('not found')) {
        return false
      }
      throw e
    }
  }

  /**
   * Upload a file to the given path.
   */
  async uploadFile(path: string, content: string, contentType: string): Promise<void> {
    await this.request('PUT', path, {
      body: content,
      headers: { 'Content-Type': contentType },
    })
  }

  /**
   * Download file content from the given path.
   */
  async downloadFile(path: string): Promise<string> {
    const response = await this.request('GET', path)
    return await response.text()
  }

  /**
   * Delete a file at the given path.
   */
  async deleteFile(path: string): Promise<void> {
    await this.request('DELETE', path)
  }
}