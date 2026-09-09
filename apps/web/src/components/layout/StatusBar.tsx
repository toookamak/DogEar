import { useEffect, useState } from 'react'
import { syncApi } from '../../api/sync.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { onUndoOffered, type UndoNotice } from '../../undo.js'

export function StatusBar() {
  const [pendingCount, setPendingCount] = useState(0)
  const [undo, setUndo] = useState<UndoNotice | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { pendingCount: count } = await syncApi.pendingCount()
        if (!cancelled) setPendingCount(count)
      } catch { /* ignore */ }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => onUndoOffered((notice) => {
    setUndo(notice)
    window.setTimeout(() => setUndo((current) => current?.undoId === notice.undoId ? null : current), 15000)
  }), [])

  const handleUndo = async () => {
    if (!undo) return
    try {
      await bookmarksApi.revert(undo.undoId)
      setUndo(null)
      window.location.reload()
    } catch {
      setUndo(null)
    }
  }

  return (
    <footer style={{
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--spacing-12)',
      borderTop: '1px solid var(--border-primary)',
      background: 'var(--color-bg-page)',
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      color: 'var(--color-text-muted)',
    }}>
      <span>未推送 {pendingCount}</span>
      {undo && (
        <button
          type="button"
          onClick={handleUndo}
          className="btn-secondary-pill"
          style={{ height: '18px', fontSize: '11px', padding: '0 var(--spacing-8)' }}
        >
          撤销：{undo.message}
        </button>
      )}
    </footer>
  )
}
