import { useState } from "react";
import type { AgentCapabilities, AppSettings } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";
import Switch from "../atoms/Switch";
import ConfigField from "../atoms/ConfigField";
import KeyField from "../atoms/KeyField";
import StatCard from "../atoms/StatCard";

interface Props {
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  onNotify: BookmarkAPI["notify"];
}

const CAP_DEFS: { key: keyof AgentCapabilities; label: string; desc: string; experimental?: boolean }[] = [
  { key: "query", label: "查询", desc: "搜索 / 列表书签，仅供读取" },
  { key: "save", label: "新增", desc: "Agent 可保存新书签" },
  { key: "edit", label: "编辑", desc: "更新标题 / 状态 / 标签 / 文件夹" },
  { key: "batch", label: "批量整理", desc: "实验性：仅生成建议，需工作台确认", experimental: true },
  { key: "delete", label: "删除", desc: "默认禁止。AI 误删不可恢复，请谨慎开启" },
];

function genKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let k = "dogear_";
  for (let i = 0; i < 32; i += 1) k += chars[Math.floor(Math.random() * chars.length)];
  return k;
}

export default function AgentSection({ settings, onUpdateSettings, onNotify }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const agent = settings.agent;

  function setCap(key: keyof AgentCapabilities, value: boolean) {
    if (key === "delete" && value && !confirmDelete) {
      setConfirmDelete(true);
      onNotify({ kind: "error", message: "删除权限为高危操作，请再次点击确认开启" });
      return;
    }
    onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, capabilities: { ...s.agent.capabilities, [key]: value } } }));
    if (key !== "delete") setConfirmDelete(false);
  }

  function simulateCall() {
    const stats = agent.stats;
    if (agent.enabled) {
      const overWrite = stats.writeCount >= agent.limits.writePerMinute;
      onUpdateSettings((s) => ({
        ...s,
        agent: {
          ...s.agent,
          stats: {
            todayRequests: stats.todayRequests + 1,
            writeCount: overWrite ? stats.writeCount : stats.writeCount + 1,
            blockedCount: overWrite ? stats.blockedCount + 1 : stats.blockedCount,
          },
        },
      }));
      if (overWrite) {
        onNotify({ kind: "error", message: `429 限频：每分钟写入超过 ${agent.limits.writePerMinute} 次，已拦截` });
      } else {
        onNotify({ kind: "success", message: "Agent 调用成功（模拟）：已写入 1 条" });
      }
    } else {
      onNotify({ kind: "error", message: "Agent 服务未启用，请在设置中开启" });
    }
  }

  return (
    <div className="section-pane settings-section">
      <section className="settings-group">
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">Agent 服务</span>
            <span className="settings-row-desc">REST 先行 · MCP Server 后补（将与 REST 共享鉴权与限频内核）</span>
          </div>
          <Switch
            checked={agent.enabled}
            onChange={(v) => onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, enabled: v } }))}
          />
        </div>
        {agent.enabled && (
          <>
            <ConfigField
              label="Base URL"
              value={agent.baseUrl}
              onChange={(v) => onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, baseUrl: v } }))}
              placeholder="http://localhost:3000"
            />
            <ConfigField
              label="Agent 名称（可选）"
              value={agent.agentName}
              onChange={(v) => onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, agentName: v } }))}
              placeholder="如：claude-code"
            />
          </>
        )}
      </section>

      {agent.enabled && (
        <>
          <section className="settings-group">
            <h3>鉴权</h3>
            <KeyField
              value={agent.apiKey}
              onGenerate={() => {
                const key = genKey();
                onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, apiKey: key } }));
                return key;
              }}
              onNotify={(message) => onNotify({ kind: "success", message })}
            />
            <p className="section-pane">
              任意 AI Agent / 客户端可在任意位置通过 Base URL + Bearer Token 访问基础查询与操作能力。
            </p>
          </section>

          <section className="settings-group">
            <h3>能力权限</h3>
            {CAP_DEFS.map((c) => (
              <div key={c.key} className="settings-row">
                <div className="settings-row-main">
                  <span className="settings-row-title">
                    {c.label}
                    {c.experimental && (
                      <span className="badge-experimental">experimental</span>
                    )}
                  </span>
                  <span className="settings-row-desc">{c.desc}</span>
                </div>
                {c.key === "delete" ? (
                  <>
                    <Switch checked={agent.capabilities.delete} onChange={(v) => setCap("delete", v)} />
                    {confirmDelete && (
                      <button type="button" className="mini-action confirm-warn" onClick={() => setCap("delete", true)}>
                        确认开启
                      </button>
                    )}
                  </>
                ) : (
                  <Switch checked={agent.capabilities[c.key]} onChange={(v) => setCap(c.key, v)} />
                )}
              </div>
            ))}
          </section>

          <section className="settings-group">
            <h3>限频配置</h3>
            <div className="settings-row">
              <div className="settings-row-main">
                <span className="settings-row-title">读取上限</span>
                <span className="settings-row-desc">每分钟最大查询次数</span>
              </div>
              <input
                type="number"
                min={1}
                max={600}
                value={agent.limits.readPerMinute}
                onChange={(e) =>
                  onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, limits: { ...s.agent.limits, readPerMinute: Number(e.target.value) || 1 } } }))
                }
                style={{ width: 80, padding: "6px 8px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
              />
            </div>
            <div className="settings-row">
              <div className="settings-row-main">
                <span className="settings-row-title">写入上限</span>
                <span className="settings-row-desc">每分钟最大写操作（新增/编辑/整理）次数</span>
              </div>
              <input
                type="number"
                min={1}
                max={120}
                value={agent.limits.writePerMinute}
                onChange={(e) =>
                  onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, limits: { ...s.agent.limits, writePerMinute: Number(e.target.value) || 1 } } }))
                }
                style={{ width: 80, padding: "6px 8px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
              />
            </div>
            <div className="settings-row">
              <div className="settings-row-main">
                <span className="settings-row-title">单次批量上限</span>
                <span className="settings-row-desc">防止一次性编辑/覆盖大量内容</span>
              </div>
              <input
                type="number"
                min={1}
                max={100}
                value={agent.limits.batchMax}
                onChange={(e) =>
                  onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, limits: { ...s.agent.limits, batchMax: Number(e.target.value) || 1 } } }))
                }
                style={{ width: 80, padding: "6px 8px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--panel-raised)", color: "var(--text)", fontFamily: "var(--font-mono)" }}
              />
            </div>
            <p className="section-pane">超限时返回 429 + Retry-After，Agent 应退避重试。</p>
          </section>

          <section className="settings-group">
            <h3>使用统计</h3>
            <div className="stat-grid">
              <StatCard label="今日请求" value={String(agent.stats.todayRequests)} />
              <StatCard label="写入次数" value={String(agent.stats.writeCount)} />
              <StatCard label="被拦截" value={String(agent.stats.blockedCount)} tone={agent.stats.blockedCount > 0 ? "red" : "default"} />
            </div>
            <div className="settings-row">
              <button type="button" className="secondary-action" onClick={simulateCall}>
                模拟一次调用
              </button>
              <button
                type="button"
                className="mini-action ghost"
                onClick={() =>
                  onUpdateSettings((s) => ({ ...s, agent: { ...s.agent, stats: { todayRequests: 0, writeCount: 0, blockedCount: 0 } } }))
                }
              >
                重置统计
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}