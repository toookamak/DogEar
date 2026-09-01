import { useEffect, useRef } from "react";
import { SOURCES } from "@/data/mock";
import type { Filters, SortKey, Source, ViewMode } from "@/types";
import { sourceLabel } from "@/utils/labels";

interface Props {
  filters: Filters;
  view: ViewMode;
  organizeCount: number;
  onQuery: (query: string) => void;
  onSource: (source: Source | "全部") => void;
  onSort: (sort: SortKey) => void;
  onView: (view: ViewMode) => void;
  onOrganize: () => void;
}

const VIEW_META: Record<ViewMode, { label: string; glyph: string }> = {
  grid: { label: "网格", glyph: "▦" },
  tags: { label: "标签", glyph: "◈" },
  list: { label: "列表", glyph: "☷" },
  board: { label: "看板", glyph: "▤" },
};

export default function WorkspaceToolbar({
  filters,
  view,
  organizeCount,
  onQuery,
  onSource,
  onSort,
  onView,
  onOrganize,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="toolbar">
      <label className="search-box">
        <span className="search-icon">⌕</span>
        <input
          ref={inputRef}
          type="search"
          value={filters.query}
          placeholder="搜索标题、标签或域名"
          onChange={(event) => onQuery(event.target.value)}
        />
        {filters.query !== "" && (
          <button
            type="button"
            className="search-clear"
            aria-label="清除搜索"
            onClick={() => onQuery("")}
          >
            ×
          </button>
        )}
        <kbd>⌘K</kbd>
      </label>

      <span className="toolbar-sep" aria-hidden="true" />

      <div className="filter-group" role="group" aria-label="来源筛选">
        {SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            className={`filter-chip${filters.source === s ? " active" : ""}`}
            onClick={() => onSource(s)}
          >
            {sourceLabel(s)}
          </button>
        ))}
      </div>

      <span className="toolbar-sep" aria-hidden="true" />

      <div className="toolbar-actions">
        <select
          className="sort-select"
          value={filters.sort}
          aria-label="排序方式"
          onChange={(event) => onSort(event.target.value as SortKey)}
        >
          <option value="recent">最近添加</option>
          <option value="title">按标题</option>
          <option value="domain">按域名</option>
        </select>

        <div className="view-switcher" role="group" aria-label="切换视图">
          {(Object.keys(VIEW_META) as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`view-btn${view === v ? " active" : ""}`}
              aria-label={VIEW_META[v].label}
              title={VIEW_META[v].label}
              onClick={() => onView(v)}
            >
              <span className="glyph" aria-hidden="true">
                {VIEW_META[v].glyph}
              </span>
              <span className="label">{VIEW_META[v].label}</span>
            </button>
          ))}
        </div>

        <button type="button" className="primary-action" onClick={onOrganize}>
          整理建议
          {organizeCount > 0 && <span className="primary-count">{organizeCount}</span>}
          <span className="primary-arrow">↗</span>
        </button>
      </div>
    </div>
  );
}