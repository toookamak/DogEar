import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'wouter'
import { syncApi, type SyncStatusResponse } from '../../api/sync.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { getExportProgress, getImportProgress, subscribeExportProgress, subscribeImportProgress } from '../../channel-tasks.js'
import { onUndoOffered, notifyDataChanged, type UndoNotice } from '../../undo.js'
import { toast, errorMessage } from '../../toast.js'
import { formatAgo } from '../../utils/format.js'

/**
 * 状态栏：同步状态、通道任务进度与撤销入口。
 *
 * 同步卡片（20260927 屏稿）：状态栏的「待同步 N」可点击，向上弹出同步状态卡片
 * （待推送 / 推送失败 / 待处理冲突 / 上次推送·拉取时间），并提供「拉取」「推送」按钮：
 * - 拉取：单页低频拉回（50 条，防 Raindrop 风控），与设置页「拉取」同语义；
 * - 推送：循环调 /api/sync/process（每轮 10 条）清空积压，20 轮上限（约 200 条）。
 * 数据源为聚合接口 /api/sync/status，替代此前前端对 pending-count 的单独探测。
 *
 * 「待同步 N」= sync_queue pending 计数——正式后端里「未推送数」与「队列长度」
 * 是同一数据源，故合并为一项。条/秒、时延、成功率、429 等指标后端暂无接口，
 * 本轮不展示（见 docs/modules/20260910_工作台外壳屏稿.md §4）。
 *
 * 失败不再静默：取数失败时显式提示并可重试。此前失败被 catch 吞掉，用户只看到
 * 「待同步 0」，会把「取不到」误读成「没有待同步」。
 */

/** 推送循环上限：每轮服务端消费 10 条，20 轮 ≈ 200 条，防长时间占用与 Raindrop 风控 */
const PUSH_MAX_ROUNDS = 20

export function StatusBar() {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null)
  const [syncError, setSyncError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [busy, setBusy] = useState<'pull' | 'push' | null>(null)
  const [pushRound, setPushRound] = useState(0)
  const [undo, setUndo] = useState<UndoNotice | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [, setLocation] = useLocation()
  const importProgress = useSyncExternalStore(subscribeImportProgress, getImportProgress)
  const exportProgress = useSyncExternalStore(subscribeExportProgress, getExportProgress)
  const importRunning = importProgress.status === 'running'
  const exportRunning = exportProgress.status === 'running'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await syncApi.status())
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

  // 卡片打开时点击外部收起（mousedown 先于 click，避免「点开又立刻关上」）
  useEffect(() => {
    if (!cardOpen) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setCardOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [cardOpen])

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

  /** 拉取：单页低频拉回；文案与设置页 ChannelManager 的「拉取」保持一致 */
  const handlePull = async () => {
    setBusy('pull')
    try {
      const summary = await syncApi.pull()
      const parts = [`新增 ${summary.created} 条`]
      if (summary.conflicts > 0) parts.push(`${summary.conflicts} 条冲突待处理（下方「管理冲突」）`)
      if (summary.hasMore) parts.push('远端还有更多，可再次拉取')
      if (summary.created > 0 || summary.conflicts > 0) {
        toast.success(`拉取完成：${parts.join('，')}`)
        // 新增了书签就让列表刷新，否则用户拉完看不到新内容
        if (summary.created > 0) notifyDataChanged()
      } else {
        toast.info('拉取完成：远端没有新内容')
      }
      await load()
    } catch (e) {
      toast.error(errorMessage(e, '拉取失败'))
    }
    setBusy(null)
  }

  /**
   * 推送：循环消费直到清空。三个停止条件：
   * remaining === 0（清完）/ 达轮数上限 / 本轮没有实际处理（剩余全是退避未到期的
   * 失败项，继续只会空转）。
   */
  const handlePush = async () => {
    setBusy('push')
    let totalSucceeded = 0
    let totalFailed = 0
    let remaining = 0
    try {
      for (let round = 1; round <= PUSH_MAX_ROUNDS; round++) {
        setPushRound(round)
        const summary = await syncApi.process()
        totalSucceeded += summary.succeeded
        totalFailed += summary.failed
        remaining = summary.remaining
        if (summary.remaining === 0) break
        if (summary.processed === 0) break
      }
      if (totalSucceeded + totalFailed === 0) toast.info('没有可推送的条目')
      else {
        const parts = [`成功 ${totalSucceeded}`]
        if (totalFailed > 0) parts.push(`失败 ${totalFailed}（将按退避自动重试）`)
        if (remaining > 0) parts.push(`剩余 ${remaining} 条未到重试时机`)
        toast[totalFailed > 0 ? 'info' : 'success'](`推送完成：${parts.join('，')}`)
      }
      await load()
    } catch (e) {
      toast.error(errorMessage(e, '推送失败'))
    }
    setPushRound(0)
    setBusy(null)
  }

  const pendingPush = status?.pendingPush ?? null
  const failedPush = status?.failedPush ?? 0
  const pendingConflicts = status?.pendingConflicts ?? 0

  return (
    <footer className="statusbar">
      <div className="statusbar-group" ref={rootRef}>
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
          <>
            <button
              type="button"
              className="statusbar-item statusbar-sync"
              aria-expanded={cardOpen}
              title="同步状态与拉取 / 推送"
              onClick={() => setCardOpen((v) => !v)}
            >
              待同步 {pendingPush ?? '—'}
              {failedPush > 0 && <span className="statusbar-sync-fail"> 失败 {failedPush}</span>}
            </button>
            {cardOpen && status && (
              <div className="sync-card" role="dialog" aria-label="同步状态">
                <div className="sync-card-title">Raindrop 同步</div>
                <div className="sync-card-rows">
                  <span>待推送 <b>{status.pendingPush}</b></span>
                  <span className={status.failedPush > 0 ? 'sync-card-fail' : undefined}>
                    推送失败 <b>{status.failedPush}</b>
                  </span>
                  <span className={status.pendingConflicts > 0 ? 'sync-card-warn' : undefined}>
                    待处理冲突 <b>{status.pendingConflicts}</b>
                  </span>
                </div>
                {status.failedPush > 0 && (
                  <p className="sync-card-hint">失败条目按退避自动重试（最多 8 次），超限后需人工排查</p>
                )}
                <div className="sync-card-times">
                  <span>上次推送 {formatAgo(status.lastPushAt)}</span>
                  <span>上次拉取 {formatAgo(status.lastPullAt)}</span>
                </div>
                <div className="sync-card-actions">
                  <button
                    type="button"
                    className="btn btn--pill"
                    disabled={busy !== null}
                    onClick={() => { void handlePull() }}
                  >
                    {busy === 'pull' ? '拉取中…' : '拉取'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--pill btn--primary"
                    disabled={busy !== null}
                    onClick={() => { void handlePush() }}
                  >
                    {busy === 'push' ? `推送中（第 ${pushRound} 轮）` : '推送'}
                  </button>
                  {status.pendingConflicts > 0 && (
                    <button
                      type="button"
                      className="sync-card-link"
                      onClick={() => setLocation('/settings?tab=channels')}
                    >
                      管理冲突 →
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {(importRunning || exportRunning) && (
        <div className="statusbar-group statusbar-spacer">
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
