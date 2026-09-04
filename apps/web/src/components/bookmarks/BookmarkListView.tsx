import type { BookmarkResponse } from '../../types/api.js'
import { BookmarkCard } from './BookmarkCard.js'

interface BookmarkListViewProps {
  bookmarks: BookmarkResponse[]
  onSelect: (bookmark: BookmarkResponse) => void
  viewMode: 'list' | 'grid'
}

export function BookmarkListView({ bookmarks, onSelect, viewMode }: BookmarkListViewProps) {
  if (viewMode === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
        {bookmarks.map((b) => (
          <BookmarkCard key={b.id} bookmark={b} onClick={() => onSelect(b)} selected={false} />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 'var(--spacing-12)',
    }}>
      {bookmarks.map((b) => (
        <BookmarkCard key={b.id} bookmark={b} onClick={() => onSelect(b)} selected={false} />
      ))}
    </div>
  )
}