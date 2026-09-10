import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useSearchParams } from 'wouter'
import { ContentHead } from '../components/layout/ContentHead.js'
import { WorkspaceToolbar, type SortKey, type ViewMode } from '../components/bookmarks/WorkspaceToolbar.js'
import { BookmarkGridView } from '../components/bookmarks/BookmarkGridView.js'
import { BookmarkTableView } from '../components/bookmarks/BookmarkTableView.js'
import { BookmarkBoardView } from '../components/bookmarks/BookmarkBoardView.js'
import { BookmarkTilesView } from '../components/bookmarks/BookmarkTilesView.js'
import { BookmarkDetail } from '../components/detail/BookmarkDetail.js'
import { SaveBookmarkForm } from '../components/detail/SaveBookmarkForm.js'
import { CommandPalette } from '../components/command/CommandPalette.js'
import { SuggestionPanel } from '../components/suggestions/SuggestionPanel.js'
import { EmptyState } from '../components/feedback/EmptyState.js'
import { Loading } from '../components/feedback/Loading.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import { bookmarksApi } from '../api/bookmarks.js'
import { organizationApi } from '../api/organization.js'
import type { BookmarkListParams } from '../api/bookmarks.js'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../types/api.js'
import { offerUndo, onDataChanged } from '../undo.js'

const VIEW_STORAGE_KEY = 'dogear.workbench.view'

/** 各导航位置的标题与说明；说明取自 PRD 对三种处理状态的定位 */
const NAV_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: '待处理',
    description: 'Inbox：新进入资料库的链接。可长期停留，不强制整理（PRD §2.0.2）。',
  },
  '/bookmarks': {
    title: '书签',
    description: '全部书签，可按状态、场景、文件夹、标签筛选，或直接搜索。',
  },
}

function readStoredView(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'grid' || stored === 'tags' || stored === 'list' || stored === 'board') return stored
  } catch { /* 隐私模式下不可读，用默认值 */ }
  return 'grid'
}

