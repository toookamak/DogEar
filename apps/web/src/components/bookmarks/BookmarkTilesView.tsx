import { useState } from 'react'
import type { BookmarkResponse } from '../../types/api.js'
import { STATUS_LABELS, SOURCE_LABELS, formatDateShort, label } from '../../utils/format.js'

interface Props {
  bookmarks: BookmarkResponse[]
  activeId: string | null
  onOpen: (bookmark: BookmarkResponse) => void
}

type IconStep = 0 | 1 | 2

// favicon 两级降级：站点自身 → DuckDuckGo 图标服务 → 首字母
const STEP_URLS: ((domain: string) => string)[] = [
  (domain) => `https://${domain}/favicon.ico`,
  (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
]

/**
 * 标签视图（方案 B · 索引卡，2026-09-27 确认稿见 docs/modules/grid-card-structure-options.html）：
 * 头部为站点图标 + mono 域名（点击开原文，替代原独立 ↗ 按钮）+ 状态点；
 * 标题两行 + 一行简介；底栏（浮起面）为标签 / 来源 / 日期。
 * 无预览区，密度优先；结构与网格卡的封面区解耦，两视图互不影响。
 */
export function BookmarkTilesView({ bookmarks, activeId, onOpen }: Props) {
  const [steps, setSteps] = useState<Record<string, IconStep>>({})

  const advance = (id: string) => {
    setSteps((prev) => {
      const step = prev[id] ?? 0
      if (step >= 2) return prev
      return { ...prev, [id]: (step + 1) as IconStep }
    })
  }

  return (
    <div className="bm-tiles" role="list">
      {bookmarks.map((bookmark) => {
        const step = steps[bookmark.id] ?? 0
        const useFallback = step >= 2 || !bookmark.domain
        const initial = (bookmark.title || bookmark.url || '?').trim().charAt(0).toUpperCase()
        // 展示层兜底：domain 为可空字段时从 URL 取主机名
        const domain = bookmark.domain ?? bookmark.url.replace(/^https?:\/\//, '').split('/')[0]
        const day = formatDateShort(bookmark.createdAt)
        const hasMeta = Boolean(bookmark.source) || Boolean(day) || bookmark.tags !== undefined
        return (
          <article
            key={bookmark.id}
            role="listitem"
            tabIndex={0}
            className={`bm-tile${activeId === bookmark.id ? ' bm-tile--active' : ''}`}
            onClick={() => onOpen(bookmark)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(bookmark)
              }
            }}
            aria-label={`${bookmark.title || bookmark.url}（打开详情）`}
          >
            <span className="bm-tile-head">
              <span className={`bm-tile-icon${bookmark.source ? ` src-${bookmark.source}` : ''}`}>
                {useFallback ? (
                  <span className="bm-tile-initial">{initial}</span>
                ) : (
                  <img
                    className="bm-tile-fav"
                    alt=""
                    loading="lazy"
                    src={STEP_URLS[step](bookmark.domain as string)}
                    onError={() => advance(bookmark.id)}
                  />
                )}
              </span>
              <a
                className="bm-tile-dom"
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`打开 ${bookmark.title || bookmark.url}`}
                title="打开原网页"
                onClick={(event) => event.stopPropagation()}
              >
                {domain}
              </a>
              {bookmark.status && (
                <span
                  className={`bm-tile-dot state-${bookmark.status}`}
                  title={label(STATUS_LABELS, bookmark.status)}
                />
              )}
            </span>
            <span className="bm-tile-title">{bookmark.title || bookmark.url}</span>
            {bookmark.excerpt && <span className="bm-tile-sub">{bookmark.excerpt}</span>}
            {hasMeta && (
              <span className="bm-tile-foot">
                {bookmark.tags ? (
                  <span className="bm-tile-tags">
                    {bookmark.tags.length > 0 ? (
                      bookmark.tags.map((tag) => (
                        <span key={tag.id} className="tag-pill">
                          {tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="tag-pill tag-pill-empty">未整理</span>
                    )}
                  </span>
                ) : null}
                <span className="bm-tile-foot-end">
                  {bookmark.source && (
                    <span className={`bm-tile-srclabel src-${bookmark.source}`}>
                      {label(SOURCE_LABELS, bookmark.source)}
                    </span>
                  )}
                  {day && <span className="bm-tile-date">{day}</span>}
                </span>
              </span>
            )}
          </article>
        )
      })}
    </div>
  )
}
