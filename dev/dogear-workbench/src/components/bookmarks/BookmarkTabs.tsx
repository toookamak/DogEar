import { useState } from "react";
import type { Bookmark } from "@/types";

interface Props {
  items: Bookmark[];
  selectedId: number | null;
  onOpen: (id: number) => void;
}

type IconStep = 0 | 1 | 2;

const STEP_URLS: ((domain: string) => string)[] = [
  (domain) => `https://${domain}/favicon.ico`,
  (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
];

export default function BookmarkTabs({ items, selectedId, onOpen }: Props) {
  const [steps, setSteps] = useState<Record<number, IconStep>>({});

  const advance = (id: number) => {
    setSteps((prev) => {
      const step = prev[id] ?? 0;
      if (step >= 2) return prev;
      return { ...prev, [id]: (step + 1) as IconStep };
    });
  };

  return (
    <div className="tabs-grid" role="list">
      {items.map((b) => {
        const step = steps[b.id] ?? 0;
        const fallback = step >= 2;
        return (
          <article
            key={b.id}
            role="listitem"
            tabIndex={0}
            className={`tabs-card${selectedId === b.id ? " selected" : ""}`}
            onClick={() => onOpen(b.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(b.id);
              }
            }}
            aria-label={`${b.title}（打开详情）`}
          >
            <span className="tg-head">
              <span className={`tab-ico${fallback ? ` ${b.art}` : ""}`}>
                {fallback ? (
                  <span className="tab-mono">{b.mark}</span>
                ) : (
                  <img
                    className="tab-fav"
                    alt=""
                    loading="lazy"
                    src={STEP_URLS[step](b.domain)}
                    onError={() => advance(b.id)}
                  />
                )}
              </span>
              <span className="tabs-title">{b.title}</span>
              <button
                type="button"
                className="tabs-go"
                aria-label={`打开 ${b.title}`}
                title="打开原网页"
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(b.url, "_blank", "noopener,noreferrer");
                }}
              >
                ↗
              </button>
            </span>
            <span className="tabs-sub">{b.excerpt}</span>
          </article>
        );
      })}
    </div>
  );
}
