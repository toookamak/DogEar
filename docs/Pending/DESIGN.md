# DogEar 技术设计文档

- **日期**：2026-08-21

- **版本**：v1.1

- **状态**：Phase 1 设计完成（已对齐 PRD v0.3.5 + 600 条基线 + 关联细化）

***

## 1. 架构概览

### 1.1 系统架构图

DogEar 采用服务端真源的双轨架构：Skill API 作为 AI 接入层，服务端数据层作为核心存储与同步中枢，前端应用层包含工作台和导航页两个独立客户端。部署分为 Cloudflare Workers+D1 默认轨与 Docker+Bun+SQLite 本地轨；IndexedDB 仅作为端侧缓存。

```
┌─────────────────────────────────────────────────────┐
│                    Skill API                         │
│     任何 AI 平台调用（Hermes / OpenClaw / 其他）      │
│     自描述接口，给 Base URL + Token 即可使用           │
│     安全策略：软删除、操作限速、审计日志、撤销机制     │
│     实现：Cloudflare Workers / Bun + Hono               │
└──────────────────────┬──────────────────────────────┘
                       │
                       │  HTTP REST (Bearer Token Auth)
                       ▼
┌──────────────────────────────────────────────────────┐
│                 服务端数据层 (Core)                    │
│                                                      │
│   D1（默认轨）/ SQLite（本地轨） ←→ 同步引擎 ←→ Raindrop API
│                                                      │
│   • 服务端为真源，在线写入先完成服务端事务             │
│   • 变更队列由服务端同步引擎推送到 Raindrop             │
│   • 离线写入端侧缓存，联网后提交服务端                 │
│   • 定时拉取 Raindrop 变更，冲突两端保留由用户选择      │
│   • 软删除：标记删除，保留 7 天可恢复                  │
│   • 操作日志：记录所有变更，支持回滚                   │
└────────┬──────────────────┬──────────────────────────┘
         │                  │
         │  HTTP API          │  HTTP API
         │  + 端侧缓存         │  + 端侧缓存
         ▼                  ▼
┌──────────────┐   ┌──────────────────┐
│   工作台      │   │   个人导航页      │
│   (Web App)  │   │   (浏览器插件     │
│  React+Vite  │   │    新标签页)       │
│  shadcn/ui   │   │  Manifest V3     │
│              │   │                  │
│   整理/浏览   │   │   图标网格/搜索   │
│   批量操作    │   │   Docker 栏       │
│   多视图      │   │   快速启动        │
│   工具面板    │   │   隐私保护        │
└──────────────┘   └──────────────────┘
```

### 1.2 技术选型

| 层级               | 技术选择                                            | 选型理由                            |
| ---------------- | ----------------------------------------------- | ------------------------------- |
| **工作台前端**        | React + Vite                                    | 生态成熟，AI 协作友好，社区资源丰富             |
| **UI 组件库**       | shadcn/ui                                       | 轻量可定制、无运行时开销、与 Tailwind CSS 配合  |
| **样式方案**         | Tailwind CSS                                    | 与 shadcn/ui 原生配合，原子化 CSS 提高开发效率 |
| **状态管理**         | Zustand                                         | 轻量简洁，API 学习成本低，适合中小型项目          |
| **服务端默认轨**       | Cloudflare Workers + D1                         | 托管式默认部署，服务端事务作为数据真源             |
| **服务端本地轨**       | Docker + Bun + SQLite                           | 本地可控部署，保持与默认轨一致的 API 与数据边界      |
| **端侧缓存**         | Dexie.js（IndexedDB 封装）                          | 缓存离线数据和待提交变更，不作为运行时真源           |
| **拖拽能力**         | @dnd-kit                                        | 现代化拖拽库、TypeScript 友好、支持多容器拖拽    |
| **表单校验**         | React Hook Form + Zod                           | 类型安全的表单校验，Zod 可复用于 API 参数校验     |
| **图标**           | Lucide React                                    | 与 shadcn/ui 生态一致，图标风格统一         |
| **Skill API 后端** | Hono（Workers / Bun 运行时）                         | 统一 API 边界，兼容默认云端轨与本地轨           |
| **浏览器插件**        | Manifest V3                                     | Chrome/Edge 兼容性好，MV3 是当前标准      |
| **Monorepo 管理**  | pnpm workspace + Turborepo                      | pnpm 节省磁盘和安装速度，Turborepo 增量构建   |
| **部署**           | Cloudflare Workers+D1 默认轨；Docker+Bun+SQLite 本地轨 | 云端默认部署与本地可控部署并行                 |

