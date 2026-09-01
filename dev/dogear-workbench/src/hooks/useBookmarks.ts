import { useCallback, useEffect, useMemo, useReducer } from "react";
import { initialBookmarks } from "@/data/mock";
import { SEED_LOGS } from "@/data/mockSettings";
import type {
  Bookmark,
  Filters,
  LogEntry,
  LogSource,
  LogType,
  SectionKey,
  SortKey,
  Source,
  Status,
  ToastMsg,
  TrashItem,
  UndoAction,
  ViewMode,
} from "@/types";

interface SyncState {
  phase: "idle" | "syncing" | "success" | "error";
  attempts: number;
  lastSyncAt: string;
}

interface State {
  bookmarks: Bookmark[];
  filters: Filters;
  view: ViewMode;
  selection: number[];
  selectedId: number | null;
  detailOpen: boolean;
  sidebarOpen: boolean;
  booting: boolean;
  sync: SyncState;
  toasts: ToastMsg[];
  logs: LogEntry[];
  trash: TrashItem[];
}

type Action =
  | { type: "SET_SECTION"; section: SectionKey }
  | { type: "SET_TAG"; tag: string }
  | { type: "SET_SOURCE"; source: Source | "全部" }
  | { type: "SET_QUERY"; query: string }
  | { type: "SET_SORT"; sort: SortKey }
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "CLEAR_FILTERS" }
  | { type: "TOGGLE_SELECT"; id: number }
  | { type: "CLEAR_SELECTION" }
  | { type: "OPEN_DETAIL"; id: number }
  | { type: "CLOSE_DETAIL" }
  | { type: "TOGGLE_DETAIL" }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_SIDEBAR"; open: boolean }
  | { type: "BATCH_STATUS"; status: Exclude<Status, "待整理">; ids: number[] }
  | { type: "ADD_TAG"; tag: string; ids: number[] }
  | { type: "APPLY_SUGGESTION"; id: number }
  | { type: "SUGGESTION_STATE"; id: number; state: "ignored" | "later" }
  | { type: "MOVE_STATUS"; id: number; status: Status }
  | { type: "BOOT_DONE" }
  | { type: "SYNC_START" }
  | { type: "SYNC_DONE"; ok: boolean }
  | { type: "PUSH_TOAST"; toast: ToastMsg }
  | { type: "DISMISS_TOAST"; id: number }
  | { type: "UNDO"; undo: UndoAction }
  | { type: "TRASH_BOOKMARKS"; items: TrashItem[] }
  | { type: "RESTORE_BOOKMARK"; id: number }
  | { type: "PURGE_BOOKMARKS"; ids: number[] }
  | { type: "EMPTY_TRASH" }
  | { type: "LOG_ACTION"; entry: LogEntry }
  | { type: "CLEAR_LOGS" };

const FOLDER_LABEL: Record<string, string> = {
  design: "设计参考",
  engineering: "工程与工具",
  notes: "文章与笔记",
};

const STATUS_SECTIONS: { inbox: Status[]; later: Status[]; archive: Status[] } = {
  inbox: ["待整理"],
  later: ["稍后读"],
  archive: ["已归档"],
};

const INITIAL_FILTERS: Filters = {
  section: "inbox",
  query: "",
  tag: "全部",
  source: "全部",
  sort: "recent",
};

const initialState: State = {
  bookmarks: initialBookmarks,
  filters: INITIAL_FILTERS,
  view: "grid",
  selection: [],
  selectedId: null,
  detailOpen: false,
  sidebarOpen: false,
  booting: true,
  sync: { phase: "idle", attempts: 0, lastSyncAt: "14:26" },
  toasts: [],
  logs: SEED_LOGS,
  trash: seedTrash(),
};

let toastSeq = 0;
let syncAttempt = 0;
let logSeq = SEED_LOGS.length;

