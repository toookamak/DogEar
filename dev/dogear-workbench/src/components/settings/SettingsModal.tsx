import { useState } from "react";
import type { AppSettings, SettingsTabKey } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";
import StatusSection from "./sections/StatusSection";
import RaindropSection from "./sections/RaindropSection";
import BackupSection from "./sections/BackupSection";
import AgentSection from "./sections/AgentSection";
import LogSection from "./sections/LogSection";
import TrashSection from "./sections/TrashSection";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  bm: BookmarkAPI;
}

const TABS: { key: SettingsTabKey; label: string }[] = [
  { key: "status", label: "状态信息" },
  { key: "raindrop", label: "Raindrop 同步" },
  { key: "backup", label: "备份与恢复" },
  { key: "agent", label: "Agent 接入" },
  { key: "log", label: "日志" },
  { key: "trash", label: "回收站" },
];

export default function SettingsModal({ open, onClose, settings, onUpdateSettings, bm }: Props) {
  const [tab, setTab] = useState<SettingsTabKey>("status");

  if (!open) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="设置">
      <button type="button" className="modal-scrim" aria-label="关闭设置" onClick={onClose} />
      <div className="modal">
        <header className="modal-head">
          <h2>设置</h2>
          <button type="button" className="modal-close" aria-label="关闭设置" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <nav className="settings-nav" aria-label="设置分区">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`settings-tab${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {tab === "status" && (
              <StatusSection settings={settings} onUpdateSettings={onUpdateSettings} bm={bm} />
            )}
            {tab === "raindrop" && (
              <RaindropSection settings={settings} onUpdateSettings={onUpdateSettings} bm={bm} />
            )}
            {tab === "backup" && (
              <BackupSection settings={settings} onUpdateSettings={onUpdateSettings} onNotify={bm.notify} />
            )}
            {tab === "agent" && (
              <AgentSection settings={settings} onUpdateSettings={onUpdateSettings} onNotify={bm.notify} />
            )}
            {tab === "log" && (
              <LogSection logs={bm.logs} settings={settings} onUpdateSettings={onUpdateSettings} onClearLogs={bm.clearLogs} />
            )}
            {tab === "trash" && (
              <TrashSection trash={bm.trash} settings={settings} onUpdateSettings={onUpdateSettings} bm={bm} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}