### 1.3 数据流（已对齐 600 条基线 + 同步速率监测）

数据从输入到存储的完整流程，速率（条数/秒、时延、成功率、队列长度、429）计入 05.2 监测：

```
                        ┌──────────────────────────────────────────────────┐
                        │                  数据输入端                       │
                        ├──────────────────────────────────────────────────┤
                        │                                                  │
  ┌──────────┐          │   ┌────────────────┐                             │
  │ AI Agent  │──收藏──→│──→│ Skill API       │──事务──→┌──────────────┐   │
  │ (任意平台) │         │   │ (save_bookmark) │         │              │   │
  └──────────┘          │   └────────────────┘         │  服务端数据层 │   │
                        │                              │  (D1/SQLite)  │   │
                        │   ┌────────────────┐         │              │   │
  │ 浏览器插件 │─────────│──→│ 服务端 API      │──请求──→│              │   │
  │ (原生收藏)  │        │   │                 │         │              │   │
  └─────────────┘       │   └────────────────┘         └──────┬───────┘   │
                        │                                     │           │
                        │   ┌────────────────┐               │           │
  │ 手动输入   │─────────│──→│ 工作台 Web App   │──编辑──→      │           │
  │ (工作台)    │        │   │ (网格/列表/整理) │               │           │
  └─────────────┘       │   └────────────────┘               │           │
                        │                                     │           │
                        └─────────────────────────────────────┼───────────┘
                                                              │
                                                ┌─────────────┼─────────────┐
                                                │             │             │
                                                ▼             ▼             ▼
                                          ┌──────────┐ ┌──────────┐ ┌──────────┐
                                          │ 同步队列  │ │ 操作日志  │ │ 导航页    │
                                          │ (推送到   │ │ (审计+   │ │ (读取    │
                                          │ Raindrop) │ │ 回滚)    │ │ 缓存)    │
                                          └──────────┘ └──────────┘ └──────────┘
```

**写入流（客户端/API → 服务端 → Raindrop）**：

```
用户/AI/插件/工作台通过服务端 API 写入 D1/SQLite
→ 服务端事务成功
→ 更新 IndexedDB 缓存并入 sync_queue
→ 同步引擎后台轮询（每 30s）
→ 按 API 限速逐条推送（每次最多 5 条，429 退避）
→ 推送成功 → 从 sync_queue 移除
→ 推送失败 → 重试（最多 3 次）→ 标记需人工干预
```

**读取流（Raindrop → 服务端 → 客户端）**：

```
定时拉取（每 5 分钟，可配置）或手动刷新
→ 服务端同步引擎从 Raindrop 增量拉取
→ 写入 D1/SQLite
→ 对比服务端版本处理冲突
→ 冲突两端保留，等待用户选择
→ 由客户端 API 刷新 IndexedDB
```

***

## 2. 模块划分

### 2.1 工作台模块

工作台是 DogEar 的核心交互界面，采用 React + Vite + shadcn/ui 技术栈，按功能模块组织：

