import { useEffect, useState } from "react";
import {
  ACTIVE_TAGS,
  FOLDER_SECTIONS,
  PRIMARY_SECTIONS,
} from "@/data/mock";
import type { SectionKey, Status, SyncState, ThemeMode } from "@/types";

interface Props {
  section: SectionKey;
  tag: string;
  sectionStats: Record<Status, number>;
  folderCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  sidebarOpen: boolean;
  sync: SyncState;
  theme: ThemeMode;
  onSection: (section: SectionKey) => void;
  onTag: (tag: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onRunSync: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}

const STATUS_BADGE: Record<string, Status> = {
  inbox: "待整理",
  later: "稍后读",
  archive: "已归档",
};

const STATUS_DOT: Record<Status, string> = {
  待整理: "dot-amber",
  稍后读: "dot-blue",
  已归档: "dot-mint",
};

const THEME_OPTIONS = [
  { value: "light", label: "浅色", Icon: SunIcon },
  { value: "dark", label: "深色", Icon: MoonIcon },
  { value: "system", label: "跟随系统", Icon: MonitorIcon },
] as const;

function SunIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Sidebar({
  section,
  tag,
  sectionStats,
  folderCounts,
  tagCounts,
  sidebarOpen,
  sync,
  theme,
  onSection,
  onTag,
  onClose,
  onOpenSettings,
  onRunSync,
  onThemeChange,
}: Props) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const total =
    sectionStats["待整理"] + sectionStats["稍后读"] + sectionStats["已归档"];
  const folderCount = Object.keys(folderCounts).length;
  const tagCount = Object.keys(tagCounts).length;

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const close = () => setThemeMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [themeMenuOpen]);

  const themeIcon =
    theme === "system" ? (
      <MonitorIcon />
    ) : theme === "dark" ? (
      <MoonIcon />
    ) : (
      <SunIcon />
    );

  return (
    <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
      <div className="sidebar-scroll">
        <section className="library-summary" aria-label="本地资料库统计">
          <div className="library-summary-head">
            <span className="library-mark" aria-hidden="true">
              ▤
            </span>
            <span className="library-title">本地资料库</span>
          </div>
          <div className="library-total">
            <strong>{total}</strong>
            <span>条收藏</span>
          </div>
          <div className="library-meta">
            <span>{folderCount} 个文件夹</span>
            <span className="library-meta-sep" aria-hidden="true">
              ·
            </span>
            <span>{tagCount} 个标签</span>
          </div>
        </section>

        <nav className="sidebar-block" aria-label="书签导航">
          <div className="nav-label">资料库</div>
          <div className="library-list">
            {PRIMARY_SECTIONS.map((s) => {
              const st = STATUS_BADGE[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`nav-item library-item${section === s.key ? " active" : ""}`}
                  onClick={() => {
                    onSection(s.key);
                    onClose();
                  }}
                >
                  <span className="library-item-main">
                    <span className={`status-dot ${STATUS_DOT[st]}`} aria-hidden="true" />
                    <span>{s.label}</span>
                  </span>
                  <span className="nav-badge">{sectionStats[st]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <nav className="sidebar-block folder-block" aria-label="文件夹">
          <div className="nav-label">文件夹</div>
          <div className="folder-list">
            {FOLDER_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`nav-item${section === s.key ? " active" : ""}`}
                onClick={() => {
                  onSection(s.key);
                  onClose();
                }}
              >
                <span>{s.label}</span>
                <span className="nav-badge">{folderCounts[s.label] ?? 0}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-block tag-block">
          <div className="nav-label">标签</div>
          <div className="tag-list">
            {ACTIVE_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`tag-chip${tag === t ? " active" : ""}`}
                onClick={() => {
                  onTag(tag === t ? "全部" : t);
                  onClose();
                }}
              >
                <span>{t}</span>
                <span className="tag-count">{tagCounts[t] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-foot">
        {themeMenuOpen && (
          <div className="theme-menu" role="menu">
            {THEME_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="menuitem"
                className={`theme-option${theme === o.value ? " checked" : ""}`}
                onClick={() => {
                  onThemeChange(o.value);
                  setThemeMenuOpen(false);
                }}
              >
                <span className="theme-option-icon">
                  <o.Icon />
                </span>
                <span>{o.label}</span>
                <span
                  className="theme-option-radio"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        )}
        <div className="foot-actions">
          <div className="sync-area">
            <button
              type="button"
              className={`icon-btn sync-btn${sync.phase === "syncing" ? " spinning" : ""}`}
              aria-label="立即同步"
              title="立即同步"
              onClick={onRunSync}
            >
              ↻
            </button>
          </div>
          <div className="seg-control" role="group" aria-label="主题与设置">
            <button
              type="button"
              className="seg-btn theme-btn"
              aria-label="切换主题"
              title="切换主题"
              onClick={(event) => {
                event.stopPropagation();
                setThemeMenuOpen((open) => !open);
              }}
            >
              {themeIcon}
              <span className="seg-label">主题</span>
            </button>
            <button
              type="button"
              className="seg-btn seg-settings"
              aria-label="设置"
              title="设置"
              onClick={onOpenSettings}
            >
              <GearIcon />
              <span className="seg-label">设置</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}