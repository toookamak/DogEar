# DogEar 组件注册表

* **日期**：2026-08-21

* **版本**：v1.1（已对齐 PRD v0.3.5 关联细化 + 落地拆解）

***

## 1. 使用说明

本注册表是 DogEar 工作台所有 UI 组件的唯一索引。**新建组件前必须遵循以下流程**：

1. **先搜索**：在本注册表中按名称 / 描述 / 层级检索，确认是否已有可复用组件
2. **合并对照**：对照「组件合并对照表」（第 8 节），判断是复用、扩展还是新建
3. **命名规范**：

   * 文件名使用 PascalCase，如 `BookmarkCard.tsx`

   * 原子组件以 UI 语义命名（`Button`、`Input`）

   * 分子组件以功能组合命名（`SearchBox`、`BookmarkCard`）

   * 组织组件以业务区域命名（`BookmarkList`、`Sidebar`）

   * 模板组件以 `Layout` 后缀命名（`WorkbenchLayout`）

   * 页面组件以 `Page` 后缀命名（`WorkbenchPage`）
4. **注册**：新建组件后，必须在本文件对应层级中补充登记

***

## 2. 组件层级（原子设计）

DogEar 采用 Brad Frost 原子设计方法论，组件由小到大分为五个层级：

```
原子（Atoms）→ 分子（Molecules）→ 组织（Organisms）→ 模板（Templates）→ 页面（Pages）
```

| 层级     | 说明                | 复用范围          | 依赖方向            |
| ------ | ----------------- | ------------- | --------------- |
| **原子** | 不可再分的基础 UI 元素     | 全局通用，可被任意层级引用 | 不依赖其他 DogEar 组件 |
| **分子** | 2\~5 个原子组合而成的功能单元 | 跨模块复用         | 仅依赖原子组件         |
| **组织** | 业务区域级组件，包含数据获取和状态 | 特定功能模块内复用     | 可依赖原子 + 分子      |
| **模板** | 页面骨架，定义布局和插槽      | 页面级复用         | 可依赖原子 + 分子 + 组织 |
| **页面** | 完整页面，组合模板与业务组件    | 路由级，不复用       | 可依赖所有层级         |

**关键原则**：

* 上层可依赖下层，禁止反向依赖

* 同层级组件之间尽量解耦

* 跨模块共享的组件放在 `components/` 目录

* 模块内部组件放在对应 `features/` 子目录

***

## 3. 原子组件

基础 UI 组件，基于 shadcn/ui + Tailwind CSS 构建，全局通用。

| 名称              | 描述                    | Props                                                       | 文件位置建议                                                               |
| --------------- | --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `Button`        | 按钮组件，支持多种变体和尺寸        | `variant`, `size`, `disabled`, `onClick`, `children`        | `components/ui/button.tsx`                                           |
| `Input`         | 文本输入框                 | `type`, `placeholder`, `value`, `onChange`, `disabled`      | `components/ui/input.tsx`                                            |
| `Select`        | 下拉选择器                 | `options`, `value`, `onChange`, `placeholder`               | `components/ui/select.tsx`                                           |
| `Badge`         | 状态/标签徽章               | `variant`, `children`                                       | `components/ui/badge.tsx`                                            |
| `Icon`          | 图标组件（基于 Lucide React） | `name`, `size`, `className`                                 | `components/ui/icon.tsx`                                             |
| `Tag`           | 标签组件，支持可关闭和颜色         | `color`, `closable`, `onClose`, `children`                  | `components/ui/tag.tsx`                                              |
| `Tooltip`       | 悬浮提示                  | `content`, `side`, `children`                               | `components/ui/tooltip.tsx`                                          |
| `Modal`         | 模态弹窗                  | `open`, `onClose`, `title`, `children`                      | `components/ui/modal.tsx`                                            |
| `Dropdown`      | 下拉菜单                  | `trigger`, `items`, `onSelect`                              | `components/ui/dropdown.tsx`                                         |
| `Checkbox`      | 复选框                   | `checked`, `onChange`, `label`                              | `components/ui/checkbox.tsx`                                         |
| `Radio`         | 单选框                   | `options`, `value`, `onChange`                              | `components/ui/radio.tsx`                                            |
| `Switch`        | 开关切换                  | `checked`, `onChange`, `label`                              | `components/ui/switch.tsx`                                           |
| `Spinner`       | 加载指示器                 | `size`                                                      | `components/ui/spinner.tsx`                                          |
| `Avatar`        | 头像/图标展示               | `src`, `fallback`, `size`                                   | `components/ui/avatar.tsx`                                           |
| `Switch`（设置页原型） | 设置页开关组件               | `checked`, `onChange`, `label`                              | `dev/dogear-workbench/src/components/settings/atoms/Switch.tsx`      |
| `StatCard`      | 统计信息卡片                | `label`, `value`, `sub`, `tone`                             | `dev/dogear-workbench/src/components/settings/atoms/StatCard.tsx`    |
| `ConfigField`   | 带标签的配置输入框             | `label`, `value`, `onChange`, `type`, `placeholder`, `hint` | `dev/dogear-workbench/src/components/settings/atoms/ConfigField.tsx` |
| `KeyField`      | 密钥输入/显示/复制（仅显示一次）     | `value`, `onGenerate`, `onNotify`                           | `dev/dogear-workbench/src/components/settings/atoms/KeyField.tsx`    |