```
apps/web/src/
├── app/                        # 路由和页面入口
│   ├── routes.tsx              # 路由定义
│   ├── layouts/
│   │   ├── MainLayout.tsx      # 主布局（侧栏+顶栏+内容区+工具面板）
│   │   └── InboxLayout.tsx     # 整理模式布局（左侧列表+右侧预览）
│   └── pages/
│       ├── DashboardPage.tsx   # 主界面（收藏列表）
│       ├── InboxPage.tsx       # 整理模式
│       ├── FolderPage.tsx      # 文件夹视图
│       ├── TagPage.tsx         # 标签视图
│       ├── StatsPage.tsx       # 统计视图
│       ├── LogPage.tsx         # 操作日志
│       └── SettingsPage.tsx    # 设置页
├── features/
│   ├── bookmark/               # 书签管理
│   │   ├── views/              # 网格视图、列表视图、看板视图（Phase 2）
│   │   ├── BookmarkCard.tsx    # 书签卡片组件
│   │   ├── inline-edit/        # 内联编辑（标签、文件夹、状态）
│   │   └── batch/              # 批量操作
│   ├── inbox/                  # 整理模式
│   │   ├── InboxList.tsx       # 左侧待处理列表
│   │   ├── InboxPreview.tsx    # 右侧预览面板
│   │   ├── InboxToolbar.tsx    # 底部工具栏（统计+批量操作）
│   │   ├── PhaseOne.tsx        # 阶段一：分拣（保留/删除/待定）
│   │   └── PhaseTwo.tsx        # 阶段二：分类（采纳建议/修改）
│   ├── search/                 # 搜索
│   │   └── SearchCommand.tsx   # ⌘K 快速搜索/命令面板
│   ├── export/                 # 导出
│   │   └── ExportDialog.tsx    # 导出弹窗（HTML/MD/CSV/JSON）
│   └── settings/               # 设置
│       ├── RaindropConfig.tsx  # Raindrop 连接配置
│       ├── SkillConfig.tsx     # Skill API 配置
│       └── SyncSettings.tsx    # 同步间隔设置
├── components/                 # 跨模块共享 UI 组件
│   ├── NavigationSidebar.tsx   # 左侧导航栏
│   ├── ToolPanel.tsx           # 右侧可折叠工具面板
│   ├── TagSelector.tsx         # 标签选择器
│   ├── FolderPicker.tsx        # 文件夹选择器
│   ├── SearchBar.tsx           # 搜索栏
│   ├── SyncIndicator.tsx       # 同步状态指示器
│   ├── BatchToolbar.tsx        # 批量操作工具栏
│   └── UndoBar.tsx             # 底部撤销提示条
├── hooks/                      # 跨模块共享 hooks
├── lib/                        # 业务逻辑
│   ├── data-layer.ts           # 数据层接口
│   ├── sync-engine.ts          # 同步引擎
│   └── raindrop-api.ts         # Raindrop API 客户端
├── types/                      # 跨模块共享类型
└── utils/                      # 工具函数
```

**2.1.1 书签管理模块**

核心功能：多视图展示（网格/列表）、内联编辑、批量操作。

| 功能   | 实现方案                    | 说明                       |
| ---- | ----------------------- | ------------------------ |
| 网格视图 | CSS Grid + BookmarkCard | 卡片式展示：封面图 + 标题 + 标签      |
| 列表视图 | Flex 列表 + BookmarkCard  | 紧凑行展示，一屏更多条目             |
| 内联编辑 | Hover 触发浮层              | 悬浮卡片时浮现文件夹选择器/标签选择器/状态切换 |
| 批量操作 | 多选 + BatchToolbar       | 选中后出现批量工具栏：移动、打标、删除      |

**2.1.2 整理模式模块**

采用两阶段分拣流程（Inbox Zero），左右分区布局：

- **阶段一（分拣）**：筛选"保留/删除/待定"，快速过滤不需要的条目

  - 左侧紧凑列表：每条显示标题 + URL + AI 摘要 + 三个操作按钮

  - 右侧预览面板：点击后显示完整详情、AI 建议分类/标签

  - 底部工具栏：统计信息（✓N ✕N ?N 未处理:N）+ 批量操作 + 进入阶段二

  - 键盘操作：Enter 保留、D 删除、S 待定、←→ 切换、Esc 退出

- **阶段二（分类）**：仅展示"保留"条目，每条展示 AI 建议的文件夹和标签

  - 支持逐条采纳/修改 AI 建议

  - 支持批量采纳 AI 建议

  - "在浏览器中打开"可跳转原文阅读后返回继续

**2.1.3 搜索模块**

- 全局快速搜索（⌘K），搜索所有书签（含未在当前页显示的）

- 搜索结果以下拉列表呈现，支持模糊匹配标题和域名

- 本地 IndexedDB 全文搜索，不依赖 Raindrop API

**2.1.4 导出模块**

| 格式       | 说明                | 用途                   |
| -------- | ----------------- | -------------------- |
| HTML     | 浏览器收藏夹格式          | 可导入 Chrome / Firefox |
| Markdown | 标题 + 链接 + 标签 + 备注 | 人类可读备份               |
| CSV      | 表格化数据             | 数据分析                 |
| JSON     | 完整数据（含元信息）        | 备份/迁移                |

导出时支持按文件夹、标签、状态、时间范围筛选。

**2.1.5 设置模块**

- Raindrop Token 配置与连接验证

- Skill API Token 生成与管理

- 同步间隔配置（5 分钟 / 15 分钟 / 手动）

- 隐私设置（私密文件夹/标签标记）

### 2.2 导航页模块

浏览器插件，替换新标签页，基于 Manifest V3。

