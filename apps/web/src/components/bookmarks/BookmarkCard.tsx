import { useEffect, useState } from 'react'
import type { BookmarkResponse } from '../../types/api.js'
import { resolveCoverUrl } from '../../utils/cover-url.js'
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  SYNC_STATUS_LABELS,
  formatDateShort,
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
 * 书签卡片（方案 A · 封面主导，2026-09-27 确认稿见 docs/modules/grid-card-structure-options.html）：
 * 大封面区（有 cover 显示封面图，否则来源色渐变 + 斜纹 + 衬线水印）+
 * 顶部信息层（选择键 / 域名 chip / 状态徽标）+ 左下来源点；
 * 正文为两行标题、两行简介与「AI 建议 / 重要 / 私密 / 待推送 + 标签 + 日期」脚注。
 * 原「来源条 + 独立域名按钮」的纵向三段式已合并：域名 chip 兼任打开原文入口。
 * 防御性缺省：导航页传入 NavItem 投影（无 source/status/tags/createdAt 等），
 * 缺字段时对应区块不渲染——不得因缺字段崩溃（2026-09-12 导航页白屏回归的修复口径延续）。
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
  // 封面水印与 chip 图标的单字：优先域名首字母，缺省回落标题
  const mark = (domain || title).charAt(0).toUpperCase()
  const excerpt = bookmark.excerpt ?? bookmark.note ?? ''
  // source/status 缺省时不渲染来源点与状态徽标——导航投影不含这两个字段，
  // 用缺省值展示会误导（例如把已收藏条目显示成「待处理」）。
  const source = bookmark.source
  const status = bookmark.status
  // tags 为 undefined（投影未返回）时不显示标签区；空数组才是真实的「未整理」
  const tags = bookmark.tags
  const pendingSuggestions = bookmark.pendingSuggestionCount ?? 0
  const remoteCover = resolveCoverUrl(bookmark.cover, bookmark.url)
  const proxyCover = `/api/bookmarks/${bookmark.id}/cover`
  // 有封面地址一律走同源 /cover：命中 R2/本地缓存，未命中再回源并落下
  const [coverSrc, setCoverSrc] = useState<string | null>(remoteCover ? proxyCover : null)
  const [coverBroken, setCoverBroken] = useState(false)
  useEffect(() => {
    setCoverSrc(remoteCover ? proxyCover : null)
    setCoverBroken(false)
  }, [remoteCover, proxyCover, bookmark.id])
  const showCover = Boolean(coverSrc) && !coverBroken
  // NavItem 投影无 createdAt（类型上必有、运行时可能缺）；无值时不渲染日期
  const day = typeof bookmark.createdAt === 'number' ? formatDateShort(bookmark.createdAt) : ''
  // 脚注区五类内容全空时不渲染，避免导航页出现只剩一条空行
  const hasFootMeta =
    pendingSuggestions > 0 ||
    Boolean(bookmark.important) ||
    Boolean(bookmark.private) ||
    bookmark.syncStatus === 'pending' ||
    tags !== undefined ||
    Boolean(day)

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
      <div
        className={`bm-card-cover${source ? ` src-${source}` : ''}${showCover ? ' bm-card-cover--photo' : ''}`}
        data-mark={showCover ? undefined : mark}
        aria-hidden="true"
      >
        {showCover && coverSrc && (
          <img
            className="bm-card-thumb"
            src={coverSrc}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              if (coverSrc !== proxyCover) setCoverSrc(proxyCover)
              else setCoverBroken(true)
            }}
          />
        )}

        {/* 封面四角各自锚定：选择键左上、状态徽标右上、来源点左下、域名 chip 右下。
            此前四者同处一个 flex 行，选择键一出现就把域名右推约 24px ——
            现在四者各自定位，选择键出现或消失都不改变域名位置。 */}
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

        {status && (
          <span className={`bm-card-flag state-${status}`}>
            {label(STATUS_LABELS, status)}
          </span>
        )}

        <div className="bm-card-bottom">
          {source && (
            <span className={`bm-card-srcdot srcdot-${source}`}>
              <span className="srcdot-label">{label(SOURCE_LABELS, source)}</span>
            </span>
          )}
          {/* 域名 chip：兼任「打开原链接」入口（替代原独立域名按钮行） */}
          <a
            className={`bm-card-chip${source ? ` src-${source}` : ''}`}
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="打开原链接"
            title="打开原链接"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="chip-ico">
              {bookmark.favicon ? <img src={bookmark.favicon} alt="" loading="lazy" /> : mark}
            </span>
            <span className="chip-dom">{domain}</span>
          </a>
        </div>
      </div>

      <div className="bm-card-body">
        <h3 className="bm-card-title">{title}</h3>
        {excerpt && <p className="bm-card-excerpt">{excerpt}</p>}

        {hasFootMeta && (
          <div className="bm-card-foot">
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
            {day && <span className="bm-card-date">{day}</span>}
          </div>
        )}
      </div>
    </article>
  )
}
