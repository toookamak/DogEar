import { useEffect, useState } from 'react'
import { syncApi } from '../../api/sync.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { onUndoOffered, notifyDataChanged, type UndoNotice } from '../../undo.js'

/**
 * 状态栏：同步状态与撤销入口。
 * 「待同步 N」取自 /api/sync/pending-count（sync_queue 的 pending 计数）——正式后端里
 * 「未推送数」与「队列长度」是同一数据源，故合并为一项，不重复展示。
 * 条/秒、时延、成功率、429 等指标后端暂无接口，本轮不展示
 * （见 docs/modules/20260910_工作台外壳屏稿.md §4）。
 */
export function StatusBar() {
  const [pendingCount, setPendingCount] = useState(0)
  const [undo, setUndo] = useState<UndoNotice | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { pendingCount: count } = await syncApi.pendingCount()
        if (!cancelled) setPendingCount(count)
      } catch { /* 状态栏不因取数失败而中断 */ }
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
      notifyDataChanged()
    } catch {
      setUndo(null)
    }
  }

  return (
    <footer className="statusbar">
      <div className="statusbar-group">
        <span className="statusbar-item">待同步 {pendingCount}</span>
      </div>

      {undo && (
        <div className="statusbar-group statusbar-spacer">
          <button
            type="button"
            className="btn btn--pill statusbar-undo"
            onClick={handleUndo}
          >
            撤销：{undo.message}
          </button>
        </div>
      )}
    </footer>
  )
}
