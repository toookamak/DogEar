import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import type { SectionKey, ThemeMode } from "@/types";
import type { BookmarkAPI } from "@/types/bookmark-api";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import WorkspaceToolbar from "@/components/bookmarks/WorkspaceToolbar";
import BookmarkGrid from "@/components/bookmarks/BookmarkGrid";
import BookmarkList from "@/components/bookmarks/BookmarkList";
import BookmarkBoard from "@/components/bookmarks/BookmarkBoard";
import BookmarkTabs from "@/components/bookmarks/BookmarkTabs";
import SelectionToolbar from "@/components/bookmarks/SelectionToolbar";
import DetailPanel from "@/components/detail/DetailPanel";
import ToastRegion from "@/components/feedback/ToastRegion";
import EmptyState from "@/components/feedback/EmptyState";
import Skeleton from "@/components/feedback/Skeleton";
import SettingsModal from "@/components/settings/SettingsModal";

interface Props {
  bm: BookmarkAPI;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

const SECTION_META: Record<SectionKey, { title: string; desc: string }> = {
  inbox: {
    title: "收件箱",
    desc: "先处理新进入资料库的链接，再决定阅读、归档或交给 AI 整理。",
  },
  later: {
    title: "稍后读",
    desc: "排入阅读队列的内容，按自己的节奏逐条消化。",
  },
  archive: {
    title: "已归档",
    desc: "已完成整理的书签，随时可以回看与检索。",
  },
  design: {
    title: "设计参考",
    desc: "灵感、排版与设计体系相关的收藏。",
  },
  engineering: {
    title: "工程与工具",
    desc: "框架、存储与工程实践相关的收藏。",
  },
  notes: {
    title: "文章与笔记",
    desc: "长文、观点与个人知识沉淀相关的收藏。",
  },
};

export default function AppShell({ bm, theme, onThemeChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { state, visibleBookmarks, sectionStats, folderCounts, tagCounts } = bm;
  const { settings, updateSettings } = useSettings();
  const meta = SECTION_META[state.filters.section];
  const selection = state.selection;

  const hasActiveFilters =
    state.filters.query !== "" ||
    state.filters.tag !== "全部" ||
    state.filters.source !== "全部";

  const activeId = state.detailOpen ? state.selectedId : null;

  const countLabel =
    state.filters.section === "inbox" ? " 条待处理" : " 条收藏";

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  return (
    <div className="app-shell">
      <TopBar onToggleSidebar={bm.toggleSidebar} />

      <div className="workspace">
        <Sidebar
          section={state.filters.section}
          tag={state.filters.tag}
          sectionStats={sectionStats}
          folderCounts={folderCounts}
          tagCounts={tagCounts}
          sidebarOpen={state.sidebarOpen}
          sync={state.sync}
          theme={theme}
          onSection={bm.setSection}
          onTag={bm.setTag}
          onClose={() => bm.setSidebar(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onRunSync={bm.runSync}
          onThemeChange={onThemeChange}
        />
        {state.sidebarOpen && (
          <button
            type="button"
            className="backdrop"
            aria-label="关闭导航"
            onClick={() => bm.setSidebar(false)}
          />
        )}

        <main className="main-content" id="workbench">
          <section className="content-head">
            <h1 className="page-title">
              {meta.title}{" "}
              <span className="page-count">{visibleBookmarks.length}</span>
            </h1>
          </section>

          <WorkspaceToolbar
            filters={state.filters}
            view={state.view}
            organizeCount={bm.pendingSuggestionCount}
            onQuery={bm.setQuery}
            onSource={bm.setSource}
            onSort={bm.setSort}
            onView={bm.setView}
            onOrganize={bm.organizeAction}
          />

          {selection.length > 0 && (
            <SelectionToolbar
              count={selection.length}
              onArchive={() => bm.batchSetStatus("已归档", selection)}
              onLater={() => bm.batchSetStatus("稍后读", selection)}
              onAddTag={(tag) => bm.batchAddTag(tag, selection)}
              onClear={bm.clearSelection}
              onTrash={() => bm.trashBookmarks(selection, settings.trash.retentionDays)}
            />
          )}

          <section className="bookmark-area">
            <div className="bookmark-summary">
              <span className="result-count">
                显示 {visibleBookmarks.length}
                {countLabel}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={bm.clearFilters}
                >
                  清除筛选
                </button>
              )}
            </div>

            {state.booting ? (
              <Skeleton />
            ) : visibleBookmarks.length === 0 ? (
              <EmptyState onClear={bm.clearFilters} />
            ) : state.view === "grid" ? (
              <BookmarkGrid
                items={visibleBookmarks}
                selection={selection}
                selectedId={activeId}
                onOpen={bm.openDetail}
                onToggleSelect={bm.toggleSelect}
              />
            ) : state.view === "list" ? (
              <BookmarkList
                items={visibleBookmarks}
                selection={selection}
                selectedId={activeId}
                onOpen={bm.openDetail}
                onToggleSelect={bm.toggleSelect}
                onMove={bm.moveStatus}
              />
            ) : state.view === "tags" ? (
              <BookmarkTabs
                items={visibleBookmarks}
                selectedId={activeId}
                onOpen={bm.openDetail}
              />
            ) : (
              <BookmarkBoard
                items={visibleBookmarks}
                selectedId={activeId}
                onOpen={bm.openDetail}
                onMove={bm.moveStatus}
              />
            )}
          </section>
        </main>

        {state.detailOpen && state.selectedId && (
          <button
            type="button"
            className={`detail-scrim${state.detailOpen ? " show" : ""}`}
            aria-label="关闭详情"
            onClick={bm.closeDetail}
          />
        )}
        <DetailPanel
          bookmark={bm.selectedBookmark}
          open={state.detailOpen}
          onClose={bm.closeDetail}
          onMove={bm.moveStatus}
          onAddTag={(id, tag) => bm.batchAddTag(tag, [id])}
          onApplySuggestion={bm.applySuggestion}
          onSuggestionState={bm.setSuggestionState}
          onNotify={(message) =>
            bm.notify({ kind: "success", message })
          }
          onTrash={(id) => bm.trashBookmarks([id], settings.trash.retentionDays)}
        />
      </div>

      <StatusBar
        sync={state.sync}
        pendingCount={sectionStats["待整理"]}
        onRetry={bm.runSync}
      />
      <ToastRegion
        toasts={state.toasts}
        onDismiss={bm.dismissToast}
        onUndo={bm.undo}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        bm={bm}
      />
    </div>
  );
}