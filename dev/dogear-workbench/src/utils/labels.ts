import type { Source, Status } from "@/types";

export function sourceLabel(source: Source | "全部"): string {
  switch (source) {
    case "AI":
      return "AI";
    case "extension":
      return "插件";
    case "raindrop":
      return "Raindrop";
    default:
      return "全部";
  }
}

export function statusClass(status: Status): string {
  switch (status) {
    case "待整理":
      return "state-pending";
    case "稍后读":
      return "state-later";
    case "已归档":
      return "state-archive";
  }
}