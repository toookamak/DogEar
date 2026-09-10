# DogEar 组件注册表（原型版）

| 项 | 值 |
| --- | --- |
| 文档名 | DogEar 组件注册表（原型版） |
| 版本 | v2.0 |
| 日期 | 2026-09-02 |
| 关联 PRD | v1.0.7（`wiki/DogEar_折耳书签_需求总纲_v1.0.7.md`） |
| 状态 | 原型现行登记表（隔离原型 dev/dogear-workbench） |
| 说明 | 本表为重写版，不承接 `docs/归档/COMPONENTS-原型版.md` v1.0 旧口径 |

> 追溯声明：归档稿 `docs/归档/COMPONENTS-原型版.md`（v1.0）以旧 PRD 口径编写，其条目、判定与结论在本表中**一律不作为依据**，仅作历史追溯用。本表内容全部依据当前 `dev/dogear-workbench/src` 下实际代码重新登记。
>
> 登记范围：`dev/dogear-workbench/src/components/**` 下全部 `.tsx` 文件（共 27 个），另附入口 `src/App.tsx`（见「层级落点」）。路径列统一相对 `dev/dogear-workbench/`。本表不含任何改造建议，仅陈述代码事实。

## 1. 怎么用这份表

1. **新建组件前先搜本表**：按目标职责在「组件登记表」「设置域登记表」中检索，确认是否已有同名或同职责条目。
2. **判定三选一**：命中已有条目且职责一致 → 复用；职责相邻但需要新增入参/分支 → 扩展（扩展时同步更新本表该行的「关键 props」）；职责重叠但无法承载 → 新建。
3. **新建后回到本表登记**：新增 `.tsx` 组件须补入对应层级表格；props 以代码中真实 `interface Props` 为准，未在代码中出现的字段写「待确认」。
4. **不要在本表推断产品结论**：本表是组件层登记表，需求分层口径以 PRD（核心 / 近期 / 远景）为准，本表不重复、不改写。
5. **正式工程启动时另建正式注册表**：本表服务于隔离原型（Vite + React 19 + TypeScript、mock 数据、非正式工程）。正式工程（shadcn / Tailwind）落地时另建正式版注册表，本表转为对照参考，不直接迁移判定。

## 2. 层级落点

本原型未建立原子设计的目录命名约定（无 `atoms/` `molecules/` `organisms/` 平铺目录，仅 `settings/` 下有 `atoms/` 与 `sections/` 两级）。下表按代码中的引用方向与组合关系推定落点；标注「推定」处无目录层显式声明。

| 层级 | 本原型对应文件 | 说明 |
| --- | --- | --- |
| Atoms | `src/components/settings/atoms/ConfigField.tsx`、`KeyField.tsx`、`StatCard.tsx`、`Switch.tsx` | 代码中唯一显式以 `atoms/` 目录命名的层级 |
| Molecules | `src/components/bookmarks/BookmarkCard.tsx`、`src/components/feedback/EmptyState.tsx`、`Skeleton.tsx`、`ToastRegion.tsx`、`src/components/nav/NavPlaceholder.tsx`（推定，见下） | 单一职责、无子组件组合或组合极浅 |
| Organisms | `src/components/bookmarks/BookmarkGrid.tsx`、`BookmarkList.tsx`、`BookmarkBoard.tsx`、`BookmarkTabs.tsx`、`WorkspaceToolbar.tsx`、`SelectionToolbar.tsx`、`src/components/detail/DetailPanel.tsx`、`src/components/layout/TopBar.tsx`、`Sidebar.tsx`、`StatusBar.tsx` | 承载一块完整功能区，内部组合多个 molecule |
| Templates / Pages | `src/components/layout/AppShell.tsx`（模板：装配全部区域与视图分支）、`src/components/settings/SettingsModal.tsx`（模态容器，装配 6 个 section）、`src/App.tsx`（页面入口：主题态 + 数据钩子 + 挂载 AppShell） | `NavPlaceholder.tsx` 亦为整页形态占位，落点待确认（见「已知职责重叠」） |