```
apps/extension/src/
├── newtab/                     # 新标签页
│   ├── index.html
│   ├── NewTab.tsx              # 新标签页主组件
│   ├── components/
│   │   ├── TimeSearch.tsx      # 顶部时间和搜索区
│   │   ├── PageTabs.tsx        # 页面标签区（水平/垂直可切换）
│   │   ├── WidgetsZone.tsx     # 小组件区（稍后读/待办/最近/统计）
│   │   ├── FolderGrid.tsx      # 文件夹图标区
│   │   ├── BookmarkGrid.tsx    # 书签图标网格
│   │   ├── DockerBar.tsx       # 底部 Docker 常驻栏
│   │   ├── FolderOverlay.tsx   # 文件夹展开浮层
│   │   └── PageIndicator.tsx   # 页码指示器
│   └── hooks/
│       ├── useNavigationData.ts # 数据获取（服务端 API 优先，IndexedDB 缓存离线兜底）
│       └── usePrivacyGuard.ts   # 隐私控制逻辑
├── popup/                      # 插件弹窗（快捷操作入口）
├── shared/                     # 共享逻辑
│   ├── storage.ts              # IndexedDB 读取封装
│   └── types.ts                # 共享类型定义
└── manifest.json
```

**2.2.1 网格布局与显示控制（已对齐 04.5.10 关联细化）**

- 显示控制：工作台 `设置>导航页` 设 `全部/按规则-或/自定义搜索勾选/隐藏`，`showInNav` 持久化；导航页读 `showInNav` 渲染，按规则先做或，后续扩展与

- 开关持久化：导航页可关闭无需确认，`showInNav/page_tab/docker_items` 保留，重开即还原，新标签页恢复浏览器默认

- 统一格子系统（6 列 × 4 行 = 24 格/页）

- 书签图标占 1 格，文件夹图标占 1 格，小组件可占多格（2×1、2×2 等）

- 文件夹以聚合图标呈现（内显前 4 个书签 favicon），点击展开浮层

- 支持分页，页码指示点显示（● ○ ○）

- 页面标签按内容维度命名（常用/开发/阅读等），非自动分割

**2.2.2 Docker 常驻栏**

底部半透明磨砂底栏，始终固定显示，不随分页切换：

- 放置最常用的书签/文件夹快捷方式

- 支持从主网格拖入添加、拖出移除

- 内部支持拖拽排序

- 配置项：启用/关闭、位置、显示名称、最大图标数（12）、图标大小

- 数据完全本地，不写入 Raindrop，不参与同步

**2.2.3 搜索**

- 页面顶部居中搜索框

- 搜索所有书签（含未在当前页显示的），模糊匹配标题和域名

- 结果以下拉列表呈现，点击直接打开

**2.2.4 隐私控制**

- 标记为私密的文件夹/标签在导航页默认不显示

- 查看私密内容需解锁（密码/系统认证）

- 设置中配置私密标记

### 2.3 Skill API 模块

AI 能力接口层，采用 Hono，运行于 Cloudflare Workers 默认轨或 Bun 本地轨，遵循自描述、安全边界、平台无关三大原则。

```
apps/server/src/
├── index.ts                    # 服务入口
├── routes/
│   ├── capabilities.ts         # /.well-known/capabilities 自描述端点
│   ├── bookmarks.ts            # /api/v1/bookmarks CRUD
│   └── stats.ts                # /api/v1/stats 统计
├── middleware/
│   ├── auth.ts                 # Bearer Token 认证
│   ├── rate-limit.ts           # 限速（60 次/分钟，写入 10 次/分钟）
│   ├── audit-log.ts            # 操作审计日志
│   └── cors.ts                 # CORS 配置（仅允许本地 + Tailscale）
├── services/
│   ├── bookmark-service.ts     # 书签业务逻辑
│   ├── raindrop-client.ts      # Raindrop API 客户端
│   ├── ai-classifier.ts        # AI 自动分类服务
│   └── preference-learner.ts   # AI 偏好学习（Phase 2）
└── types/
    └── api.ts                  # API 类型定义
```

**2.3.1 自描述机制**

AI 平台绑定时只需提供 Base URL 和 Token，通过访问 `/.well-known/capabilities` 端点自动获取完整能力清单：

