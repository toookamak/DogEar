import { useCallback, useEffect, useState } from 'react'
import { syncApi } from '../../api/sync.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { onUndoOffered, notifyDataChanged, type UndoNotice } from '../../undo.js'

/**
 * 状态栏：同步状态与撤销入口。
 * 「待同步 N」取自 /api/sync/pending-count（sync_queue 的 pending 计数）——正式后端里
 * 「未推送数」与「队列长度」是同一数据源，故合并为一项，不重复展示。
 * 条/秒、时延、成功率、429 等指标后端暂无接口，本轮不展示
 * （见 docs/modules/20260910_工作台外壳屏稿.md §4）。
 *
 * 失败不再静默：取数失败时显式提示并可重试（原型 StatusBar 有同样的重试入口）。
 * 此前失败被 catch 吞掉，用户只看到「待同步 0」，会把「取不到」误读成「没有待同步」。
 */
export function StatusBar() {
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [syncError, setSyncError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [undo, setUndo] = useState<UndoNotice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { pendingCount: count } = await syncApi.pendingCount()
      setPendingCount(count)
      setSyncError(false)
    } catch {
      setSyncError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => { if (!cancelled) await load() })()
    const interval = setInterval(() => { void load() }, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [load])

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
        {syncError ? (
          <>
            <span className="statusbar-item statusbar-item--error">同步状态读取失败</span>
            <button
              type="button"
              className="btn btn--pill statusbar-undo"
              disabled={loading}
              onClick={() => { void load() }}
            >
              {loading ? '重试中…' : '重试'}
            </button>
          </>
        ) : (
          <span className="statusbar-item">
            待同步 {pendingCount ?? '—'}
          </span>
        )}
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
