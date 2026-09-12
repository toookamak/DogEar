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
import { Skeleton } from '../components/feedback/Skeleton.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import { bookmarksApi } from '../api/bookmarks.js'
import { organizationApi } from '../api/organization.js'
import type { BookmarkListParams } from '../api/bookmarks.js'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../types/api.js'
import { offerUndo, onDataChanged } from '../undo.js'
import { toast, errorMessage } from '../toast.js'
import { presentationForAerr, nextSortOnSceneChange, DEFAULT_PRESENTATION } from '../utils/scene-presentation.js'
import { scenesForPicker } from '../utils/scene-filtering.js'
import { onOrgChanged } from '../org-events.js'

const VIEW_STORAGE_KEY = 'dogear.workbench.view'

/** 视图 → 骨架屏形态：标签视图的形状与图标卡一致，列表视图即表格行 */
const SKELETON_VARIANT: Record<ViewMode, 'grid' | 'tiles' | 'table' | 'board'> = {
  grid: 'grid',
  tags: 'tiles',
  list: 'table',
  board: 'board',
}

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
  const [location, setLocation] = useLocation()
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

  // 当前处于哪个 Scene 视图：决定标题、说明与 AERR 呈现（PRD §2.0.3）
  const activeScene = filters.sceneId ? scenes.find((scene) => scene.id === filters.sceneId) ?? null : null
  const presentation = presentationForAerr(activeScene?.aerr)

  // Scene 视图切换时调整默认排序：进入某 Scene 用它的原型默认值，
  // 离开则回到默认排序。仅在 Scene 变化时执行一次，用户手动选的排序不会被反复覆盖。
  const previousSceneRef = useRef<string | null>(null)
  useEffect(() => {
    const nextSceneId = filters.sceneId || null
    const nextSort = nextSortOnSceneChange(nextSceneId, previousSceneRef.current, presentation)
    if (nextSort) setSort(nextSort)
    previousSceneRef.current = nextSceneId
  }, [filters.sceneId, presentation])

  // 外壳（顶栏 / 侧栏）通过 URL 参数下达意图：palette、save 为一次性动作，
  // sceneId / folderId / tagId 为组织维度筛选，clear 表示「回到完整列表」。
  // 处理完即从 URL 清除这些参数，以免与页面内的筛选下拉互相覆盖
  // （下拉改的是本地状态，不回写 URL）。
  useEffect(() => {
    const palette = searchParams.get('palette')
    const save = searchParams.get('save')
    const clear = searchParams.get('clear')
    const sceneId = searchParams.get('sceneId')
    const folderId = searchParams.get('folderId')
    const tagId = searchParams.get('tagId')
    if (!palette && !save && !clear && !sceneId && !folderId && !tagId) return

    if (palette === '1') setShowCommand(true)
    if (save === '1') setShowSaveForm(true)
    if (clear === '1') {
      // 清掉全部筛选，并把排序交还给默认值——否则停留在上个 Scene 带过来的排序上
      setFilters({ q: '', status: '', sceneId: '', folderId: '', tagId: '', source: '' })
      setSort(DEFAULT_PRESENTATION.defaultSort)
    } else if (sceneId || folderId || tagId) {
      setFilters((f) => ({
        ...f,
        sceneId: sceneId ?? f.sceneId,
        folderId: folderId ?? f.folderId,
        tagId: tagId ?? f.tagId,
      }))
    }

    const next = new URLSearchParams(searchParams)
    for (const key of ['palette', 'save', 'clear', 'sceneId', 'folderId', 'tagId']) next.delete(key)
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

  // 组织维度被改动后重载列表。详情里「就地新建标签」会新建库级标签并广播；
  // 若不重载，新建的标签不在本页列表里，chip 不会渲染——那就会出现
  // 「看不到也摘不掉」的问题（与 Scene 停用同类的坑）。
  useEffect(() => onOrgChanged(() => { void loadOrganization() }), [loadOrganization])

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
      const created = await bookmarksApi.create(data)
      setShowSaveForm(false)
      void loadBookmarks()

      // AI 建议落点①「输入时」：保存成功后取回该条，若服务端已预备建议就顺手打开详情，
      // 让用户能立刻确认。建议由服务端异步生成，故此处可能取到 0——那就只提示已保存，
      // 不假装有建议（PRD §2.0.2：建议先行，须用户确认后才写入）。
      const id = (created as { id?: string })?.id
      if (id) {
        try {
          const fresh = await bookmarksApi.get(id)
          const pending = fresh.pendingSuggestionCount || 0
          if (pending > 0) {
            setSelectedBookmark(fresh)
            toast.info(`已保存，有 ${pending} 条 AI 整理建议待你确认`)
            return
          }
        } catch { /* 取回失败不影响「已保存」这一事实 */ }
      }
      toast.success('已保存到 Inbox')
    } catch (e) {
      toast.error(errorMessage(e, '保存失败'))
    }
  }

  const handleUpdate = (updated: BookmarkResponse) => {
    setBookmarks((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    setSelectedBookmark(updated)
  }

  /**
   * 重新取回当前详情（采纳 AI 建议会改变书签的 Scene/标签，本地副本会过期）。
   * 详情已关闭则跳过，避免无谓请求。
   */
  const refreshSelected = useCallback(async () => {
    const id = selectedBookmark?.id
    if (!id) return
    try {
      const fresh = await bookmarksApi.get(id)
      setBookmarks((prev) => prev.map((b) => b.id === id ? fresh : b))
      setSelectedBookmark((current) => current?.id === id ? fresh : current)
    } catch { /* 取回失败保留现有内容，不打断操作 */ }
  }, [selectedBookmark?.id])

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
      // 双入口撤销：Toast 直带撤销按钮（状态栏保留兜底）
      if (result.undoId) offerUndo({ undoId: result.undoId, message: data.deleted ? '删除' : '批量修改' })
      await loadBookmarks()
      // 被跳过的条目要如实告知，避免「点了没反应」的误解
      const skipped = result.skipped?.length ?? 0
      if (skipped > 0) toast.info(`已处理，${skipped} 条被跳过（可能已被删除）`)
      else if (result.undoId) toast.undoable(data.deleted ? '已移入回收站' : '已更新', result.undoId)
      else toast.success(data.deleted ? '已移入回收站' : '已更新')
    } catch (e) {
      toast.error(errorMessage(e, '批量操作失败'))
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
      toast.error(errorMessage(e, '状态更新失败'))
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

  /** 当前已加载书签中待确认的 AI 建议合计（用于工具栏「整理建议」计数） */
  const pendingSuggestionTotal = bookmarks.reduce((sum, b) => sum + (b.pendingSuggestionCount || 0), 0)

  /** 选中项中待确认建议的合计（用于整理时的提示） */
  const selectedSuggestionCount = bookmarks
    .filter((b) => selectedIds.has(b.id))
    .reduce((sum, b) => sum + (b.pendingSuggestionCount || 0), 0)

  /**
   * AI 建议落点②「整理时」：汇总入口。
   * 先切到 Inbox（建议多产生于未整理条目），再直接打开第一条有建议的书签，
   * 让用户能立刻确认；没有建议时如实说明而不假装有。
   */
  const reviewSuggestions = () => {
    const target = bookmarks.find((b) => (b.pendingSuggestionCount || 0) > 0)
    if (!target) {
      toast.info(isInbox ? '当前列表没有待确认的 AI 建议' : '当前列表没有待确认的 AI 建议，可到 Inbox 看看')
      return
    }
    if (!isInbox) void setLocation('/')
    setSelectedBookmark(target)
    toast.info(`已打开「${(target.title || target.url).slice(0, 20)}」，请在详情里确认建议`)
  }

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
        title={activeScene ? activeScene.name : meta.title}
        count={bookmarks.length}
        description={activeScene?.description || meta.description}
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setShowSaveForm(true)}>
              + 保存
            </button>
            {/* Scene 视图的主操作：文案随该 Scene 的 AERR 原型变化（PRD §2.0.3）。
                这里只换文案与引导，不伪造独立功能——点击后落到当前筛选结果上。 */}
            {activeScene && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  document.querySelector('.bookmark-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {presentation.primaryAction}
              </button>
            )}
          </>
        }
      />

      <WorkspaceToolbar
        query={filters.q}
        source={filters.source}
        sort={sort}
        view={viewMode}
        suggestionCount={pendingSuggestionTotal}
        onQuery={(q) => setFilters((f) => ({ ...f, q }))}
        onSource={(source) => setFilters((f) => ({ ...f, source }))}
        onSort={setSort}
        onView={changeView}
        onReviewSuggestions={reviewSuggestions}
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
            {/* 停用场景保留在筛选里并加标注：停用不删历史挂载，仍要能筛到已挂的书签 */}
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.enabled === false ? `${scene.name}（已停用）` : scene.name}
              </option>
            ))}
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
          {/* AI 建议落点②「整理时」：整理过程中就告知选中项里有多少条有建议待确认 */}
          {selectedSuggestionCount > 0 && (
            <button
              type="button"
              className="btn btn--pill btn--accent"
              onClick={reviewSuggestions}
            >
              其中 {selectedSuggestionCount} 条有 AI 建议
            </button>
          )}
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
            {/* 批量挂场景属挑选器：停用项不可选，故用 scenesForPicker */}
            {scenesForPicker(scenes).map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
          {/* 批量加标签（对齐原型 SelectionToolbar 的批量加标签能力）。
              取已有标签；新建标签在「组织管理 → 标签」里做。 */}
          <select
            className="input"
            defaultValue=""
            disabled={tags.length === 0}
            title={tags.length === 0 ? '还没有标签，可到「组织管理 → 标签」新建' : undefined}
            onChange={(e) => {
              if (e.target.value) runBatch({ ids: [...selectedIds], addTagIds: [e.target.value] })
              e.target.value = ''
            }}
          >
            <option value="">{tags.length === 0 ? '暂无标签…' : '添加标签…'}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--pill btn--danger"
            onClick={() => runBatch({ ids: [...selectedIds], deleted: true })}
          >
            移入回收站
          </button>
          <button type="button" className="btn btn--pill" onClick={() => setSelectedIds(new Set())}>取消选择</button>
        </div>
      )}

      <section className="bookmark-area" data-density={presentation.density}>
        <div className="bookmark-summary">
          <span>显示 {bookmarks.length} 条{nextCursor ? '（还有更多）' : ''}</span>
          {hasActiveFilters && (
            <button type="button" className="clear-btn" onClick={clearFilters}>清除筛选</button>
          )}
        </div>

        {loading && <Skeleton variant={SKELETON_VARIANT[viewMode]} />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && bookmarks.length === 0 && (
          <EmptyState
            message={
              hasActiveFilters
                ? '当前筛选条件下没有书签'
                : isInbox ? 'Inbox 为空' : '暂无书签'
            }
            // 有筛选时才给「清除筛选」——这才是死胡同的出口；
            // 真正没数据时给「去保存第一条」，指向页面顶部的保存入口。
            action={
              hasActiveFilters
                ? { label: '清除筛选', onClick: clearFilters }
                : { label: '+ 保存第一条', onClick: () => setShowSaveForm(true) }
            }
          />
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
        <>
          {/* 遮罩：点击任意处收起详情，与原型一致 */}
          <button
            type="button"
            className="detail-backdrop"
            aria-label="收起详情"
            onClick={() => setSelectedBookmark(null)}
          />
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
              <SuggestionPanel
                bookmarkId={selectedBookmark.id}
                onUpdate={() => { void loadBookmarks(); void refreshSelected() }}
              />
            </div>
          </aside>
        </>
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
