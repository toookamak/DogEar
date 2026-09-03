# DogEar 组件注册表（原型版）

> **本表对应隔离前端原型** **`dev/dogear-workbench`，与[正式工程版](COMPONENTS.md)** **[`COMPONENTS.md`](COMPONENTS.md)（v1.1，shadcn/Tailwind）并存、互不替代。** 正式工程组件规范以 v1.1 为准；本表仅为原型界面的原子设计登记与迁移蓝图，正式工程落地参考迁移计划。

* **日期**：2026-09-01

* **版本**：v1.1（新增第四视图「标签视图」相关登记：BookmarkTabs / TabIco / TabGo；ViewSwitcher 更新为四按钮带文字版）

* **关联**：PRD v0.3.7 / 高保真原型规格（设置页设计规格 v0.2.x）

* **基线**：`dev/dogear-workbench`（React 18 + Vite + 原生 CSS，无组件库）

> 本表**全量登记**——凡原型界面出现的可命名 UI 原语（含尚未独立成文件、当前内联在父组件里的元素）均登记在案，标注为「规划」类，作为后续迁移落地的蓝图。

***

## 1. 使用说明

新建或改动组件前必须遵循：

1. **先搜索**：按名称 / 职责 / 层级在本表检索，确认是否已有可复用组件（含内联规划项）
2. **合并对照**：对照「组件合并对照表」（第 8 节）判定复用 / 扩展 / 新建
3. **命名规范**：

   * 组件文件 PascalCase + 英文语义名（`TagPill`、`BookmarkCard`）

   * CSS 类保持 kebab-case（`.tag-pill`），与组件一一对应

   * 原子用 UI 语义命名，分子用功能组合命名，组织用业务区域命名
4. **层级归属**：按第 2 节判断组件应落在哪一层，禁止跨层依赖
5. **登记**：新建 / 拆分完成后更新本表 + `docs/组件迁移合并计划.md` 的落地状态

***

## 2. 组件层级（原子设计 + 本工作台约定）

Brad Frost 五层：原子 → 分子 → 组织 → 模板 → 页面。

| 层级     | 说明                              | 复用范围  | 依赖方向            |
| ------ | ------------------------------- | ----- | --------------- |
| **原子** | 不可再分的视觉/交互原语；含「规划原子」（当前内联、未成文件） | 全局通用  | 不依赖其他 DogEar 组件 |
| **分子** | 2\~5 个原子组合的功能单元                 | 跨区块复用 | 仅依赖原子           |
| **组织** | 业务实体 / 区域组件，含数据与状态              | 模块内复用 | 可依赖原子 + 分子      |
| **模板** | 页面骨架，定义区域与插槽                    | 页面级复用 | 可依赖所有下层         |
| **页面** | 路由级完整页面                         | 不复用   | 可依赖所有层          |

**技术基线（登记前提）**

* 图标：内联 SVG（`stroke="currentColor"`，15px，stroke-width 1.6\~1.7），见 `SunIcon / MoonIcon / MonitorIcon / GearIcon`

* 字形符号（☰ ⌕ ↻ ↗ × ✓ ▦ ☷ ▤）用作轻量图标位；**禁止用 Unicode emoji 风格符号做状态图标**（跨平台渲染不一致）

* 设计令牌统一走 `styles/tokens.css`（`--space-*`、`--amber/--blue/--mint`、`--line/--panel` 等）

* 状态语义色：待整理=琥珀、稍后读=深蓝、已归档=薄荷；来源语义色：rain=蓝、extension=琥珀、ai=薄荷

***

## 3. 原子组件（Atoms）

> 现形态列 = 该元素当前在代码中的形态载体。「规划」= 尚未独立成文件，为迁移计划目标；颜色/圆角均为整卡/整栏内联，迁移时随元素一起抽取。

