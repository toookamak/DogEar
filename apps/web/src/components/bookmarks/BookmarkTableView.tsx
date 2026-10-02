import type { BookmarkResponse } from '../../types/api.js'
import { SOURCE_LABELS, formatDateTime, label } from '../../utils/format.js'

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
 * 表格列表视图：**五列**（选择 / 标题 / 来源 / 加入时间 / 操作）。
 *
 * v0.8.0：去掉「状态」列与行内「确认/搁置」——两者都是按状态组织的入口，
 * 留着它们等于 Status 没隐藏（计划决策二）。`onMoveStatus` 形参与
 * BookmarkBoardView 一并保留，接口未删，可随时放回。
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
            tabIndex={0}
            className={`bm-table-row${activeId === bookmark.id ? ' bm-table-row--active' : ''}${selected ? ' bm-table-row--selected' : ''}`}
            aria-label={`${bookmark.title || bookmark.url}（打开详情）`}
            onClick={() => onOpen(bookmark)}
            // 键盘可达：网格与图标视图已支持 Enter/Space，表格此前只能鼠标点
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(bookmark)
              }
            }}
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
              <span className="bm-table-row-domain">
                {bookmark.domain ?? ''}
                {/* AI 建议落点③「Inbox 内」：表格视图同样在行内提示有建议待确认 */}
                {bookmark.pendingSuggestionCount > 0 && (
                  <span className="pill pill--ai pill--gap">
                    AI 建议 {bookmark.pendingSuggestionCount}
                  </span>
                )}
              </span>
            </span>

            {/* v0.8.0：状态列与行内改状态按钮已隐藏（计划决策二）。
                两者都是「按状态组织」的入口；留着它们等于 Status 没隐藏。
                `onMoveStatus` 形参与 BookmarkBoardView 一并保留，可随时放回。 */}

            <span className="bm-col-source">{label(SOURCE_LABELS, bookmark.source)}</span>
            <span className="bm-col-date">{formatDateTime(bookmark.createdAt)}</span>

            <span className="bm-col-actions" />
          </div>
        )
      })}
    </div>
  )
}