补充事实：

- `settings/sections/*` 六个文件是设置域内的「区块」层，介于 organisms 与 templates 之间，与上面四级不严格对应；本表按仓库惯例将其单列于「设置域登记表」。
- `src/utils/labels.ts` 提供 `sourceLabel` / `statusClass` / `statusDotClass` / `STATUS_LIST`，被 `BookmarkCard`、`BookmarkList`、`BookmarkBoard`、`DetailPanel`、`WorkspaceToolbar`、`Sidebar` 引用；非组件，不在登记表内。
- 数据与状态来源不在登记表内：`src/hooks/useBookmarks.ts`（工作台状态机）、`src/hooks/useSettings.ts`（设置态 + localStorage）、`src/data/mock.ts`、`src/data/mockSettings.ts`。

## 3. 组件登记表

### 3.1 Atoms

| 组件 | 文件路径 | 职责（一句话） | 关键 props | 判定 |
| --- | --- | --- | --- | --- |
| （无） | — | 原型未在 `components/` 根层设 `atoms/` 目录；原子组件目前仅存在于 `settings/atoms/`，见「设置域登记表」 | — | 待确认 |

### 3.2 Molecules

| 组件 | 文件路径 | 职责（一句话） | 关键 props | 判定 |
| --- | --- | --- | --- | --- |
| BookmarkCard | `src/components/bookmarks/BookmarkCard.tsx` | 网格视图中的单张书签卡片：封面、来源、状态、摘要、标签与域名外链，并承载勾选 | `bookmark: Bookmark`；`active?: boolean`（默认 false）；`checked?: boolean`（默认 false）；`onOpen: (id: number) => void`；`onToggleSelect: (id: number) => void` | 复用 |
| EmptyState | `src/components/feedback/EmptyState.tsx` | 空结果提示块（固定文案：无符合筛选条件 + 清除筛选按钮） | `onClear?: () => void` | 复用 |
| Skeleton | `src/components/feedback/Skeleton.tsx` | 启动期骨架屏，固定渲染 8 张占位卡片网格 | 无 props | 复用 |
| ToastRegion | `src/components/feedback/ToastRegion.tsx` | 右下 toast 区（`aria-live="polite"`），按 `kind` 着色，可带撤销动作与关闭按钮 | `toasts: ToastMsg[]`；`onDismiss: (id: number) => void`；`onUndo: (undo: UndoAction) => void` | 复用 |
| NavPlaceholder | `src/components/nav/NavPlaceholder.tsx` | 导航页（M6）占位页：静态 6 个区域说明 + 脚注，无交互 | 无 props | 复用 |

### 3.3 Organisms

