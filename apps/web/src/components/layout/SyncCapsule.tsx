import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { syncApi, type SyncDiffResponse, type SyncStatusResponse } from '../../api/sync.js'
import { notifyDataChanged } from '../../undo.js'
import { toast, errorMessage } from '../../toast.js'
import { formatAgo } from '../../utils/format.js'
import { aheadBreakdownText, behindLabel, capsuleFolded, latestSyncAt, syncLamp, type SyncLamp } from '../../utils/sync-presentation.js'

/**
 * 顶栏右上角的同步胶囊（2026-09-27 方案 D 镜像：向左滑出；2026-10-03 按界面稿 v0.3 升级）。
 *
 * 折叠态 = 三色灯箱 + 差异数：失败压过一切（红）；↑领先 / ↓落后 双计数并排、
 * 单侧只显示一侧；两侧皆 0 只留绿点 + 「已同步」，没事不占视觉；探测失败显示
 * 「未知」——不知道远端状态就不能宣布「已同步」。
 *
 * 浮条 = 多行、贴右缘：下载 / 上传两个可单独决策的动作；领先行给明细
 * （「N 条改标签 · M 条改收藏夹」，来自 breakdown，只在展开时取——它要读全部
 * pending payload，代价更高）；落后行是远端信息态；失败 / 冲突 / 上次操作失败
 * 常驻各自一行；底部一行「上次同步 · 查看日志」。
 *
 * 差异探测**不随 30s 轮询**（额度保护 §3.6.2）：每次要打 1 次真实 Raindrop API，
 * 只在挂载（轻量）、展开胶囊（带明细）、同步动作后取。
 */

/** 推送循环上限：每轮服务端消费 10 条，20 轮 ≈ 200 条，防长时间占用与 Raindrop 风控 */
const PUSH_MAX_ROUNDS = 20

