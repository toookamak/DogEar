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

// 状态样式映射：沿用现有 CSS 类（pending=琥珀 / archive=mint / later=蓝），
// 仅重映射三态口径，避免大范围样式改动。
export function statusClass(status: Status): string {
  switch (status) {
    case "待处理":
      return "state-pending";
    case "已确认":
      return "state-archive";
    case "搁置":
      return "state-later";
  }
}

export function statusDotClass(status: Status): string {
  switch (status) {
    case "待处理":
      return "dot-amber";
    case "已确认":
      return "dot-mint";
    case "搁置":
      return "dot-slate";
  }
}

export const STATUS_LIST: Status[] = ["待处理", "已确认", "搁置"];
