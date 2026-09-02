import { useRef, useState } from "react";
import type { Bookmark, Status } from "@/types";
import { sourceLabel } from "@/utils/labels";

interface Props {
  items: Bookmark[];
  selectedId: number | null;
  onOpen: (id: number) => void;
  onMove: (id: number, status: Status) => void;
}

const COLUMNS: { key: Status; label: string }[] = [
  { key: "待处理", label: "待处理" },
  { key: "已确认", label: "已确认" },
  { key: "搁置", label: "搁置" },
];

interface DragState {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export default function BookmarkBoard({ items, selectedId, onOpen, onMove }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const byColumn = (status: Status) => items.filter((b) => b.status === status);
  const draggingTitle = drag
    ? items.find((b) => b.id === drag.id)?.title ?? ""
    : "";

  function handlePointerDown(event: React.PointerEvent, id: number) {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({
      id,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY });
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-col]");
    const col = target?.getAttribute("data-col") as Status | null;
    setOver(col && COLUMNS.some((c) => c.key === col) ? col : null);
  }

  function handlePointerUp(event: React.PointerEvent, id: number) {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-col]");
    const col = target?.getAttribute("data-col") as Status | null;
    const item = items.find((b) => b.id === id);
    if (col && item && col !== item.status) {
      onMove(id, col);
    }
    setDrag(null);
    setOver(null);
  }

  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const cards = byColumn(col.key);
        return (
          <section
            key={col.key}
            className={`board-col${over === col.key ? " col-over" : ""}`}
            data-col={col.key}
            aria-label={`${col.label}分栏`}
          >
            <header className="board-col-head">
              <span className="board-col-dot" />
              <h3 className="board-col-title">{col.label}</h3>
              <span className="board-col-count">{cards.length}</span>
            </header>
            <div className="board-cards">
              {cards.map((b) => (
                <div
                  key={b.id}
                  ref={(el) => {
                    if (b.id === drag?.id) cardRef.current = el;
                  }}
                  className={`board-card${drag?.id === b.id ? " dragging" : ""}${selectedId === b.id ? " selected" : ""}`}
                  onClick={() => onOpen(b.id)}
                  onPointerDown={(event) => handlePointerDown(event, b.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => handlePointerUp(event, b.id)}
                  title={`${b.title} · 拖拽到其他分栏可迁移状态`}
                >
                  <span className={`board-card-art ${b.art}`}>{b.mark}</span>
                  <span className="board-card-body">
                    <span className="board-card-title">{b.title}</span>
                    <span className="board-card-domain">
                      {b.domain} · {sourceLabel(b.source)}
                    </span>
                  </span>
                </div>
              ))}
              {cards.length === 0 && (
                <div className="board-col-empty">拖拽书签到这里</div>
              )}
            </div>
          </section>
        );
      })}

      {drag && cardRef.current && (
        <div
          className="drag-ghost"
          style={{ left: drag.x, top: drag.y }}
          role="presentation"
        >
          <span className={`board-card-art ${items.find((b) => b.id === drag.id)?.art ?? ""}`}>
            {items.find((b) => b.id === drag.id)?.mark}
          </span>
          <span className="drag-ghost-title">{draggingTitle}</span>
        </div>
      )}
    </div>
  );
}