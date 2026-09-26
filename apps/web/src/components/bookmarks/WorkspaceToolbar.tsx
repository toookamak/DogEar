import { useEffect, useRef, useState } from 'react'
import { SOURCE_LABELS, label } from '../../utils/format.js'
import { CREATED_RANGES, activeFilterCount, type WorkbenchFilters } from '../../utils/filters.js'
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

const VIEW_META: Record<ViewMode, { label: string; glyph: string }> = {
  grid: { label: '网格', glyph: '▦' },
  tags: { label: '标签', glyph: '◈' },
  list: { label: '列表', glyph: '☷' },
  board: { label: '看板', glyph: '▤' },
}

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
          <span className="toolbar-search-icon" aria-hidden="true">⌕</span>
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
              ×
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
              <span aria-hidden="true">⚙</span> 筛选
              {activeCount > 0 && <span className="filter-toggle-count">{activeCount}</span>}
            </button>

            {showFilterPop && (
              <div className="filter-pop" role="group" aria-label="筛选维度">
                <label className="fp-field">
                  <span className="fp-label">状态</span>
                  <select className="input" value={filters.status} onChange={(e) => onFilters({ status: e.target.value })}>
                    <option value="">全部状态</option>
                    <option value="unread">待处理</option>
                    <option value="saved">已确认</option>
                    <option value="archived">搁置</option>
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
                  <span className="fp-label">场景</span>
                  <select className="input" value={filters.sceneId} onChange={(e) => onFilters({ sceneId: e.target.value })}>
                    <option value="">全部场景</option>
                    {/* 停用场景保留在筛选里并加标注：停用不删历史挂载，仍要能筛到已挂的书签 */}
                    {scenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.enabled === false ? `${scene.name}（已停用）` : scene.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">文件夹</span>
                  <select className="input" value={filters.folderId} onChange={(e) => onFilters({ folderId: e.target.value })}>
                    <option value="">全部文件夹</option>
                    <option value="none">无文件夹</option>
                    {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">标签</span>
                  <select className="input" value={filters.tagId} onChange={(e) => onFilters({ tagId: e.target.value })}>
                    <option value="">全部标签</option>
                    {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                  </select>
                </label>

                <label className="fp-field">
                  <span className="fp-label">时间</span>
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
            {(Object.keys(VIEW_META) as ViewMode[]).map((key) => (
              <button
                key={key}
                type="button"
                className="view-btn"
                aria-pressed={view === key}
                aria-label={VIEW_META[key].label}
                title={VIEW_META[key].label}
                onClick={() => onView(key)}
              >
                <span aria-hidden="true">{VIEW_META[key].glyph}</span>
                <span className="view-btn-label">{VIEW_META[key].label}</span>
              </button>
            ))}
          </div>

          {/* AI 建议落点②「整理时」：把待确认建议汇总成一个入口，计数为已加载书签中的合计 */}
          <button
            type="button"
            className="btn btn--ghost toolbar-organize"
            onClick={onReviewSuggestions}
            title="查看待确认的 AI 整理建议（建议先行，须你确认后才写入）"
          >
            整理建议
            {suggestionCount > 0 && <span className="toolbar-count">{suggestionCount}</span>}
          </button>

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
