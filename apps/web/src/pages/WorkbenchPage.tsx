import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'wouter'
import { TopBar } from '../components/layout/TopBar.js'
import { BookmarkListView } from '../components/bookmarks/BookmarkListView.js'
import { BookmarkDetail } from '../components/detail/BookmarkDetail.js'
import { SaveBookmarkForm } from '../components/detail/SaveBookmarkForm.js'
import { CommandPalette } from '../components/command/CommandPalette.js'
import { SuggestionPanel } from '../components/suggestions/SuggestionPanel.js'
import { EmptyState } from '../components/feedback/EmptyState.js'
import { Loading } from '../components/feedback/Loading.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import { bookmarksApi } from '../api/bookmarks.js'
import { organizationApi } from '../api/organization.js'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../types/api.js'

export function WorkbenchPage() {
  const [location, setLocation] = useLocation()
  const isInbox = location === '/'
  const title = isInbox ? 'Inbox' : location === '/bookmarks' ? '书签' : '工作台'

  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkResponse | null>(null)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [showCommand, setShowCommand] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [folders, setFolders] = useState<FolderResponse[]>([])
  const [tags, setTags] = useState<TagResponse[]>([])

  const loadBookmarks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = isInbox
        ? await bookmarksApi.inbox()
        : await bookmarksApi.list()
      setBookmarks(isInbox ? (result as any).bookmarks ?? [] : (result as any).items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
    setLoading(false)
  }, [isInbox])

  const loadOrganization = useCallback(async () => {
    try {
      const [scenesRes, foldersRes, tagsRes] = await Promise.all([
        organizationApi.scenes.list(),
        organizationApi.folders.list(),
        organizationApi.tags.list(),
      ])
      setScenes(scenesRes.items)
      setFolders(foldersRes.items)
      setTags(tagsRes.items)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadBookmarks(); loadOrganization() }, [loadBookmarks, loadOrganization])

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommand((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSave = async (data: { url: string; note?: string; intent?: string; important?: boolean; private?: boolean }) => {
    try {
      await bookmarksApi.create(data)
      setShowSaveForm(false)
      loadBookmarks()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
    }
  }

  const handleUpdate = (updated: BookmarkResponse) => {
    setBookmarks((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    setSelectedBookmark(updated)
  }

  return (
    <div>
      <TopBar
        title={title}
        actions={
          <>
            <button onClick={() => setShowSaveForm(true)} className="btn-primary">
              + 保存
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="btn-secondary-pill"
            >
              {viewMode === 'list' ? '网格' : '列表'}
            </button>
          </>
        }
      />

      <div style={{ display: 'flex', height: 'calc(100vh - 52px - 24px)' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-16)' }}>
          {showSaveForm && (
            <div style={{ marginBottom: 'var(--spacing-16)' }}>
              <SaveBookmarkForm onSave={handleSave} onClose={() => setShowSaveForm(false)} />
            </div>
          )}

          {loading && <Loading />}
          {error && <ErrorMessage message={error} />}
          {!loading && !error && bookmarks.length === 0 && <EmptyState message={isInbox ? 'Inbox 为空' : '暂无书签'} />}

          {!loading && !error && bookmarks.length > 0 && (
            <BookmarkListView
              bookmarks={bookmarks}
              onSelect={(b) => setSelectedBookmark(b)}
              viewMode={viewMode}
            />
          )}
        </div>

        {selectedBookmark && (
          <div style={{
            width: '360px',
            minWidth: '360px',
            overflow: 'auto',
            padding: 'var(--spacing-16)',
            borderLeft: '1px solid var(--border-primary)',
          }}>
            <BookmarkDetail
              bookmark={selectedBookmark}
              scenes={scenes}
              folders={folders}
              tags={tags}
              onUpdate={handleUpdate}
              onClose={() => setSelectedBookmark(null)}
            />
            <div style={{ marginTop: 'var(--spacing-12)' }}>
              <SuggestionPanel
                bookmarkId={selectedBookmark.id}
                onUpdate={() => loadBookmarks()}
              />
            </div>
          </div>
        )}
      </div>

      <CommandPalette
        bookmarks={bookmarks}
        onSelect={(b) => setSelectedBookmark(b)}
        onClose={() => setShowCommand(false)}
        open={showCommand}
      />
    </div>
  )
}