| 名称                | 职责                           | 现形态                                                                                                                  | 变体 / 状态                               | 规划文件                        |
| ----------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------- |
| `Icon`            | 通用线型 SVG 图标                  | `.ico`（内联 svg）                                                                                                       | 15px、stroke 1.6\~1.7、`currentColor`   | `atoms/Icon.tsx`            |
| `StatusDot`       | 状态圆点（侧栏资料库项 / 看板列头）          | `.status-dot`、`.board-col-dot`                                                                                       | `dot-amber` / `dot-blue` / `dot-mint` | `atoms/StatusDot.tsx`       |
| `Monogram`        | 首字母徽章（封面 / 主链 favicon 位）     | `.cover-monogram`、`.d-fav`                                                                                           | 来源色、圆/方角                              | `atoms/Monogram.tsx`        |
| `CountBadge`      | 计数徽标（侧栏数 / 页头数 / 主按钮数 / 结果数） | `.nav-badge`、`.tag-count`、`.page-count`、`.primary-count`、`.result-count`                                             | 无 / 琥珀强调                              | `atoms/CountBadge.tsx`      |
| `TagPill`         | 空心标签（描边 + 琥珀 `#`），卡片与侧栏统一款   | `.tag-pill`（卡片）、`.tag-chip`（侧栏，形态同源）                                                                                 | `tag-pill-empty`（未整理斜体灰）              | `atoms/TagPill.tsx`         |
| `StatusPill`      | 实色状态胶囊（卡片封面、列表行、详情）          | `.status-pill`、`.cover-status`                                                                                       | `st-*` 按状态着色                          | `atoms/StatusPill.tsx`      |
| `SourceBadge`     | 来源徽标（RAINDROP / 插件 / AI）     | `.cover-source`、`.source-chip`                                                                                       | 来源色                                   | `atoms/SourceBadge.tsx`     |
| `Chip`            | 通用描边小块（详情标签 / 建议标签）          | `.chip`、`.chip-empty`                                                                                                | 空态斜体                                  | `atoms/Chip.tsx`            |
| `IconButton`      | 平方图标按钮（菜单 / 同步 / 选择 / 关闭）    | `.icon-btn`、`.menu-btn`、`.sync-btn`、`.card-select-btn`、`.detail-close`、`.modal-close`、`.toast-close`、`.search-clear` | `checked`（勾选态）                        | `atoms/IconButton.tsx`      |
| `SegButton`       | 分段控件段按钮（主题 / 设置）             | `.seg-btn`（内含 `.seg-label`）                                                                                          | 首段 / 末段圆角由容器裁切                        | `atoms/SegButton.tsx`       |
| `MiniButton`      | 小号操作按钮（批量条 / 列表行 / 详情）       | `.mini-action`                                                                                                       | `accent` / `ghost` / `danger`         | `atoms/MiniButton.tsx`      |
| `PrimaryButton`   | 主按钮（整理建议 / 打开链接 / 清筛选）       | `.primary-action`（含 `--count`、`--arrow`）                                                                             | —                                     | `atoms/PrimaryButton.tsx`   |
| `SecondaryButton` | 次按钮（归档 / 稍后读）                | `.secondary-action`                                                                                                  | —                                     | `atoms/SecondaryButton.tsx` |
| `FilterChip`      | 来源筛选按钮                       | `.filter-chip`                                                                                                       | `active`                              | `atoms/FilterChip.tsx`      |
| `ViewButton`      | 视图切换按钮（图标+文字，窄屏退化为纯图标）       | `.view-btn`（`.glyph` + `.label`）                                                                                     | `active`                              | `atoms/ViewButton.tsx`      |
| `TextInput`       | 文本输入（搜索 / 标签 / 配置）           | `input[type=search/text]`（.search-box 内、.selection-tag-form、.detail-tag-form、ConfigField）                            | 尺寸由容器上下文决定                            | `atoms/TextInput.tsx`       |
| `SortSelect`      | 排序下拉                         | `.sort-select`                                                                                                       | —                                     | `atoms/SortSelect.tsx`      |
| `Kbd`             | 快捷键提示                        | `<kbd>`（.search-box 内）                                                                                               | —                                     | `atoms/Kbd.tsx`             |
| `Divider`         | 分隔线（工具栏 / 元数据 / 状态栏 / 侧栏区块间） | `.toolbar-sep`、`.library-meta-sep`、`.statusbar-sep`、`.sidebar-block` 上边框、`.seg-btn` 段间线                              | 横向 / 竖向                               | `atoms/Divider.tsx`         |
| `Switch`          | 开关（设置分区）                     | `settings/atoms/Switch.tsx`                                                                                          | on/off                                | `atoms/Switch.tsx`（已成文件）    |
| `FormField`       | 配置行（label + 控件 + hint）       | `settings/atoms/ConfigField.tsx`                                                                                     | text / number / select 内容             | `atoms/FormField.tsx`（已成文件） |
| `KeyField`        | 密钥输入 / 显示 / 复制 / 生成          | `settings/atoms/KeyField.tsx`                                                                                        | 明 / 密                                 | `atoms/KeyField.tsx`（已成文件）  |
| `StatCard`        | 统计卡（设置分区 / 侧栏统计）             | `settings/atoms/StatCard.tsx`、`.library-total`                                                                       | label / value / sub / tone            | `atoms/StatCard.tsx`（已成文件）  |
| `Avatar`          | 用户头像（圆形首字母）                  | `.user-avatar`                                                                                                       | —                                     | `atoms/Avatar.tsx`          |
| `Brand`           | 品牌标识（Logo + 名称 + 模式）         | `.brand`（brand-mark/name/sep/mode）                                                                                   | —                                     | `atoms/Brand.tsx`           |
| `SkeletonBlock`   | 骨架块（封面 / 预览 / 文本线）           | `.skel-cover`、`.skel-preview`、`.skel-line`                                                                           | 宽度变体 w70 / w40                        | `atoms/SkeletonBlock.tsx`   |
| `Backdrop`        | 半透明遮罩（侧栏 / 详情 / 模态）          | `.backdrop`、`.detail-scrim`、`.modal-scrim`                                                                           | —                                     | `atoms/Backdrop.tsx`        |
| `SectionLabel`    | 区块小标题（侧栏"资料库 / 文件夹 / 标签"）    | `.nav-label`                                                                                                         | —                                     | `atoms/SectionLabel.tsx`    |

