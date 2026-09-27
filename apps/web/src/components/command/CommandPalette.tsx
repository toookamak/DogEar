import { useState, useEffect, useRef, useCallback } from 'react'
import MiniSearch from 'minisearch'
import type { BookmarkResponse } from '../../types/api.js'
import { SYNC_STATUS_LABELS, label } from '../../utils/format.js'
import { Icon } from '../ui/Icon.js'

interface CommandPaletteProps {
  bookmarks: BookmarkResponse[]
  onSelect: (bookmark: BookmarkResponse) => void
  onClose: () => void
  open: boolean
}

const MAX_RESULTS = 20

/**
 * ⌘K 命令面板：端侧 MiniSearch 检索（标题 / URL / 备注 / 标签）。
 * 支持键盘操作：↑↓ 移动、Enter 打开、Esc 关闭——命令面板必须能全程不碰鼠标。
 */
export function CommandPalette({ bookmarks, onSelect, onClose, open }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookmarkResponse[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const miniSearchRef = useRef<MiniSearch | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      return
    }
    inputRef.current?.focus()

    const miniSearch = new MiniSearch({
      fields: ['title', 'url', 'note', 'tagText'],
      storeFields: ['id'],
      searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true },
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
      setActiveIndex(0)
      return
    }
    const ranked = miniSearchRef.current.search(query).map((r) => String(r.id))
    const byId = new Map(bookmarks.map((b) => [b.id, b]))
    setResults(ranked.map((id) => byId.get(id)).filter(Boolean).slice(0, MAX_RESULTS) as BookmarkResponse[])
    setActiveIndex(0)
  }, [query, bookmarks])

  // 选中项滚入视野，避免键盘移动后看不到高亮
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const commit = useCallback((bookmark: BookmarkResponse | undefined) => {
    if (!bookmark) return
    onSelect(bookmark)
    onClose()
  }, [onSelect, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(results[activeIndex])
    }
  }

  if (!open) return null

  const hasQuery = query.trim().length > 0

  return (
    <div className="palette-layer" role="dialog" aria-modal="true" aria-label="搜索书签">
      <button type="button" className="palette-scrim" aria-label="关闭搜索" onClick={onClose} />
      <div className="palette">
        <div className="palette-input-row">
          <span className="palette-icon" aria-hidden="true"><Icon name="search" /></span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索标题、网址、备注或标签…"
            className="palette-input"
            aria-label="搜索书签"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="palette-results"
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        <div className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {!hasQuery && (
            <p className="palette-hint">
              输入关键词开始搜索。支持 ↑↓ 选择、Enter 打开。检索在本地完成，不走网络。
            </p>
          )}

          {hasQuery && results.length === 0 && (
            <p className="palette-hint">无匹配结果。当前只检索已加载的书签（{bookmarks.length} 条）。</p>
          )}

          {results.map((bookmark, index) => (
            <button
              key={bookmark.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              data-index={index}
              className={`palette-item${index === activeIndex ? ' palette-item--active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(bookmark)}
            >
              {bookmark.favicon && <img className="palette-item-fav" src={bookmark.favicon} alt="" loading="lazy" />}
              <span className="palette-item-main">
                <span className="palette-item-title">{bookmark.title || bookmark.url}</span>
                <span className="palette-item-meta">
                  {bookmark.domain ?? ''}
                  {bookmark.syncStatus === 'pending' ? ` · ${label(SYNC_STATUS_LABELS, bookmark.syncStatus)}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
