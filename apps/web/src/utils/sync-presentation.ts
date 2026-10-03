/**
 * 同步胶囊的呈现判定（纯函数，2026-09-27）。
 *
 * 抽成纯函数的原因：这两条判定原先写在 `SyncCapsule` 组件里，其中「上次同步」
 * 出过一个真实缺陷——只读 `lastPushAt` 却标成「上次」，用户点完「拉取」看到
 * 仍显示「从未」，读起来像功能坏了（2026-09-27 用户反馈）。放在这里可以被测试
 * 锁住，不再依赖肉眼回归。
 */

/** 灯态：绿=数据一致 / 黄=有修改未同步 / 红=出错 / 黄绿交替=正在同步 */
export type SyncLamp = 'ok' | 'warn' | 'err' | 'syncing'

/**
 * 灯态判定，优先级：同步中 > 出错 > 有积压 > 一致。
 *
 * 「同步中」必须最优先：正在跑的时候 `pendingPush` 本来就在变，此时报红黄没有意义。
 * 出错有两个来源——队列里有推不过去的条目（`failedPush`），或上一次拉取 / 推送
 * 直接失败（`actionFailed`；典型是本地没配 Raindrop 通道，被服务端 400 拦下）。
 */
export function syncLamp(
  busy: boolean,
  failedPush: number,
  pendingPush: number | null,
  actionFailed = false,
): SyncLamp {
  if (busy) return 'syncing'
  if (failedPush > 0 || actionFailed) return 'err'
  if ((pendingPush ?? 0) > 0) return 'warn'
  return 'ok'
}

/**
 * 「上次同步」时间 = 推送与拉取中较晚的一次。
 *
 * 浮条里拉取与推送是同一排的两个按钮，紧邻的「上次」会被读成「上次我做的那个动作」，
 * 因此必须同时覆盖两者——只取推送时间会在「刚点完拉取」时仍显示「从未」。
 * 两侧都无记录才返回 null（真正的「从未」，由调用方交给 `formatAgo` 渲染）。
 */
export function latestSyncAt(
  lastPushAt: number | null | undefined,
  lastPullAt: number | null | undefined,
): number | null {
  const push = lastPushAt ?? null
  const pull = lastPullAt ?? null
  if (push == null) return pull
  if (pull == null) return push
  return Math.max(push, pull)
}

/**
 * 双向差异的呈现（计划 §3.5，2026-10-03 接线）。
 *
 * 三个刻意的克制，全部来自「不撒谎」：
 * - **领先给「条」**：`↑N`——它来自本地 `sync_queue`，是准确值。
 * - **落后给「至少 N」语义**：探测只扫远端首屏，`behindIsExact=false` 时真实值
 *   只会更多，显示 `↓N+` 而不是谎称「一共 N 条」。
 * - **探测失败 ≠ 落后 0**：未配通道或远端报错时返回 null，界面**不渲染** ↓——
 *   显示 0 会被读成「远端没有新东西」，而事实是「我们不知道」。
 */
export interface DiffCounts {
  ahead: number
  behind: number
  behindIsExact: boolean
  probeError?: string
}

/** 领先标签：0 或无效时不渲染（null） */
export function aheadLabel(diff: DiffCounts | null): string | null {
  if (!diff || !Number.isFinite(diff.ahead) || diff.ahead <= 0) return null
  return `↑${diff.ahead}`
}

/** 落后标签：0 且无探测错误时不渲染；探测失败时不渲染（不能显示成 ↓0） */
export function behindLabel(diff: DiffCounts | null): string | null {
  if (!diff) return null
  if (diff.probeError) return null
  if (!Number.isFinite(diff.behind) || diff.behind <= 0) return null
  return diff.behindIsExact ? `↓${diff.behind}` : `↓${diff.behind}+`
}

/**
 * 折叠态主计数：待推送优先（它是本地动作、可直接消掉），其次落后，最后是占位。
 * 两侧都干净时显示待推送数本身（通常为 0），维持既有读法。
 */
export function capsuleCount(
  pendingPush: number | null,
  diff: DiffCounts | null,
): { text: string; behind: boolean } {
  if ((pendingPush ?? 0) > 0) return { text: String(pendingPush), behind: false }
  const behind = behindLabel(diff)
  if (behind) return { text: behind, behind: true }
  return { text: pendingPush == null ? '—' : String(pendingPush), behind: false }
}
