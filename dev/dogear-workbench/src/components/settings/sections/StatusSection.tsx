import { useMemo } from "react";
import type { AppSettings } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";
import StatCard from "../atoms/StatCard";
import { SIM_TOTAL, SIM_CAPACITY, SYNC_METRICS } from "@/data/mockSettings";

interface Props {
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  bm: BookmarkAPI;
}

const STATUS_LABELS = {
  待整理: "待整理",
  稍后读: "稍后读",
  已归档: "已归档",
} as const;

export default function StatusSection({ settings, bm }: Props) {
  const total = bm.state.bookmarks.length;
  const counts = bm.sectionStats;

  const space = useMemo(() => {
    const bmBytes = JSON.stringify(bm.state.bookmarks).length;
    const logBytes = JSON.stringify(bm.logs).length;
    const trashBytes = JSON.stringify(bm.trash).length;
    const settingBytes = JSON.stringify(settings).length;
    const totalBytes = bmBytes + logBytes + trashBytes + settingBytes;
    return {
      bookmarks: fmt(bmBytes),
      logs: fmt(logBytes),
      trash: fmt(trashBytes),
      settings: fmt(settingBytes),
      total: fmt(totalBytes),
    };
  }, [bm.state.bookmarks, bm.logs, bm.trash, settings]);

  function fmt(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  const syncPhase = bm.state.sync.phase;
  const phaseLabel =
    syncPhase === "syncing" ? "同步中" : syncPhase === "success" ? "同步成功" : syncPhase === "error" ? "同步失败" : "空闲";

  return (
    <div className="section-pane settings-section">
      <section className="settings-group">
        <h3>收藏统计</h3>
        <div className="stat-grid">
          <StatCard label="总收藏" value={String(total)} sub={`资料库 ${SIM_TOTAL} / ${SIM_CAPACITY}`} />
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <StatCard key={key} label={label} value={String(counts[key as keyof typeof STATUS_LABELS] ?? 0)} />
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h3>空间占用</h3>
        <div className="stat-grid">
          <StatCard label="书签" value={space.bookmarks} />
          <StatCard label="日志" value={space.logs} />
          <StatCard label="回收站" value={space.trash} />
          <StatCard label="设置" value={space.settings} />
          <StatCard label="合计" value={space.total} tone="mint" />
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">本地资料库占用 {Math.round((SIM_TOTAL / SIM_CAPACITY) * 100)}%</span>
            <span className="settings-row-desc">按 600 条基线考核</span>
          </div>
          <div className="progress-bar" style={{ width: 160 }}>
            <span style={{ width: `${(SIM_TOTAL / SIM_CAPACITY) * 100}%` }} />
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>同步状态</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">状态灯：{phaseLabel}</span>
            <span className="settings-row-desc">上次同步 {bm.state.sync.lastSyncAt} · 队列 {bm.state.sync.attempts} 次尝试</span>
          </div>
          <button type="button" className="secondary-action" onClick={() => bm.runSync()}>
            立即同步
          </button>
        </div>
        <div className="stat-grid">
          <StatCard label="速率" value={SYNC_METRICS.rate} />
          <StatCard label="时延" value={SYNC_METRICS.latency} />
          <StatCard label="成功率" value={SYNC_METRICS.successRate} />
          <StatCard label="429 次数" value={String(SYNC_METRICS.retries429)} tone={SYNC_METRICS.retries429 > 0 ? "red" : "default"} />
        </div>
        <p className="section-pane">推送/拉取间隔、队列与限频等配置已移至「Raindrop 同步」分区，此处仅展示同步状态。</p>
      </section>

      <section className="settings-group">
        <h3>数据安全</h3>
        <p className="section-pane">
          密钥等敏感项仅存储于本机（原型模拟），API Key 仅显示一次。数据仅存本地，云端仅在你主动备份时上传。
        </p>
      </section>
    </div>
  );
}