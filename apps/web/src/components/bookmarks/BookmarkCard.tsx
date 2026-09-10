import type { BookmarkResponse } from '../../types/api.js'
import { STATUS_LABELS, SYNC_STATUS_LABELS, label } from '../../utils/format.js'

interface BookmarkCardProps {
  bookmark: BookmarkResponse
  onClick: () => void
  active?: boolean
  selected?: boolean
  selectable?: boolean
  onToggleSelect?: (id: string) => void
}

/** 书签卡片：网格视图与导航页共用。样式见 styles/app.css 的 .bm-card */
export function BookmarkCard({
  bookmark,
  onClick,
  active,
  selected,
  selectable,
  onToggleSelect,
}: BookmarkCardProps) {
  const title = bookmark.title || bookmark.url

  return (
    <article
      className={`bm-card${active ? ' bm-card--active' : ''}${selected ? ' bm-card--selected' : ''}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`${title}（打开详情）`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <header className="bm-card-head">
        {selectable && (
          <input
            type="checkbox"
            className="bm-card-check"
            checked={Boolean(selected)}
            onClick={(event) => event.stopPropagation()}
            onChange={() => onToggleSelect?.(bookmark.id)}
            aria-label={selected ? '取消选择' : '选择该书签'}
          />
        )}
        {bookmark.favicon && (
          <img className="bm-card-fav" src={bookmark.favicon} alt="" loading="lazy" />
        )}
        <h3 className="bm-card-title">{title}</h3>
      </header>

      {bookmark.note && <p className="bm-card-note">{bookmark.note}</p>}

      <footer className="bm-card-foot">
        <span className={`pill pill--status pill--${bookmark.status}`}>
          {label(STATUS_LABELS, bookmark.status)}
        </span>
        {bookmark.important && <span className="pill pill--important">重要</span>}
        {bookmark.private && <span className="pill">私密</span>}
        {bookmark.syncStatus === 'pending' && (
          <span className="pill pill--pending">{label(SYNC_STATUS_LABELS, bookmark.syncStatus)}</span>
        )}
        <span className="bm-card-domain">{bookmark.domain ?? ''}</span>
      </footer>
    </article>
  )
}
