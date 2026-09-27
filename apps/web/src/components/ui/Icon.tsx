/**
 * 内联 SVG 图标集（2026-09-27 新增，见 docs/modules/20260927_UI精细化设计.md §4）。
 *
 * 为什么自写而不是引图标库：AGENTS.md 对新生产依赖有边界约束；界面此前用
 * ⌕ ⚙ ▦ ◈ ☷ ▤ 这类 Unicode 字形代替图标，它们来自不同字体，字宽、粗细与基线
 * 各不相同，是「看起来像原型页」的主要来源之一。
 *
 * 规格（全组统一，改一个就改全组）：
 * - viewBox 16×16、stroke=currentColor、stroke-width 1.5、圆头圆角、无填充
 * - 尺寸默认 1em，随外层 font-size 缩放；颜色随 color 继承
 * - 一律 aria-hidden：图标不承载语义，语义由按钮的 aria-label / 可见文字承担
 */

export type IconName =
  | 'search'
  | 'filter'
  | 'grid'
  | 'tags'
  | 'list'
  | 'board'
  | 'edit'
  | 'swap'
  | 'close'
  | 'external'

/** 每条 path 用 M...Z 子路径拼成，保持单 d 以便一次渲染 */
const PATHS: Record<IconName, string> = {
  // 放大镜：圆心 (7,7) r4.5 的整圆 + 手柄
  search: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z M10.4 10.4 13.5 13.5',
  // 漏斗：宽口收窄到管身，末端斜切
  filter: 'M2.5 3.5h11L9.3 8.2v4.3l-2.6-1.5V8.2Z',
  // 网格视图：2×2 四个方格
  grid: 'M2.5 2.5h4.6v4.6H2.5Z M8.9 2.5h4.6v4.6H8.9Z M2.5 8.9h4.6v4.6H2.5Z M8.9 8.9h4.6v4.6H8.9Z',
  // 标签视图：标签牌 + 穿线孔
  tags: 'M2.5 6.4V3.5a1 1 0 0 1 1-1h2.9a1 1 0 0 1 .7.3l6 6a1 1 0 0 1 0 1.4l-2.9 2.9a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1-.3-.7Z M5.3 5.3h.01',
  // 列表视图：三行「圆点 + 横线」
  list: 'M5.5 4.5h8 M5.5 8h8 M5.5 11.5h8 M2.6 4.5h.01 M2.6 8h.01 M2.6 11.5h.01',
  // 看板视图：外框 + 两条分栏线
  board: 'M2.5 3.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z M6.2 2.5v11 M9.8 2.5v11',
  // 改名：铅笔 + 笔尖分隔线
  edit: 'M11.2 2.9a1.3 1.3 0 0 1 1.9 1.9L5.4 12.5l-2.5.6.6-2.5Z M10 4.1l1.9 1.9',
  // 合并：上下两条反向箭头
  swap: 'M2.5 5.5h10 M9.6 2.5l3 3-3 3 M13.5 10.5h-10 M6.4 7.5l-3 3 3 3',
  // 关闭 / 清除
  close: 'M4 4l8 8 M12 4l-8 8',
  // 打开原文：右上出框箭头 + 剩余边框
  external:
    'M9.5 2.5h4v4 M13.5 2.5 8 8 M11.5 9.5v3a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h3',
}

interface IconProps {
  name: IconName
  /** 边长（px）。缺省跟随外层 font-size（1em），便于直接塞进既有字号体系 */
  size?: number
  className?: string
}

export function Icon({ name, size, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size ?? '1em'}
      height={size ?? '1em'}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // 图标不承载语义：由按钮的 aria-label 或可见文字承担
      aria-hidden="true"
      focusable="false"
      style={{ flex: '0 0 auto', display: 'block' }}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
