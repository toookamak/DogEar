import { useRef, useState } from 'react'
import type { BookmarkResponse } from '../../types/api.js'

type Status = 'unread' | 'saved' | 'archived'

interface Props {
  bookmarks: BookmarkResponse[]
  activeId: string | null
  onOpen: (bookmark: BookmarkResponse) => void
  /** 拖拽到其他分栏后改状态 */
  onMoveStatus: (id: string, status: Status) => void
}

const COLUMNS: { key: Status; label: string }[] = [
  { key: 'unread', label: '待处理' },
  { key: 'saved', label: '已确认' },
  { key: 'archived', label: '搁置' },
]

interface DragState {
  id: string
  x: number
  y: number
  over: Status | null
}

/**
 * 看板视图：三列对应三种状态，卡片可拖拽跨列改状态。
 * 用 Pointer Events + setPointerCapture 实现，触摸与鼠标同一套逻辑。
 */
export function BookmarkBoardView({ bookmarks, activeId, onOpen, onMoveStatus }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  // 拖动结束后应抑制一次 click，避免「拖完又打开详情」
  const draggedRef = useRef(false)

  const columnOf = (status: Status) => bookmarks.filter((b) => b.status === status)

  const statusAt = (x: number, y: number): Status | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-col]')
    const value = el?.getAttribute('data-col')
    return value === 'unread' || value === 'saved' || value === 'archived' ? value : null
  }

  const onPointerDown = (event: React.PointerEvent, bookmark: BookmarkResponse) => {
    if (event.button !== 0) return
    draggedRef.current = false
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    setDrag({ id: bookmark.id, x: event.clientX, y: event.clientY, over: bookmark.status })
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return
    // 超过阈值才算拖动，避免把普通点击当成拖拽
    if (Math.abs(event.clientX - drag.x) > 4 || Math.abs(event.clientY - drag.y) > 4) {
      draggedRef.current = true
    }
    setDrag({ ...drag, x: event.clientX, y: event.clientY, over: statusAt(event.clientX, event.clientY) })
  }

  const onPointerUp = (event: React.PointerEvent, bookmark: BookmarkResponse) => {
    if (!drag) return
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    const target = statusAt(event.clientX, event.clientY)
    if (draggedRef.current && target && target !== bookmark.status) {
      onMoveStatus(bookmark.id, target)
    }
    setDrag(null)
  }

  const dragging = drag ? bookmarks.find((b) => b.id === drag.id) : null

  return (
    <div className="bm-board">
      {COLUMNS.map((col) => {
        const items = columnOf(col.key)
        return (
          <section
            key={col.key}
            className={`bm-board-col${drag?.over === col.key ? ' bm-board-col--over' : ''}`}
            data-col={col.key}
            aria-label={`${col.label}分栏`}
          >
            <header className="bm-board-col-head">
              <h3 className="bm-board-col-title">{col.label}</h3>
              <span className="bm-board-col-count">{items.length}</span>
            </header>

            <div className="bm-board-cards">
              {items.map((bookmark) => (
                <article
                  key={bookmark.id}
                  tabIndex={0}
                  className={`bm-board-card${activeId === bookmark.id ? ' bm-board-card--active' : ''}${drag?.id === bookmark.id ? ' bm-board-card--dragging' : ''}`}
                  aria-label={`${bookmark.title || bookmark.url}（打开详情）`}
                  onClick={() => {
                    if (draggedRef.current) { draggedRef.current = false; return }
                    onOpen(bookmark)
                  }}
                  // 键盘可达：拖拽是鼠标/触摸的快捷方式，键盘用户走 Enter 打开详情后改状态
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpen(bookmark)
                    }
                  }}
                  onPointerDown={(event) => onPointerDown(event, bookmark)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(event) => onPointerUp(event, bookmark)}
                  onPointerCancel={() => setDrag(null)}
                  title={`${bookmark.title || bookmark.url} · 拖拽到其他分栏可改状态（键盘：Enter 打开详情后改）`}
                >
                  <span className="bm-board-card-title">{bookmark.title || bookmark.url}</span>
                  <span className="bm-board-card-domain">{bookmark.domain ?? ''}</span>
                </article>
              ))}
              {items.length === 0 && <p className="bm-board-empty">拖拽书签到这里</p>}
            </div>
          </section>
        )
      })}

      {dragging && drag && (
        <div className="bm-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {dragging.title || dragging.url}
        </div>
      )}
    </div>
  )
}
