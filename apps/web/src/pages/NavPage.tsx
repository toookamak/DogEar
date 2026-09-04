import { useState, useEffect } from 'react'
import { TopBar } from '../components/layout/TopBar.js'
import { BookmarkListView } from '../components/bookmarks/BookmarkListView.js'
import { Loading } from '../components/feedback/Loading.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import { EmptyState } from '../components/feedback/EmptyState.js'
import { navApi } from '../api/nav.js'
import type { BookmarkResponse } from '../types/api.js'

export function NavPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [showRecent, setShowRecent] = useState(true)
  const [recentBookmarks, setRecentBookmarks] = useState<BookmarkResponse[]>([])

  const loadBookmarks = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await navApi.bookmarks(50)
      setBookmarks(result.items)
      setNextCursor(result.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
    setLoading(false)
  }

  const loadRecent = async () => {
    try {
      const result = await navApi.recent(10)
      setRecentBookmarks(result.items)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadBookmarks()
    loadRecent()
  }, [])

  const loadMore = async () => {
    if (!nextCursor) return
    try {
      const result = await navApi.bookmarks(50, nextCursor)
      setBookmarks(prev => [...prev, ...result.items])
      setNextCursor(result.nextCursor)
    } catch { /* ignore */ }
  }

  return (
    <div>
      <TopBar title="导航页" />

      {recentBookmarks.length > 0 && showRecent && (
        <div style={{ padding: 'var(--spacing-16)', borderBottom: '1px solid var(--border-primary)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-8)' }}>
            最近访问
          </h3>
          <BookmarkListView
            bookmarks={recentBookmarks}
            onSelect={() => {}}
            viewMode="list"
          />
        </div>
      )}

      <div style={{ padding: 'var(--spacing-16)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-8)' }}>
          全部书签
        </h3>

        {loading && <Loading />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && bookmarks.length === 0 && <EmptyState message="导航页暂无书签" />}
        {!loading && !error && bookmarks.length > 0 && (
          <BookmarkListView
            bookmarks={bookmarks}
            onSelect={() => {}}
            viewMode="grid"
          />
        )}

        {nextCursor && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-16)' }}>
            <button onClick={loadMore} className="btn-secondary-pill">
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  )
}