> 💡 原子组件优先使用 shadcn/ui 内置组件，在 `components/ui/` 下通过 `npx shadcn-ui add` 引入，按需定制样式。

***

## 4. 分子组件

由多个原子组合而成的功能单元，跨模块复用。

| 名称              | 描述                      | 组成                             | Props                                          | 文件位置建议                               |
| --------------- | ----------------------- | ------------------------------ | ---------------------------------------------- | ------------------------------------ |
| `SearchBox`     | 搜索输入框 + 图标 + 快捷键提示      | Input + Icon + Badge           | `value`, `onChange`, `onSubmit`, `placeholder` | `components/SearchBox.tsx`           |
| `BookmarkCard`  | 书签卡片：封面图 + 标题 + 标签 + 操作 | Avatar + Tag + Icon + Dropdown | `bookmark`, `view`, `onEdit`, `onDelete`       | `features/bookmark/BookmarkCard.tsx` |
| `FolderTree`    | 文件夹树形结构                 | Icon + Dropdown + 递归           | `folders`, `selectedId`, `onSelect`            | `components/FolderTree.tsx`          |
| `TagCloud`      | 标签云展示                   | Tag + Badge                    | `tags`, `selectedTags`, `onToggle`             | `components/TagCloud.tsx`            |
| `StatusBadge`   | 书签阅读状态徽章                | Badge + Icon                   | `status`, `onChange`                           | `components/StatusBadge.tsx`         |
| `SyncIndicator` | 同步状态指示器（旋转图标 + 提示文本）    | Spinner + Icon + Tooltip       | `syncStatus`, `lastSyncAt`                     | `components/SyncIndicator.tsx`       |

***

## 5. 组织组件

业务区域级组件，通常包含数据获取逻辑和局部状态管理。

| 名称                 | 描述                                | 数据依赖                            | Props                                                   | 文件位置建议                                                                      |
| ------------------ | --------------------------------- | ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `BookmarkList`     | 书签列表（网格/列表视图切换）                   | bookmarks store                 | `viewMode`, `filters`, `sortOrder`                      | `features/bookmark/BookmarkList.tsx`                                        |
| `Sidebar`          | 左侧导航栏：文件夹树 + 标签 + 统计入口            | folders store, tags store       | `collapsed`, `onToggle`                                 | `components/NavigationSidebar.tsx`                                          |
| `TopBar`           | 顶部工具栏：搜索 + 同步状态 + 用户操作            | sync store                      | `onSearch`, `onSettings`                                | `components/TopBar.tsx`                                                     |
| `ToolPanel`        | 右侧可折叠工具面板                         | 书签详情                            | `bookmarkId`, `collapsed`, `onToggle`                   | `components/ToolPanel.tsx`                                                  |
| `DockerBar`        | 底部 Docker 常驻栏（本地配置，开关持久化）         | docker\_items                   | `items`, `onSort`, `onRemove`                           | `components/DockerBar.tsx`                                                  |
| `PageTabs`         | 页面标签（横/竖排、拖拽排序、重命名）               | page\_tabs                      | `tabs`, `layout`, `onSort`, `onRename`                  | `components/PageTabs.tsx`                                                   |
| `StatsPanel`       | 统计面板：图表 + 数据摘要                    | stats store                     | `dateRange`                                             | `components/StatsPanel.tsx`                                                 |
| `ExportDialog`     | 导出弹窗：格式选择 + 筛选条件 + 预览             | bookmarks store                 | `open`, `onClose`                                       | `features/export/ExportDialog.tsx`                                          |
| `BatchActionBar`   | 批量操作工具栏：多选计数 + 操作按钮               | bookmarks store                 | `selectedIds`, `onAction`, `onClear`                    | `components/BatchToolbar.tsx`                                               |
| `SettingsModal`    | 居中设置模态框（分区导航 + 内容区）               | settings + logs/trash           | `open`, `onClose`, `settings`, `onUpdateSettings`, `bm` | `dev/dogear-workbench/src/components/settings/SettingsModal.tsx`            |
| `RaindropSection`  | Raindrop 同步分区：连接/定时/手动/队列/限频/同步日志 | settings.raindrop + sync + logs | `settings`, `onUpdateSettings`, `bm`                    | `dev/dogear-workbench/src/components/settings/sections/RaindropSection.tsx` |
| `BackupTargetCard` | 备份目标卡片（连接/备份/恢复/删除）               | settings.backup.targets         | `target`, `onUpdate`, `onRemove`                        | `dev/dogear-workbench/src/components/settings/sections/BackupSection.tsx`   |
| `LogRow`           | 单条操作日志行                           | logs store                      | `entry`                                                 | `dev/dogear-workbench/src/components/settings/sections/LogSection.tsx`      |
| `TrashRow`         | 单条回收站记录行                          | trash store                     | `item`, `onRestore`, `onPurge`                          | `dev/dogear-workbench/src/components/settings/sections/TrashSection.tsx`    |