***

## 4. 分子组件（Molecules）

| 名称                  | 职责                            | 组成                                    | 现形态                                    | 规划文件                              |
| ------------------- | ----------------------------- | ------------------------------------- | -------------------------------------- | --------------------------------- |
| `SearchBox`         | 搜索框（图标 + 输入 + 清除 + ⌘K）        | Icon + TextInput + IconButton + Kbd   | `.search-box`                          | `molecules/SearchBox.tsx`         |
| `SourceFilterGroup` | 来源筛选按钮组                       | FilterChip × 3                        | `.filter-group`                        | `molecules/SourceFilterGroup.tsx` |
| `ViewSwitcher`      | 视图四按钮组（图标+文字，active 琥珀底）      | ViewButton × 4                        | `.view-switcher`                       | `molecules/ViewSwitcher.tsx`      |
| `OrganizeButton`    | 整理建议主按钮（文字 + 计数 + 箭头）         | PrimaryButton + CountBadge + Icon     | `.primary-action`                      | `molecules/OrganizeButton.tsx`    |
| `NavItem`           | 导航项基座（文本 + 计数，含 active 态）     | Span + CountBadge                     | `.nav-item`                            | `molecules/NavItem.tsx`           |
| `LibraryItem`       | 资料库导航项（状态圆点版）                 | NavItem + StatusDot                   | `.nav-item.library-item`               | `molecules/LibraryItem.tsx`       |
| `FolderItem`        | 文件夹导航项（朴素版）                   | NavItem                               | `.nav-item`（文件夹块内）                     | `molecules/FolderItem.tsx`        |
| `TagChip`           | 可交互标签钮（空心标签 + 计数 + active，侧栏） | TagPill + CountBadge + active 态       | `.tag-chip`                            | `molecules/TagChip.tsx`           |
| `SegmentedControl`  | 分段控件（主题 \| 设置，段间分隔线）          | SegButton × 2 + Divider               | `.seg-control`                         | `molecules/SegmentedControl.tsx`  |
| `ThemeMenu`         | 主题选择菜单（三选项，全宽上弹）              | Icon × 3 + radio 圆点                   | `.theme-menu`（`.theme-option`）         | `molecules/ThemeMenu.tsx`         |
| `SyncButton`        | 同步按钮（旋转动画）                    | IconButton + Icon                     | `.sync-btn.spinning`                   | `molecules/SyncButton.tsx`        |
| `UserChip`          | 顶栏用户（头像 + 名称）                 | Avatar + Span                         | `.topbar-user`                         | `molecules/UserChip.tsx`          |
| `LibrarySummary`    | 本地资料库统计（标记 + 总数 + 元数据）        | StatCard + Count                      | `.library-summary`                     | `molecules/LibrarySummary.tsx`    |
| `CardCover`         | 卡片封面带（monogram + 来源 + 状态，来源色） | Monogram + SourceBadge + StatusPill   | `.card-cover source-*`                 | `molecules/CardCover.tsx`         |
| `CardPreview`       | 卡片预览图（渐变 + 水印字母 + 选择按钮插槽）     | Background + Monogram + IconButton 插槽 | `.card-preview source-*`               | `molecules/CardPreview.tsx`       |
| `SelectButton`      | 卡片勾选按钮（勾选态）                   | IconButton                            | `.card-select-btn.checked`             | `molecules/SelectButton.tsx`      |
| `CardTagsRow`       | 卡片标签行（多标签 / 未整理占位）            | TagPill × N                           | `.card-tags-row`                       | `molecules/CardTagsRow.tsx`       |
| `DomainLink`        | 原链接跳转（fav + 域名 + ↗，整行热区）      | Monogram + Text + Icon                | `.card-domain-btn src-*`               | `molecules/DomainLink.tsx`        |
| `DetailBadges`      | 详情头部徽标（状态 + 来源）               | StatusPill + SourceBadge              | `.detail-badges`                       | `molecules/DetailBadges.tsx`      |
| `ToastItem`         | 单条 Toast（消息 + 撤销 + 关闭）        | Span + MiniButton + IconButton        | `.toast`（toast-success/error）          | `molecules/ToastItem.tsx`         |
| `PageHead`          | 内容区页头（标题 + 计数）                | Heading + CountBadge                  | `.content-head`（page-title/page-count） | `molecules/PageHead.tsx`          |

