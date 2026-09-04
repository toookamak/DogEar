import { useState, useEffect, useRef, useCallback } from 'react'
import MiniSearch from 'minisearch'
import type { BookmarkResponse } from '../../types/api.js'

interface CommandPaletteProps {
  bookmarks: BookmarkResponse[]
  onSelect: (bookmark: BookmarkResponse) => void
  onClose: () => void
  open: boolean
}

export function CommandPalette({ bookmarks, onSelect, onClose, open }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookmarkResponse[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const miniSearchRef = useRef<MiniSearch | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      return
    }
    inputRef.current?.focus()

    const miniSearch = new MiniSearch({
      fields: ['title', 'url', 'note', 'tagText'],
      storeFields: ['id', 'title', 'url', 'note', 'domain', 'favicon'],
      searchOptions: { boost: { title: 2 }, fuzzy: 0.2 },
    })
    miniSearch.addAll(bookmarks.map((bookmark) => ({
      ...bookmark,
      tagText: (bookmark.tags || []).map((tag) => tag.name).join(' '),
    })))
    miniSearchRef.current = miniSearch
  }, [open, bookmarks])

  useEffect(() => {
    if (!query.trim() || !miniSearchRef.current) {
      setResults([])
      return
    }
    const raw = miniSearchRef.current.search(query)
    const ids = new Set(raw.map((r: { id: string }) => r.id))
    setResults(bookmarks.filter((b) => ids.has(b.id)))
  }, [query, bookmarks])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0, 0, 0, 0.3)',
      display: 'flex', justifyContent: 'center', paddingTop: '80px',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-bg-surface-400)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-comfortable)',
        boxShadow: 'var(--shadow-card)',
        width: 'min(500px, 90vw)',
        maxHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
      }} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索书签..."
          className="input"
          style={{
            margin: 'var(--spacing-8)',
            padding: 'var(--spacing-10) var(--spacing-12)',
            fontSize: '16px',
          }}
        />
        <div style={{ overflow: 'auto', flex: 1 }}>
          {results.length === 0 && query.trim() && (
            <div style={{ padding: 'var(--spacing-16)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              无结果
            </div>
          )}
          {results.map((b) => (
            <div
              key={b.id}
              onClick={() => { onSelect(b); onClose() }}
              style={{
                padding: 'var(--spacing-8) var(--spacing-12)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-primary)',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-surface-500)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500 }}>{b.title || b.url}</div>
              {b.domain && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{b.domain}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}