> 说明：原型（workbench）内的 `BackupTargetCard / LogRow / TrashRow` 以渲染内联实现（未单独成文件），注册表登记为规划归属，正式工程落地时再拆分子组件文件；设置页分区组件（StatusSection / RaindropSection / BackupSection / AgentSection / LogSection / TrashSection）为分区容器，登记于上述对应组织行。

***

## 6. 模板组件

页面骨架模板，定义布局结构和插槽区域。

| 名称                | 描述                                | 插槽                                          | 文件位置建议                           |
| ----------------- | --------------------------------- | ------------------------------------------- | -------------------------------- |
| `WorkbenchLayout` | 主布局：侧栏 + 顶栏 + 内容区 + 工具面板          | `sidebar`, `topbar`, `content`, `toolpanel` | `app/layouts/MainLayout.tsx`     |
| `OrganizerLayout` | 整理模式布局：左侧列表 + 右侧预览 + 底部工具栏（两阶段分拣） | `list`, `preview`, `toolbar`                | `app/layouts/InboxLayout.tsx`    |
| `SettingsLayout`  | 设置页布局：左侧分类导航 + 右侧配置内容             | `nav`, `content`                            | `app/layouts/SettingsLayout.tsx` |

***

## 7. 页面组件

完整页面组件，组合模板与业务组件，对应路由入口。

| 名称              | 描述                                 | 使用模板              | 核心业务组件                                                              | 文件位置建议                        |
| --------------- | ---------------------------------- | ----------------- | ------------------------------------------------------------------- | ----------------------------- |
| `WorkbenchPage` | 主工作台页面：收藏列表 + 多视图 + 搜索             | `WorkbenchLayout` | `BookmarkList`, `Sidebar`, `TopBar`, `ToolPanel`, `BatchActionBar`  | `app/pages/DashboardPage.tsx` |
| `OrganizerPage` | 整理模式页面：两阶段分拣流程                     | `OrganizerLayout` | `InboxList`, `InboxPreview`, `InboxToolbar`, `PhaseOne`, `PhaseTwo` | `app/pages/InboxPage.tsx`     |
| `SettingsPage`  | 设置页面：Raindrop 配置 + Skill 配置 + 同步设置 | `SettingsLayout`  | `RaindropConfig`, `SkillConfig`, `SyncSettings`                     | `app/pages/SettingsPage.tsx`  |

***

## 8. 组件合并对照表

新建组件前，按此表判断是否应复用或扩展现有组件：

| 场景                 | 判断条件               | 处理方式                             |
| ------------------ | ------------------ | -------------------------------- |
| 新组件与已有组件功能重叠 > 70% | 核心 Props 和渲染逻辑基本一致 | ✅ 复用已有组件，通过 Props 变体扩展           |
| 新组件是已有组件的子集        | 功能更简单，是已有组件的简化版    | ✅ 在已有组件中增加 `variant` 或 `size` 属性 |
| 新组件是已有组件的超集        | 功能更丰富，包含已有组件全部能力   | ⚠️ 扩展已有组件，避免创建新组件                |
| 新组件与已有组件仅有 UI 相似   | 业务逻辑完全不同（如不同数据源）   | ❌ 可新建，但抽取共享 UI 部分为原子/分子          |
| 新组件属于不同层级          | 如把原子级功能做成组织级       | ❌ 放到正确的层级，避免层级错位                 |

**合并决策流程**：

