import { useState } from "react";
import type { AppSettings, RaindropConflictStrategy, RaindropQueueItem } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";
import Switch from "../atoms/Switch";
import StatCard from "../atoms/StatCard";
import ConfigField from "../atoms/ConfigField";

interface Props {
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  bm: BookmarkAPI;
}

const PUSH_PRESETS = [
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "120s", value: 120 },
];

const PULL_PRESETS = [
  { label: "5min", value: 5 },
  { label: "15min", value: 15 },
  { label: "30min", value: 30 },
];

const STRATEGIES: { key: RaindropConflictStrategy; label: string; desc: string }[] = [
  { key: "local", label: "本地优先", desc: "冲突时以本地为准" },
  { key: "raindrop", label: "Raindrop 优先", desc: "冲突时以云端为准" },
  { key: "ask", label: "每次询问", desc: "冲突保留两端，手动选择" },
];

const OP_LABEL: Record<RaindropQueueItem["op"], string> = {
  create: "新增",
  update: "更新",
  delete: "删除",
};

function statusCls(status: RaindropQueueItem["status"]): string {
  switch (status) {
    case "pending":
      return "state-pending";
    case "synced":
      return "status-done";
    case "conflict":
    case "failed":
      return "status-error";
  }
}

function statusLabel(status: RaindropQueueItem["status"]): string {
  switch (status) {
    case "pending":
      return "待处理";
    case "synced":
      return "已同步";
    case "failed":
      return "失败";
    case "conflict":
      return "冲突";
  }
}

