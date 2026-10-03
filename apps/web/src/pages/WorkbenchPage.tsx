import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useSearchParams } from 'wouter'
import { WorkspaceToolbar, type SortKey, type ViewMode } from '../components/bookmarks/WorkspaceToolbar.js'
import { BookmarkGridView } from '../components/bookmarks/BookmarkGridView.js'
import { BookmarkTableView } from '../components/bookmarks/BookmarkTableView.js'
import { BookmarkBoardView } from '../components/bookmarks/BookmarkBoardView.js'
import { BookmarkTilesView } from '../components/bookmarks/BookmarkTilesView.js'
import { BookmarkDetail } from '../components/detail/BookmarkDetail.js'
import { SaveBookmarkForm } from '../components/detail/SaveBookmarkForm.js'
import { CommandPalette } from '../components/command/CommandPalette.js'
import { bookmarkSearchIndex } from '../search-index.js'
import { SuggestionPanel } from '../components/suggestions/SuggestionPanel.js'
import { EmptyState } from '../components/feedback/EmptyState.js'
import { Skeleton } from '../components/feedback/Skeleton.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import { ConfirmDialog } from '../components/feedback/ConfirmDialog.js'
import { bookmarksApi } from '../api/bookmarks.js'
import { organizationApi } from '../api/organization.js'
import type { BookmarkListParams } from '../api/bookmarks.js'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../types/api.js'
import { offerUndo, onDataChanged } from '../undo.js'
import { toast, errorMessage } from '../toast.js'
import { presentationForAerr, nextSortOnSceneChange, DEFAULT_PRESENTATION } from '../utils/scene-presentation.js'
import { scenesForPicker } from '../utils/scene-filtering.js'
import { EMPTY_FILTERS, buildListParams, hasActiveFilters, type WorkbenchFilters } from '../utils/filters.js'
import { BATCH_CHUNK_SIZE, BATCH_CONFIRM_THRESHOLD, chunkIds } from '../utils/batch.js'
import { onOrgChanged } from '../org-events.js'

const VIEW_STORAGE_KEY = 'dogear.workbench.view'

/** 分页大小：与服务端列表默认一致；397 条 ≈ 8 页 */
const PAGE_SIZE = 50

/** 视图 → 骨架屏形态：标签视图的形状与图标卡一致，列表视图即表格行 */
const SKELETON_VARIANT: Record<ViewMode, 'grid' | 'tiles' | 'table' | 'board'> = {
  grid: 'grid',
  tags: 'tiles',
  list: 'table',
  board: 'board',
}

function readStoredView(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'grid' || stored === 'tags' || stored === 'list') return stored
    // v0.8.0：看板已从视图切换器移出（它的列就是 Status 三值，留着等于 Status 没隐藏）。
    // 老用户 localStorage 里存的 'board' 一律回落列表——**不静默把他留在一个没有入口的视图里**。
    if (stored === 'board') return 'list'
  } catch { /* 隐私模式下不可读，用默认值 */ }
  return 'grid'
}

