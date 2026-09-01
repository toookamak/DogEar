import { useState } from "react";
import type { AppSettings, TrashItem } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";

interface Props {
  trash: TrashItem[];
  settings: AppSettings;
  onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void;
  bm: BookmarkAPI;
}

export default function TrashSection({ trash, settings, bm }: Props) {
  const [checked, setChecked] = useState<number[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const toggle = (id: number) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const allChecked = trash.length > 0 && checked.length === trash.length;

  if (trash.length === 0) {
    return (
      <div className="section-pane settings-section">
        <section className="settings-group">
          <h3>回收站</h3>
          <p className="section-pane">回收站暂无内容</p>
        </section>
      </div>
    );
  }

  return (
    <div className="section-pane settings-section">
      <section className="settings-group">
        <h3>回收站 {trash.length} 条</h3>
        <div className="settings-row">
          <label className="switch">
            <input type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? [] : trash.map((t) => t.id))} />
            <span className="switch-track" aria-hidden="true" />
            <span className="switch-label">全选</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {checked.length > 0 && (
              <>
                <button type="button" className="mini-action accent" onClick={() => { checked.forEach((id) => bm.restoreBookmark(id)); setChecked([]); }}>
                  恢复（{checked.length}）
                </button>
                <button type="button" className="mini-action confirm-warn" onClick={() => { bm.purgeBookmarks(checked); setChecked([]); }}>
                  彻底删除
                </button>
              </>
            )}
          </div>
        </div>
        {trash.map((t) => (
          <div key={t.id} className="settings-row trash-row">
            <label className="switch">
              <input type="checkbox" checked={checked.includes(t.id)} onChange={() => toggle(t.id)} />
              <span className="switch-track" aria-hidden="true" />
            </label>
            <div className="settings-row-main" style={{ flex: 1 }}>
              <span className="settings-row-title">{t.bookmark.title}</span>
              <span className="settings-row-desc">
                删除于 {t.deletedAt} · {t.expiresAt} · 原「{t.bookmark.status} / {t.bookmark.folder}」
              </span>
            </div>
            <button type="button" className="mini-action" onClick={() => bm.restoreBookmark(t.id)}>恢复</button>
            <button
              type="button"
              className="mini-action ghost"
              onClick={() => {
                bm.purgeBookmarks([t.id]);
                setChecked((c) => c.filter((x) => x !== t.id));
              }}
            >
              彻底删除
            </button>
          </div>
        ))}
        <div className="settings-row">
          <div className="settings-row-main">
            <span className="settings-row-title">保留 {settings.trash.retentionDays} 天后自动永久清理</span>
            <span className="settings-row-desc">彻底删除不可恢复</span>
          </div>
          {confirmClear ? (
            <button
              type="button"
              className="mini-action confirm-warn"
              onClick={() => {
                bm.emptyTrash();
                setConfirmClear(false);
                setChecked([]);
              }}
            >
              再次点击确认清空
            </button>
          ) : (
            <button type="button" className="mini-action confirm-warn" onClick={() => setConfirmClear(true)}>
              清空回收站
            </button>
          )}
        </div>
      </section>
    </div>
  );
}