```
新组件需求
  ↓
搜索注册表 → 找到相似组件？
  ├── 是 → 功能重叠 > 70%？
  │         ├── 是 → 扩展已有组件（增加 variant/Props）
  │         └── 否 → 是否仅 UI 相似？
  │                   ├── 是 → 新建，抽取共享 UI 部分
  │                   └── 否 → 继续评估合并方案
  └── 否 → 确认所属层级 → 创建新组件 → 注册到本表
```

***

## 9. 新建组件约束

AI 协作开发中，新建组件必须遵守以下约束：

### 约束话术（AI 必须遵循）

> **"在新建组件之前，我将先搜索组件注册表（`docs/COMPONENTS.md`），确认是否已有可复用或可扩展的组件。如果已有相似组件，我将优先通过扩展 Props 或变体的方式复用，而非新建。如确需新建，我将补充注册表登记。"**

### 新建检查清单

* [ ] 已搜索注册表，确认无高度相似组件

* [ ] 已对照合并表，确认不适合扩展现有组件

* [ ] 已确认组件层级归属（原子 / 分子 / 组织 / 模板 / 页面）

* [ ] 已确定文件命名（PascalCase）和存放位置

* [ ] 已定义组件 Props 接口（TypeScript 类型）

* [ ] 新建完成后已更新本注册表

### 禁止事项

* ❌ 不经搜索直接创建新组件

* ❌ 同一功能创建多个重复组件（如多个 Button 变体分散在不同目录）

* ❌ 跳过注册登记，组件游离于注册表之外

* ❌ 跨层级依赖（如原子组件引用组织组件）

***

## 快速参考卡

### 组件层级速查

```
原子 Atoms          → Button, Input, Select, Badge, Icon, Tag, Tooltip, Modal,
                       Dropdown, Checkbox, Radio, Switch, Spinner, Avatar
                       路径: components/ui/

分子 Molecules      → SearchBox, BookmarkCard, FolderTree, TagCloud,
                       StatusBadge, SyncIndicator
                       路径: components/ 或 features/*/}

组织 Organisms     → BookmarkList, Sidebar, TopBar, ToolPanel, StatsPanel,
                       ExportDialog, BatchActionBar
                       路径: components/ 或 features/*/

模板 Templates     → WorkbenchLayout, OrganizerLayout, SettingsLayout
                       路径: app/layouts/

页面 Pages         → WorkbenchPage, OrganizerPage, SettingsPage
                       路径: app/pages/
```

### 文件路径总览

```
apps/web/src/
├── components/                    # 跨模块共享组件
│   ├── ui/                        # 原子组件（shadcn/ui）
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── icon.tsx
│   │   ├── tag.tsx
│   │   ├── tooltip.tsx
│   │   ├── modal.tsx
│   │   ├── dropdown.tsx
│   │   ├── checkbox.tsx
│   │   ├── radio.tsx
│   │   ├── switch.tsx
│   │   ├── spinner.tsx
│   │   └── avatar.tsx
│   ├── SearchBox.tsx              # 分子
│   ├── FolderTree.tsx             # 分子
│   ├── TagCloud.tsx               # 分子
│   ├── StatusBadge.tsx            # 分子
│   ├── SyncIndicator.tsx          # 分子
│   ├── NavigationSidebar.tsx      # 组织
│   ├── TopBar.tsx                 # 组织
│   ├── ToolPanel.tsx              # 组织
│   ├── StatsPanel.tsx             # 组织
│   ├── BatchToolbar.tsx           # 组织
│   └── UndoBar.tsx                # 组织
├── features/
│   ├── bookmark/
│   │   ├── BookmarkCard.tsx       # 分子
│   │   └── BookmarkList.tsx       # 组织
│   ├── inbox/
│   │   ├── InboxList.tsx          # 组织
│   │   ├── InboxPreview.tsx       # 组织
│   │   └── InboxToolbar.tsx       # 组织
│   ├── export/
│   │   └── ExportDialog.tsx       # 组织
│   └── search/
│       └── SearchCommand.tsx      # 组织
├── app/
│   ├── layouts/
│   │   ├── MainLayout.tsx         # 模板
│   │   ├── InboxLayout.tsx        # 模板
│   │   └── SettingsLayout.tsx     # 模板
│   └── pages/
│       ├── DashboardPage.tsx      # 页面
│       ├── InboxPage.tsx          # 页面
│       ├── FolderPage.tsx         # 页面
│       ├── TagPage.tsx            # 页面
│       ├── StatsPage.tsx          # 页面
│       ├── LogPage.tsx            # 页面
│       └── SettingsPage.tsx       # 页面
```