***

## 5. 组织组件（Organisms）

| 名称                 | 职责                                                 | 组成                                                                                                           | 现形态 / 文件                         |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `TopBar`           | 顶栏（菜单 + 品牌 + 用户）                                   | IconButton + Brand + UserChip                                                                                | `layout/TopBar.tsx`              |
| `Sidebar`          | 侧栏（统计 + 三块导航 + 底部操作区）                              | LibrarySummary + SectionLabel×3 + LibraryItem/FolderItem/TagChip + SyncButton + SegmentedControl + ThemeMenu | `layout/Sidebar.tsx`             |
| `StatusBar`        | 底部状态栏（LED + 相位 + 重试 + 计数）                          | StatusDot + Span + MiniButton + CountBadge                                                                   | `layout/StatusBar.tsx`           |
| `WorkspaceToolbar` | 工作区工具栏（搜索 / 来源 / 排序 / 视图 / 整理）                     | SearchBox + Divider×2 + SourceFilterGroup + SortSelect + ViewSwitcher + OrganizeButton                       | `bookmarks/WorkspaceToolbar.tsx` |
| `BookmarkSummary`  | 结果统计行（显示 N 条 + 清除筛选）                               | CountBadge + MiniButton                                                                                      | `.bookmark-summary`（AppShell 内联） |
| `BookmarkCard`     | 卡片（封面 + 预览 + 标题 / 摘要 + 标签 + 主链）                    | CardCover + CardPreview(SelectButton 插槽) + Title/Excerpt + CardTagsRow + DomainLink                          | `bookmarks/BookmarkCard.tsx`     |
| `BookmarkGrid`     | 网格容器（弹性卡片流）                                        | BookmarkCard × N                                                                                             | `bookmarks/BookmarkGrid.tsx`     |
| `BookmarkList`     | 列表视图（列头 + 行）                                       | ListRow × N（列头为纯样式行）                                                                                         | `bookmarks/BookmarkList.tsx`     |
| `ListRow`          | 列表行（勾选 + 标题/域名 + 状态 + 来源 + 日期 + 操作）                | IconButton + Text + StatusPill + MiniButton×2                                                                | `bookmarks/BookmarkList.tsx` 内联  |
| `BookmarkBoard`    | 看板视图（三状态列 + 拖拽迁移）                                  | BoardColumn × 3 + drag-ghost                                                                                 | `bookmarks/BookmarkBoard.tsx`    |
| `BookmarkTabs`     | 标签视图（导航页式瘦身卡：图标+标题+跳转同排，简介固定两行；点卡开详情）              | TabIco + Text + TabGo（Card 容器内联）                                                                             | `bookmarks/BookmarkTabs.tsx`     |
| `TabIco`           | 站点图标块（域名 favicon → DuckDuckGo → 首字母+art 配色三级降级）    | Img + Monogram 式 Span                                                                                        | `bookmarks/BookmarkTabs.tsx` 内联  |
| `TabGo`            | 卡片跳转钮（stopPropagation 直接开新标签页）                     | IconButton（↗）                                                                                                | `bookmarks/BookmarkTabs.tsx` 内联  |
| `BoardColumn`      | 看板列（列头 + 卡片流 + 空态）                                 | StatusDot + CountBadge + BoardCard × N                                                                       | `bookmarks/BookmarkBoard.tsx` 内联 |
| `BoardCard`        | 看板卡片（art 块 + 标题 + 域名·来源，可拖拽）                       | Span + Text                                                                                                  | `bookmarks/BookmarkBoard.tsx` 内联 |
| `SelectionToolbar` | 批量操作条（计数 + 归档 / 稍后读 / 加标签 / 回收站 / 取消）              | CountBadge + MiniButton×3 + TextInput 表单                                                                     | `bookmarks/SelectionToolbar.tsx` |
| `DetailPanel`      | 详情侧滑面板（徽标 + 标题 + 动作 + 建议 + 标签 + 来源信息）              | DetailBadges + PrimaryButton + SecondaryButton + SuggestionCard + Chip + 表单 + 事实行                            | `detail/DetailPanel.tsx`         |
| `SuggestionCard`   | AI 整理建议块（note + 目标 + 三态操作）                         | Span + Chip + MiniButton×3                                                                                   | `detail/DetailPanel.tsx` 内联      |
| `SettingsModal`    | 设置弹窗（头部 + 分区导航 + 内容区）                              | Backdrop + ModalHead + SettingsTab×6 + SettingsSection 实例                                                    | `settings/SettingsModal.tsx`     |
| `SettingsSection`  | 设置分区容器 + 内容（状态 / Raindrop / 备份 / Agent / 日志 / 回收站） | StatCard + FormField + Switch + KeyField + 各自业务块                                                             | `settings/sections/*Section.tsx` |
| `ToastRegion`      | Toast 浮层容器（polite）                                 | ToastItem × N                                                                                                | `feedback/ToastRegion.tsx`       |
| `EmptyState`       | 空状态（图示 + 标题 + 提示 + 操作）                             | Glyph + Text + PrimaryButton                                                                                 | `feedback/EmptyState.tsx`        |
| `SkeletonScreen`   | 骨架屏（卡片 × 8）                                        | SkeletonBlock × 6 × 8                                                                                        | `feedback/Skeleton.tsx`          |