```json
{
  "name": "DogEar Bookmark Skill",
  "version": "1.0.0",
  "description": "个人书签收藏与管理的 AI 能力接口",
  "capabilities": [
    {
      "name": "save_bookmark",
      "description": "收藏一个链接，自动抓取元数据、分类、打标签",
      "parameters": {
        "url": { "type": "string", "required": true, "description": "要收藏的 URL" },
        "note": { "type": "string", "required": false, "description": "用户备注" }
      },
      "example": "save_bookmark(url='https://example.com/article', note='设计参考')"
    },
    {
      "name": "search_bookmarks",
      "description": "搜索书签，支持自然语言和条件筛选"
    },
    {
      "name": "update_bookmark",
      "description": "修改单条书签的文件夹、标签、备注或状态"
    },
    {
      "name": "list_bookmarks",
      "description": "列出书签，支持筛选和分页"
    },
    {
      "name": "get_stats",
      "description": "获取收藏统计信息，无输入参数"
    }
  ],
  "rateLimits": {
    "requestsPerMinute": 60,
    "writesPerMinute": 10
  }
}
```

**2.3.2 端点设计**

| 方法     | 路径                              | 说明            | 认证           |
| ------ | ------------------------------- | ------------- | ------------ |
| GET    | `/.well-known/capabilities`     | 自描述端点         | 可选           |
| POST   | `/api/v1/bookmarks`             | 收藏新书签         | Bearer Token |
| GET    | `/api/v1/bookmarks`             | 列出书签（支持筛选/分页） | Bearer Token |
| GET    | `/api/v1/bookmarks/:id`         | 获取单条书签        | Bearer Token |
| PATCH  | `/api/v1/bookmarks/:id`         | 修改书签          | Bearer Token |
| DELETE | `/api/v1/bookmarks/:id`         | 软删除书签         | Bearer Token |
| POST   | `/api/v1/bookmarks/:id/restore` | 恢复已删除书签       | Bearer Token |
| GET    | `/api/v1/stats`                 | 获取统计信息        | Bearer Token |

**2.3.3 安全策略**

| 类别      | 策略                                           |
| ------- | -------------------------------------------- |
| 认证      | 所有端点（除 capabilities）需要 Bearer Token          |
| AI 禁止操作 | 删除书签（DELETE 返回 403 给 AI 调用）、修改文件夹结构、批量操作（默认） |
| AI 允许操作 | 收藏新链接、搜索列出、单条修改、获取统计                         |
| 限速      | 每分钟最多 60 次请求，连续写入超 10 次/分钟触发警告               |
| CORS    | 仅允许 localhost 和 Tailscale 内网地址               |
| 输入校验    | URL 格式校验、参数类型检查（Zod）                         |
| 操作日志    | 所有写操作记录到 operation\_log，支持审计和回滚              |

### 2.4 数据库层

#### 2.4.1 服务端数据模型映射与端侧缓存镜像（已对齐 DATA\_MODEL v1.2）

D1（默认轨）或 SQLite（本地轨）是书签、文件夹、同步队列和操作日志的服务端真源；端侧使用 Dexie.js 封装 IndexedDB，作为服务端数据的缓存镜像并保存离线待提交变更，不作为核心表来源。

**bookmarks 表（书签主数据）**：

| 字段           | 类型            | 索引  | 说明                                         |
| ------------ | ------------- | --- | ------------------------------------------ |
| `id`         | string (UUID) | 主键  | 本地唯一 ID                                    |
| `raindropId` | number?       | 有索引 | Raindrop 侧 ID，用于同步匹配                       |
| `url`        | string        | —   | 书签 URL                                     |
| `title`      | string        | —   | 标题                                         |
| `note`       | string        | —   | 用户备注                                       |
| `excerpt`    | string        | —   | AI 生成摘要（仅本地）                               |
| `favicon`    | string        | —   | 图标缓存（仅本地）                                  |
| `folderId`   | string        | 有索引 | 所属文件夹                                      |
| `tags`       | string\[]     | —   | 标签列表                                       |
| `status`     | enum          | 有索引 | 阅读状态：unread / reading / read / organized   |
| `showInNav`  | boolean       | —   | 是否在导航页显示，仅本地持久化                            |
| `isPrivate`  | boolean       | —   | 是否私密，仅本地持久化                                |
| `syncStatus` | enum          | —   | 同步状态：pending / syncing / synced / conflict |
| `isDeleted`  | boolean       | 有索引 | 软删除标记                                      |
| `deletedAt`  | number?       | —   | 删除时间戳                                      |
| `createdAt`  | number        | 有索引 | 创建时间                                       |
| `updatedAt`  | number        | —   | 更新时间                                       |

**sync\_queue 表（同步变更队列）**：