function nowLabel(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function seedTrash(): TrashItem[] {
  return [
    {
      id: 901,
      bookmark: {
        id: 901, title: "旧版主题截图存档", url: "https://example.com/old-theme", domain: "example.com",
        excerpt: "早期视觉稿截图，已由新主题替代。", source: "extension", status: "已归档", folder: "文章与笔记",
        tags: ["存档"], createdAt: "08-20 09:12", ts: Date.now() - 86400000 * 6, progress: 100,
        art: "art-slate", mark: "ARCH",
      },
      deletedAt: "08-25 10:02", expiresAt: "09-01 10:02",
    },
    {
      id: 902,
      bookmark: {
        id: 902, title: "An old newsletter issue", url: "https://example.com/newsletter-42", domain: "example.com",
        excerpt: "过期简报，不再需要。", source: "raindrop", status: "稍后读", folder: "文章与笔记",
        tags: ["阅读"], createdAt: "08-18 20:40", ts: Date.now() - 86400000 * 12, progress: 20,
        art: "art-rust", mark: "NL",
      },
      deletedAt: "昨天 18:20", expiresAt: "09-06 18:20",
    },
  ];
}

function patchBookmark(
  bookmarks: Bookmark[],
  id: number,
  patch: Partial<Bookmark>
): Bookmark[] {
  return bookmarks.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SECTION":
      return { ...state, filters: { ...state.filters, section: action.section } };
    case "SET_TAG":
      return { ...state, filters: { ...state.filters, tag: action.tag } };
    case "SET_SOURCE":
      return { ...state, filters: { ...state.filters, source: action.source } };
    case "SET_QUERY":
      return { ...state, filters: { ...state.filters, query: action.query } };
    case "SET_SORT":
      return { ...state, filters: { ...state.filters, sort: action.sort } };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "CLEAR_FILTERS":
      return {
        ...state,
        filters: {
          ...INITIAL_FILTERS,
          section: state.filters.section,
          sort: state.filters.sort,
        },
      };
    case "TOGGLE_SELECT":
      return {
        ...state,
        selection: state.selection.includes(action.id)
          ? state.selection.filter((id) => id !== action.id)
          : [...state.selection, action.id],
      };
    case "CLEAR_SELECTION":
      return { ...state, selection: [] };
    case "OPEN_DETAIL":
      return {
        ...state,
        selectedId: action.id,
        detailOpen: true,
      };
    case "CLOSE_DETAIL":
      return { ...state, detailOpen: false };
    case "TOGGLE_DETAIL":
      return { ...state, detailOpen: !state.detailOpen };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case "SET_SIDEBAR":
      return { ...state, sidebarOpen: action.open };
    case "BATCH_STATUS": {
      const bookmarks = state.bookmarks.map((b) =>
        action.ids.includes(b.id) ? { ...b, status: action.status } : b
      );
      return { ...state, bookmarks, selection: [] };
    }
    case "ADD_TAG": {
      const tag = action.tag.trim();
      if (!tag) return state;
      const bookmarks = state.bookmarks.map((b) =>
        action.ids.includes(b.id) && !b.tags.includes(tag)
          ? { ...b, tags: [...b.tags, tag] }
          : b
      );
      return { ...state, bookmarks };
    }
    case "APPLY_SUGGESTION": {
      const target = state.bookmarks.find((b) => b.id === action.id);
      if (!target || !target.suggestion || target.suggestion.state === "accepted") {
        return state;
      }
      const mergedTags = Array.from(
        new Set([...target.tags, ...target.suggestion.tags])
      );
      return {
        ...state,
        bookmarks: patchBookmark(state.bookmarks, action.id, {
          folder: target.suggestion.folder,
          tags: mergedTags,
          suggestion: { ...target.suggestion, state: "accepted" },
        }),
      };
    }
    case "SUGGESTION_STATE": {
      const target = state.bookmarks.find((b) => b.id === action.id);
      if (!target || !target.suggestion) return state;
      const next =
        target.suggestion.state === action.state ? "pending" : action.state;
      return {
        ...state,
        bookmarks: patchBookmark(state.bookmarks, action.id, {
          suggestion: { ...target.suggestion, state: next },
        }),
      };
    }
    case "MOVE_STATUS": {
      const target = state.bookmarks.find((b) => b.id === action.id);
      if (!target) return state;
      return {
        ...state,
        bookmarks: patchBookmark(state.bookmarks, action.id, {
          status: action.status,
          progress: action.status === "已归档" ? 100 : target.progress,
        }),
      };
    }
    case "BOOT_DONE":
      return { ...state, booting: false };
    case "SYNC_START":
      return {
        ...state,
        sync: {
          ...state.sync,
          phase: "syncing",
          attempts: state.sync.attempts + 1,
        },
      };
    case "SYNC_DONE":
      return {
        ...state,
        sync: {
          ...state.sync,
          phase: action.ok ? "success" : "error",
          lastSyncAt: action.ok ? "刚刚" : state.sync.lastSyncAt,
        },
      };
    case "TRASH_BOOKMARKS": {
      const ids = new Set(action.items.map((i) => i.id));
      const bookmarks = state.bookmarks.filter((b) => !ids.has(b.id));
      return { ...state, bookmarks, trash: [...action.items, ...state.trash], selection: [] };
    }
    case "RESTORE_BOOKMARK": {
      const item = state.trash.find((t) => t.id === action.id);
      if (!item) return state;
      return {
        ...state,
        bookmarks: [...state.bookmarks, item.bookmark],
        trash: state.trash.filter((t) => t.id !== action.id),
      };
    }
    case "PURGE_BOOKMARKS":
      return {
        ...state,
        trash: state.trash.filter((t) => !action.ids.includes(t.id)),
      };
    case "EMPTY_TRASH":
      return { ...state, trash: [] };
    case "LOG_ACTION":
      return { ...state, logs: [action.entry, ...state.logs].slice(0, 120) };
    case "CLEAR_LOGS":
      return { ...state, logs: [] };
    case "PUSH_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] };
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    case "UNDO": {
      const undo = action.undo;
      if (undo.type === "restoreStatus") {
        const map = new Map(undo.entries.map((e) => [e.id, e.status]));
        return {
          ...state,
          bookmarks: state.bookmarks.map((b) =>
            map.has(b.id) ? { ...b, status: map.get(b.id)! } : b
          ),
        };
      }
      if (undo.type === "restoreTrash") {
        const ids = new Set(undo.items.map((i) => i.id));
        return {
          ...state,
          bookmarks: [...state.bookmarks, ...undo.items.map((i) => i.bookmark)],
          trash: state.trash.filter((t) => !ids.has(t.id)),
        };
      }
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) =>
          b.id === undo.id && b.suggestion
            ? {
                ...b,
                folder: undo.folder,
                tags: undo.tags,
                suggestion: { ...b.suggestion, state: "pending" as const },
              }
            : b
        ),
      };
    }
    default:
      return state;
  }
}

