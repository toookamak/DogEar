import { useEffect, useState, useSyncExternalStore } from 'react'
import { bookmarksApi } from '../../api/bookmarks.js'
import {
  getExportProgress,
  getImportProgress,
  subscribeExportProgress,
  subscribeImportProgress,
} from '../../channel-tasks.js'
import { onUndoOffered, notifyDataChanged, type UndoNotice } from '../../undo.js'

/**
 * 状态栏：只承担「瞬时任务」——通道导入 / 导出进度与撤销入口；没有瞬时任务时基本是空的。
 *
 * 同步状态与拉取 / 推送已于 2026-09-27 迁到顶栏右上角的同步胶囊
 * （components/layout/SyncCapsule.tsx）。原因有两条：
 * 1. 状态栏在 28px 的最下沿，是离主视线最远的位置，重要状态不该放这里；
 * 2. 顶栏已有常驻状态区，两边各放一个同步入口属同屏重复
 *    （与「顶栏和工作台各有一个添加书签」是同一类问题）。
 * 屏稿记录见 docs/modules/20260927_同步状态卡片屏稿.md v1.1。
 */
export function StatusBar() {
  const [undo, setUndo] = useState<UndoNotice | null>(null)
  const importProgress = useSyncExternalStore(subscribeImportProgress, getImportProgress)
  const exportProgress = useSyncExternalStore(subscribeExportProgress, getExportProgress)
  const importRunning = importProgress.status === 'running'
  const exportRunning = exportProgress.status === 'running'

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
      {(importRunning || exportRunning) && (
        <div className="statusbar-group">
          {importRunning && (
            <span className="statusbar-item statusbar-item--accent">
              导入中 {importProgress.okCount}{importProgress.total ? ` / ${importProgress.total}` : ''} 条（第 {importProgress.rounds + 1} 页）
            </span>
          )}
          {exportRunning && (
            <span className="statusbar-item statusbar-item--accent">
              导出中 {exportProgress.okCount}{exportProgress.total ? ` / ${exportProgress.total}` : ''} 条
            </span>
          )}
        </div>
      )}

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