| 组件 | 文件路径 | 职责（一句话） | 关键 props | 判定 |
| --- | --- | --- | --- | --- |
| BookmarkGrid | `src/components/bookmarks/BookmarkGrid.tsx` | 网格视图容器，把 `items` 映射为 `BookmarkCard` 并透传选中态 | `items: Bookmark[]`；`selection: number[]`；`selectedId: number \| null`；`onOpen: (id: number) => void`；`onToggleSelect: (id: number) => void` | 复用 |
| BookmarkList | `src/components/bookmarks/BookmarkList.tsx` | 列表视图（表头 + 行），每行含勾选、标题/域名、状态、来源、加入时间与「确认」「搁置」行内操作 | `items: Bookmark[]`；`selection: number[]`；`selectedId: number \| null`；`onOpen: (id: number) => void`；`onToggleSelect: (id: number) => void`；`onMove: (id: number, status: Status) => void` | 复用 |
| BookmarkBoard | `src/components/bookmarks/BookmarkBoard.tsx` | 看板视图：固定三栏（待处理/已确认/搁置），指针拖拽卡片跨栏触发状态迁移，拖拽中渲染 ghost 元素 | `items: Bookmark[]`；`selectedId: number \| null`；`onOpen: (id: number) => void`；`onMove: (id: number, status: Status) => void` | 复用 |
| BookmarkTabs | `src/components/bookmarks/BookmarkTabs.tsx` | 标签视图：卡片式浏览，favicon 二级回退（站点 favicon → DuckDuckGo 图标 → 首字母色块），支持 Enter/Space 打开 | `items: Bookmark[]`；`selectedId: number \| null`；`onOpen: (id: number) => void` | 复用 |
| WorkspaceToolbar | `src/components/bookmarks/WorkspaceToolbar.tsx` | 工作区工具条：搜索（含 ⌘/Ctrl+K 聚焦）、来源筛选芯片、排序下拉、视图切换、整理建议入口（带待处理计数） | `filters: Filters`；`view: ViewMode`；`organizeCount: number`；`onQuery: (query: string) => void`；`onSource: (source: Source \| "全部") => void`；`onSort: (sort: SortKey) => void`；`onView: (view: ViewMode) => void`；`onOrganize: () => void` | 复用 |
| SelectionToolbar | `src/components/bookmarks/SelectionToolbar.tsx` | 批量操作条（选中数 > 0 时由 AppShell 挂载）：确认收藏、搁置、退回待处理、批量加标签、移至回收站、取消选择 | `count: number`；`onConfirm: () => void`；`onShelve: () => void`；`onBack: () => void`；`onAddTag: (tag: string) => void`；`onClear: () => void`；`onTrash: () => void` | 复用 |
| DetailPanel | `src/components/detail/DetailPanel.tsx` | 右侧详情抽屉：状态/来源徽标、标题摘要、打开链接与状态迁移操作、AI 建议卡（接受/稍后/忽略/撤销）、标签读写、来源信息（含同步状态文案） | `bookmark: Bookmark \| null`；`open: boolean`；`onClose: () => void`；`onMove: (id: number, status: Status) => void`；`onAddTag: (id: number, tag: string) => void`；`onApplySuggestion: (id: number) => void`；`onSuggestionState: (id: number, state: "ignored" \| "later") => void`；`onNotify: (message: string) => void`；`onTrash: (id: number) => void` | 复用 |
| TopBar | `src/components/layout/TopBar.tsx` | 顶栏：侧栏开关、品牌标识、模拟保存按钮、用户头像与名称展示 | `onToggleSidebar: () => void`；`onMockSave: () => void` | 复用 |
| Sidebar | `src/components/layout/Sidebar.tsx` | 左区导航：资料库统计、Scene 列表、状态三视图、文件夹、标签云、M6 导航页入口，底部含立即同步、主题菜单（light/dark）与设置入口 | `nav: NavKey`；`tag: string`；`statusCounts: Record<"待处理" \| "已确认" \| "搁置", number>`；`sceneCounts: Record<string, number>`；`folderCounts: Record<string, number>`；`tagCounts: Record<string, number>`；`sidebarOpen: boolean`；`sync: SyncState`；`theme: ThemeMode`；`onNav: (nav: NavKey) => void`；`onTag: (tag: string) => void`；`onClose: () => void`；`onOpenSettings: () => void`；`onRunSync: () => void`；`onThemeChange: (theme: ThemeMode) => void` | 复用 |
| StatusBar | `src/components/layout/StatusBar.tsx` | 底区状态栏：同步相位灯与文案、失败重试按钮、上次同步、未推送数、队列长度、速率/时延/成功率/429 计数、待处理数 | `sync: SyncState`；`pendingCount: number`；`metrics: SyncMetrics`（文件内私有接口：`rate: string`、`latency: string`、`successRate: string`、`retries429: number`）；`queueLength: number`；`pendingPush: number`；`onRetry: () => void` | 复用 |

### 3.4 Templates / Pages

