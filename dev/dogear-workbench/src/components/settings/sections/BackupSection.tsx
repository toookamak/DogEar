import { useState } from "react";
import type { AppSettings, BackupKind, BackupTarget } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";
import Switch from "../atoms/Switch";
import ConfigField from "../atoms/ConfigField";
import { runSim } from "@/utils/sim";
import { SIM_TOTAL } from "@/data/mockSettings";

interface Props {
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  onNotify: BookmarkAPI["notify"];
}

let backupSeq = 100;

function nextTargetId(): string {
  backupSeq += 1;
  return `t-${backupSeq}`;
}

const WEBDAV_FIELDS = [
  { key: "server", label: "服务器地址", placeholder: "https://dav.example.com/dav" },
  { key: "path", label: "目录路径", placeholder: "/DogEar/backups" },
  { key: "username", label: "用户名", placeholder: "user" },
  { key: "password", label: "密码", placeholder: "••••••••", secret: true },
];

const S3_FIELDS = [
  { key: "endpoint", label: "Endpoint", placeholder: "https://s3.example.com" },
  { key: "region", label: "Region", placeholder: "us-east-1" },
  { key: "bucket", label: "Bucket", placeholder: "dogear-backup" },
  { key: "prefix", label: "Path Prefix", placeholder: "snapshots" },
  { key: "accessKey", label: "Access Key", placeholder: "AKIA..." },
  { key: "secretKey", label: "Secret Key", placeholder: "••••••••", secret: true },
];