| 字段              | 类型      | 说明                                  |
| --------------- | ------- | ----------------------------------- |
| `id`            | string  | 队列项唯一 ID                            |
| `bookmarkId`    | string? | 关联的书签 ID                            |
| `folderId`      | string? | 关联的文件夹 ID                           |
| `action`        | enum    | create / update / delete            |
| `payload`       | unknown | 变更数据快照                              |
| `status`        | enum    | pending / syncing / synced / failed |
| `retryCount`    | number  | 已重试次数                               |
| `createdAt`     | number  | 入队时间                                |
| `lastAttemptAt` | number? | 上次尝试时间                              |

**operation\_log 表（操作日志）**：

| 字段           | 类型      | 说明                                                    |
| ------------ | ------- | ----------------------------------------------------- |
| `id`         | string  | 日志条目 ID                                               |
| `action`     | string  | 操作类型（create / update / delete / restore / move / tag） |
| `targetType` | string  | 操作实体类型（bookmark / folder）                             |
| `targetId`   | string  | 操作实体 ID                                               |
| `before`     | unknown | 操作前数据快照（用于回滚）                                         |
| `after`      | unknown | 操作后数据快照                                               |
| `createdAt`  | number  | 操作时间                                                  |

**folders 表（文件夹）**：

| 字段           | 类型      | 说明                     |
| ------------ | ------- | ---------------------- |
| `id`         | string  | 本地文件夹 ID               |
| `raindropId` | number? | Raindrop collection ID |
| `name`       | string  | 文件夹名称                  |
| `parentId`   | string? | 父文件夹 ID（支持嵌套）          |
| `order`      | number  | 排序权重                   |

**导航页配置表（按服务端/端侧归属拆分）**：

- `page_tabs`：端侧本地配置，保存导航页页面标签、布局、筛选规则与排序。

- `docker_items`：端侧本地配置，保存导航页 Dock 栏项目与排序；导航页关闭时保留，重新开启后恢复。

- `settings`：服务端真源，保存应用运行时配置；敏感值加密存储，端侧仅缓存脱敏结果或短期使用所需数据。

- `sync_meta`：服务端真源，保存同步游标、时间戳与运行状态，不写入端侧业务缓存，也不参与 Raindrop 书签数据同步。

#### 2.4.2 同步引擎

同步引擎是 DogEar 数据可靠性的生命线，负责服务端真源、端侧 IndexedDB 缓存与 Raindrop 之间的双向数据同步。

**推送策略**：

- 后台轮询间隔：30 秒

- 每次最多推送 5 条变更

- 遇到 Raindrop 429 限频时，按 `Retry-After` 响应头退避等待

- 重试策略：最多 3 次，间隔递增（1s → 3s → 9s）

- 超过重试次数标记为"需人工干预"

**拉取策略**：

- 定时拉取间隔：可配置（5 分钟 / 15 分钟 / 手动）

- 先查询 Raindrop collections 的 `lastUpdate`，仅在集合更新时间发生变化后继续拉取详情

- 检测到变化后按 API 分页拉取书签与文件夹详情，并写入服务端真源

- 首次初始化或每周兜底执行一次全量分页拉取

- 使用 `sync_meta` 保存集合更新时间与同步游标，对比本地 `raindropId` 处理匹配

**冲突处理**：

- 冲突两端保留，等待用户选择

- 提供冲突视图：用户可选择"用本地的"、"用 Raindrop 的"或"手动合并"

#### 2.4.3 操作日志

- 所有写操作（创建/更新/删除/恢复）记录 `beforeSnapshot` 和 `afterSnapshot`

- 支持单步撤销：从 `afterSnapshot` 回滚到 `beforeSnapshot`

- 工作台底部常驻撤销提示条，支持 Ctrl+Z 撤销最近操作

- 日志保留策略：保留 5000 条或 30 天，超出数量或期限的日志自动清理归档

#### 2.4.4 标签约定

DogEar 通过 Raindrop 标签系统实现多维度数据扩展，使用前缀约定区分：

| 标签约定            | 用途    | 示例                                                                          |
| --------------- | ----- | --------------------------------------------------------------------------- |
| `_status:xxx`   | 阅读状态  | `_status:unread`、`_status:reading`、`_status:read`、`_status:organized`       |
| `_scene:xxx`    | 情景/用途 | `_scene:learning`、`_scene:work`、`_scene:inspiration`、`_scene:entertainment` |
| `_priority:xxx` | 优先级   | `_priority:high`、`_priority:medium`、`_priority:low`                         |
| `_temporal:xxx` | 时效性   | `_temporal:permanent`、`_temporal:temporary`                                 |
| `_project:xxx`  | 项目关联  | `_project:dogear`                                                           |

