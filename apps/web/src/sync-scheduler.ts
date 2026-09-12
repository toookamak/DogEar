/**
 * 客户端同步攒批（L2）。
 *
 * 职责：数据变更后不立即打服务端，攒 1 分钟批量消费；页面隐藏/卸载时立即 flush。
 * 另带一个 60s 的兜底轮询：发现服务端有积压（pending-count > 0，例如其他端
 * 或 Agent 产生的变更）就触发一次消费——Workers 轨的 Cron 间隔是 5 分钟，
 * 工作台在线时由这里把消费延迟从分钟级拉到实时。
 *
 * 所有请求失败都静默：消费只是加速，服务端 Cron/定时器是最终兜底。
 */

const FLUSH_DELAY_MS = 60_000
const POLL_INTERVAL_MS = 60_000

let flushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

async function fetchPendingCount(): Promise<number> {
  try {
    const response = await fetch('/api/sync/pending-count')
    if (!response.ok) return 0
    const body = (await response.json()) as { pendingCount?: number }
    return body.pendingCount ?? 0
  } catch {
    return 0
  }
}

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  try {
    // keepalive：页面卸载后请求仍能发出
    await fetch('/api/sync/process', { method: 'POST', keepalive: true })
  } catch {
    // 失败留待下一轮轮询/定时器
  }
}

/** 数据变更后调用：1 分钟窗口内合并为一次消费（攒批） */
export function scheduleSyncFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_DELAY_MS)
}

/** 在应用外壳挂载一次；重复调用是幂等的 */
export function installSyncScheduler() {
  if (installed) return
  installed = true

  window.addEventListener('pagehide', () => {
    if (flushTimer) void flush()
  })
  document.addEventListener('visibilitychange', () => {
    // 切到后台立即清账，避免回到前台才发现积压
    if (document.visibilityState === 'hidden' && flushTimer) void flush()
  })
  window.setInterval(() => {
    void fetchPendingCount().then((count) => {
      if (count > 0) void flush()
    })
  }, POLL_INTERVAL_MS)
  // 启动时清一次遗留积压（例如上次页面卸载时 flush 失败的）
  void fetchPendingCount().then((count) => {
    if (count > 0) void flush()
  })
}
