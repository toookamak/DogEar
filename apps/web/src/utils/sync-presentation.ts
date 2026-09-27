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