前缀统一使用下划线 `_`，与用户自定义标签区分开。在 UI 层读取时过滤前缀标签，映射为可读名称。

***

## 3. 架构决策记录

### 3.1 决策：服务端真源 + 端侧缓存与离线提交

**决策**：在线写入服务端事务，离线写入 IndexedDB 并联网提交。

**理由**：

- 服务端事务统一数据真源，保证 API、工作台和导航页的数据边界一致

- IndexedDB 仅承担端侧缓存与离线待提交变更，不承担运行时真源职责

- Raindrop API 有调用频率限制（429），由服务端同步引擎统一限速和退避

- 冲突不自动覆盖，保留两端版本交由用户决策

**替代方案**：

| 方案   | 优势     | 劣势                      |
| ---- | ------ | ----------------------- |
| 实时同步 | 数据一致性高 | 受 Raindrop 限频影响，操作延迟明显  |
| 纯本地  | 完全离线可用 | 浏览器清除数据会丢失，不满足"多平台可取"需求 |
| 纯云端  | 多设备一致  | 无网络时不可用，操作体验差           |

**权衡**：

- 短期数据不一致风险：通过同步引擎保证最终一致性

- 浏览器数据丢失风险：Raindrop 作为持久化保障，本地可重建

- 同步引擎复杂度：Phase 1 只做基本的推送/拉取+冲突两端保留并由用户选择，不过度设计

### 3.2 决策：Monorepo 组织

**决策**：使用 pnpm workspace + Turborepo 管理整个项目，分为 `apps/`（工作台、导航页插件、Skill API 服务端）和 `packages/`（共享类型、数据库层、工具函数）。

**理由**：

- 三个应用共享数据模型和类型定义，Monorepo 避免重复和不一致

- `packages/db` 独立封装数据层，工作台和 Skill API 服务端都可以复用

- Turborepo 支持增量构建和缓存，开发体验好

- 统一的版本管理和依赖管理，减少依赖冲突

**工具选择**：

- pnpm：节省磁盘空间（硬链接）、安装速度快、workspace 支持好

- Turborepo：增量构建、任务编排、构建缓存

### 3.3 决策：Skill API 自描述机制

**决策**：Skill API 通过 `/.well-known/capabilities` 端点暴露完整的自描述能力清单，AI 平台绑定时只需提供 Base URL 和 Token。

**理由**：

- 需求明确要求"Skill 不应绑定特定 AI 平台"，需要平台无关的接入方式

- AI 通过链接自动发现能力，不需要用户反复说明如何使用

- 参考了 OpenAPI / MCP 等标准的自描述思想，但更轻量

- 返回的 capabilities 直接包含参数说明和使用示例，降低 AI 理解成本

**实现方案**：

- 端点返回 JSON 格式的能力清单，包含名称、描述、参数、示例

- 附带限速策略信息，AI 可据此调整调用频率

- 统一的请求/响应格式（`ok`/`data`/`error`/`meta`）

- 后续可扩展支持 OpenAPI 3.0 schema 导出，兼容更多 AI 工具链

***

## 4. 非功能需求

### 4.1 性能要求

| 指标     | 目标值      | 说明                |
| ------ | -------- | ----------------- |
| 首屏加载   | < 1 秒    | 工作台主界面首屏渲染        |
| 列表渲染   | < 2 秒    | 500+ 条书签列表完整渲染    |
| 卡片操作响应 | < 200 毫秒 | 内联编辑、标签切换、文件夹移动   |
| 搜索响应   | < 300 毫秒 | ⌘K 搜索从输入到结果展示     |
| 同步推送   | 异步不阻塞    | 后台同步不影响 UI 响应     |
| 滚动性能   | 60fps    | 500+ 条书签列表滚动流畅无卡顿 |
| 导航页加载  | < 500 毫秒 | 新标签页打开到图标展示       |

**性能策略**：

- 列表使用虚拟滚动（virtual scroll）处理大数据量

- favicon 图标本地缓存，避免重复网络请求

- IndexedDB 查询利用索引字段（raindropId、status、isDeleted、createdAt）

- 同步引擎后台运行，不阻塞 UI 线程

### 4.2 安全要求

