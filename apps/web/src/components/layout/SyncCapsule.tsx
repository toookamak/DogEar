import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { syncApi, type SyncStatusResponse } from '../../api/sync.js'
import { notifyDataChanged } from '../../undo.js'
import { toast, errorMessage } from '../../toast.js'
import { formatAgo } from '../../utils/format.js'
import { latestSyncAt, syncLamp, type SyncLamp } from '../../utils/sync-presentation.js'

/**
 * 顶栏右上角的同步胶囊（2026-09-27，方案 D 镜像：展开方向向左）。
 *
 * 从 StatusBar 迁来：此前同步状态藏在 28px 底部状态栏、「待同步 N」点击向上弹卡片，
 * 入口离主视线最远，且与顶栏的常驻动作分散。现在折叠态是「三色灯箱 + 常驻积压数」，
 * 一眼看到有没有积压；悬停或点击后向左滑出操作浮条，把拉取 / 推送收在同一条里，
 * 不再叠第二层弹层（原「状态栏同步卡片」屏稿升 v1.1 记录本次迁移）。
 *
 * 灯态与「上次同步」的判定见 `utils/sync-presentation.ts`（纯函数，带测试）。
 * 数据源为聚合接口 GET /api/sync/status；取数失败时显式提示并可重试，
 * 不显示假的「0 条」——此前失败被 catch 吞掉，用户会把「取不到」误读成「没有待同步」。
 */

/** 推送循环上限：每轮服务端消费 10 条，20 轮 ≈ 200 条，防长时间占用与 Raindrop 风控 */
const PUSH_MAX_ROUNDS = 20

