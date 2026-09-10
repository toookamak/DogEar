import { useState } from 'react'
import type { BookmarkResponse } from '../../types/api.js'

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

/** 标签视图：以站点图标为主的紧凑卡片，用于快速辨认站点 */
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
              <span className="bm-tile-icon">
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
              <span className="bm-tile-title">{bookmark.title || bookmark.url}</span>
              <a
                className="bm-tile-go"
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`打开 ${bookmark.title || bookmark.url}`}
                title="打开原网页"
                onClick={(event) => event.stopPropagation()}
              >
                ↗
              </a>
            </span>
            {bookmark.excerpt && <span className="bm-tile-sub">{bookmark.excerpt}</span>}
          </article>
        )
      })}
    </div>
  )
}
