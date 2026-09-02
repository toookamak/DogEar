import { useEffect, useState } from "react";
import {
  ACTIVE_TAGS,
  FOLDER_SECTIONS,
  SCENES,
  STATUS_NAV,
} from "@/data/mock";
import type { NavKey, SyncState, ThemeMode } from "@/types";
import { statusDotClass } from "@/utils/labels";

interface Props {
  nav: NavKey;
  tag: string;
  statusCounts: Record<"待处理" | "已确认" | "搁置", number>;
  sceneCounts: Record<string, number>;
  folderCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  sidebarOpen: boolean;
  sync: SyncState;
  theme: ThemeMode;
  onNav: (nav: NavKey) => void;
  onTag: (tag: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onRunSync: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}

// 主题入口收敛为 light / dark（用户已确认）。
// Claude / Notion 系列仍保留在 tokens.css 中作为占位（TODO(pending)），
// 待设计评审收敛色板后再决定是否重新开放入口。
const THEME_OPTIONS = [
  { value: "light", label: "浅色", Icon: SunIcon },
  { value: "dark", label: "深色", Icon: MoonIcon },
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

function GearIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Sidebar({
  nav,
  tag,
  statusCounts,
  sceneCounts,
  folderCounts,
  tagCounts,
  sidebarOpen,
  sync,
  theme,
  onNav,
  onTag,
  onClose,
  onOpenSettings,
  onRunSync,
  onThemeChange,
}: Props) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const total =
    statusCounts["待处理"] + statusCounts["已确认"] + statusCounts["搁置"];
  const folderCount = Object.keys(folderCounts).length;
  const tagCount = Object.keys(tagCounts).length;

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const close = () => setThemeMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [themeMenuOpen]);

  const ActiveThemeIcon =
    THEME_OPTIONS.find((option) => option.value === theme)?.Icon ?? SunIcon;
  const themeIcon = <ActiveThemeIcon />;

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

        {/* 左区①：Scene（使用情境，PRD §2.0.1） */}
        <nav className="sidebar-block" aria-label="Scene">
          <div className="nav-label">Scene · 使用情境</div>
          <div className="library-list">
            {SCENES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`nav-item library-item${nav === s.key ? " active" : ""}`}
                title={s.description}
                onClick={() => {
                  onNav(s.key);
                  onClose();
                }}
              >
                <span className="library-item-main">
                  <span className="scene-glyph" aria-hidden="true">
                    ◈
                  </span>
                  <span>{s.name}</span>
                </span>
                <span className="nav-badge">{sceneCounts[s.name] ?? 0}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* 左区②：状态三视图（待处理 / 已确认 / 搁置） */}
        <nav className="sidebar-block" aria-label="状态">
          <div className="nav-label">状态</div>
          <div className="library-list">
            {STATUS_NAV.map((s) => {
              const st = s.key as "inbox" | "confirmed" | "shelved";
              const statusName =
                st === "inbox" ? "待处理" : st === "confirmed" ? "已确认" : "搁置";
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`nav-item library-item${nav === s.key ? " active" : ""}`}
                  onClick={() => {
                    onNav(s.key);
                    onClose();
                  }}
                >
                  <span className="library-item-main">
                    <span className={`status-dot ${statusDotClass(statusName)}`} aria-hidden="true" />
                    <span>{s.label}</span>
                  </span>
                  <span className="nav-badge">{statusCounts[statusName]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* 左区③：文件夹（稳定维度） */}
        <nav className="sidebar-block folder-block" aria-label="文件夹">
          <div className="nav-label">文件夹</div>
          <div className="folder-list">
            {FOLDER_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`nav-item${nav === s.key ? " active" : ""}`}
                onClick={() => {
                  onNav(s.key);
                  onClose();
                }}
              >
                <span>{s.label}</span>
                <span className="nav-badge">{folderCounts[s.label] ?? 0}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* 左区④：标签云 */}
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

        {/* 近期需求占位：导航页（M6，访问记录落库为核心） */}
        <div className="sidebar-block">
          <div className="nav-label">即将推出</div>
          <button
            type="button"
            className={`nav-item nav-item-pending${nav === "navpage" ? " active" : ""}`}
            onClick={() => {
              onNav("navpage");
              onClose();
            }}
          >
            <span>导航页（M6 占位）</span>
            <span className="nav-badge">规划中</span>
          </button>
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
