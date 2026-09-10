import type { BookmarkResponse } from '../../types/api.js'
import { BookmarkCard } from './BookmarkCard.js'

interface Props {
  bookmarks: BookmarkResponse[]
  activeId: string | null
  selectedIds: Set<string>
  onOpen: (bookmark: BookmarkResponse) => void
  onToggleSelect: (id: string) => void
}

/** 网格视图：卡片网格，信息密度中等 */
export function BookmarkGridView({ bookmarks, activeId, selectedIds, onOpen, onToggleSelect }: Props) {
  return (
    <div className="bm-grid">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          active={activeId === bookmark.id}
          selected={selectedIds.has(bookmark.id)}
          selectable
          onClick={() => onOpen(bookmark)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )
}
