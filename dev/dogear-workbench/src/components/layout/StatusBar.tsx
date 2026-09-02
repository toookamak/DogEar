import type { SyncState } from "@/types";

interface SyncMetrics {
  rate: string;
  latency: string;
  successRate: string;
  retries429: number;
}

interface Props {
  sync: SyncState;
  pendingCount: number;
  metrics: SyncMetrics;
  queueLength: number;
  pendingPush: number;
  onRetry: () => void;
}

// 底区状态栏（PRD §9.x 可观测性）：未推送条数常驻显示，
// 条/秒、时延、成功率、队列长度、429 计数可见；不设硬性速度验收阈值。
export default function StatusBar({
  sync,
  pendingCount,
  metrics,
  queueLength,
  pendingPush,
  onRetry,
}: Props) {
  const phaseText =
    sync.phase === "syncing"
      ? "正在导出变更…"
      : sync.phase === "error"
        ? "同步失败"
        : "队列空闲";

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className={`status-led ${sync.phase}`} />
        <span>{phaseText}</span>
        {sync.phase === "error" && (
          <button type="button" className="statusbar-retry" onClick={onRetry}>
            重试
          </button>
        )}
        <span className="statusbar-sep">·</span>
        <span>上次同步 {sync.lastSyncAt}</span>
        <span className="statusbar-sep">·</span>
        <span>
          未推送 <strong>{pendingPush}</strong>
        </span>
        <span className="statusbar-sep">·</span>
        <span>队列 {queueLength}</span>
      </div>
      <div className="statusbar-right">
        <span>{metrics.rate}</span>
        <span className="statusbar-sep">·</span>
        <span>{metrics.latency}</span>
        <span className="statusbar-sep">·</span>
        <span>成功率 {metrics.successRate}</span>
        <span className="statusbar-sep">·</span>
        <span className={metrics.retries429 > 0 ? "metrics-warn" : undefined}>
          429 ×{metrics.retries429}
        </span>
        <span className="statusbar-sep">·</span>
        <span>{pendingCount} 条待处理</span>
        <span className="statusbar-sep">·</span>
        <span>本地优先</span>
      </div>
    </footer>
  );
}
