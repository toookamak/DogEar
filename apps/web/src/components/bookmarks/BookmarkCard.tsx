import type { BookmarkResponse } from '../../types/api.js'
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  SYNC_STATUS_LABELS,
  label,
} from '../../utils/format.js'

interface BookmarkCardProps {
  bookmark: BookmarkResponse
  onClick: () => void
  active?: boolean
  selected?: boolean
  selectable?: boolean
  onToggleSelect?: (id: string) => void
}

/**
 * 书签卡片（网格视图与导航页共用）：对齐原型三段式结构——
 * 来源条（monogram + 来源 + 状态）/ 装饰预览（渐变底 + 衬线水印 + 选择键）/ 内容（标题、摘要、标签、域名）。
 * 样式见 styles/app.css 的 .bm-card；来源与状态着色由 src-* / state-* 修饰符驱动。
 */
export function BookmarkCard({
  bookmark,
  onClick,
  active,
  selected,
  selectable,
  onToggleSelect,
}: BookmarkCardProps) {
  const title = bookmark.title || bookmark.url
  // 展示层兜底：元数据未回填时从 URL 取主机名（domain 为可空字段）
  const domain = bookmark.domain ?? bookmark.url.replace(/^https?:\/\//, '').split('/')[0]
  // 预览区水印与 monogram 的单字：优先域名首字母，缺省回落标题
  const mark = (domain || title).charAt(0).toUpperCase()
  const excerpt = bookmark.excerpt ?? bookmark.note ?? ''

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
      <div className={`bm-card-cover src-${bookmark.source}`}>
        <span className="cover-monogram">
          {bookmark.favicon ? (
            <img src={bookmark.favicon} alt="" loading="lazy" />
          ) : (
            mark
          )}
        </span>
        <span className="cover-source">{label(SOURCE_LABELS, bookmark.source)}</span>
        <span className={`cover-status state-${bookmark.status}`}>
          {label(STATUS_LABELS, bookmark.status)}
        </span>
      </div>

      <div className={`bm-card-preview src-${bookmark.source}`} data-mark={mark} aria-hidden="true">
        {selectable && (
          <input
            type="checkbox"
            className={`bm-card-select${selected ? ' checked' : ''}`}
            checked={Boolean(selected)}
            aria-label={selected ? '取消选择' : '选择该书签'}
            onClick={(event) => event.stopPropagation()}
            onChange={() => onToggleSelect?.(bookmark.id)}
          />
        )}
      </div>

      <div className="bm-card-body">
        <h3 className="bm-card-title">{title}</h3>
        {excerpt && <p className="bm-card-excerpt">{excerpt}</p>}

        <div className="bm-card-tags-row">
          {/* AI 建议落点③「Inbox 内」：列表层就能看出哪条有建议待确认，
              数据来自服务端的 pendingSuggestionCount，不是占位。 */}
          {bookmark.pendingSuggestionCount > 0 && (
            <span
              className="pill pill--ai"
              title={`有 ${bookmark.pendingSuggestionCount} 条 AI 整理建议待确认（建议先行，须你确认后才写入）`}
            >
              AI 建议 {bookmark.pendingSuggestionCount}
            </span>
          )}
          {bookmark.important && <span className="pill pill--important">重要</span>}
          {bookmark.private && <span className="pill">私密</span>}
          {bookmark.syncStatus === 'pending' && (
            <span className="pill pill--pending">{label(SYNC_STATUS_LABELS, bookmark.syncStatus)}</span>
          )}
          {bookmark.tags.length > 0 ? (
            bookmark.tags.map((tag) => (
              <span key={tag.id} className="tag-pill">
                {tag.name}
              </span>
            ))
          ) : (
            <span className="tag-pill tag-pill-empty">未整理</span>
          )}
        </div>

        <a
          className={`bm-card-domain src-${bookmark.source}`}
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="打开原链接"
          title="打开原链接"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="d-fav">{mark}</span>
          <span className="d-text">{domain}</span>
          <span className="d-go">↗</span>
        </a>
      </div>
    </article>
  )
}