function sortBy(list: Bookmark[], sort: SortKey): Bookmark[] {
  const copy = [...list];
  switch (sort) {
    case "recent":
      return copy.sort((a, b) => b.ts - a.ts);
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "zh"));
    case "domain":
      return copy.sort((a, b) => a.domain.localeCompare(b.domain));
  }
}

function matchesSection(bookmark: Bookmark, section: SectionKey): boolean {
  if (section === "inbox" || section === "later" || section === "archive") {
    return STATUS_SECTIONS[section].includes(bookmark.status);
  }
  return bookmark.folder === FOLDER_LABEL[section];
}

export function useBookmarks() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const timer = window.setTimeout(() => dispatch({ type: "BOOT_DONE" }), 520);
    return () => window.clearTimeout(timer);
  }, []);

  const notify = useCallback(
    (msg: Omit<ToastMsg, "id">) => {
      const id = ++toastSeq;
      dispatch({ type: "PUSH_TOAST", toast: { ...msg, id } });
      window.setTimeout(() => dispatch({ type: "DISMISS_TOAST", id }), 4600);
    },
    [dispatch]
  );

  const pushLog = useCallback(
    (type: LogType, action: string, object: string, source: LogSource, result: "success" | "fail" = "success") => {
      const entry: LogEntry = { id: ++logSeq, at: nowLabel(), type, action, object, source, result };
      dispatch({ type: "LOG_ACTION", entry });
    },
    [dispatch]
  );

  const visibleBookmarks = useMemo(() => {
    const q = state.filters.query.trim().toLowerCase();
    const list = state.bookmarks.filter((b) => {
      const inSection = matchesSection(b, state.filters.section);
      const matchesTag =
        state.filters.tag === "全部" || b.tags.includes(state.filters.tag);
      const matchesSource =
        state.filters.source === "全部" ||
        b.source === state.filters.source;
      const haystack = `${b.title} ${b.domain} ${b.folder} ${b.tags.join(" ")}`.toLowerCase();
      const matchesQuery = q === "" || haystack.includes(q);
      return inSection && matchesTag && matchesSource && matchesQuery;
    });
    return sortBy(list, state.filters.sort);
  }, [state.bookmarks, state.filters]);

  const sectionStats = useMemo(() => {
    const counts: Record<Status, number> = {
      待整理: 0,
      稍后读: 0,
      已归档: 0,
    };
    for (const b of state.bookmarks) counts[b.status] += 1;
    return counts;
  }, [state.bookmarks]);

  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of state.bookmarks) {
      map[b.folder] = (map[b.folder] ?? 0) + 1;
    }
    return map;
  }, [state.bookmarks]);

  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of state.bookmarks) {
      for (const t of b.tags) map[t] = (map[t] ?? 0) + 1;
    }
    return map;
  }, [state.bookmarks]);

  const selectedBookmarks = useMemo(
    () =>
      state.bookmarks.filter((b) => state.selection.includes(b.id)),
    [state.bookmarks, state.selection]
  );

  const selectedBookmark = useMemo(
    () =>
      state.bookmarks.find((b) => b.id === state.selectedId) ?? null,
    [state.bookmarks, state.selectedId]
  );

  const pendingSuggestionCount = useMemo(
    () =>
      visibleBookmarks.filter(
        (b) => b.suggestion && b.suggestion.state === "pending"
      ).length,
    [visibleBookmarks]
  );

  const setSection = useCallback(
    (section: SectionKey) => dispatch({ type: "SET_SECTION", section }),
    [dispatch]
  );
  const setTag = useCallback(
    (tag: string) => dispatch({ type: "SET_TAG", tag }),
    [dispatch]
  );
  const setSource = useCallback(
    (source: Source | "全部") => dispatch({ type: "SET_SOURCE", source }),
    [dispatch]
  );
  const setQuery = useCallback(
    (query: string) => dispatch({ type: "SET_QUERY", query }),
    [dispatch]
  );
  const setSort = useCallback(
    (sort: SortKey) => dispatch({ type: "SET_SORT", sort }),
    [dispatch]
  );
  const setView = useCallback(
    (view: ViewMode) => dispatch({ type: "SET_VIEW", view }),
    [dispatch]
  );
  const clearFilters = useCallback(
    () => dispatch({ type: "CLEAR_FILTERS" }),
    [dispatch]
  );
  const toggleSelect = useCallback(
    (id: number) => dispatch({ type: "TOGGLE_SELECT", id }),
    [dispatch]
  );
  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    [dispatch]
  );
  const openDetail = useCallback(
    (id: number) => dispatch({ type: "OPEN_DETAIL", id }),
    [dispatch]
  );
  const closeDetail = useCallback(
    () => dispatch({ type: "CLOSE_DETAIL" }),
    [dispatch]
  );
  const toggleSidebar = useCallback(
    () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    [dispatch]
  );
  const setSidebar = useCallback(
    (open: boolean) => dispatch({ type: "SET_SIDEBAR", open }),
    [dispatch]
  );

  const batchSetStatus = useCallback(
    (status: Exclude<Status, "待整理">, ids: number[]) => {
      const prev = ids
        .map((id) => state.bookmarks.find((b) => b.id === id))
        .filter((b): b is Bookmark => Boolean(b))
        .map((b) => ({ id: b.id, status: b.status }));
      dispatch({ type: "BATCH_STATUS", status, ids });
      const label = status === "稍后读" ? "稍后读" : "归档";
      pushLog("整理", "批量移动状态", `移至「${label}」× ${ids.length} 条`, "工作台");
      notify({
        kind: "success",
        message: `已将 ${ids.length} 条书签移至「${label}」`,
        actionLabel: "撤销",
        undo: { type: "restoreStatus", entries: prev },
      });
    },
    [dispatch, notify, pushLog, state.bookmarks]
  );

  const batchAddTag = useCallback(
    (tag: string, ids: number[]) => {
      const t = tag.trim();
      if (!t) return;
      dispatch({ type: "ADD_TAG", tag: t, ids });
      pushLog("整理", "批量添加标签", `「${t}」× ${ids.length} 条`, "工作台");
      notify({
        kind: "success",
        message: `已为 ${ids.length} 条书签添加标签「${t}」`,
      });
    },
    [dispatch, notify, pushLog]
  );

  const applySuggestion = useCallback(
    (id: number) => {
      const target = state.bookmarks.find((b) => b.id === id);
      if (!target || !target.suggestion) return;
      dispatch({ type: "APPLY_SUGGESTION", id });
      pushLog("整理", "采纳 AI 建议", target.title, "工作台");
      notify({
        kind: "success",
        message: "已采纳 AI 建议并更新书签",
        actionLabel: "撤销",
        undo: {
          type: "restoreSuggestion",
          id,
          folder: target.folder,
          tags: target.tags,
        },
      });
    },
    [dispatch, notify, pushLog, state.bookmarks]
  );

  const setSuggestionState = useCallback(
    (id: number, state2: "ignored" | "later") => {
      dispatch({ type: "SUGGESTION_STATE", id, state: state2 });
    },
    [dispatch]
  );

  const moveStatus = useCallback(
    (id: number, status: Status) => {
      const target = state.bookmarks.find((b) => b.id === id);
      if (!target || target.status === status) return;
      dispatch({ type: "MOVE_STATUS", id, status });
      pushLog("编辑", `移动状态 → ${status}`, target.title, "工作台");
      notify({
        kind: "success",
        message: `已将「${target.title}」移至「${status}」`,
        actionLabel: "撤销",
        undo: { type: "restoreStatus", entries: [{ id, status: target.status }] },
      });
    },
    [dispatch, notify, pushLog, state.bookmarks]
  );

  const runSync = useCallback(
    (cb?: (ok: boolean) => void) => {
      syncAttempt += 1;
      const no = syncAttempt;
      dispatch({ type: "SYNC_START" });
      window.setTimeout(() => {
        const ok = no % 3 !== 0;
        dispatch({ type: "SYNC_DONE", ok });
        if (ok) {
          pushLog("同步", "推送/拉取完成", "与 Raindrop 完成同步", "同步");
          notify({ kind: "success", message: "已与 Raindrop 完成同步" });
        } else {
          pushLog("同步", "推送/拉取完成", "与 Raindrop 完成同步", "同步", "fail");
          notify({ kind: "error", message: "同步失败：网络限频，请重试" });
        }
        cb?.(ok);
      }, 1200);
    },
    [dispatch, notify, pushLog]
  );

  const dismissToast = useCallback(
    (id: number) => dispatch({ type: "DISMISS_TOAST", id }),
    [dispatch]
  );

  const undo = useCallback(
    (u: UndoAction) => {
      dispatch({ type: "UNDO", undo: u });
      pushLog("恢复", "撤销操作", "上一步操作", "工作台");
      notify({ kind: "success", message: "已撤销该操作" });
    },
    [dispatch, notify, pushLog]
  );

  const trashBookmarks = useCallback(
    (ids: number[], expireDays: number) => {
      const items: TrashItem[] = [];
      for (const b of state.bookmarks) {
        if (!ids.includes(b.id)) continue;
        items.push({ id: b.id, bookmark: b, deletedAt: nowLabel(), expiresAt: `${expireDays} 天后自动清理` });
      }
      dispatch({ type: "TRASH_BOOKMARKS", items });
      if (items.length > 0) {
        const labels = items.map((i) => i.bookmark.title).join("、");
        pushLog("删除", "移至回收站", labels, "工作台");
        notify({
          kind: "success",
          message: `已将 ${items.length} 条书签移至回收站`,
          actionLabel: "撤销",
          undo: { type: "restoreTrash", items },
        });
        dispatch({ type: "CLEAR_SELECTION" });
      }
    },
    [dispatch, notify, pushLog, state.bookmarks]
  );

  const restoreBookmark = useCallback(
    (id: number) => {
      const item = state.trash.find((t) => t.id === id);
      if (!item) return;
      dispatch({ type: "RESTORE_BOOKMARK", id });
      pushLog("恢复", "从回收站恢复", item.bookmark.title, "工作台");
      notify({ kind: "success", message: `已恢复「${item.bookmark.title}」` });
    },
    [dispatch, notify, pushLog, state.trash]
  );

  const purgeBookmarks = useCallback(
    (ids: number[]) => {
      const items = state.trash.filter((t) => ids.includes(t.id));
      dispatch({ type: "PURGE_BOOKMARKS", ids });
      pushLog("删除", "彻底删除", items.map((i) => i.bookmark.title).join("、"), "工作台");
      notify({ kind: "success", message: `已彻底删除 ${items.length} 条书签` });
    },
    [dispatch, notify, pushLog, state.trash]
  );

  const emptyTrash = useCallback(() => {
    const count = state.trash.length;
    dispatch({ type: "EMPTY_TRASH" });
    pushLog("删除", "清空回收站", `${count} 条`, "工作台");
    notify({ kind: "success", message: `已清空回收站（${count} 条）` });
  }, [dispatch, notify, pushLog, state.trash.length]);

  const clearLogs = useCallback(() => {
    dispatch({ type: "CLEAR_LOGS" });
  }, [dispatch]);

  const organizeAction = useCallback(() => {
    if (pendingSuggestionCount === 0) {
      notify({ kind: "success", message: "当前没有待处理的整理建议" });
      return;
    }
    notify({
      kind: "success",
      message: `已生成 ${pendingSuggestionCount} 条整理建议，可在详情面板查看`,
    });
  }, [notify, pendingSuggestionCount]);

  return {
    state,
    notify,
    visibleBookmarks,
    sectionStats,
    folderCounts,
    tagCounts,
    selectedBookmarks,
    selectedBookmark,
    pendingSuggestionCount,
    setSection,
    setTag,
    setSource,
    setQuery,
    setSort,
    setView,
    clearFilters,
    toggleSelect,
    clearSelection,
    openDetail,
    closeDetail,
    toggleSidebar,
    setSidebar,
    batchSetStatus,
    batchAddTag,
    applySuggestion,
    setSuggestionState,
    moveStatus,
    runSync,
    dismissToast,
    undo,
    organizeAction,
    logs: state.logs,
    trash: state.trash,
    trashBookmarks,
    restoreBookmark,
    purgeBookmarks,
    emptyTrash,
    clearLogs,
    pushLog,
  };
}