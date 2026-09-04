import type { BookmarkResponse } from '../../types/api.js'
import { BookmarkCard } from './BookmarkCard.js'

interface BookmarkListViewProps {
  bookmarks: BookmarkResponse[]
  onSelect: (bookmark: BookmarkResponse) => void
  viewMode: 'list' | 'grid'
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function BookmarkListView({ bookmarks, onSelect, viewMode, selectedIds, onToggleSelect }: BookmarkListViewProps) {
  const selectable = Boolean(onToggleSelect)
  const card = (b: BookmarkResponse) => (
    <BookmarkCard
      key={b.id}
      bookmark={b}
      onClick={() => onSelect(b)}
      selected={selectedIds?.has(b.id)}
      selectable={selectable}
      onToggleSelect={onToggleSelect}
    />
  )
  if (viewMode === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
        {bookmarks.map(card)}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 'var(--spacing-12)',
    }}>
      {bookmarks.map(card)}
    </div>
  )
}