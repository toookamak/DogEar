# M4 正式工作台前端 Spec

## Why
当前 `apps/web` 仅包含最小化入口文件，需要按照 API 结构表 v1.1 和 DESIGN 视觉规范构建完整可使用的 M4 工作台前端，支持登录、书签列表、Inbox、搜索筛选、详情编辑、批量处理、组织管理（Scene/Folder/Tag）、回收站、AI 建议、操作日志、设置、Job 列表。

## What Changes
- 按照 `docs/TODO/20260904_正式前端与M4_API实施计划.md` §3.1 建立正式前端目录结构
- 实现认证 + 会话 Cookie 管理
- 实现工作台应用壳层（AppShell + 路由 + 导航）
- 实现 Inbox 分页列表、书签全列表分页搜索
- 实现书签详情面板、编辑表单、保存新书签
- 实现筛选 + ⌘K 命令面板（端侧 MiniSearch）
- 实现批量处理、回收站恢复/永久删除/清空
- 实现 Scene/Folder/Tag CRUD 与选择器
- 实现 AI 建议查看/接受/延后/忽略（四落点占位 UI）
- 实现操作日志、设置展示/保存、Skill 能力开关、用量展示、Job 列表重试/取消
- 遵循根目录 `DESIGN.md` 唯一视觉规范，不引入额外 UI 库依赖
- 仅允许新增 `wouter` 和 `minisearch` 两个生产依赖（经用户确认）

## Impact
- Affected specs: M4 正式工作台前端主链路
- Affected code: `apps/web/src/` 下所有新文件
- 不修改后端代码、wiki、docs（除目录结构）
- 不修改现有依赖边界

## ADDED Requirements
### Requirement: 应用结构与认证
前端 SHALL 按照以下目录结构：
```text
apps/web/
├─ src/
│  ├─ main.tsx                 # 应用入口，挂载 + 顶层会话
│  ├─ app/
│  │  ├─ App.tsx              # 顶层路由
│  │  ├─ AppShell.tsx         # 布局：Sidebar + TopBar + 内容区
│  │  └─ navigation.ts        # 页面和导航项定义
│  ├─ api/
│  │  ├─ client.ts            # fetch + Cookie + 401 统一处理
│  │  ├─ bookmarks.ts        # 书签/搜索/批量/访问记录 API
│  │  ├─ organization.ts     # Scene/Folder/Tag API
│  │  ├─ recycleBin.ts       # 回收站 API
│  │  ├─ suggestions.ts      # 建议 API
│  │  ├─ settings.ts        # 设置/能力/用量 API
│  │  └─ jobs.ts            # Job 查询/重试/取消 API
│  ├─ components/
│  │  ├─ layout/            # Sidebar/TopBar/StatusBar/内容区
│  │  ├─ bookmarks/         # Board/Card/Grid/List/Toolbar
│  │  ├─ detail/           # 详情面板 + 编辑表单
│  │  ├─ organization/      # Scene/Folder/Tag 选择控件
│  │  ├─ command/          # ⌘K 命令面板（MiniSearch）
│  │  ├─ recycle-bin/      # 回收站列表 + 确认对话框
│  │  ├─ suggestions/      # AI 建议占位 UI 处理
│  │  ├─ settings/        # 设置/日志/Job 区块
│  │  └─ feedback/        # Loading/Empty/Error/Toast/Confirm
│  ├─ pages/
│  │  ├─ LoginPage.tsx
│  │  ├─ WorkbenchPage.tsx
│  │  ├─ RecycleBinPage.tsx
│  │  └─ SettingsPage.tsx
│  ├─ types/
│  │  ├─ api.ts             # API 回执类型（从 shared 推断）
│  │  └─ view.ts             # 页面筛选/视图本地状态
│  ├─ hooks/
│  │  ├─ useSession.ts
│  │  ├─ useBookmarks.ts
│  │  └─ useOrganization.ts
│  └─ styles.css           # 全局样式 + DESIGN.md Token
```

### Requirement: 认证与会话
- 登录页面输入密码，成功后设置会话 Cookie
- 所有 API 请求自动带 Cookie
- 401 自动跳转登录页
- 支持退出登录

### Requirement: 工作台主链路
- 登录后进入工作台，左侧导航显示 Inbox/书签列表/回收站/设置
- Inbox 显示 `status=unread` 书签，支持分页加载
- 点击书签打开详情面板可编辑
- 保存新书签后 Inbox 刷新
- 列表支持搜索筛选（来源/status/scene/folder/tag/important）

### Requirement: ⌘K 命令面板
- 按 ⌘K 唤起，加载当前页可见列表构建端侧 MiniSearch 索引
- 输入即筛，结果可跳转对应书签
- Esc 关闭，无结果提示

### Requirement: AI 建议四落点占位
- 在输入/整理/Inbox 内/未整理详情四个落点放置占位 UI
- 展示建议来源和建议动作
- 无模型时返回空建议不崩溃
- 确认后才写结构，不提前修改归属

### Requirement: 视觉规范
- 严格遵循根目录 `DESIGN.md` 颜色、字体、间距、圆角
- 专有字体缺失回退系统栈
- 本期浅色主题，不做暗色

### Requirement: 测试
- 只做纯函数和 API 客户端层测试，vitest，不引入 jsdom/@testing-library

## MODIFIED Requirements
无（新增目录结构，不修改既有代码逻辑）

## REMOVED Requirements
无
