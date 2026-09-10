import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/layout/PageHeader.js'
import { BookmarkGridView } from '../components/bookmarks/BookmarkGridView.js'
import { Skeleton } from '../components/feedback/Skeleton.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import { EmptyState } from '../components/feedback/EmptyState.js'
import { navApi } from '../api/nav.js'
import { bookmarksApi } from '../api/bookmarks.js'
import { toast, errorMessage } from '../toast.js'
import type { BookmarkResponse } from '../types/api.js'

type NavItem = Pick<BookmarkResponse, 'id' | 'url'> & {
  title?: string | null
  favicon?: string | null
  domain?: string | null
}

/** 导航页不做多选，传空集合即可 */
const EMPTY_SELECTION: Set<string> = new Set()

/**
 * 导航页：以收藏作为浏览起点。
 * 列表由服务端投影（只返回标题/图标/URL，排除 Inbox 与私密），点开时记一次访问。
 */
export function NavPage() {
  const [bookmarks, setBookmarks] = useState<NavItem[]>([])
  const [recentBookmarks, setRecentBookmarks] = useState<NavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const openBookmark = async (bookmark: NavItem) => {
    try {
      await bookmarksApi.createAccessRecord(bookmark.id, { source: 'original', client: 'navigation' })
    } catch { /* 访问记录失败不阻塞打开原文 */ }
    window.open(bookmark.url, '_blank', 'noopener')
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [listRes, recentRes] = await Promise.allSettled([
      navApi.bookmarks(50),
      navApi.recent(10),
    ])
    if (listRes.status === 'fulfilled') {
      setBookmarks(listRes.value.items ?? [])
      setNextCursor(listRes.value.nextCursor ?? null)
    } else {
      setError(errorMessage(listRes.reason, '加载失败'))
    }
    if (recentRes.status === 'fulfilled') setRecentBookmarks(recentRes.value.items ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await navApi.bookmarks(50, nextCursor)
      setBookmarks((prev) => [...prev, ...result.items])
      setNextCursor(result.nextCursor)
    } catch (e) {
      toast.error(errorMessage(e, '加载更多失败'))
    }
    setLoadingMore(false)
  }

  return (
    <div>
      <PageHeader title="导航页" />

      {recentBookmarks.length > 0 && (
        <section className="nav-section">
          <h3 className="section-title">最近访问</h3>
          <BookmarkGridView
            bookmarks={recentBookmarks as BookmarkResponse[]}
            activeId={null}
            selectedIds={EMPTY_SELECTION}
            onOpen={(bookmark) => { void openBookmark(bookmark) }}
            onToggleSelect={() => {}}
          />
        </section>
      )}

      <section className="nav-section">
        <h3 className="section-title">全部书签</h3>

        {loading && <Skeleton variant="grid" count={8} />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && bookmarks.length === 0 && (
          <EmptyState message="导航页暂无书签（只展示已确认且非私密的收藏）" />
        )}
        {!loading && !error && bookmarks.length > 0 && (
          <BookmarkGridView
            bookmarks={bookmarks as BookmarkResponse[]}
            activeId={null}
            selectedIds={EMPTY_SELECTION}
            onOpen={(bookmark) => { void openBookmark(bookmark) }}
            onToggleSelect={() => {}}
          />
        )}

        {nextCursor && (
          <div className="load-more">
            <button type="button" className="btn btn--pill" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
