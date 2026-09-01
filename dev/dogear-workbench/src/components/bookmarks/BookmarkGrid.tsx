import type { Bookmark } from "@/types";
import BookmarkCard from "@/components/bookmarks/BookmarkCard";

interface Props {
  items: Bookmark[];
  selection: number[];
  selectedId: number | null;
  onOpen: (id: number) => void;
  onToggleSelect: (id: number) => void;
}

export default function BookmarkGrid({
  items,
  selection,
  selectedId,
  onOpen,
  onToggleSelect,
}: Props) {
  return (
    <div className="card-grid">
      {items.map((b) => (
        <BookmarkCard
          key={b.id}
          bookmark={b}
          active={selectedId === b.id}
          checked={selection.includes(b.id)}
          onOpen={onOpen}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}