| 组件 | 文件路径 | 职责（一句话） | 关键 props | 判定 |
| --- | --- | --- | --- | --- |
| AppShell | `src/components/layout/AppShell.tsx` | 工作台装配模板：顶栏 + 侧栏 + 主区（页头/工具条/批量条/视图分支/骨架/空态）+ 详情抽屉与遮罩 + 状态栏 + toast + 设置模态，并处理 Escape 与 Scene 默认排序 | `bm: BookmarkAPI`；`theme: ThemeMode`；`onThemeChange: (theme: ThemeMode) => void` | 复用 |
| SettingsModal | `src/components/settings/SettingsModal.tsx` | 设置模态容器：6 个分区标签切换，按分区装配对应 section，遮罩与关闭按钮均关闭 | `open: boolean`；`onClose: () => void`；`settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`bm: BookmarkAPI` | 复用 |
| App | `src/App.tsx` | 页面入口：主题态与 localStorage 持久化、调用 `useBookmarks`、Escape 关闭详情/侧栏、挂载 AppShell | 无 props | 复用 |

补充说明（代码事实）：

- `BookmarkAPI` 为 `src/types/bookmark-api.ts` 类型：`ReturnType<typeof useBookmarks> & { logs: LogEntry[]; trash: TrashItem[] }`。因此 `AppShell` / `SettingsModal` / `RaindropSection` / `StatusSection` / `TrashSection` 对 `bm` 的取用范围由 `useBookmarks` 返回值决定，本表不逐项展开。
- 四个视图组件均由 `AppShell` 依据 `state.view` 分支挂载（`grid` / `list` / `tags` / `board`），互斥渲染。
- `SelectionToolbar` 由 `AppShell` 在 `selection.length > 0` 时挂载；`count` 传 `selection.length`。
- `ToastRegion` 由 `AppShell` 常驻挂载；`SettingsModal` 常驻挂载但内部 `open === false` 时返回 `null`。

## 4. 设置域登记表

### 4.1 settings/atoms

| 组件 | 文件路径 | 职责（一句话） | 关键 props | 判定 |
| --- | --- | --- | --- | --- |
| ConfigField | `src/components/settings/atoms/ConfigField.tsx` | 带标签的配置输入项（可选类型、占位与提示文案） | `label: string`；`value: string`；`onChange: (value: string) => void`；`type?: string`（默认 `"text"`）；`placeholder?: string`；`hint?: string` | 复用 |
| KeyField | `src/components/settings/atoms/KeyField.tsx` | API Key 字段：未生成时显示生成按钮，已生成时支持显示/隐藏与复制，并回报一次性提示 | `value: string`；`onGenerate: () => string`；`onNotify: (message: string) => void` | 复用 |
| StatCard | `src/components/settings/atoms/StatCard.tsx` | 设置域统计卡：标签 + 数值 + 可选副标题与配色（default/mint/red） | `label: string`；`value: string`；`sub?: string`；`tone?: "default" \| "mint" \| "red"`（默认 `"default"`） | 复用 |
| Switch | `src/components/settings/atoms/Switch.tsx` | 开关控件（checkbox + 轨道 + 可选文案） | `checked: boolean`；`onChange: (checked: boolean) => void`；`label?: string` | 复用 |

### 4.2 settings/sections

| 组件 | 文件路径 | 职责（一句话） | 关键 props | 判定 |
| --- | --- | --- | --- | --- |
| StatusSection | `src/components/settings/sections/StatusSection.tsx` | 状态信息分区：收藏统计、按 JSON 长度估算的空间占用、同步状态与指标、数据安全说明 | `settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`bm: BookmarkAPI` | 复用 |
| RaindropSection | `src/components/settings/sections/RaindropSection.tsx` | Raindrop 分区：角色定位说明、Token 配置与连接测试、定时同步（攒批窗口/导入间隔）、手动同步（导出/导入/全量）、同步队列、API 限频、最近 8 条同步日志 | `settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`bm: BookmarkAPI` | 复用 |
| BackupSection | `src/components/settings/sections/BackupSection.tsx` | 备份与恢复分区：本地 CSV/ZIP 导出、从文件恢复、云端目标（WebDAV/S3）增删与连接测试/备份/恢复、定时备份、备份历史 | `settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`onNotify: BookmarkAPI["notify"]` | 复用 |
| AgentSection | `src/components/settings/sections/AgentSection.tsx` | Agent 接入分区：服务开关与 Base URL/名称、API Key、能力权限（含删除二次确认）、限频配置、使用统计与模拟调用 | `settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`onNotify: BookmarkAPI["notify"]` | 复用 |
| LogSection | `src/components/settings/sections/LogSection.tsx` | 日志分区：按类型筛选 + 关键词搜索 + 20 条分页的日志列表，以及条数/天数保留策略与清空 | `logs: LogEntry[]`；`settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`onClearLogs: () => void` | 复用 |
| TrashSection | `src/components/settings/sections/TrashSection.tsx` | 回收站分区：空态提示、全选/单选、批量或单条恢复与彻底删除、清空回收站（二次确认）、保留天数展示 | `trash: TrashItem[]`；`settings: AppSettings`；`onUpdateSettings: (updater: (s: AppSettings) => AppSettings) => void`；`bm: BookmarkAPI` | 复用 |