export function SyncCapsule() {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null)
  const [syncError, setSyncError] = useState(false)
  const [loading, setLoading] = useState(false)
  /** 点击钉住展开态；仅悬停时不留住，移开即收 */
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState<'pull' | 'push' | null>(null)
  const [pushRound, setPushRound] = useState(0)
  /**
   * 上一次「拉取 / 推送」操作的失败原因，成功即清空。
   *
   * 只弹 toast 不够：错误 toast 6 秒后消失、界面上不留痕，用户回头只看到
   * 「上次同步 从未」，会以为功能坏了——2026-09-27 用户反馈
   * 「我点过拉取但是最近更新显示从未」即由此而来（真实原因是本地没配通道，
   * 拉取被 400 拦下，而唯一的痕迹随 toast 一起消失了）。
   */
  const [actionError, setActionError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [, setLocation] = useLocation()

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

  // 点外部 / Esc 收起钉住的展开态（mousedown 先于 click，避免「点开又立刻关上」）
  useEffect(() => {
    if (!pinned) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setPinned(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  /** 拉取：单页低频拉回；文案与设置页 ChannelManager 的「拉取」保持一致 */
  const handlePull = async () => {
    setBusy('pull')
    setActionError(null)
    try {
      const summary = await syncApi.pull()
      const parts = [`新增 ${summary.created} 条`]
      if (summary.conflicts > 0) parts.push(`${summary.conflicts} 条冲突待处理（浮条里「管理冲突」）`)
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
      // 失败原因同时进 toast 与浮条：toast 会消失，浮条留到下次成功
      setActionError(errorMessage(e, '拉取失败'))
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
    setActionError(null)
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
      setActionError(errorMessage(e, '推送失败'))
      toast.error(errorMessage(e, '推送失败'))
    }
    setPushRound(0)
    setBusy(null)
  }

  const pendingPush = status?.pendingPush ?? null
  const failedPush = status?.failedPush ?? 0
  const pendingConflicts = status?.pendingConflicts ?? 0

  /**
   * 「上次同步」取推送与拉取中较晚的一次（2026-09-27 修正）。
   *
   * 初版只读 lastPushAt 却把标签写成「上次」——用户点了「拉取」、看到仍显示「从未」，
   * 读起来像功能坏了。拉取与推送是同一排的两个按钮，紧邻的「上次」自然会被读成
   * 「上次我做的那个动作」，因此必须覆盖两者。精确拆分放 title（浮条单行放不下两行时间）。
   */
  const lastSyncAt = latestSyncAt(status?.lastPushAt, status?.lastPullAt)

  // 同步中优先于其它态：正在跑的时候「待推送」数字本来就在变，报红黄没有意义
  const lamp: SyncLamp = syncLamp(busy !== null, failedPush, pendingPush, actionError !== null)
  const countText = syncError ? '—' : pendingPush ?? '—'
  const lampLabel = syncError
    ? '同步状态读取失败'
    : `同步状态：待推送 ${pendingPush ?? '未知'}${failedPush > 0 ? `，推送失败 ${failedPush}` : ''}${
        pendingConflicts > 0 ? `，待处理冲突 ${pendingConflicts}` : ''
      }${busy ? '，正在同步' : ''}${actionError ? `；上次操作失败：${actionError}` : ''}`

  return (
    <div className={`syncbox${pinned ? ' is-open' : ''}`} ref={rootRef}>
      <div className="sync-strip" role="dialog" aria-label="同步状态与拉取 / 推送">
        {syncError ? (
          <>
            <span className="sync-strip-item sync-strip-item--err">同步状态读取失败</span>
            <button
              type="button"
              className="btn btn--pill sync-strip-btn"
              disabled={loading}
              onClick={() => { void load() }}
            >
              {loading ? '重试中…' : '重试'}
            </button>
          </>
        ) : (
          <>
            <div className="sync-strip-acts">
              <button
                type="button"
                className="btn btn--pill sync-strip-btn"
                disabled={busy !== null}
                onClick={() => { void handlePull() }}
              >
                {busy === 'pull' ? '拉取中…' : '拉取'}
              </button>
              <button
                type="button"
                className="btn btn--pill btn--primary sync-strip-btn"
                disabled={busy !== null}
                onClick={() => { void handlePush() }}
              >
                {busy === 'push' ? `推送中（第 ${pushRound} 轮）` : '推送'}
              </button>
            </div>
            <span className="sync-strip-item">待推送 <b>{pendingPush ?? '—'}</b></span>
            {failedPush > 0 && (
              // 完整退避说明进 title：单行浮条塞不下，硬塞会把「拉取」挤出可视区
              <span
                className="sync-strip-item sync-strip-item--err"
                title="失败条目按退避自动重试（最多 8 次），超限后需人工排查"
              >
                失败 <b>{failedPush}</b>
              </span>
            )}
            {pendingConflicts > 0 ? (
              <>
                <span className="sync-strip-item sync-strip-item--warn">冲突 <b>{pendingConflicts}</b></span>
                <button
                  type="button"
                  className="sync-strip-link"
                  onClick={() => setLocation('/settings?tab=channels')}
                >
                  管理冲突 →
                </button>
              </>
            ) : actionError ? (
              // 标签写「上次」而不是裸「操作失败」：这个痕迹会一直留到下次成功，
              // 必须让人看出说的是历史动作、不是当下的故障。
              // 失败原因只在 title：完整文案约 20 字，直接上屏会把「拉取」挤出可视区。
              <span className="sync-strip-item sync-strip-item--err" title={actionError}>
                上次操作失败
              </span>
            ) : (
              <span
                className="sync-strip-item"
                title={`上次推送：${formatAgo(status?.lastPushAt)} · 上次拉取：${formatAgo(status?.lastPullAt)}`}
              >
                上次同步 <b>{formatAgo(lastSyncAt)}</b>
              </span>
            )}

            {/*
              v0.8.0 起常驻：回写范围只覆盖标题与备注，**收藏夹与标签不回写**。

              为什么必须写在这里：改标签/收藏夹同样会入队、同样把胶囊点亮成「待推送」，
              消费器推完还会标回「已同步」——若不点破，用户会看到「整理好了、已同步」，
              而 Raindrop 上的归类**一点没变**。这不是提示，这是修掉一个会骗人的假成功。
              待 0.5/0.6/0.8（推送补字段 + 改走批量接口）落地后删掉这一行。
            */}
            <span
              className="sync-strip-item sync-strip-item--note"
              title="Raindrop 通道当前只回写标题与备注。你在本地改的收藏夹与标签不会推到 Raindrop。"
            >
              收藏夹与标签暂不回写
            </span>
          </>
        )}
      </div>

      <button
        type="button"
        className="sync-lamp"
        aria-expanded={pinned}
        aria-label={lampLabel}
        title="同步状态与拉取 / 推送"
        onClick={() => setPinned((v) => !v)}
      >
        <span className="sync-lamp-housing" aria-hidden="true">
          <span className={`sync-lamp-dot${lamp === 'err' ? ' is-on-red' : ''}`} />
          <span className={`sync-lamp-dot${lamp === 'warn' ? ' is-on-warn' : lamp === 'syncing' ? ' is-alt-warn' : ''}`} />
          <span className={`sync-lamp-dot${lamp === 'ok' ? ' is-on-ok' : lamp === 'syncing' ? ' is-alt-ok' : ''}`} />
        </span>
        <span className={`sync-lamp-count${lamp === 'err' ? ' is-err' : lamp === 'ok' ? ' is-ok' : ''}`}>
          {countText}
        </span>
      </button>
    </div>
  )
}
