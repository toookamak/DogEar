import { useRef } from 'react'
import { SOURCE_LABELS, label } from '../../utils/format.js'

export type ViewMode = 'grid' | 'tags' | 'list' | 'board'
export type SortKey = 'recent' | 'title' | 'domain'

interface Props {
  query: string
  source: string
  sort: SortKey
  view: ViewMode
  /** 当前已加载书签中待确认的 AI 建议总数（AI 建议落点②「整理时」） */
  suggestionCount: number
  onQuery: (value: string) => void
  onSource: (value: string) => void
  onSort: (value: SortKey) => void
  onView: (value: ViewMode) => void
  onReviewSuggestions: () => void
}

const VIEW_META: Record<ViewMode, { label: string; glyph: string }> = {
  grid: { label: '网格', glyph: '▦' },
  tags: { label: '标签', glyph: '◈' },
  list: { label: '列表', glyph: '☷' },
  board: { label: '看板', glyph: '▤' },
}

const SOURCES = ['', 'page', 'agent', 'extension'] as const

const SORT_LABELS: Record<SortKey, string> = {
  recent: '最近添加',
  title: '按标题',
  domain: '按域名',
}

/** 工作台工具栏：搜索、来源筛选、排序与四视图切换 */
export function WorkspaceToolbar({
  query,
  source,
  sort,
  view,
  suggestionCount,
  onQuery,
  onSource,
  onSort,
  onView,
  onReviewSuggestions,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
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

      <div className="toolbar-group" role="group" aria-label="来源筛选">
        {SOURCES.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            className="chip"
            aria-pressed={source === value}
            onClick={() => onSource(value)}
          >
            {value === '' ? '全部' : label(SOURCE_LABELS, value)}
          </button>
        ))}
      </div>

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
      </div>
    </div>
  )
}
