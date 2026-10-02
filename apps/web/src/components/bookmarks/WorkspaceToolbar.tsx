import { useEffect, useRef, useState } from 'react'
import { SOURCE_LABELS, label } from '../../utils/format.js'
import { CREATED_RANGES, OPENED_RANGES, activeFilterCount, type WorkbenchFilters } from '../../utils/filters.js'
import { Icon, type IconName } from '../ui/Icon.js'
import type { SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'

export type ViewMode = 'grid' | 'tags' | 'list' | 'board'
export type SortKey = 'recent' | 'title' | 'domain' | 'important'

interface Props {
  query: string
  /** 完整筛选状态（弹层各维度 + 生效计数）；q 也在其中，搜索框读写它 */
  filters: WorkbenchFilters
  sort: SortKey
  view: ViewMode
  scenes: SceneResponse[]
  folders: FolderResponse[]
  tags: TagResponse[]
  /** Inbox 是固定视图（status 恒为 unread），不提供筛选弹层 */
  showFilters: boolean
  /** 当前已加载书签中待确认的 AI 建议总数（AI 建议落点②「整理时」） */
  suggestionCount: number
  /** 整理模式（v0.8.0）：叠加在浏览之上的可进可退态 */
  organizing: boolean
  onToggleOrganize: () => void
  /** Scene 视图的 AERR 主操作文案（无场景时缺省，不显示按钮） */
  scenePrimaryAction?: string
  showAddButton?: boolean
  onQuery: (value: string) => void
  onFilters: (patch: Partial<WorkbenchFilters>) => void
  onSort: (value: SortKey) => void
  onView: (value: ViewMode) => void
  onReviewSuggestions: () => void
  onAdd: () => void
  onScenePrimaryAction: () => void
}

/**
 * 视图切换：图标用内联 SVG（原 ▦ ◈ ☷ ▤ 来自不同字体，字宽与基线不一致）。
 *
 * v0.8.0：**看板移出入口**。看板的列就是 Status 三值（待处理/已确认/搁置），
 * 留着它等于 Status 根本没隐藏。组件与路由保留，可随时放回。
 */
const VIEW_META: Record<ViewMode, { label: string; icon: IconName }> = {
  grid: { label: '网格', icon: 'grid' },
  tags: { label: '标签', icon: 'tags' },
  list: { label: '列表', icon: 'list' },
  board: { label: '看板', icon: 'board' },
}

/** 视图切换器里实际露出的几个（不含 board，见上） */
const VISIBLE_VIEWS: ViewMode[] = ['list', 'grid', 'tags']

/** 来源筛选项（v1.14 起收进弹层；raindrop 来自双向拉回/导入） */
const SOURCES = ['', 'page', 'agent', 'extension', 'raindrop'] as const

const SORT_LABELS: Record<SortKey, string> = {
  recent: '最近添加',
  title: '按标题',
  domain: '按域名',
  important: '★ 收藏标星优先',
}

/** 工作台工具栏（单行）：搜索、筛选弹层（方向 A）、排序与视图切换、主操作 */
export function WorkspaceToolbar({
  query,
  filters,
  sort,
  view,
  scenes,
  folders,
  tags,
  showFilters,
  suggestionCount,
  organizing,
  onToggleOrganize,
  scenePrimaryAction,
  showAddButton = true,
  onQuery,
  onFilters,
  onSort,
  onView,
  onReviewSuggestions,
  onAdd,
  onScenePrimaryAction,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showFilterPop, setShowFilterPop] = useState(false)
  const popWrapRef = useRef<HTMLDivElement>(null)

  // 点击弹层外部收起；Esc 也可收起（与详情浮层的键盘口径一致）
  useEffect(() => {
    if (!showFilterPop) return
    const onPointerDown = (event: MouseEvent) => {
      if (popWrapRef.current && !popWrapRef.current.contains(event.target as Node)) setShowFilterPop(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowFilterPop(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showFilterPop])

  const activeCount = activeFilterCount(filters)

  return (
    <div className="toolbar-wrap">
      <div className="toolbar">
        <label className="toolbar-search">
          <span className="toolbar-search-icon" aria-hidden="true"><Icon name="search" /></span>
          <input
            ref={inputRef}
            type="search"
            className="toolbar-search-input"
            value={query}
            placeholder="筛选当前列表（标题 / 备注 / 标签）"
            onChange={(event) => onQuery(event.target.value)}
          />
          {query !== '' && (
            <button
              type="button"
              className="toolbar-search-clear"
              aria-label="清除搜索"
              onClick={() => onQuery('')}
            >
              <Icon name="close" />
            </button>
          )}
        </label>

        {showFilters && (
          <div className="toolbar-filter-anchor" ref={popWrapRef}>
            <button
              type="button"
              className={`filter-toggle${activeCount > 0 ? ' filter-toggle--on' : ''}`}
              aria-expanded={showFilterPop}
              onClick={() => setShowFilterPop((v) => !v)}
              title="按状态、来源、时间等维度筛选"
            >
              <span aria-hidden="true"><Icon name="filter" /></span> 筛选
              {activeCount > 0 && <span className="filter-toggle-count">{activeCount}</span>}
            </button>

            {showFilterPop && (
              <div className="filter-pop" role="group" aria-label="筛选维度">
                {/* v0.8.0：状态维度已隐藏（计划决策二）。字段与接口仍保留，可随时放回。
                    「未打标签」与「一年没打开」是无状态条件——只是缩小范围的手段，不带「欠账」语气。 */}
                <label className="fp-field">
                  <span className="fp-label">归类情况</span>
                  <select
                    className="input"
                    value={filters.tagId === 'none' ? 'none' : ''}
                    onChange={(e) => onFilters({ tagId: e.target.value })}
                  >
                    <option value="">不限</option>
                    <option value="none">未打标签</option>
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">文件夹</span>
                  <select className="input" value={filters.folderId} onChange={(e) => onFilters({ folderId: e.target.value })}>
                    <option value="">全部文件夹</option>
                    <option value="none">没有收藏夹</option>
                    {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">标签</span>
                  {/* 有具体标签选中时优先显示它；否则回落到「不限」而不是误显示「未打标签」 */}
                  <select
                    className="input"
                    value={filters.tagId === 'none' ? '' : filters.tagId}
                    onChange={(e) => onFilters({ tagId: e.target.value })}
                  >
                    <option value="">全部标签</option>
                    {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">最近打开</span>
                  <select
                    className="input"
                    value={filters.openedRange}
                    onChange={(e) => onFilters({ openedRange: e.target.value as WorkbenchFilters['openedRange'] })}
                  >
                    {OPENED_RANGES.map((preset) => (
                      <option key={preset.value || 'all'} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">来源</span>
                  <select className="input" value={filters.source} onChange={(e) => onFilters({ source: e.target.value })}>
                    {SOURCES.map((value) => (
                      <option key={value || 'all'} value={value}>
                        {value === '' ? '全部来源' : label(SOURCE_LABELS, value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">添加时间</span>
                  <select
                    className="input"
                    value={filters.createdRange}
                    onChange={(e) => onFilters({ createdRange: e.target.value as WorkbenchFilters['createdRange'] })}
                  >
                    {CREATED_RANGES.map((preset) => (
                      <option key={preset.value || 'all'} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                </label>

                <label className="fp-field">
                  {/* v0.8.0：Scene 降级为本地维度，只在字段名上写明「不回写」，
                      不删这个筛选（删了就没法按场景找了）。停用场景保留并加标注。 */}
                  <span className="fp-label">本地场景（不回写）</span>
                  <select className="input" value={filters.sceneId} onChange={(e) => onFilters({ sceneId: e.target.value })}>
                    <option value="">全部场景</option>
                    {scenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.enabled === false ? `${scene.name}（已停用）` : scene.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">导航页展示</span>
                  <select
                    className="input"
                    value={filters.navVisible}
                    onChange={(e) => onFilters({ navVisible: e.target.value as WorkbenchFilters['navVisible'] })}
                  >
                    <option value="">全部</option>
                    <option value="true">已在导航页展示</option>
                    <option value="false">未在导航页展示</option>
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">收藏标星</span>
                  <select
                    className="input"
                    value={filters.important}
                    onChange={(e) => onFilters({ important: e.target.value as WorkbenchFilters['important'] })}
                  >
                    <option value="">全部</option>
                    <option value="true">仅重要</option>
                    <option value="false">未标星</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="toolbar-actions">
          <select
            className="input toolbar-sort"
            value={sort}
            aria-label="排序方式"
            onChange={(event) => onSort(event.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>{SORT_LABELS[key]}</option>
            ))}
          </select>

          <div className="view-switcher" role="group" aria-label="切换视图">
            {VISIBLE_VIEWS.map((key) => (
              <button
                key={key}
                type="button"
                className="view-btn"
                aria-pressed={view === key}
                aria-label={VIEW_META[key].label}
                title={VIEW_META[key].label}
                onClick={() => onView(key)}
              >
                <span aria-hidden="true"><Icon name={VIEW_META[key].icon} /></span>
                <span className="view-btn-label">{VIEW_META[key].label}</span>
              </button>
            ))}
          </div>

          {/* v0.8.0 整理模式：可进可退的叠加态，不改变你在哪（不跳页、不重置筛选） */}
          <button
            type="button"
            className={`btn btn--ghost toolbar-organize${organizing ? ' toolbar-organize--on' : ''}`}
            aria-pressed={organizing}
            onClick={onToggleOrganize}
            title={organizing ? '退出整理模式' : '进入整理模式：多选后可批量改收藏夹与标签'}
          >
            {organizing ? '整理中 · 退出' : '整理'}
          </button>

          {/* AI 建议落点②「整理时」：把待确认建议汇总成一个入口，计数为已加载书签中的合计。
              v0.8.0：整理模式开启时隐藏，避免两个「整理」入口并排造成歧义。 */}
          {!organizing && (
            <button
              type="button"
              className="btn btn--ghost toolbar-organize"
              onClick={onReviewSuggestions}
              title="查看待确认的 AI 整理建议（建议先行，须你确认后才写入）"
            >
              整理建议
              {suggestionCount > 0 && <span className="toolbar-count">{suggestionCount}</span>}
            </button>
          )}

          {/* Scene 视图的 AERR 主操作：文案随该 Scene 原型变化（PRD §2.0.3）。
              点击后落到当前筛选结果上（滚动到列表区），不伪造独立功能。 */}
          {scenePrimaryAction && (
            <button type="button" className="btn btn--ghost" onClick={onScenePrimaryAction}>
              {scenePrimaryAction}
            </button>
          )}

          {showAddButton && (
            <button type="button" className="btn btn--primary" onClick={onAdd}>添加书签</button>
          )}
        </div>
      </div>
    </div>
  )
}