设置域补充事实：

- 未使用的 props 已按代码原样登记：`StatusSection` 接收 `onUpdateSettings` 但在函数体内未解构使用；`TrashSection` 接收 `onUpdateSettings` 但未解构使用。
- `TrashSection` 的空态分支在 `trash.length === 0` 时直接返回，此时不渲染全选行与保留策略行。
- `RaindropSection` 的「立即导出 / 立即导入 / 全量导入」三个按钮绑定同一 `handleSync`；「立即导出」额外要求 `pendingCount > 0`。
- 分区标签键为 `SettingsTabKey = "status" | "raindrop" | "backup" | "agent" | "log" | "trash"`（`src/types/index.ts`）。

## 5. 已知职责重叠（仅陈述事实）

以下仅罗列代码中可观察到的重叠点，不含任何改造建议；代码中无法确认的写「待确认」。

1. **DetailPanel 与 BookmarkCard**
   - 重叠点：两者都展示同一 `Bookmark` 的标题、摘要、来源与状态；`BookmarkCard` 通过 `card-domain-btn` 外链展示域名，`DetailPanel` 展示 `domain` 文本与「打开链接」按钮（该按钮不跳转，仅回调 `onNotify("已在浏览器打开（原型模拟）")`）。
   - 差异事实：`BookmarkCard` 的勾选动作走 `onToggleSelect`；`DetailPanel` 无勾选入口。
   - 待确认：详情与卡片的信息字段是否应由同一视图模型派生——代码中两者各自直接读取 `Bookmark` 字段，无共享字段派生层。

2. **DetailPanel 与 BookmarkList 的状态迁移操作**
   - 重叠点：两者都提供状态迁移按钮且都以「当前状态」为条件渲染——`BookmarkList` 仅提供「确认」「搁置」，`DetailPanel` 提供「确认收藏」「搁置」「退回待处理」。
   - 差异事实：两者最终都调用 `bm.moveStatus(id, status)`；`BookmarkList` 只覆盖两种目标状态。

3. **SelectionToolbar 与 DetailPanel 的批量/单条操作入口**
   - 重叠点：加标签（`SelectionToolbar.onAddTag` vs `DetailPanel.onAddTag`）、移至回收站（`SelectionToolbar.onTrash` vs `DetailPanel.onTrash`）、以及三类状态迁移动作在两者中都存在，区别只是作用于 `selection` 还是单个 `id`。
   - 事实：`AppShell` 中 `SelectionToolbar.onAddTag` → `bm.batchAddTag(tag, selection)`，`DetailPanel.onAddTag` → `bm.batchAddTag(tag, [id])`，即同一 API 的两种作用域包装。