***

## 6. 模板组件（Templates）

| 名称               | 职责                             | 插槽 / 区域                                                                                                           | 现形态 / 文件                                    |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `AppShellLayout` | 应用壳：顶栏 + 工作区（侧栏/主内容）+ 状态栏 + 浮层 | `topbar` / `workspace(sidebar,main)` / `statusbar` / 浮层（detail-scrim + DetailPanel + ToastRegion + SettingsModal） | `layout/AppShell.tsx`                       |
| `SettingsLayout` | 设置弹窗内部骨架：分区导航 + 内容区            | `nav` / `content`                                                                                                 | `settings/SettingsModal.tsx` 的 `modal-body` |

***

## 7. 页面组件（Pages）

| 名称              | 职责                               | 使用模板           | 核心组织组件                                                                                                                                       | 文件                                 |
| --------------- | -------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `WorkbenchPage` | 工作台根页面（装配 BookmarkAPI 实例 + 主题状态） | AppShellLayout | TopBar / Sidebar / WorkspaceToolbar / BookmarkGrid·List·Board·Tabs / DetailPanel / SettingsModal / ToastRegion / EmptyState / SkeletonScreen | `dev/dogear-workbench/src/App.tsx` |

***

## 8. 组件合并对照表

新建组件前，按此表判断复用 / 扩展 / 新建：

