import { cache } from './dexie.js'
import { bookmarksApi } from '../api/bookmarks.js'
import { organizationApi } from '../api/organization.js'
import type { DexieBookmark } from './dexie.js'
import type { BookmarkResponse } from '../types/api.js'

async function toDexieBookmark(api: BookmarkResponse): Promise<DexieBookmark> {
  return {
    ...api,
    important: Boolean(api.important),
    private: Boolean(api.private),
    broken: Boolean(api.broken),
    folderId: api.folder?.id ?? null,
  }
}

export const cacheSync = {
  async syncAll() {
    await Promise.all([
      this.syncBookmarks(),
      this.syncScenes(),
      this.syncFolders(),
      this.syncTags(),
    ])
  },

  async syncBookmarks() {
    try {
      const result = await bookmarksApi.list()
      const items = result.items ?? []
      const dexieItems = await Promise.all(items.map(toDexieBookmark))
      await cache.bookmarks.bulkPut(dexieItems)
    } catch { /* offline or error */ }
  },

  async syncScenes() {
    try {
      const result = await organizationApi.scenes.list()
      await cache.scenes.bulkPut(result.items)
    } catch { /* ignore */ }
  },

  async syncFolders() {
    try {
      const result = await organizationApi.folders.list()
      await cache.folders.bulkPut(result.items ?? [])
    } catch { /* ignore */ }
  },

  async syncTags() {
    try {
      const result = await organizationApi.tags.list()
      await cache.tags.bulkPut(result.items)
    } catch { /* ignore */ }
  },

  async getBookmark(id: string) {
    const cached = await cache.bookmarks.get(id)
    if (cached) return cached
    // fallback to API
    try {
      const result = await bookmarksApi.list()
      const items = result.items ?? []
      return items.find((b: BookmarkResponse) => b.id === id) ?? null
    } catch { return null }
  },

  async queryBookmarks(filters?: { status?: string; query?: string }) {
    // Dexie doesn't support compound index full scan easily, use simple approach
    const all = await cache.bookmarks.toArray()
    let filtered = all
    if (filters?.status) {
      filtered = filtered.filter(b => b.status === filters.status)
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase()
      filtered = filtered.filter(b =>
        (b.title?.toLowerCase().includes(q) ?? false) ||
        b.url.toLowerCase().includes(q) ||
        (b.note?.toLowerCase().includes(q) ?? false)
      )
    }
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  },
}
