import { useState, useEffect, useCallback, useMemo } from 'react'
import type { BookmarkResponse } from '../types/api.js'
import type { BookmarkFilters } from '../types/view.js'
import { bookmarksApi } from '../api/bookmarks.js'

export function useBookmarks(filters: BookmarkFilters, limit = 50) {
  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(!!nextCursor)

  const load = useCallback(async (cursor?: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await bookmarksApi.inbox({ limit, cursor })
      if (cursor) {
        setBookmarks(prev => [...prev, ...result.bookmarks])
      } else {
        setBookmarks(result.bookmarks)
      }
      setNextCursor(result.nextCursor)
      setHasMore(!!result.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters, limit])

  const refresh = useCallback(async () => {
    setBookmarks([])
    setNextCursor(null)
    await load()
  }, [load])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      load(nextCursor!)
    }
  }, [loading, hasMore, nextCursor, load])

  useEffect(() => {
    load()
  }, [])

  return { bookmarks, loading, error, hasMore, loadMore, refresh }
}