import type { Bookmark } from "@/types";
import { sourceLabel, statusClass } from "@/utils/labels";

interface Props {
  bookmark: Bookmark;
  active?: boolean;
  checked?: boolean;
  onOpen: (id: number) => void;
  onToggleSelect: (id: number) => void;
}

export default function BookmarkCard({
  bookmark: b,
  active = false,
  checked = false,
  onOpen,
  onToggleSelect,
}: Props) {
  return (
    <article
      className={`bookmark-card${active ? " selected" : ""}`}
      onClick={() => onOpen(b.id)}
    >
      <div className={`card-cover source-${b.source.toLowerCase()}`}>
        <span className="cover-monogram">{b.mark}</span>
        <span className="cover-source">{sourceLabel(b.source)}</span>
        <span className={`cover-status ${statusClass(b.status)}`}>
          {b.status}
        </span>
      </div>

      <div
        className={`card-preview source-${b.source.toLowerCase()}`}
        data-mark={b.mark}
      >
        <button
          type="button"
          className={`card-select-btn${checked ? " checked" : ""}`}
          aria-pressed={checked}
          aria-label={checked ? "取消选择" : "选择该书签"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect(b.id);
          }}
        >
          {checked ? "✓" : ""}
        </button>
      </div>

      <div className="card-body">
        <h3 className="card-title">{b.title}</h3>
        <p className="card-excerpt">{b.excerpt}</p>

        <div className="card-tags-row">
          {b.tags.length > 0 ? (
            b.tags.map((t) => (
              <span key={t} className="tag-pill">{t}</span>
            ))
          ) : (
            <span className="tag-pill tag-pill-empty">未整理</span>
          )}
        </div>

        <a
          className={`card-domain-btn src-${b.source.toLowerCase()}`}
          href={b.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="打开原链接"
          title="打开原链接"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="d-fav">{b.domain.charAt(0).toUpperCase()}</span>
          <span className="d-text">{b.domain}</span>
          <span className="d-go">↗</span>
        </a>
      </div>
    </article>
  );
}