export default function BackupSection({ settings, onUpdateSettings, onNotify }: Props) {
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTarget, setNewTarget] = useState<BackupTarget>({
    id: "",
    type: "webdav",
    name: "",
    enabled: true,
    config: {},
  });

  const targets = settings.backup.targets;
  const history = settings.backup.history;

  function startTask(label: string, done: () => void) {
    if (progress) return;
    setProgress({ label, value: 0 });
    runSim(800, (p) => setProgress({ label, value: p }), () => {
      setProgress(null);
      done();
    });
  }

  function runExport(kind: "csv" | "zip") {
    startTask(`正在导出 ${kind.toUpperCase()}…`, () => {
      const size = kind === "csv" ? "58 KB" : "142 KB";
      onUpdateSettings((s) => ({
        ...s,
        backup: {
          ...s.backup,
          history: [
            { id: Date.now(), at: "刚刚", type: kind, target: `本地 ${kind.toUpperCase()}`, result: "success" as const, size },
            ...s.backup.history,
          ].slice(0, 20),
        },
      }));
      onNotify({ kind: "success", message: `已导出 ${kind.toUpperCase()}（${SIM_TOTAL} 条，${size}）· 模拟完成` });
    });
  }

  function runConnection(targetId: string) {
    startTask("正在测试连接…", () => {
      onUpdateSettings((s) => ({
        ...s,
        backup: {
          ...s.backup,
          targets: s.backup.targets.map((t) =>
            t.id === targetId ? { ...t, lastResult: "success" as const } : t
          ),
        },
      }));
      onNotify({ kind: "success", message: "连接成功（模拟）" });
    });
  }

  function runBackup(targetId: string) {
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;
    startTask(`正在备份到「${target.name}」…`, () => {
      onUpdateSettings((s) => ({
        ...s,
        backup: {
          ...s.backup,
          targets: s.backup.targets.map((t) =>
            t.id === targetId ? { ...t, lastBackupAt: "刚刚", lastSize: "186 KB", lastResult: "success" as const } : t
          ),
          history: [
            { id: Date.now(), at: "刚刚", type: target.type, target: target.name, result: "success" as const, size: "186 KB" },
            ...s.backup.history,
          ].slice(0, 20),
        },
      }));
      onNotify({ kind: "success", message: `已备份到「${target.name}」（模拟）` });
    });
  }

  function runRestore(targetName: string) {
    startTask("正在从备份恢复…", () => {
      onNotify({ kind: "success", message: `已从「${targetName}」恢复（模拟）` });
    });
  }

  function addTarget() {
    if (!newTarget.name.trim()) return;
    onUpdateSettings((s) => ({
      ...s,
      backup: { ...s.backup, targets: [...s.backup.targets, { ...newTarget, id: nextTargetId() }] },
    }));
    setShowAdd(false);
    setNewTarget({ id: "", type: "webdav", name: "", enabled: true, config: {} });
    onNotify({ kind: "success", message: "已添加备份目标" });
  }

  return (
    <div className="section-pane settings-section">
      {progress && (
        <div className="settings-group">
          <h3>{progress.label} {progress.value}%</h3>
          <div className="progress-bar"><span style={{ width: `${progress.value}%` }} /></div>
        </div>
      )}

      <section className="settings-group">
        <h3>本地备份</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">导出 CSV（轻档）</span>
            <span className="settings-row-desc">书签核心字段：标题 / URL / 摘要 / 标签 / 文件夹</span>
          </div>
          <button type="button" className="secondary-action" onClick={() => runExport("csv")}>
            导出 CSV
          </button>
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">导出 ZIP（全量）</span>
            <span className="settings-row-desc">书签 + 文件夹 + 设置 + 日志 + 回收站，含 manifest 清单</span>
          </div>
          <button type="button" className="primary-action" onClick={() => runExport("zip")}>
            导出 ZIP
          </button>
        </div>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">从文件恢复</span>
            <span className="settings-row-desc">支持 CSV / ZIP，可选择「合并导入」或「覆盖恢复」</span>
          </div>
          <button type="button" className="secondary-action" onClick={() => onNotify({ kind: "success", message: "已选择备份文件，开始解析（模拟）" })}>
            选择文件…
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h3>云端备份</h3>
        {targets.map((t) => (
          <div key={t.id} className="settings-group">
            <div className="settings-row">
              <div className="settings-row-main">
                <span className="settings-row-title">{t.name}</span>
                <span className="settings-row-desc">
                  {t.type === "webdav" ? "WebDAV" : "S3"} · 上次备份 {t.lastBackupAt ?? "—"} ·{" "}
                  {t.lastResult === "fail" ? <span className="confirm-warn" style={{ padding: "1px 6px", borderRadius: 4 }}>最近一次失败</span> : t.lastSize ?? "未备份"}
                </span>
              </div>
              <Switch
                checked={t.enabled}
                onChange={(v) =>
                  onUpdateSettings((s) => ({
                    ...s,
                    backup: { ...s.backup, targets: s.backup.targets.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)) },
                  }))
                }
              />
            </div>
            <div className="settings-row">
              <button type="button" className="mini-action" onClick={() => runConnection(t.id)}>连接测试</button>
              <button type="button" className="mini-action accent" onClick={() => runBackup(t.id)}>立即备份</button>
              <button type="button" className="mini-action" onClick={() => runRestore(t.name)}>恢复</button>
              <button
                type="button"
                className="mini-action ghost"
                onClick={() => {
                  onUpdateSettings((s) => ({ ...s, backup: { ...s.backup, targets: s.backup.targets.filter((x) => x.id !== t.id) } }));
                  onNotify({ kind: "success", message: `已删除备份目标「${t.name}」` });
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {showAdd ? (
          <div className="settings-group">
            <h3>新增备份目标</h3>
            <label className="config-field">
              <span className="config-label">类型</span>
              <select
                value={newTarget.type}
                onChange={(e) => setNewTarget({ ...newTarget, type: e.target.value as BackupKind })}
                style={{ padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)" }}
              >
                <option value="webdav">WebDAV</option>
                <option value="s3">S3 兼容</option>
              </select>
            </label>
            <ConfigField
              label="目标名称"
              value={newTarget.name}
              onChange={(v) => setNewTarget({ ...newTarget, name: v })}
              placeholder="如：家庭 NAS"
            />
            {(newTarget.type === "webdav" ? WEBDAV_FIELDS : S3_FIELDS).map((f) => (
              <ConfigField
                key={f.key}
                label={f.label}
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                value={newTarget.config[f.key] ?? ""}
                onChange={(v) => setNewTarget({ ...newTarget, config: { ...newTarget.config, [f.key]: v } })}
              />
            ))}
            <div className="settings-row">
              <button type="button" className="primary-action" onClick={addTarget}>保存目标</button>
              <button type="button" className="mini-action ghost" onClick={() => setShowAdd(false)}>取消</button>
            </div>
          </div>
        ) : (
          <button type="button" className="mini-action" onClick={() => setShowAdd(true)}>+ 新增备份目标</button>
        )}
      </section>

      <section className="settings-group">
        <h3>定时备份</h3>
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">启用定时备份</span>
            <span className="settings-row-desc">上次成功 {settings.backup.history.find((h) => h.result === "success")?.at ?? "—"}</span>
          </div>
          <Switch
            checked={settings.backup.schedule.enabled}
            onChange={(v) => onUpdateSettings((s) => ({ ...s, backup: { ...s.backup, schedule: { ...s.backup.schedule, enabled: v } } }))}
          />
        </div>
        {settings.backup.schedule.enabled && (
          <div className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-title">频率</span>
              <span className="settings-row-desc">原型的定时为演示配置，不真正触发</span>
            </div>
            <select
              value={settings.backup.schedule.frequency}
              onChange={(e) =>
                onUpdateSettings((s) => ({
                  ...s,
                  backup: { ...s.backup, schedule: { ...s.backup.schedule, frequency: e.target.value as AppSettings["backup"]["schedule"]["frequency"] } },
                }))
              }
              style={{ padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)" }}
            >
              <option value="manual">手动</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
            </select>
          </div>
        )}
      </section>

      <section className="settings-group">
        <h3>备份历史</h3>
        {history.map((h) => (
          <div key={h.id} className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-title">{h.at} · {h.type.toUpperCase()} → {h.target}</span>
              <span className="settings-row-desc">{h.result === "success" ? h.size : "失败"}</span>
            </div>
            <span className={`status-pill ${h.result === "success" ? "status-done" : "status-error"}`}>
              {h.result === "success" ? "成功" : "失败"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}