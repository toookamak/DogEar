import type { SyncState } from "@/types";

interface Props {
  sync: SyncState;
  pendingCount: number;
  onRetry: () => void;
}

export default function StatusBar({ sync, pendingCount, onRetry }: Props) {
  const phaseText =
    sync.phase === "syncing"
      ? "正在推送变更…"
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
      </div>
      <div className="statusbar-right">
        <span>{pendingCount} 条待处理</span>
        <span className="statusbar-sep">·</span>
        <span>本地优先</span>
      </div>
    </footer>
  );
}