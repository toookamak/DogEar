import { useEffect, useState } from 'react'
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
 * 来源条（monogram + 来源 + 状态）/ 预览（有 cover 显示封面图，否则渐变底 + 衬线水印）/ 内容。
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
  // 防御性缺省：导航页传入的是投影子集（NavItem，无 source/status/tags 等字段），
  // 共用组件不得因缺字段崩溃（2026-09-12 导航页白屏回归的修复点）。
  // source/status 缺省时不渲染来源与状态徽标——导航投影不含这两个字段，
  // 用缺省值展示会误导（例如把已收藏条目显示成「待处理」）。
  const source = bookmark.source
  const status = bookmark.status
  // tags 为 undefined（投影未返回）时不显示标签区；空数组才是真实的「未整理」
  const tags = bookmark.tags
  const pendingSuggestions = bookmark.pendingSuggestionCount ?? 0
  const coverUrl = (bookmark.cover ?? '').trim() || null
  const [coverBroken, setCoverBroken] = useState(false)
  useEffect(() => {
    setCoverBroken(false)
  }, [coverUrl])
  const showCover = Boolean(coverUrl) && !coverBroken


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
      <div className={`bm-card-cover${source ? ` src-${source}` : ''}`}>
        <span className="cover-monogram">
          {bookmark.favicon ? (
            <img src={bookmark.favicon} alt="" loading="lazy" />
          ) : (
            mark
          )}
        </span>
        {source && <span className="cover-source">{label(SOURCE_LABELS, source)}</span>}
        {status && (
          <span className={`cover-status state-${status}`}>
            {label(STATUS_LABELS, status)}
          </span>
        )}
      </div>

      <div
        className={`bm-card-preview${source ? ` src-${source}` : ''}${showCover ? ' bm-card-preview--photo' : ''}`}
        data-mark={showCover ? undefined : mark}
        aria-hidden="true"
      >
        {showCover && coverUrl && (
          <img
            className="bm-card-thumb"
            src={coverUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setCoverBroken(true)}
          />
        )}
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
          {pendingSuggestions > 0 && (
            <span
              className="pill pill--ai"
              title={`有 ${pendingSuggestions} 条 AI 整理建议待确认（建议先行，须你确认后才写入）`}
            >
              AI 建议 {pendingSuggestions}
            </span>
          )}
          {bookmark.important && <span className="pill pill--important">重要</span>}
          {bookmark.private && <span className="pill">私密</span>}
          {bookmark.syncStatus === 'pending' && (
            <span className="pill pill--pending">{label(SYNC_STATUS_LABELS, bookmark.syncStatus)}</span>
          )}
          {tags ? (
            tags.length > 0 ? (
              tags.map((tag) => (
                <span key={tag.id} className="tag-pill">
                  {tag.name}
                </span>
              ))
            ) : (
              <span className="tag-pill tag-pill-empty">未整理</span>
            )
          ) : null}
        </div>

        <a
          className={`bm-card-domain${source ? ` src-${source}` : ''}`}
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
