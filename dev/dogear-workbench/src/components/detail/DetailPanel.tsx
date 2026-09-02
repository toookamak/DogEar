import { useState } from "react";
import type { Bookmark, Status } from "@/types";
import { sourceLabel, statusClass } from "@/utils/labels";

interface Props {
  bookmark: Bookmark | null;
  open: boolean;
  onClose: () => void;
  onMove: (id: number, status: Status) => void;
  onAddTag: (id: number, tag: string) => void;
  onApplySuggestion: (id: number) => void;
  onSuggestionState: (id: number, state: "ignored" | "later") => void;
  onNotify: (message: string) => void;
  onTrash: (id: number) => void;
}

export default function DetailPanel({
  bookmark: b,
  open,
  onClose,
  onMove,
  onAddTag,
  onApplySuggestion,
  onSuggestionState,
  onNotify,
  onTrash,
}: Props) {
  const [tagInput, setTagInput] = useState("");
  const sg = b ? b.suggestion : undefined;

  return (
    <aside
      className={`detail-panel${open ? " open" : ""}`}
      aria-hidden={!open}
    >
      <div className="detail-topline">
        <span>书签详情</span>
        <button
          type="button"
          className="detail-close"
          aria-label="关闭详情"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {!b ? (
        <div className="empty-detail">
          选择一条书签
          <br />
          查看它的整理上下文
        </div>
      ) : (
        <div className="detail-content">
          <div className="detail-badges">
            <span className={`status-pill ${statusClass(b.status)}`}>{b.status}</span>
            <span className="source-chip">{sourceLabel(b.source)}</span>
          </div>

          <h2 className="detail-title">{b.title}</h2>
          <p className="detail-domain">{b.domain}</p>
          <p className="detail-excerpt">{b.excerpt}</p>

          <div className="detail-actions">
            <button
              type="button"
              className="primary-action"
              onClick={() => onNotify("已在浏览器打开（原型模拟）")}
            >
              打开链接 <span className="primary-arrow">↗</span>
            </button>
            {b.status !== "已确认" && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => onMove(b.id, "已确认")}
              >
                确认收藏
              </button>
            )}
            {b.status !== "搁置" && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => onMove(b.id, "搁置")}
              >
                搁置
              </button>
            )}
            {b.status !== "待处理" && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => onMove(b.id, "待处理")}
              >
                退回待处理
              </button>
            )}
            <button
              type="button"
              className="mini-action ghost danger"
              onClick={() => onTrash(b.id)}
            >
              移至回收站
            </button>
          </div>

          {sg && (
            <section className="detail-section suggestion-card">
              <h3>AI 整理建议（建议先行）</h3>
              {sg.state === "accepted" && (
                <p className="suggestion-note">已采纳本次建议并更新了书签。</p>
              )}
              <p className="suggestion-note">{sg.note}</p>
              <div className="suggestion-target">
                <span>建议 Scene</span>
                {sg.scene ? <strong>{sg.scene}</strong> : <span className="chip chip-empty">—</span>}
                <span>文件夹</span>
                <strong>{sg.folder || "—"}</strong>
                <span>标签</span>
                {sg.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
              <div className="suggestion-actions">
                {sg.state === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="mini-action accent"
                      onClick={() => onApplySuggestion(b.id)}
                    >
                      接受建议
                    </button>
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() => onSuggestionState(b.id, "later")}
                    >
                      稍后处理
                    </button>
                    <button
                      type="button"
                      className="mini-action ghost"
                      onClick={() => onSuggestionState(b.id, "ignored")}
                    >
                      忽略
                    </button>
                  </>
                ) : (
                  <span className="suggestion-state">
                    {sg.state === "accepted"
                      ? "✓ 已采纳"
                      : sg.state === "later"
                        ? "已标记稍后处理"
                        : "已忽略"}
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() =>
                        onSuggestionState(b.id, sg.state === "ignored" ? "ignored" : "later")
                      }
                    >
                      撤销
                    </button>
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="detail-section">
            <h3>标签</h3>
            <div className="detail-tag-list">
              {b.tags.length > 0 ? (
                b.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))
              ) : (
                <span className="chip chip-empty">未整理</span>
              )}
            </div>
            <form
              className="detail-tag-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (tagInput.trim()) {
                  onAddTag(b.id, tagInput);
                  setTagInput("");
                }
              }}
            >
              <input
                type="text"
                value={tagInput}
                placeholder="添加标签"
                aria-label="添加标签"
                onChange={(event) => setTagInput(event.target.value)}
              />
              <button type="submit" className="mini-action">
                添加
              </button>
            </form>
          </section>

          <section className="detail-section detail-facts">
            <h3>来源信息</h3>
            <div>
              <span>收集方式</span>
              <strong>{sourceLabel(b.source)}</strong>
            </div>
            <div>
              <span>Scene</span>
              <strong>
                {b.scenes.length > 0 ? b.scenes.join("、") : "未挂载"}
              </strong>
            </div>
            <div>
              <span>文件夹</span>
              <strong>{b.folder || "未设置"}</strong>
            </div>
            <div>
              <span>加入时间</span>
              <strong>{b.createdAt}</strong>
            </div>
            <div>
              <span>同步状态</span>
              <strong>本地已保存 · 待推送</strong>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}