| 维度      | 措施           | 说明                            |
| ------- | ------------ | ----------------------------- |
| 认证      | Bearer Token | 所有 API 端点需 Token 认证           |
| AI 操作边界 | 角色权限控制       | AI 禁止删除、批量操作，仅允许收藏/搜索/单条修改/统计 |
| 限速      | 请求频率限制       | 60 次/分钟，写入 10 次/分钟            |
| 软删除     | 标记删除+保留期     | 删除标记保留 7 天，支持一键恢复             |
| 操作日志    | 全量审计         | 所有写操作记录 before/after 快照       |
| 撤销机制    | 操作回滚         | 底部常驻撤销条，支持 Ctrl+Z             |
| CORS    | 来源限制         | 仅允许 localhost 和 Tailscale 内网  |
| 隐私保护    | 私密内容标记       | 导航页默认不显示私密文件夹/标签，需解锁查看        |
| 数据安全    | 本地存储         | Token 本地加密存储，不明文写入文件          |

### 4.3 可扩展性要求

DogEar 当前为个人自用工具，但架构设计需为未来产品化预留空间：

| 维度     | 预留措施                  | 当前实现                                            |
| ------ | --------------------- | ----------------------------------------------- |
| 多用户    | 数据模型预留 `user_id` 字段   | 字段存在但只服务单一用户                                    |
| API 认证 | 统一 Bearer Token 认证    | 个人 Token，不做角色权限                                 |
| 部署扩展   | 双轨部署，可迁移和切换           | Cloudflare Workers+D1 默认轨；Docker+Bun+SQLite 本地轨 |
| AI 接入  | 自描述接口，平台无关            | 已实现 capabilities 端点                             |
| 数据维度   | 标签约定扩展，兼容 Raindrop    | 5 个维度标签约定                                       |
| 导航页小组件 | 网格系统支持 1×1 至 4×2 多种尺寸 | Phase 1 基础网格，小组件 Phase 2                        |

***

## 快速参考卡

### 架构决策速查

| 决策项      | 选择                                              | 一句话理由                            |
| -------- | ----------------------------------------------- | -------------------------------- |
| 数据底层     | 服务端 D1/SQLite + 端侧 IndexedDB 缓存                 | 服务端为真源，端侧支持离线与快速展示               |
| 同步策略     | 服务端事务 + 异步同步                                    | 在线先写服务端，离线联网后提交，不被 Raindrop 限频阻塞 |
| 冲突处理     | 两端保留，用户选择                                       | 避免自动覆盖，保留决策空间                    |
| AI 解耦    | Skill API 自描述                                   | 不绑定任何 AI 平台                      |
| 多维度数据    | 标签约定前缀 `_`                                      | 兼容 Raindrop 标签系统                 |
| 前端框架     | React + Vite                                    | 生态成熟，AI 协作友好                     |
| 组件库      | shadcn/ui + Tailwind                            | 轻量可定制                            |
| 状态管理     | Zustand                                         | 轻量够用                             |
| 部署方式     | Cloudflare Workers+D1 默认轨；Docker+Bun+SQLite 本地轨 | 云端默认部署与本地可控部署并行                  |
| Monorepo | pnpm + Turborepo                                | 共享代码，增量构建                        |

### Phase 1 里程碑

| 里程碑      | 内容                                     | 验证标准                          |
| -------- | -------------------------------------- | ----------------------------- |
| M1 基础设施  | 脚手架 + 服务端数据库 + 端侧 IndexedDB 缓存 + 基础 UI | `npm run dev` 能启动，数据层 CRUD 可用 |
| M2 收藏与同步 | Skill API + 双向同步 + 操作日志 + 软删除          | AI 能收藏，同步引擎正常工作               |
| M3 工作台   | 多视图 + 内联编辑 + 批量操作 + 整理模式 + 快捷键         | 工作台核心功能完整可用                   |
| M4 补全与部署 | 工具面板 + 导出 + 导航页插件 + 部署                 | 全流程打通，远程可访问                   |

### 关键数据流

```
收藏 → 用户/AI/插件/工作台通过服务端 API 写入 D1/SQLite → 服务端成功后更新 IndexedDB 缓存并入 sync_queue → 同步引擎(30s) → Raindrop 推送
整理 → 分拣(保留/删除/待定) → 分类(AI建议/修改) → 服务端状态更新 → sync_queue → 同步
离线写入 → IndexedDB 缓存/待提交队列 → 联网提交服务端事务
拉取 → 服务端同步引擎从 Raindrop 增量拉取 → 写入 D1/SQLite → 更新 IndexedDB 缓存
冲突检测 → 服务端保留两端版本 → 用户选择后写入服务端真源并更新缓存
导航页 → 服务端 API 获取 → 更新 IndexedDB 缓存 → 图标网格渲染 → Docker 栏渲染
```