export function WorkbenchPage() {
  const [location] = useLocation()
  const isInbox = location === '/'
  const meta = NAV_META[location] ?? { title: '工作台', description: '' }

  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkResponse | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [showCommand, setShowCommand] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView)
  const [sort, setSort] = useState<SortKey>('recent')
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [folders, setFolders] = useState<FolderResponse[]>([])
  const [tags, setTags] = useState<TagResponse[]>([])
  const [filters, setFilters] = useState({ q: '', status: '', sceneId: '', folderId: '', tagId: '', source: '' })
  const [searchParams, setSearchParams] = useSearchParams()

  // 外壳（顶栏 / 侧栏）通过 URL 参数下达意图：palette、save 为一次性动作，
  // sceneId / folderId / tagId 为组织维度筛选。处理完即从 URL 清除这些参数，
  // 以免与页面内的筛选下拉互相覆盖（下拉改的是本地状态，不回写 URL）。
  useEffect(() => {
    const palette = searchParams.get('palette')
    const save = searchParams.get('save')
    const sceneId = searchParams.get('sceneId')
    const folderId = searchParams.get('folderId')
    const tagId = searchParams.get('tagId')
    if (!palette && !save && !sceneId && !folderId && !tagId) return

    if (palette === '1') setShowCommand(true)
    if (save === '1') setShowSaveForm(true)
    if (sceneId || folderId || tagId) {
      setFilters((f) => ({
        ...f,
        sceneId: sceneId ?? f.sceneId,
        folderId: folderId ?? f.folderId,
        tagId: tagId ?? f.tagId,
      }))
    }

    const next = new URLSearchParams(searchParams)
    for (const key of ['palette', 'save', 'sceneId', 'folderId', 'tagId']) next.delete(key)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const queryParams = useCallback((): BookmarkListParams => {
    const params: BookmarkListParams = { sort }
    if (!isInbox && filters.status) params.status = filters.status
    if (filters.sceneId) params.sceneId = filters.sceneId
    if (filters.folderId) params.folderId = filters.folderId
    if (filters.tagId) params.tagId = filters.tagId
    if (filters.source) params.source = filters.source
    if (filters.q.trim()) params.q = filters.q.trim()
    return params
  }, [filters, isInbox, sort])

  const loadBookmarks = useCallback(async (cursor?: string) => {
    if (!cursor) setLoading(true)
    setError(null)
    try {
      const params = { ...queryParams(), cursor }
      const result = isInbox
        ? await bookmarksApi.inbox({ cursor })
        : filters.q.trim()
          ? await bookmarksApi.search(params)
          : await bookmarksApi.list(params)
      const items = isInbox ? (result as { bookmarks?: BookmarkResponse[] }).bookmarks ?? [] : (result as { items?: BookmarkResponse[] }).items ?? []
      const next = result.nextCursor ?? null
      setBookmarks((prev) => cursor ? [...prev, ...items] : items)
      setNextCursor(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
    setLoading(false)
    setLoadingMore(false)
  }, [isInbox, queryParams, filters.q])

  // 外壳中的撤销成功后通知刷新列表（替代先前的整页 reload）
  useEffect(() => onDataChanged(() => { void loadBookmarks() }), [loadBookmarks])

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

  // ⌘K 打开命令面板（与顶栏搜索入口的键帽提示一致）。
  // 工具栏内的输入框是「就地筛选当前列表」，不占用该快捷键，避免一个键两种行为。
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommand((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const changeView = (next: ViewMode) => {
    setViewMode(next)
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next) } catch { /* 忽略 */ }
  }

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBatch = async (data: Parameters<typeof bookmarksApi.batchUpdate>[0]) => {
    try {
      const result = await bookmarksApi.batchUpdate(data)
      setSelectedIds(new Set())
      if (result.undoId) offerUndo({ undoId: result.undoId, message: data.deleted ? '删除' : '批量修改' })
      await loadBookmarks()
    } catch (e) {
      alert(e instanceof Error ? e.message : '批量操作失败')
    }
  }

  /** 行内/看板改状态：单条 PATCH，成功后就地更新，避免整页重载 */
  const moveStatus = async (id: string, status: 'unread' | 'saved' | 'archived') => {
    const current = bookmarks.find((b) => b.id === id)
    if (!current || current.status === status) return
    setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, status } : b))
    try {
      const updated = await bookmarksApi.update(id, { status })
      setBookmarks((prev) => prev.map((b) => b.id === id ? updated : b))
      if (selectedBookmark?.id === id) setSelectedBookmark(updated)
    } catch (e) {
      setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, status: current.status } : b))
      alert(e instanceof Error ? e.message : '状态更新失败')
    }
  }

  const hasActiveFilters = filters.q !== '' || filters.source !== '' || filters.status !== '' ||
    filters.sceneId !== '' || filters.folderId !== '' || filters.tagId !== ''

  const clearFilters = () => setFilters({ q: '', status: '', sceneId: '', folderId: '', tagId: '', source: '' })

  const loadMore = () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void loadBookmarks(nextCursor)
  }

  const openBookmark = (bookmark: BookmarkResponse) => setSelectedBookmark(bookmark)

  const renderView = () => {
    const shared = {
      bookmarks,
      activeId: selectedBookmark?.id ?? null,
      selectedIds,
      onOpen: openBookmark,
    }
    if (viewMode === 'grid') {
      return <BookmarkGridView {...shared} onToggleSelect={toggleSelect} />
    }
    if (viewMode === 'list') {
      return <BookmarkTableView {...shared} onToggleSelect={toggleSelect} onMoveStatus={moveStatus} />
    }
    if (viewMode === 'board') {
      return <BookmarkBoardView {...shared} onMoveStatus={moveStatus} />
    }
    return <BookmarkTilesView {...shared} />
  }

  return (
    <div className="workbench">
      <ContentHead
        title={meta.title}
        count={bookmarks.length}
        description={meta.description}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setShowSaveForm(true)}>
            + 保存
          </button>
        }
      />

      <WorkspaceToolbar
        query={filters.q}
        source={filters.source}
        sort={sort}
        view={viewMode}
        onQuery={(q) => setFilters((f) => ({ ...f, q }))}
        onSource={(source) => setFilters((f) => ({ ...f, source }))}
        onSort={setSort}
        onView={changeView}
      />

      {!isInbox && (
        <div className="filter-row">
          <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">全部状态</option>
            <option value="unread">待处理</option>
            <option value="saved">已确认</option>
            <option value="archived">搁置</option>
          </select>
          <select className="input" value={filters.sceneId} onChange={(e) => setFilters((f) => ({ ...f, sceneId: e.target.value }))}>
            <option value="">全部场景</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
          </select>
          <select className="input" value={filters.folderId} onChange={(e) => setFilters((f) => ({ ...f, folderId: e.target.value }))}>
            <option value="">全部文件夹</option>
            <option value="none">无文件夹</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <select className="input" value={filters.tagId} onChange={(e) => setFilters((f) => ({ ...f, tagId: e.target.value }))}>
            <option value="">全部标签</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
      )}

      {showSaveForm && (
        <div className="save-form-wrap">
          <SaveBookmarkForm onSave={handleSave} onClose={() => setShowSaveForm(false)} />
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span className="selection-bar-count">已选 {selectedIds.size}</span>
          <button type="button" className="btn btn--pill" onClick={() => runBatch({ ids: [...selectedIds], status: 'saved' })}>标为已确认</button>
          <button type="button" className="btn btn--pill" onClick={() => runBatch({ ids: [...selectedIds], status: 'archived' })}>标为搁置</button>
          <button type="button" className="btn btn--pill" onClick={() => runBatch({ ids: [...selectedIds], status: 'unread' })}>退回待处理</button>
          <select
            className="input"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) runBatch({ ids: [...selectedIds], addSceneIds: [e.target.value] })
              e.target.value = ''
            }}
          >
            <option value="">添加场景…</option>
            {scenes.filter((scene) => scene.enabled !== false).map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--pill"
            style={{ color: 'var(--color-error)' }}
            onClick={() => runBatch({ ids: [...selectedIds], deleted: true })}
          >
            移入回收站
          </button>
          <button type="button" className="btn btn--pill" onClick={() => setSelectedIds(new Set())}>取消选择</button>
        </div>
      )}

      <section className="bookmark-area">
        <div className="bookmark-summary">
          <span>显示 {bookmarks.length} 条{nextCursor ? '（还有更多）' : ''}</span>
          {hasActiveFilters && (
            <button type="button" className="clear-btn" onClick={clearFilters}>清除筛选</button>
          )}
        </div>

        {loading && <Loading />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && bookmarks.length === 0 && (
          <EmptyState message={isInbox ? 'Inbox 为空' : '暂无书签'} />
        )}
        {!loading && !error && bookmarks.length > 0 && renderView()}

        {nextCursor && (
          <div className="load-more">
            <button type="button" className="btn btn--pill" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        )}
      </section>

      {selectedBookmark && (
        <aside className="detail-aside">
          <BookmarkDetail
            bookmark={selectedBookmark}
            scenes={scenes}
            folders={folders}
            tags={tags}
            onUpdate={handleUpdate}
            onClose={() => setSelectedBookmark(null)}
            onDeleted={(id) => {
              setBookmarks((prev) => prev.filter((item) => item.id !== id))
              setSelectedIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            }}
          />
          <div className="detail-aside-suggestions">
            <SuggestionPanel bookmarkId={selectedBookmark.id} onUpdate={() => loadBookmarks()} />
          </div>
        </aside>
      )}

      <CommandPalette
        bookmarks={bookmarks}
        onSelect={(b) => setSelectedBookmark(b)}
        onClose={() => setShowCommand(false)}
        open={showCommand}
      />
    </div>
  )
}
