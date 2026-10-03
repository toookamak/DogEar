import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { bookmarkSearchIndex, type SearchHit } from '../../search-index.js'
import { Icon } from '../ui/Icon.js'
import type { FolderResponse, TagResponse } from '../../types/api.js'

interface CommandPaletteProps {
  /** 打开某条书签。索引里只有瘦投影，完整对象由调用方按 id 取。 */
  onOpenBookmark: (id: string) => void
  onClose: () => void
  open: boolean
  /**
   * 行内快改（P1b-3，整理台界面稿屏 4 的「结果行内 hover 显形改收藏夹/加标签」）。
   * 面板本身不持有组织数据与写逻辑：选项来自 props，执行交给调用方的批量通道
   * （单条 = 一条的批量，走同一套回执/刷新/入队路径）。
   */
  onQuickEdit?: (id: string, change: { folderId?: string; addTagIds?: string[] }) => void
  folders?: FolderResponse[]
  tags?: TagResponse[]
}

const MAX_RESULTS = 20

interface QuickPick {
  id: string
  title: string
  mode: 'folder' | 'tag'
}

/**
 * ⌘K 命令面板：端侧全量检索（2026-10-02 批次 2）。
 *
 * **行为变更**：此前把 `WorkbenchPage` 当前页的 `bookmarks` 喂给本地 MiniSearch，
 * 于是「搜不到没被翻到过的收藏」——3000 条规模下这是大部分收藏。
 * 现在改读 `bookmarkSearchIndex`（后台预取的瘦投影全量索引），查询零网络往返。
 *
 * 面板必须全程不碰鼠标：↑↓ 选择、Enter 打开、Esc 关闭。
 * 行内快改是鼠标加速器（hover 显形），键盘主路径不变——键盘用户 Enter 打开详情后编辑。
 */
export function CommandPalette({ onOpenBookmark, onClose, open, onQuickEdit, folders = [], tags = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [picker, setPicker] = useState<QuickPick | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const snapshot = useSyncExternalStore(bookmarkSearchIndex.subscribe, bookmarkSearchIndex.getSnapshot)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setPicker(null)
      return
    }
    inputRef.current?.focus()
    // 打开即确保索引就绪：首次是后台预取，之后命中缓存不再请求
    void bookmarkSearchIndex.ensure()
  }, [open])

  useEffect(() => {
    setResults(query.trim() ? bookmarkSearchIndex.search(query, MAX_RESULTS) : [])
    setActiveIndex(0)
  }, [query, snapshot.indexed])

  // 选中项滚入视野，避免键盘移动后看不到高亮
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const commit = useCallback((hit: SearchHit | undefined) => {
    if (!hit) return
    onOpenBookmark(hit.id)
    onClose()
  }, [onOpenBookmark, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // 两层 Esc：先收起行内选择面板，再关整个面板
      if (picker) { setPicker(null); return }
      onClose()
      return
    }
    if (picker) return // 选择面板打开时方向键不驱动结果列表
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
  const indexing = snapshot.state === 'loading' || (snapshot.state === 'idle' && !hasQuery)
  const coverage = snapshot.total ?? snapshot.indexed

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
              输入关键词开始搜索。支持 ↑↓ 选择、Enter 打开。
              {indexing
                ? ` 正在建立本地索引（${snapshot.indexed}${snapshot.total ? ` / ${snapshot.total}` : ''}）…`
                : coverage > 0
                  ? ` 已索引全部 ${coverage.toLocaleString('zh-CN')} 条，检索在本地完成，不走网络。`
                  : ' 检索在本地完成，不走网络。'}
            </p>
          )}

          {hasQuery && results.length === 0 && snapshot.state === 'error' && (
            <p className="palette-hint">索引建立失败：{snapshot.error}。请检查连接后重试。</p>
          )}

          {hasQuery && results.length === 0 && snapshot.state !== 'error' && indexing && (
            <p className="palette-hint">正在建立索引，稍后再试…</p>
          )}

          {hasQuery && results.length === 0 && !indexing && (
            <p className="palette-hint">
              没有匹配「{query.trim()}」的收藏。
              {coverage > 0 ? ` 已搜完本地全部 ${coverage.toLocaleString('zh-CN')} 条。` : ''}
            </p>
          )}

          {picker ? (
            <div className="palette-picker" role="menu" aria-label={picker.mode === 'folder' ? '移入收藏夹' : '添加标签'}>
              <p className="palette-picker-title">
                {picker.mode === 'folder' ? '移入收藏夹' : '添加标签'} · {(picker.title || '').slice(0, 24)}
              </p>
              {picker.mode === 'folder'
                ? folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    role="menuitem"
                    className="palette-picker-option"
                    onClick={() => { onQuickEdit?.(picker.id, { folderId: folder.id }); setPicker(null) }}
                  >
                    {folder.name}
                  </button>
                ))
                : tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    role="menuitem"
                    className="palette-picker-option"
                    onClick={() => { onQuickEdit?.(picker.id, { addTagIds: [tag.id] }); setPicker(null) }}
                  >
                    {tag.name}
                  </button>
                ))}
              {((picker.mode === 'folder' && folders.length === 0) || (picker.mode === 'tag' && tags.length === 0)) && (
                <p className="palette-picker-title">还没有可选项，先到「组织管理」新建。</p>
              )}
              <button type="button" className="palette-picker-option palette-picker-option--cancel" onClick={() => setPicker(null)}>
                取消（Esc）
              </button>
            </div>
          ) : (
            results.map((hit, index) => (
              <div
                key={hit.id}
                role="option"
                aria-selected={index === activeIndex}
                data-index={index}
                className={`palette-item${index === activeIndex ? ' palette-item--active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {/* 主命中区仍是打开动作；行内快改是 hover 显形的鼠标加速器（界面稿屏 4） */}
                <button
                  type="button"
                  tabIndex={-1}
                  className="palette-item-hit"
                  onClick={() => commit(hit)}
                >
                  <span className="palette-item-main">
                    <span className="palette-item-title">{hit.title || hit.url}</span>
                    <span className="palette-item-meta">
                      {hit.domain ?? ''}
                      {hit.folderName ? ` · ${hit.folderName}` : ''}
                      {hit.tagNames.length > 0 ? ` · ${hit.tagNames.map((tag) => `#${tag}`).join(' ')}` : ''}
                    </span>
                  </span>
                </button>
                {onQuickEdit && (
                  <span className="palette-item-acts">
                    <button type="button" className="mini-btn" title="移入收藏夹" onClick={() => setPicker({ id: hit.id, title: hit.title, mode: 'folder' })}>
                      改收藏夹
                    </button>
                    <button type="button" className="mini-btn" title="添加标签" onClick={() => setPicker({ id: hit.id, title: hit.title, mode: 'tag' })}>
                      加标签
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
