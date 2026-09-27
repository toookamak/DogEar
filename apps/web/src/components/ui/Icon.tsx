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
  // 外壳与账户（2026-09-27 第二批：侧栏方案 C 与顶栏同步胶囊同期加入）
  | 'menu'
  | 'inbox'
  | 'bookmark'
  | 'compass'
  | 'layers'
  | 'trash'
  | 'settings'
  | 'sparkle'
  | 'folder'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'chevron'

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
  // 收起/展开导航：三横（原为 Unicode ☰，与 ☀ ☾ 同批替换，见 DESIGN.md §10）
  menu: 'M2.5 4.5h11 M2.5 8h11 M2.5 11.5h11',
  // 收件箱：收口托盘（侧栏一级导航 Inbox）
  inbox: 'M2.5 9.5V4.5h11v5 M2.5 9.5h3.2l1 2.4h2.6l1-2.4h3.2',
  // 书签：书签旗
  bookmark: 'M4 2.5h8v11l-4-3-4 3Z',
  // 导航页：罗盘（外圆 + 指针菱形）
  compass: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z M10.6 5.4 9.1 9.1 5.4 10.6 6.9 6.9Z',
  // 组织管理：三层堆叠
  layers: 'M8 2.5l5.5 3-5.5 3-5.5-3Z M2.5 8.5l5.5 3 5.5-3',
  // 回收站：桶身 + 两道竖纹
  trash: 'M3 4.5h10 M6.5 4.5V3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5 M4.5 4.5l.7 8.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.5 M6.5 7v4.5 M9.5 7v4.5',
  // 设置：两条滑轨 + 两个旋钮（原为 Unicode ⚙，2026-09-27 替换）
  settings: 'M2.5 5.5h11 M2.5 10.5h11 M6 4.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z M10 9.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z',
  // 场景：四角星（沿用原型对「场景」的星形语义）
  sparkle: 'M8 2.5l1.3 4.2 4.2 1.3-4.2 1.3L8 13.5l-1.3-4.2L2.5 8l4.2-1.3Z',
  // 文件夹
  folder: 'M2.5 12.5V4a1 1 0 0 1 1-1h3l1.5 2h5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1Z',
  // 浅色主题：圆 + 八向光芒
  sun: 'M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M8 1.5v1.5 M8 13v1.5 M1.5 8h1.5 M13 8h1.5 M3.4 3.4l1.1 1.1 M11.5 11.5l1.1 1.1 M12.6 3.4l-1.1 1.1 M4.5 11.5l-1.1 1.1',
  // 深色主题：月牙
  moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z',
  // 退出：门口 + 出框箭头
  logout: 'M8 3.5H5.6A1.6 1.6 0 0 0 4 5.1v5.8a1.6 1.6 0 0 0 1.6 1.6H8 M6.6 8h5 M9.4 5.9 11.5 8 9.4 10.1',
  // 折叠指示：向下箭头（账户菜单触发器；展开时由 CSS 旋转为向上）
  chevron: 'M4 6.5 8 10.5 12 6.5',
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