| 场景            | 判断条件             | 处理方式                    |
| ------------- | ---------------- | ----------------------- |
| 功能重叠 > 70%    | 核心渲染与 Props 基本一致 | ✅ 复用，通过 Props 变体扩展      |
| 是已有组件的子集      | 更简单的同族组件         | ✅ 增加 `variant` / `size` |
| 是已有组件的超集      | 包含已有组件全部能力       | ⚠️ 扩展已有组件，禁止另起炉灶        |
| 仅 UI 相似       | 业务 / 数据语义完全不同    | ❌ 可新建，但抽取共享原语为原子 / 分子   |
| 层级错位          | 原子功能做成组织组件       | ❌ 归位正确层级                |
| 同名组件曾存在（含已删除） | 语义仍一致            | ✅ 复用旧归属，避免版本碎片          |

**决策流程**

```
新组件需求
  ↓
搜索注册表（含「规划」项）→ 找到同族组件？
  ├── 是 → 功能重叠 > 70%？ → 是：扩展已有组件
  │                          └ 否：仅 UI 相似？ → 是：新建并抽取共享原语
  │                                              └ 否：评估合并方案
  └── 否 → 判定层级 → 新建 → 登记到本表 + 迁移计划落地状态
```

***

## 9. 新建组件约束

**AI 协作话术（必须遵循）**

> "新建组件前，我将先搜索 `docs/COMPONENTS.md` 注册表，确认是否已有可复用 / 可扩展组件；如有则优先扩展复用而非新建；如确需新建，将补充注册表登记，并同步 `docs/组件迁移合并计划.md` 的落地状态。"

**检查清单**

* [ ] 已搜索注册表（含规划项），确认无高度相似组件

* [ ] 已对照合并表，确认不适合扩展现有组件

* [ ] 已确认层级归属（原子 / 分子 / 组织 / 模板 / 页面）

* [ ] 已确定文件名（PascalCase）与规划目录

* [ ] 已确定设计令牌来源（tokens.css）与 CSS 类名（kebab-case）

* [ ] 新建完成后已更新注册表 + 迁移计划 + `docs/README.md`

**禁止事项**

* ❌ 不经搜索直接创建组件

* ❌ 同一功能多副本（多套 Button / 多套胶囊样式分散）

* ❌ 跳过登记，组件游离注册表之外

* ❌ 跨层反向依赖（原子引用组织等）

* ❌ 用 Unicode emoji 风格符号替代线型图标（跨平台渲染不一致）

***