export function SyncCapsule() {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null)
  const [syncError, setSyncError] = useState(false)
  const [loading, setLoading] = useState(false)
  /** 双向差异（↑领先/↓落后）。**不随 30s 轮询刷新**——额度保护 §3.6.2：
   *  探测每次要打 1 次真实 Raindrop API，只在挂载、展开胶囊、同步动作后取一次。 */
  const [diff, setDiff] = useState<SyncDiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
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

  /** 差异探测：挂载（轻量）/ 展开胶囊（带明细）/ 同步动作后各取一次；失败降级为「不渲染 ↓」 */
  const loadDiff = useCallback(async (withBreakdown = false) => {
    setDiffLoading(true)
    try {
      setDiff(await syncApi.diff(withBreakdown))
    } catch {
      setDiff(null)
    }
    setDiffLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => { if (!cancelled) await load() })()
    void (async () => { if (!cancelled) await loadDiff() })()
    const interval = setInterval(() => { void load() }, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [load, loadDiff])

  // 展开胶囊时带明细重算：用户「点开看状态」的时机正是最需要新鲜数字与明细的时候
  useEffect(() => {
    if (pinned) void loadDiff(true)
  }, [pinned, loadDiff])

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

  /** 拉取 = 追平（catchUp）：服务端连续翻页直到拉完或安全上限，一次动作完成「下载」 */
  const handlePull = async () => {
    setBusy('pull')
    setActionError(null)
    try {
      const summary = await syncApi.pull({ catchUp: true })
      const parts = [`新增 ${summary.created} 条，共扫 ${summary.scanned} 条`]
      if (summary.conflicts > 0) parts.push(`${summary.conflicts} 条冲突待处理（浮条里「管理冲突」）`)
      if (summary.hasMore) parts.push(`已达单次安全上限（${summary.pages} 页），远端仍有更多，可再次拉取`)
      if (summary.created > 0 || summary.conflicts > 0) {
        toast.success(`下载完成：${parts.join('，')}`)
        // 新增了书签就让列表刷新，否则用户拉完看不到新内容
        if (summary.created > 0) notifyDataChanged()
      } else {
        toast.info('下载完成：远端没有新内容')
      }
      await load()
      await loadDiff()
    } catch (e) {
      // 失败原因同时进 toast 与浮条：toast 会消失，浮条留到下次成功
      setActionError(errorMessage(e, '下载失败'))
      toast.error(errorMessage(e, '下载失败'))
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
      if (totalSucceeded + totalFailed === 0) toast.info('没有待上传的条目')
      else {
        const parts = [`成功 ${totalSucceeded}`]
        if (totalFailed > 0) parts.push(`失败 ${totalFailed}（将按退避自动重试）`)
        if (remaining > 0) parts.push(`剩余 ${remaining} 条未到重试时机`)
        toast[totalFailed > 0 ? 'info' : 'success'](`上传完成：${parts.join('，')}`)
      }
      await load()
      await loadDiff()
    } catch (e) {
      setActionError(errorMessage(e, '上传失败'))
      toast.error(errorMessage(e, '上传失败'))
    }
    setPushRound(0)
    setBusy(null)
  }

  const pendingPush = status?.pendingPush ?? null
  const failedPush = status?.failedPush ?? 0
  const pendingConflicts = status?.pendingConflicts ?? 0

  // 折叠态按界面稿 v0.3：失败压过一切 → 双计数并排 → 单侧 → 已同步 / 未知
  const folded = capsuleFolded(failedPush, pendingPush, diff)
  // 浮条行：落后单侧标签 + 领先明细（breakdown 只在展开取数时才有）
  const behind = behindLabel(diff)
  const breakdown = aheadBreakdownText(diff?.aheadBreakdown)
  const behindTitle = diff
    ? diff.probeError
      ? `差异探测失败：${diff.probeError}`
      : diff.behindIsExact
        ? 'Raindrop 上有、本地还没有的条数。点「下载」追平。'
        : `至少 ${diff.behind} 条——探测只扫了远端首屏，真实值可能更多。点「下载」继续追平。`
    : ''

  /**
   * 「上次同步」取推送与拉取中较晚的一次（2026-09-27 修正）。
   *
   * 初版只读 lastPushAt 却把标签写成「上次」——用户点了「拉取」、看到仍显示「从未」，
   * 读起来像功能坏了。下载与上传是相邻的两个按钮，紧邻的「上次」自然会被读成
   * 「上次我做的那个动作」，因此必须覆盖两者。精确拆分放 title（单行放不下两行时间）。
   */
  const lastSyncAt = latestSyncAt(status?.lastPushAt, status?.lastPullAt)

  // 同步中优先于其它态：正在跑的时候数字本来就在变，报红黄没有意义
  const lamp: SyncLamp = syncLamp(busy !== null, failedPush, pendingPush, actionError !== null)
  const lampLabel = syncError
    ? '同步状态读取失败'
    : `同步状态：待回写 ${pendingPush ?? '未知'}${failedPush > 0 ? `，推送失败 ${failedPush}` : ''}${
        behind ? `，远端落后 ${behind}` : ''
      }${diff?.probeError ? '，差异未知（探测失败）' : ''}${pendingConflicts > 0 ? `，待处理冲突 ${pendingConflicts}` : ''}${busy ? '，正在同步' : ''}${actionError ? `；上次操作失败：${actionError}` : ''}`

  return (
    <div className={`syncbox${pinned ? ' is-open' : ''}`} ref={rootRef}>
      <div className="sync-strip" role="dialog" aria-label="同步状态与下载 / 上传">
        {syncError ? (
          <div className="sync-strip-row">
            <span className="sync-strip-item sync-strip-item--err">同步状态读取失败</span>
            <button
              type="button"
              className="btn btn--pill sync-strip-btn"
              disabled={loading}
              onClick={() => { void load() }}
            >
              {loading ? '重试中…' : '重试'}
            </button>
          </div>
        ) : (
          <>
            <div className="sync-strip-row">
              <div className="sync-strip-acts">
                <button
                  type="button"
                  className="btn btn--pill sync-strip-btn"
                  disabled={busy !== null}
                  title="从 Raindrop 追平：服务端连续拉页，直到没有新内容或达单次安全上限"
                  onClick={() => { void handlePull() }}
                >
                  {busy === 'pull' ? '下载中…' : '下载'}
                </button>
                <button
                  type="button"
                  className="btn btn--pill btn--primary sync-strip-btn"
                  disabled={busy !== null}
                  title="改动也会自动回写 Raindrop（队列消费，约每 5 分钟），此处立即推送"
                  onClick={() => { void handlePush() }}
                >
                  {busy === 'push' ? `上传中（第 ${pushRound} 轮）` : '上传'}
                </button>
              </div>
            </div>

            {folded.parts.some((p) => p.kind === 'ahead') && (
              <div className="sync-strip-row">
                <span
                  className="sync-strip-item sync-strip-item--ahead"
                  title="本地已改、等待回写 Raindrop。改动会自动回写（约每 5 分钟），也可点「上传」立即推"
                >
                  待回写 <b>{pendingPush ?? '—'}</b>
                </span>
                {breakdown && <span className="sync-strip-detail">{breakdown}</span>}
              </div>
            )}
            {behind && (
              <div className="sync-strip-row">
                <span className="sync-strip-item sync-strip-item--behind" title={behindTitle}>
                  落后 <b>{behind}</b>
                </span>
                <span className="sync-strip-detail">Raindrop 上有新内容</span>
              </div>
            )}
            {!behind && diff?.probeError && (
              // 探测失败必须显式说「不知道」，静默不渲染会被读成「落后 0」
              <div className="sync-strip-row">
                <span className="sync-strip-item sync-strip-item--behind" title={behindTitle}>
                  {diffLoading ? '差异探测中…' : '差异未知'}
                </span>
              </div>
            )}
            {failedPush > 0 && (
              <div className="sync-strip-row">
                <span
                  className="sync-strip-item sync-strip-item--err"
                  title="失败条目按退避自动重试（最多 8 次），超限后需人工排查"
                >
                  失败 <b>{failedPush}</b>
                </span>
              </div>
            )}
            {pendingConflicts > 0 && (
              <div className="sync-strip-row">
                <span className="sync-strip-item sync-strip-item--warn">冲突 <b>{pendingConflicts}</b></span>
                <button
                  type="button"
                  className="sync-strip-link"
                  onClick={() => setLocation('/settings?tab=channels')}
                >
                  管理冲突 →
                </button>
              </div>
            )}
            {actionError && (
              // 标签写「上次」而不是裸「操作失败」：这个痕迹会一直留到下次成功，
              // 必须让人看出说的是历史动作、不是当下的故障。原因只在 title。
              <div className="sync-strip-row">
                <span className="sync-strip-item sync-strip-item--err" title={actionError}>
                  上次操作失败
                </span>
              </div>
            )}
            <div className="sync-strip-row sync-strip-row--meta">
              <span
                className="sync-strip-item"
                title={`上次推送：${formatAgo(status?.lastPushAt)} · 上次拉取：${formatAgo(status?.lastPullAt)}`}
              >
                上次同步 <b>{formatAgo(lastSyncAt)}</b>
              </span>
              <button type="button" className="sync-strip-link" onClick={() => setLocation('/settings?tab=log')}>
                查看日志 →
              </button>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="sync-lamp"
        aria-expanded={pinned}
        aria-label={lampLabel}
        title="同步状态与下载 / 上传"
        onClick={() => setPinned((v) => !v)}
      >
        <span className="sync-lamp-housing" aria-hidden="true">
          <span className={`sync-lamp-dot${lamp === 'err' ? ' is-on-red' : ''}`} />
          <span className={`sync-lamp-dot${lamp === 'warn' ? ' is-on-warn' : lamp === 'syncing' ? ' is-alt-warn' : ''}`} />
          <span className={`sync-lamp-dot${lamp === 'ok' ? ' is-on-ok' : lamp === 'syncing' ? ' is-alt-ok' : ''}`} />
        </span>
        {syncError ? (
          <span className="sync-lamp-count is-err">—</span>
        ) : folded.synced ? (
          <span className="sync-lamp-count is-ok">已同步</span>
        ) : (
          <span className="sync-lamp-counts">
            {folded.parts.map((part) => (
              <span key={part.kind} className={`sync-lamp-part is-${part.kind}`}>{part.text}</span>
            ))}
          </span>
        )}
      </button>
    </div>
  )
}
