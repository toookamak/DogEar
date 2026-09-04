import type { BookmarkResponse } from '../../types/api.js'

interface BookmarkCardProps {
  bookmark: BookmarkResponse
  onClick: () => void
  selected?: boolean
  selectable?: boolean
  onToggleSelect?: (id: string) => void
}

export function BookmarkCard({ bookmark, onClick, selected, selectable, onToggleSelect }: BookmarkCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--color-bg-surface-500)' : 'var(--color-bg-surface-400)',
        border: `1px solid ${selected ? 'var(--border-medium)' : 'var(--border-primary)'}`,
        borderRadius: 'var(--radius-comfortable)',
        padding: 'var(--spacing-12)',
        cursor: 'pointer',
        transition: 'background 150ms ease',
      }}
    >
      {bookmark.favicon && (
        <img
          src={bookmark.favicon}
          alt=""
          style={{
            width: '16px',
            height: '16px',
            display: 'inline-block',
            verticalAlign: 'middle',
            marginRight: 'var(--spacing-8)',
            borderRadius: 'var(--radius-small)',
          }}
        />
      )}
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggleSelect?.(bookmark.id)}
          style={{ marginRight: 'var(--spacing-8)', verticalAlign: 'middle' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: '500',
          margin: 0,
          color: 'var(--color-text-primary)',
          lineHeight: '1.3',
        }}>
          {bookmark.title || bookmark.url}
        </h3>
        {bookmark.note && (
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            lineClamp: 2,
          }}>
            {bookmark.note}
          </p>
        )}
        {bookmark.domain && (
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            margin: 0,
          }}>
            {bookmark.domain}
          </div>
        )}
      </div>
    </div>
  )
}