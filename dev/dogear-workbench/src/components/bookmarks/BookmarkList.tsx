import type { Bookmark, Status } from "@/types";
import { sourceLabel, statusClass } from "@/utils/labels";

interface Props {
  items: Bookmark[];
  selection: number[];
  selectedId: number | null;
  onOpen: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onMove: (id: number, status: Status) => void;
}

export default function BookmarkList({
  items,
  selection,
  selectedId,
  onOpen,
  onToggleSelect,
  onMove,
}: Props) {
  return (
    <div className="list-view">
      <div className="list-head" aria-hidden="true">
        <span className="list-col-check" />
        <span className="list-col-main">标题</span>
        <span className="list-col-status">状态</span>
        <span className="list-col-source">来源</span>
        <span className="list-col-date">加入时间</span>
        <span className="list-col-actions">操作</span>
      </div>

      {items.map((b) => (
        <div
          key={b.id}
          className={`list-row${selectedId === b.id ? " active" : ""}${selection.includes(b.id) ? " selected" : ""}`}
          onClick={() => onOpen(b.id)}
        >
          <span className="list-col-check">
            <button
              type="button"
              className={`row-check${selection.includes(b.id) ? " checked" : ""}`}
              aria-pressed={selection.includes(b.id)}
              aria-label={selection.includes(b.id) ? "取消选择" : "选择该书签"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelect(b.id);
              }}
            >
              {selection.includes(b.id) ? "✓" : ""}
            </button>
          </span>

          <span className="list-col-main">
            <span className="row-title">{b.title}</span>
            <span className="row-domain">{b.domain}</span>
          </span>

          <span className="list-col-status">
            <span className={`status-pill ${statusClass(b.status)}`}>{b.status}</span>
          </span>

          <span className="list-col-source">{sourceLabel(b.source)}</span>
          <span className="list-col-date">{b.createdAt}</span>

          <span className="list-col-actions">
            {b.status !== "已确认" && (
              <button
                type="button"
                className="mini-action"
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(b.id, "已确认");
                }}
              >
                确认
              </button>
            )}
            {b.status !== "搁置" && (
              <button
                type="button"
                className="mini-action"
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(b.id, "搁置");
                }}
              >
                搁置
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}