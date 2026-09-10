import type { BookmarkResponse } from '../../types/api.js'
import { SOURCE_LABELS, STATUS_LABELS, formatDateTime, label } from '../../utils/format.js'

interface Props {
  bookmarks: BookmarkResponse[]
  activeId: string | null
  selectedIds: Set<string>
  onOpen: (bookmark: BookmarkResponse) => void
  onToggleSelect: (id: string) => void
  /** 行内快速改状态；不传则不显示操作列的可点操作 */
  onMoveStatus?: (id: string, status: 'unread' | 'saved' | 'archived') => void
}

/**
 * 表格列表视图：六列（选择 / 标题 / 状态 / 来源 / 加入时间 / 操作）。
 * 行内「确认 / 搁置」为高频整理动作，无需先打开详情。
 */
export function BookmarkTableView({
  bookmarks,
  activeId,
  selectedIds,
  onOpen,
  onToggleSelect,
  onMoveStatus,
}: Props) {
  return (
    <div className="bm-table" role="table">
      <div className="bm-table-head" role="row">
        <span className="bm-col-check" />
        <span className="bm-col-main">标题</span>
        <span className="bm-col-status">状态</span>
        <span className="bm-col-source">来源</span>
        <span className="bm-col-date">加入时间</span>
        <span className="bm-col-actions">操作</span>
      </div>

      {bookmarks.map((bookmark) => {
        const selected = selectedIds.has(bookmark.id)
        return (
          <div
            key={bookmark.id}
            role="row"
            className={`bm-table-row${activeId === bookmark.id ? ' bm-table-row--active' : ''}${selected ? ' bm-table-row--selected' : ''}`}
            onClick={() => onOpen(bookmark)}
          >
            <span className="bm-col-check">
              <input
                type="checkbox"
                checked={selected}
                onClick={(event) => event.stopPropagation()}
                onChange={() => onToggleSelect(bookmark.id)}
                aria-label={selected ? '取消选择' : '选择该书签'}
              />
            </span>

            <span className="bm-col-main">
              <span className="bm-table-row-title">{bookmark.title || bookmark.url}</span>
              <span className="bm-table-row-domain">{bookmark.domain ?? ''}</span>
            </span>

            <span className="bm-col-status">
              <span className={`pill pill--status pill--${bookmark.status}`}>
                {label(STATUS_LABELS, bookmark.status)}
              </span>
            </span>

            <span className="bm-col-source">{label(SOURCE_LABELS, bookmark.source)}</span>
            <span className="bm-col-date">{formatDateTime(bookmark.createdAt)}</span>

            <span className="bm-col-actions">
              {onMoveStatus && bookmark.status !== 'saved' && (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    onMoveStatus(bookmark.id, 'saved')
                  }}
                >
                  确认
                </button>
              )}
              {onMoveStatus && bookmark.status !== 'archived' && (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    onMoveStatus(bookmark.id, 'archived')
                  }}
                >
                  搁置
                </button>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