## 10. 目标目录规划（迁移蓝图）

> 当前代码仍为平铺 `components/`（约 20 个文件 + settings/atoms + settings/sections）。目标结构如下，**迁移步骤与验收见** **`docs/组件迁移合并计划.md`**，本表为最终归属。

```
src/components/
├── atoms/                 # 28 个原子
│   ├── Icon.tsx  StatusDot.tsx  Monogram.tsx  CountBadge.tsx
│   ├── TagPill.tsx  StatusPill.tsx  SourceBadge.tsx  Chip.tsx
│   ├── IconButton.tsx  SegButton.tsx  MiniButton.tsx
│   ├── PrimaryButton.tsx  SecondaryButton.tsx  FilterChip.tsx  ViewButton.tsx
│   ├── TextInput.tsx  SortSelect.tsx  Kbd.tsx  Divider.tsx
│   ├── Switch.tsx  FormField.tsx  KeyField.tsx  StatCard.tsx
│   ├── Avatar.tsx  Brand.tsx  SkeletonBlock.tsx  Backdrop.tsx  SectionLabel.tsx
├── molecules/             # 22 个分子
│   ├── SearchBox.tsx  SourceFilterGroup.tsx  ViewSwitcher.tsx  OrganizeButton.tsx
│   ├── NavItem.tsx  LibraryItem.tsx  FolderItem.tsx  TagChip.tsx
│   ├── SegmentedControl.tsx  ThemeMenu.tsx  SyncButton.tsx  UserChip.tsx
│   ├── LibrarySummary.tsx  CardCover.tsx  CardPreview.tsx  SelectButton.tsx
│   ├── CardTagsRow.tsx  DomainLink.tsx  DetailBadges.tsx  ToastItem.tsx  PageHead.tsx
├── organisms/             # 20 个组织
│   ├── TopBar.tsx  Sidebar.tsx  StatusBar.tsx  WorkspaceToolbar.tsx
│   ├── BookmarkSummary.tsx  BookmarkCard.tsx  BookmarkGrid.tsx
│   ├── BookmarkList.tsx（含 ListRow）  BookmarkBoard.tsx（含 BoardColumn / BoardCard）
│   ├── SelectionToolbar.tsx  DetailPanel.tsx（含 SuggestionCard）
│   ├── SettingsModal.tsx（含 SettingsTab）  SettingsSection/（6 分区）
│   ├── ToastRegion.tsx  EmptyState.tsx  SkeletonScreen.tsx
├── templates/
│   └── AppShellLayout.tsx  SettingsLayout.tsx
└── pages/
    └── WorkbenchPage.tsx（现 App.tsx）
```

**命名速查**

```
原子 Atoms      Icon, StatusDot, Monogram, CountBadge, TagPill, StatusPill, SourceBadge,
                Chip, IconButton, SegButton, MiniButton, PrimaryButton, SecondaryButton,
                FilterChip, ViewButton, TextInput, SortSelect, Kbd, Divider, Switch,
                FormField, KeyField, StatCard, Avatar, Brand, SkeletonBlock, Backdrop, SectionLabel
分子 Molecules  SearchBox, SourceFilterGroup, ViewSwitcher, OrganizeButton, NavItem,
                LibraryItem, FolderItem, TagChip, SegmentedControl, ThemeMenu, SyncButton,
                UserChip, LibrarySummary, CardCover, CardPreview, SelectButton,
                CardTagsRow, DomainLink, DetailBadges, ToastItem, PageHead
组织 Organisms  TopBar, Sidebar, StatusBar, WorkspaceToolbar, BookmarkSummary, BookmarkCard,
                BookmarkGrid, BookmarkList, BookmarkBoard, BookmarkTabs, SelectionToolbar,
                DetailPanel, SuggestionCard, SettingsModal, SettingsSection, ToastRegion,
                EmptyState, SkeletonScreen
模板 Templates  AppShellLayout, SettingsLayout
页面 Pages      WorkbenchPage
```