4. **StatusBar 与其他同步状态展示位**
   - 重叠点：同步相位、失败重试、429 次数、队列相关数字在 `StatusBar` 与 `settings/sections/StatusSection`、`settings/sections/RaindropSection` 中重复出现。
   - 事实：`StatusBar` 与 `StatusSection` 的速率/时延/成功率/429 均取自同一常量 `SYNC_METRICS`（`src/data/mockSettings.ts`）；`StatusBar` 的 `queueLength` / `pendingPush` 由 `AppShell` 从 `settings.raindrop.queue` 计算后传入，而 `RaindropSection` 内部自行从 `settings.raindrop.queue` 统计 pending/failed/conflict；`StatusSection` 展示 `bm.state.sync.attempts`，`StatusBar` 不展示 attempts。
   - 事实：`RaindropSection` 有一条注释声明推送/拉取间隔与队列、限频配置已移至该分区、`StatusSection` 仅展示同步状态。`Sidebar` 底部另有「立即同步」按钮（`onRunSync`），与 `StatusBar` 重试、`StatusSection`「立即同步」构成第三个同步触发入口。
   - 待确认：三处同步展示是否应共用同一派生来源（当前各自从 `bm` 或模块常量取值）。

5. **BookmarkGrid / BookmarkList / BookmarkBoard / BookmarkTabs 四视图关系**
   - 事实：四者接收同一 `items: Bookmark[]`（`AppShell` 传入 `visibleBookmarks`），由 `state.view` 决定渲染哪一个，互斥。
   - 事实：`BookmarkGrid` 是唯一复用 `BookmarkCard` 的视图（`BookmarkGrid` → `BookmarkCard`），其余三个视图各自在文件内绘制条目 DOM，不共用卡片组件。
   - 事实：`BookmarkGrid` 与 `BookmarkTabs` 不含 `onMove`，不提供状态迁移；`BookmarkList` 与 `BookmarkBoard` 含 `onMove`（列表为行内按钮，看板为拖拽）。
   - 事实：仅 `BookmarkGrid` 与 `BookmarkList` 支持勾选（`selection` / `onToggleSelect`）；`BookmarkBoard` 与 `BookmarkTabs` 不支持勾选。
   - 事实：仅 `BookmarkTabs` 的视图键（`ViewMode = "tags"`）与组件名 `BookmarkTabs` 不同名；`WorkspaceToolbar` 中该视图的展示标签为「标签」。
   - 待确认：四视图是否需要统一的条目展示抽象——代码中不存在该层。

6. **BookmarkBoard 的拖拽落点判定与视图边界**
   - 事实：`BookmarkBoard` 通过 `document.elementFromPoint(...).closest("[data-col]")` 判定目标分栏，并自带 `cardRef`/`drag-ghost` 拖拽影像；该实现为指针事件 + DOM 命中测试，不依赖第三方拖拽库。
   - 事实：`BookmarkBoard` 与 `BookmarkList` 的 `onMove` 最终都接到 `bm.moveStatus`，而 `moveStatus` 内部对「目标状态 === 当前状态」直接返回，不产生日志与 toast。

7. **NavPlaceholder 与主区页头（AppShell 内联的 content-head）**
   - 事实：`AppShell` 在 `nav === "navpage"` 时整块替换主区内容为 `NavPlaceholder`，因此工作台页头（`page-title` / `page-desc` / Scene 主操作按钮）在该分支不渲染；常态分支的页头是 `AppShell` 内联 JSX，不是独立组件。
   - 事实：`NAV_META.navpage` 中亦定义了导航页的 `title` 与 `desc`，但该分支不会渲染它。
   - 待确认：`NavPlaceholder` 的层级落点（molecule 还是 page）——其形态为整页，尺寸小于 AppShell。