export default function RaindropSection({ settings, onUpdateSettings, bm }: Props) {
  const [testing, setTesting] = useState(false);
  const raindrop = settings.raindrop;
  const syncPhase = bm.state.sync.phase;
  const syncing = syncPhase === "syncing";

  const phaseCls = syncPhase === "success" ? "status-done" : syncPhase === "error" ? "status-error" : syncPhase === "syncing" ? "state-pending" : "status-neutral";
  const phaseLabel = syncPhase === "syncing" ? "同步中" : syncPhase === "success" ? "同步成功" : syncPhase === "error" ? "同步失败" : "空闲";

  const pendingCount = raindrop.queue.filter((i) => i.status === "pending").length;
  const failedCount = raindrop.queue.filter((i) => i.status === "failed").length;
  const conflictCount = raindrop.queue.filter((i) => i.status === "conflict").length;
  const remainingPct = Math.round((raindrop.rateLimit.remaining / Math.max(1, raindrop.rateLimit.limit)) * 100);

  function handleTest() {
    if (testing) return;
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      onUpdateSettings((s) => ({ ...s, raindrop: { ...s.raindrop, connected: true } }));
      bm.notify({ kind: "success", message: "Raindrop 连接成功（模拟）" });
    }, 700);
  }

  function handleSync() {
    if (syncing) return;
    bm.runSync((ok) => {
      onUpdateSettings((s) => {
        const items = s.raindrop.queue;
        const pending = items.find((it) => it.status === "pending");
        const queue = pending
          ? ok
            ? items.map((it) => (it.id === pending.id ? { ...it, status: "synced" as const } : it))
            : items.map((it) => (it.id === pending.id ? { ...it, status: "failed" as const, retries: it.retries + 1 } : it))
          : items;
        return {
          ...s,
          raindrop: {
            ...s.raindrop,
            connected: true,
            queue,
            rateLimit: ok
              ? { ...s.raindrop.rateLimit, status: "normal" as const, remaining: Math.max(0, s.raindrop.rateLimit.remaining - 1) }
              : {
                  ...s.raindrop.rateLimit,
                  status: "backoff" as const,
                  remaining: 0,
                  resetInSeconds: 60,
                  retries429: s.raindrop.rateLimit.retries429 + 1,
                },
          },
        };
      });
    });
  }

  const syncLogs = bm.logs.filter((l) => l.type === "同步").slice(0, 8);

  return (
    <div className="section-pane settings-section">
      <section className="settings-group">
        <h3>连接与授权</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">Raindrop 连接</span>
            <span className="settings-row-desc">
              {raindrop.connected ? "已连接，可正常推送/拉取" : "未连接，请先配置 Token 并测试连接"}
            </span>
          </div>
          <span className={`status-pill ${raindrop.connected ? "status-done" : "status-error"}`}>
            {raindrop.connected ? "已连接" : "未连接"}
          </span>
        </div>
        <ConfigField
          label="Access Token"
          type="password"
          value={raindrop.token}
          onChange={(v) => onUpdateSettings((s) => ({ ...s, raindrop: { ...s.raindrop, token: v } }))}
          placeholder="粘贴 Raindrop Access Token"
          hint="Token 仅保存在本机（localStorage），界面以掩码显示、仅显示一次"
        />
        <div className="settings-row">
          <button type="button" className="secondary-action" onClick={handleTest} disabled={testing || !raindrop.token}>
            {testing ? "连接中…" : "测试连接"}
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h3>定时同步</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">启用定时同步</span>
            <span className="settings-row-desc">本地写入即时生效，变更进入推送队列，按间隔自动同步（原型模拟）</span>
          </div>
          <Switch
            checked={settings.sync.enabled}
            onChange={(v) => onUpdateSettings((s) => ({ ...s, sync: { ...s.sync, enabled: v } }))}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">推送间隔</span>
            <span className="settings-row-desc">待推送变更到达 Raindrop 的节奏</span>
          </div>
          <div className="chips-row">
            {PUSH_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`chip-chip${settings.sync.pushSeconds === p.value ? " active" : ""}`}
                onClick={() => onUpdateSettings((s) => ({ ...s, sync: { ...s.sync, pushSeconds: p.value } }))}
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              min={10}
              max={600}
              value={settings.sync.pushSeconds}
              onChange={(e) => onUpdateSettings((s) => ({ ...s, sync: { ...s.sync, pushSeconds: Number(e.target.value) || 10 } }))}
              style={{ width: 72, padding: "4px 6px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">拉取间隔</span>
            <span className="settings-row-desc">按 lastSyncAt 拉取 Raindrop 增量，支持手动立即拉取</span>
          </div>
          <div className="chips-row">
            {PULL_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`chip-chip${settings.sync.pullMinutes === p.value ? " active" : ""}`}
                onClick={() => onUpdateSettings((s) => ({ ...s, sync: { ...s.sync, pullMinutes: p.value } }))}
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={240}
              value={settings.sync.pullMinutes}
              onChange={(e) => onUpdateSettings((s) => ({ ...s, sync: { ...s.sync, pullMinutes: Number(e.target.value) || 1 } }))}
              style={{ width: 72, padding: "4px 6px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>手动同步</h3>
        <div className="settings-row">
          <button type="button" className="secondary-action" onClick={handleSync} disabled={syncing || pendingCount === 0}>
            立即推送
          </button>
          <button type="button" className="secondary-action" onClick={handleSync} disabled={syncing}>
            立即拉取
          </button>
          <button type="button" className="secondary-action" onClick={handleSync} disabled={syncing}>
            全量拉取
          </button>
          <span className={`status-pill ${phaseCls}`}>{phaseLabel}</span>
        </div>
        <p className="section-pane">"全量拉取"忽略增量标记强制全量同步（等价于 API force=true）。同步模拟约 1.2s，失败时按 429 退避模拟。</p>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">冲突策略</span>
          </div>
          <div className="chips-row">
            {STRATEGIES.map((st) => (
              <button
                key={st.key}
                type="button"
                className={`chip-chip${raindrop.conflictStrategy === st.key ? " active" : ""}`}
                onClick={() => onUpdateSettings((s) => ({ ...s, raindrop: { ...s.raindrop, conflictStrategy: st.key } }))}
                title={st.desc}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>同步队列</h3>
        <div className="stat-grid">
          <StatCard label="待处理" value={String(pendingCount)} />
          <StatCard label="失败" value={String(failedCount)} tone={failedCount > 0 ? "red" : "default"} />
          <StatCard label="冲突" value={String(conflictCount)} tone={conflictCount > 0 ? "red" : "default"} />
          <StatCard label="队列共" value={String(raindrop.queue.length)} />
        </div>
        {raindrop.queue.length === 0 ? (
          <p className="section-pane">队列为空，暂无待同步变更。</p>
        ) : (
          raindrop.queue.map((it) => (
            <div key={it.id} className="settings-row log-row">
              <div className="settings-row-main">
                <span className="settings-row-title">{it.title}</span>
                <span className="settings-row-desc">
                  {OP_LABEL[it.op]} · {it.direction === "push" ? "推送" : "拉取"}
                  {it.retries > 0 ? ` · 已重试 ${it.retries} 次` : ""}
                </span>
              </div>
              <div className="log-meta">
                <span className={`status-pill ${statusCls(it.status)}`}>{statusLabel(it.status)}</span>
              </div>
            </div>
          ))
        )}
        <p className="section-pane">队列按 updatedAt 顺序消费，单条失败指数退避（1s→2s→4s…封顶 5min），不阻塞后续；断网时队列保留，联网后续推。</p>
      </section>

      <section className="settings-group">
        <h3>API 限频</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">当前状态</span>
            <span className="settings-row-desc">
              {raindrop.rateLimit.status === "backoff" ? `收到 429，退避等待 ${raindrop.rateLimit.resetInSeconds}s 后重试` : "请求速率正常"}
            </span>
          </div>
          <span className={`status-pill ${raindrop.rateLimit.status === "backoff" ? "status-error" : "status-done"}`}>
            {raindrop.rateLimit.status === "backoff" ? "退避中" : "正常"}
          </span>
        </div>
        <div className="stat-grid">
          <StatCard label="每分钟额度" value={String(raindrop.rateLimit.limit)} />
          <StatCard label="剩余额度" value={String(raindrop.rateLimit.remaining)} />
          <StatCard label="重置倒计时" value={`${raindrop.rateLimit.resetInSeconds}s`} />
          <StatCard label="429 次数" value={String(raindrop.rateLimit.retries429)} tone={raindrop.rateLimit.retries429 > 0 ? "red" : "default"} />
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">额度使用 {100 - remainingPct}%</span>
          </div>
          <div className="progress-bar" style={{ width: 200 }}>
            <span style={{ width: `${remainingPct}%`, background: remainingPct < 30 ? "var(--red)" : "var(--amber)" }} />
          </div>
        </div>
        <p className="section-pane">对接 Raindrop 限频：收到 429 时读取 Retry-After，暂停推送并指数退避，顶部状态灯与轻 Toast 提示"限频等待"。</p>
      </section>

      <section className="settings-group">
        <h3>同步日志</h3>
        {syncLogs.length === 0 ? (
          <p className="section-pane">暂无同步日志。</p>
        ) : (
          syncLogs.map((l) => (
            <div key={l.id} className="settings-row log-row">
              <div className="settings-row-main">
                <span className="settings-row-title">{l.at} · {l.action}</span>
                <span className="settings-row-desc">{l.object}</span>
              </div>
              <div className="log-meta">
                <span className={`status-pill ${l.result === "success" ? "status-done" : "status-error"}`}>{l.type}</span>
                <span className="log-source">{l.source}</span>
              </div>
            </div>
          ))
        )}
        <p className="section-pane">仅展示最近 8 条同步日志，完整历史与保留策略见「日志」分区。</p>
      </section>
    </div>
  );
}