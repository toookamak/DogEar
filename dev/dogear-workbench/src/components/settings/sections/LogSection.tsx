import { useMemo, useState } from "react";
import type { AppSettings, LogEntry, LogType } from "@/types";

interface Props {
  logs: LogEntry[];
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  onClearLogs: () => void;
}

const TYPES: (LogType | "全部")[] = ["全部", "新增", "编辑", "删除", "整理", "恢复", "同步", "备份", "Agent"];
const PAGE = 20;

export default function LogSection({ logs, settings, onUpdateSettings, onClearLogs }: Props) {
  const [type, setType] = useState<LogType | "全部">("全部");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      const okType = type === "全部" || l.type === type;
      const haystack = `${l.action} ${l.object} ${l.source}`.toLowerCase();
      return okType && (q === "" || haystack.includes(q));
    });
  }, [logs, type, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageItems = filtered.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div className="section-pane settings-section">
      <section className="settings-group">
        <h3>操作日志 {filtered.length} 条</h3>
        <div className="settings-row">
          <div className="chips-row">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip-chip${type === t ? " active" : ""}`}
                onClick={() => {
                  setType(t);
                  setPage(0);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          placeholder="搜索操作 / 对象 / 来源"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          style={{ padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)" }}
        />
        {pageItems.map((l) => (
          <div key={l.id} className="settings-row log-row">
            <div className="settings-row-main">
              <span className="settings-row-title">{l.at} · {l.action}</span>
              <span className="settings-row-desc">{l.object}</span>
            </div>
            <div className="log-meta">
              <span className={`status-pill ${l.type === "删除" || l.type === "同步" ? "status-error" : "status-done"}`}>{l.type}</span>
              <span className="log-source">{l.source}</span>
              <span className={l.result === "success" ? "log-ok" : "log-fail"}>{l.result === "success" ? "成功" : "失败"}</span>
            </div>
          </div>
        ))}
        <div className="settings-row">
          <button type="button" className="mini-action" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span className="section-pane">{page + 1} / {pages}</span>
          <button type="button" className="mini-action" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      </section>

      <section className="settings-group">
        <h3>保留策略</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">条数上限</span>
          </div>
          <input
            type="number"
            min={100}
            max={50000}
            value={settings.logs.retentionCount}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, logs: { ...s.logs, retentionCount: Number(e.target.value) || 100 } }))}
            style={{ width: 90, padding: "6px 8px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">保留天数</span>
          </div>
          <input
            type="number"
            min={1}
            max={365}
            value={settings.logs.retentionDays}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, logs: { ...s.logs, retentionDays: Number(e.target.value) || 1 } }))}
            style={{ width: 90, padding: "6px 8px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
          />
        </div>
        <button type="button" className="mini-action confirm-warn" onClick={onClearLogs}>
          清空日志
        </button>
      </section>
    </div>
  );
}