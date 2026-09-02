import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { SCENES } from "@/data/mock";
import { SYNC_METRICS } from "@/data/mockSettings";
import type { NavKey, SceneDef, ThemeMode } from "@/types";
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
import NavPlaceholder from "@/components/nav/NavPlaceholder";

interface Props {
  bm: BookmarkAPI;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

const NAV_META: Record<string, { title: string; desc: string }> = {
  inbox: {
    title: "待处理",
    desc: "Inbox：新进入资料库的链接。可长期停留，不强制整理（PRD §2.0.2）。",
  },
  confirmed: {
    title: "已确认",
    desc: "已确认价值的书签，随时可以回看与检索。",
  },
  shelved: {
    title: "搁置",
    desc: "暂不处理的收藏，仍可搜索与检索。",
  },
  navpage: {
    title: "导航页",
    desc: "M6 占位：网页形态导航页，待排期。",
  },
};

const SCENE_META_KEYS = new Map<string, SceneDef>(SCENES.map((s) => [s.key, s]));

const FOLDER_TITLES: Record<string, string> = {
  "fd-design": "设计参考",
  "fd-engineering": "工程与工具",
  "fd-notes": "文章与笔记",
};

function navMeta(nav: string) {
  if (nav.startsWith("sc-")) {
    const scene = SCENE_META_KEYS.get(nav);
    if (scene) {
      return {
        title: scene.name,
        desc: scene.description,
        primaryAction: scene.primaryAction,
        density: scene.density,
      };
    }
  }
  const folder = FOLDER_TITLES[nav];
  if (folder) {
    return { title: folder, desc: "按文件夹浏览（Folder 保持稳定、通常单属）。", primaryAction: undefined, density: "cozy" as const };
  }
  const base = NAV_META[nav];
  return { title: base?.title ?? "工作台", desc: base?.desc ?? "", primaryAction: undefined, density: "cozy" as const };
}

export default function AppShell({ bm, theme, onThemeChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    state,
    visibleBookmarks,
    sectionStats,
    sceneCounts,
    folderCounts,
    tagCounts,
  } = bm;
  const { settings, updateSettings } = useSettings();
  const nav: string = state.filters.section;
  const meta = navMeta(nav);
  const selection = state.selection;

  const hasActiveFilters =
    state.filters.query !== "" ||
    state.filters.tag !== "全部" ||
    state.filters.source !== "全部";

  const activeId = state.detailOpen ? state.selectedId : null;

  // AERR 行为原型：进入 Scene 视图时应用该 Scene 的默认排序与信息密度（PRD §2.0.3）。
  useEffect(() => {
    if (nav.startsWith("sc-")) {
      const scene = SCENE_META_KEYS.get(nav);
      if (scene) bm.setSort(scene.defaultSort);
    }
    // 仅在切换导航时应用一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  const countLabel =
    nav === "inbox" ? " 条待处理" : " 条收藏";

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  useEffect(() => {
    if (!state.detailOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") bm.closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.detailOpen, bm]);

  return (
    <div className="app-shell">
      <TopBar onToggleSidebar={bm.toggleSidebar} onMockSave={bm.mockSaveBookmark} />

      <div className="workspace">
        <Sidebar
          nav={nav as NavKey}
          tag={state.filters.tag}
          statusCounts={sectionStats}
          sceneCounts={sceneCounts}
          folderCounts={folderCounts}
          tagCounts={tagCounts}
          sidebarOpen={state.sidebarOpen}
          sync={state.sync}
          theme={theme}
          onNav={bm.setSection}
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
          {nav === "navpage" ? (
            <NavPlaceholder />
          ) : (
            <>
              <section className="content-head">
                <div>
                  <h1 className="page-title">
                    {meta.title}{" "}
                    <span className="page-count">{visibleBookmarks.length}</span>
                  </h1>
                  <p className="page-desc">{meta.desc}</p>
                </div>
                {meta.primaryAction && (
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() =>
                      bm.notify({
                        kind: "success",
                        message: `Scene 主操作「${meta.primaryAction}」（原型演示）`,
                      })
                    }
                  >
                    {meta.primaryAction} <span className="primary-arrow">↗</span>
                  </button>
                )}
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
                  onConfirm={() => bm.batchSetStatus("已确认", selection)}
                  onShelve={() => bm.batchSetStatus("搁置", selection)}
                  onBack={() => bm.batchSetStatus("待处理", selection)}
                  onAddTag={(tag) => bm.batchAddTag(tag, selection)}
                  onClear={bm.clearSelection}
                  onTrash={() => bm.trashBookmarks(selection, settings.trash.retentionDays)}
                />
              )}

              <section
                className="bookmark-area"
                data-density={meta.density ?? "cozy"}
              >
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
            </>
          )}
        </main>

        {/* 右区：可折叠工具面板（默认收起）——覆盖式浮层；面板外点击由遮罩拦截并收起 */}
        <button
          type="button"
          className={`detail-backdrop${state.detailOpen ? " open" : ""}`}
          aria-label="收起详情"
          aria-hidden={!state.detailOpen}
          tabIndex={state.detailOpen ? 0 : -1}
          onClick={bm.closeDetail}
        />
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
        pendingCount={sectionStats["待处理"]}
        metrics={SYNC_METRICS}
        queueLength={settings.raindrop.queue.length}
        pendingPush={
          settings.raindrop.queue.filter((i) => i.status === "pending").length
        }
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