export function WorkbenchPage() {
  const [location, setLocation] = useLocation()
  const isInbox = location === '/'

  const [bookmarks, setBookmarks] = useState<BookmarkResponse[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkResponse | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** 全选匹配项进行中（ids 端点可能翻几十页，按钮要有进行中态） */
  const [selectingAll, setSelectingAll] = useState(false)
  /** 影响面确认（P1b-2）：超阈值的批量改动先停在这里等用户点头 */
  const [pendingBatch, setPendingBatch] = useState<{ data: Parameters<typeof bookmarksApi.batchUpdate>[0]; description: string } | null>(null)
  /** 整理模式（v0.8.0）：叠加在浏览之上的可进可退态，不改变当前筛选与滚动位置 */
  const [organizing, setOrganizing] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [showCommand, setShowCommand] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView)
  const [sort, setSort] = useState<SortKey>('recent')
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [folders, setFolders] = useState<FolderResponse[]>([])
  const [tags, setTags] = useState<TagResponse[]>([])
  const [filters, setFilters] = useState<WorkbenchFilters>(EMPTY_FILTERS)
  const [searchParams, setSearchParams] = useSearchParams()
  // 每页的入口游标（keyset）：stack[i] = 第 i 页的取数游标（第 0 页为 null）。
  // 上一页 = 退回上一格游标，避免为「页码跳转」改用 offset 牺牲排序稳定性。
  const cursorStackRef = useRef<Array<string | null>>([null])
  const pageRef = useRef(0)
  const loadSeqRef = useRef(0)

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
      setFilters(EMPTY_FILTERS)
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

  const queryParams = useCallback((): BookmarkListParams => buildListParams(filters, sort, isInbox), [filters, isInbox, sort])

  /**
   * 取指定页（缺省刷新当前页）。游标来自 cursorStackRef——只有真正访问过的页
   * 才有游标，故分页器提供上一页/下一页而非任意跳页（keyset 排序稳定，代价是
   * 不能跳页；要跳页需改 offset 分页，见屏稿的备选方案）。
   */
  const loadBookmarks = useCallback(async (targetPage?: number) => {
    const idx = Math.max(0, targetPage ?? pageRef.current)
    const seq = ++loadSeqRef.current
    pageRef.current = idx
    setPage(idx)
    setLoading(true)
    setError(null)
    try {
      const cursor = cursorStackRef.current[idx] ?? null
      const params = { ...queryParams(), cursor: cursor ?? undefined, limit: PAGE_SIZE }
      const result = isInbox
        ? await bookmarksApi.inbox({ cursor: cursor ?? undefined, limit: PAGE_SIZE })
        : filters.q.trim()
          ? await bookmarksApi.search(params)
          : await bookmarksApi.list(params)
      if (seq !== loadSeqRef.current) return // 已有更新的取数，丢弃旧回执
      const items = isInbox ? (result as { bookmarks?: BookmarkResponse[] }).bookmarks ?? [] : (result as { items?: BookmarkResponse[] }).items ?? []
      const next = result.nextCursor ?? null
      setBookmarks(items)
      cursorStackRef.current[idx + 1] = next
      setHasNext(next !== null)
      setTotal(typeof result.total === 'number' ? result.total : null)
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e instanceof Error ? e.message : '加载失败')
    }
    setLoading(false)
  }, [isInbox, queryParams, filters.q])

  // 外壳中的撤销成功后通知刷新列表（刷新当前页，替代先前的整页 reload）
  useEffect(() => onDataChanged(() => { void loadBookmarks() }), [loadBookmarks])

  /**
   * 打开端侧索引命中的书签（2026-10-02 批次 2）。索引里只有瘦投影，
   * 完整对象按 id 取；取不到就提示而不是静默无反应。
   */
  const openBookmarkById = useCallback(async (id: string) => {
    try {
      const fresh = await bookmarksApi.get(id)
      setSelectedBookmark(fresh)
    } catch (e) {
      toast.error(errorMessage(e, '打不开这条书签'))
    }
  }, [])

  // 工作台数据一变，端侧索引即作废（下次查询时重建，见 search-index.ts 的策略说明）
  useEffect(() => onDataChanged(() => { bookmarkSearchIndex.invalidate() }), [])

  // 筛选/排序/入口变化（loadBookmarks 身份随之变化）：重置到第 1 页
  useEffect(() => {
    cursorStackRef.current = [null]
    void loadBookmarks(0)
  }, [loadBookmarks])

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
            toast.info(`已添加，有 ${pending} 条 AI 整理建议待你确认`)
            return
          }
        } catch { /* 取回失败不影响「已添加」这一事实 */ }
      }
      toast.success('已添加到 Inbox')
    } catch (e) {
      toast.error(errorMessage(e, '添加失败'))
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

  /**
   * 批量执行（P1b 重构）：
   * - 影响面 > 阈值时先弹确认（P1b-2），把「将改哪几条、改成什么」摆出来再动手；
   * - id 按块分片顺序调用（P1b-1）：全选匹配项可能选中上千条，一次请求既超
   *   服务端 100 上限、也会在轨 A 撞 Workers 50 子请求限制；
   * - 多分块时不再挂 toast 撤销——撤销 id 是按单次请求记的，挂一个会误导撤销范围，
   *   删除类操作本身有回收站兜底。
   */
  const executeBatch = async (data: Parameters<typeof bookmarksApi.batchUpdate>[0]) => {
    const chunks = chunkIds(data.ids)
    let updated = 0
    let skipped = 0
    let lastUndoId: string | undefined
    try {
      for (const chunk of chunks) {
        const result = await bookmarksApi.batchUpdate({ ...data, ids: chunk })
        updated += result.updated?.length ?? 0
        skipped += result.skipped?.length ?? 0
        lastUndoId = result.undoId
      }
      setSelectedIds(new Set())
      await loadBookmarks()
      if (chunks.length > 1) {
        toast.success(`已更新 ${updated} 条${skipped > 0 ? `，${skipped} 条被跳过` : ''}（分 ${chunks.length} 批执行）`)
      } else {
        // 双入口撤销：Toast 直带撤销按钮（状态栏保留兜底）
        if (lastUndoId) offerUndo({ undoId: lastUndoId, message: data.deleted ? '删除' : '批量修改' })
        if (skipped > 0) toast.info(`已处理，${skipped} 条被跳过（可能已被删除）`)
        else if (lastUndoId) toast.undoable(data.deleted ? '已移入回收站' : '已更新', lastUndoId)
        else toast.success(data.deleted ? '已移入回收站' : '已更新')
      }
    } catch (e) {
      toast.error(errorMessage(e, '批量操作失败'))
    }
  }

  /** 批量入口：影响面超阈值先进确认，把「将改什么、影响几条」摆到用户眼前 */
  const runBatch = async (data: Parameters<typeof bookmarksApi.batchUpdate>[0]) => {
    if (data.ids.length > BATCH_CONFIRM_THRESHOLD) {
      setPendingBatch({ data, description: describeBatchChange(data) })
      return
    }
    await executeBatch(data)
  }

  /** 影响面预览文案：把所选改动翻译成一句白话（收藏夹/标签名就地查，查不到标「?」） */
  const describeBatchChange = (data: Parameters<typeof bookmarksApi.batchUpdate>[0]): string => {
    const n = data.ids.length
    if (data.deleted) return `将把 ${n} 条书签移入回收站（可在回收站恢复）`
    const parts: string[] = []
    if (data.folderId) parts.push(`移入收藏夹「${folders.find((f) => f.id === data.folderId)?.name ?? '?'}」`)
    if (data.addTagIds?.length) parts.push(`添加标签 ${data.addTagIds.map((id) => tags.find((t) => t.id === id)?.name ?? '?').join('、')}`)
    if (data.removeTagIds?.length) parts.push(`移除标签 ${data.removeTagIds.map((id) => tags.find((t) => t.id === id)?.name ?? '?').join('、')}`)
    if (data.addSceneIds?.length) parts.push(`加入场景「${scenes.find((s) => s.id === data.addSceneIds?.[0])?.name ?? '?'}」`)
    if (data.status) parts.push('更改状态')
    return `将把 ${n} 条书签${parts.length > 0 ? `：${parts.join('，')}` : '按所选条件修改'}`
  }

  /** 全选匹配项（P1b）：按当前筛选/搜索条件取全部 id，选中集合与列表所见同口径 */
  const selectAllMatching = async () => {
    setSelectingAll(true)
    try {
      // Inbox 视图的口径是「未读」：ids 端点走通用筛选，需显式补 status=unread
      const params: BookmarkListParams = { ...queryParams(), ...(isInbox ? { status: 'unread' } : {}) }
      const result = await bookmarksApi.ids(params)
      setSelectedIds(new Set(result.ids))
      if (result.truncated) toast.info(`已选前 ${result.ids.length} 条（匹配约 ${result.total} 条）——已达单次全选上限，建议先缩小筛选范围`)
      else toast.info(`已选全部匹配的 ${result.ids.length} 条`)
    } catch (e) {
      toast.error(errorMessage(e, '全选失败'))
    }
    setSelectingAll(false)
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

  const hasFilters = hasActiveFilters(filters)

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const pageCount = total !== null ? Math.ceil(total / PAGE_SIZE) : null

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
      {/* 单行工具栏（视觉稿 v2 确认口径）：搜索 / 筛选弹层 / 排序 / 视图 / 场景主操作 / 添加书签。
          原 ContentHead（标题+计数+描述）整体去除，计数由侧栏承担；
          Scene 视图的 AERR 主操作以 ghost 按钮并入本行。 */}
      <WorkspaceToolbar
        query={filters.q}
        filters={filters}
        sort={sort}
        view={viewMode}
        scenes={scenes}
        folders={folders}
        tags={tags}
        showFilters={!isInbox}
        suggestionCount={pendingSuggestionTotal}
        organizing={organizing}
        onToggleOrganize={() => {
          setOrganizing((v) => {
            // 退出整理时清空选择：留着一条「已选 12 条」的批量条会让人误以为还在整理
            if (v) setSelectedIds(new Set())
            return !v
          })
        }}
        scenePrimaryAction={activeScene ? presentation.primaryAction : undefined}
        onQuery={(q) => setFilters((f) => ({ ...f, q }))}
        onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onSort={setSort}
        onView={changeView}
        onReviewSuggestions={reviewSuggestions}
        onAdd={() => setShowSaveForm(true)}
        onScenePrimaryAction={() => {
          document.querySelector('.bookmark-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      {showSaveForm && (
        <div className="save-form-wrap">
          <SaveBookmarkForm onSave={handleSave} onClose={() => setShowSaveForm(false)} />
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span className="selection-bar-count">已选 {selectedIds.size}</span>
          {/* 全选匹配项（P1b）：把「逐条勾选」升级为「对整个集合操作」——
              先勾一条浮起批量条，再一键把当前筛选/搜索命中的全部条目纳入选择 */}
          {total != null && total > selectedIds.size && (
            <button
              type="button"
              className="btn btn--pill"
              disabled={selectingAll}
              onClick={() => { void selectAllMatching() }}
            >
              {selectingAll ? '全选中…' : `全选匹配项（共 ${total} 条）`}
            </button>
          )}
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
          {/* v0.8.0：Status 批量三项已隐藏（计划决策二）。字段与接口保留，可随时放回。
              留下的是与「整理」直接相关的两项：收藏夹与标签。 */}
          <select
            className="input"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) runBatch({ ids: [...selectedIds], folderId: e.target.value })
              e.target.value = ''
            }}
          >
            <option value="">移入收藏夹…</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <select
            className="input"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) runBatch({ ids: [...selectedIds], addSceneIds: [e.target.value] })
              e.target.value = ''
            }}
          >
            <option value="">加到本地场景…</option>
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
          <span>共 {total ?? bookmarks.length} 条</span>
          {hasFilters && (
            <button type="button" className="clear-btn" onClick={clearFilters}>清除筛选</button>
          )}
        </div>

        {loading && <Skeleton variant={SKELETON_VARIANT[viewMode]} />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && bookmarks.length === 0 && (
          <EmptyState
            message={
              hasFilters
                ? '当前筛选条件下没有书签'
                : isInbox ? 'Inbox 为空' : '暂无书签'
            }
            // 有筛选时才给「清除筛选」——这才是死胡同的出口；
            // 真正没数据时给「添加第一条」，指向页面顶部的添加入口。
            action={
              hasFilters
                ? { label: '清除筛选', onClick: clearFilters }
                : { label: '添加第一条', onClick: () => setShowSaveForm(true) }
            }
          />
        )}
        {!loading && !error && bookmarks.length > 0 && renderView()}

        {(hasNext || page > 0) && !loading && (
          <nav className="pager" aria-label="分页">
            <button
              type="button"
              className="btn btn--pill"
              disabled={page === 0 || loading}
              onClick={() => void loadBookmarks(page - 1)}
            >
              上一页
            </button>
            <span className="pager-indicator">第 {page + 1}{pageCount ? ` / ${pageCount}` : ''} 页</span>
            <button
              type="button"
              className="btn btn--pill"
              disabled={!hasNext || loading}
              onClick={() => void loadBookmarks(page + 1)}
            >
              下一页
            </button>
          </nav>
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
        onOpenBookmark={(id) => { void openBookmarkById(id) }}
        onClose={() => setShowCommand(false)}
        open={showCommand}
        onQuickEdit={(id, change) => { void runBatch({ ids: [id], ...change }) }}
        folders={folders}
        tags={tags}
      />

      {/* 批量影响面确认（P1b-2）：大集合改动先把「将改什么、影响几条」摆出来再动手 */}
      <ConfirmDialog
        open={pendingBatch !== null}
        title="批量修改确认"
        message={pendingBatch?.description ?? ''}
        confirmLabel={pendingBatch ? `应用（${pendingBatch.data.ids.length} 条）` : '应用'}
        onConfirm={() => {
          const pending = pendingBatch
          setPendingBatch(null)
          if (pending) void executeBatch(pending.data)
        }}
        onCancel={() => setPendingBatch(null)}
      />
    </div>
  )
}