8. **Sidebar 内的内联图标与主题菜单**
   - 事实：`SunIcon` / `MoonIcon` / `GearIcon` 三个 SVG 图标组件定义在 `Sidebar.tsx` 文件内，非独立文件、不在 `components/` 登记范围内；其余组件使用字符符号（如 `⌕`、`↻`、`☰`、`↗`、`▦`）而非图标组件。
   - 事实：主题入口收敛为 `light` / `dark` 两项（`THEME_OPTIONS`），`ThemeMode` 类型中仍保留 `system` / `claude` / `claude-dark` / `notion` / `notion-dark`，由 `src/App.tsx` 的 `initialTheme` / `resolveTheme` 做向后兼容映射。
   - 待确认：图标是否需要抽为独立组件——代码中仅这三处为文件内组件。

9. **空态展示的两处实现**
   - 事实：`EmptyState` 只用于书签区（`AppShell` 在 `visibleBookmarks.length === 0` 时渲染，文案固定为筛选无结果）；`DetailPanel` 未选中书签时用内联 `div.empty-detail`（「选择一条书签 / 查看它的整理上下文」）；`TrashSection` 也用内联 `p.section-pane`（「回收站暂无内容」）。
   - 待确认：三处空态是否应统一——代码中三者文案与形态不同，`EmptyState` 的 props 只有 `onClear`，不足以覆盖后两者。

10. **设置域中未接入的钩子能力**
    - 事实：`useSettings` 导出 `upsertTarget` 与 `removeTarget`，但当前设置域组件（含 `BackupSection`）未引用，`BackupSection` 通过 `onUpdateSettings` 自行增删 `backup.targets`。
    - 待确认：是否为预留能力。

11. **Scene 相关数据口径的三处并存**
    - 事实：`Sidebar` 用 `sceneCounts[s.name] ?? 0`（以 Scene 名称计数），`useBookmarks` 的 `sceneCounts` 以 `bookmark.scenes` 中的名称为键；`AppShell` 的 `SCENE_META_KEYS` 以 `SceneDef.key`（`sc-` 前缀）为键；`AppShell` 另有一处 `FOLDER_TITLES` 硬编码映射（`fd-design` / `fd-engineering` / `fd-notes`），与 `src/data/mock.ts` 的 `FOLDER_SECTIONS` 并存。
    - 事实：`useBookmarks` 的 `matchesSection` 对 `fd-` 前缀使用 `FOLDER_SECTIONS` 的 `label` 与 `bookmark.folder` 比较；`AppShell` 的 `navMeta` 对同一 `fd-` 键使用 `FOLDER_TITLES` 取标题。两套映射由 `mock.ts` 与 `AppShell.tsx` 分别维护。
    - 待确认：`AppShell` 的 `FOLDER_TITLES` 与 `mock.ts` 的 `FOLDER_SECTIONS` 是否存在冗余。

12. **`DetailPanel` 中硬编码的同步状态文案**
    - 事实：`DetailPanel`「来源信息」段的「同步状态」固定渲染 `本地已保存 · 待推送`，取值不来自 `bm.state.sync`；与 `StatusBar`、`StatusSection`、`RaindropSection` 的同步相位展示并存。
    - 待确认：该文案是否为原型固定占位。

13. **`types/index.ts` 中已定义但本原型未在 UI 展示的类型**
    - 事实：`AERR = "Action" | "Explore" | "Read" | "Reference"` 在代码注释中标为「系统层内部类型，不展示给用户」；`SceneDef` 的 `archetype` 字段在 `AppShell` 的 `navMeta` 返回对象中被传递但未被消费。`Bookmark` 的 `progress` 字段在上述 27 个组件文件中未被读取。
    - 待确认：以上是否为原型阶段的未接入项。

## 6. 变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-09-02 | v2.0 | 初次重写，替代归档 v1.0（旧口径不承接） |
