import type { useBookmarks } from "@/hooks/useBookmarks";
import type { LogEntry, TrashItem } from "@/types";

export type BookmarkAPI = ReturnType<typeof useBookmarks> & {
  logs: LogEntry[];
  trash: TrashItem[];
};