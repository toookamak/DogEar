# Tasks

- [x] Task 1: **应用壳层 + 认证**
  - 创建目录结构
  - 安装 wouter、minisearch 依赖
  - 实现 API 客户端 client.ts（fetch + Cookie + 401 统一处理）
  - 实现 LoginPage、Session Hook、AppShell、Sidebar、TopBar、StatusBar
  - 顶层路由 wouter 配置

- [x] Task 2: **书签主链路**
  - 实现 api/client/bookmarks.ts 所有接口
  - 实现 Inbox 分页列表（Card/List 视图）
  - 实现书签全列表分页搜索
  - 实现保存书签表单（含 note/intent/important/private 可选字段）
  - 实现书签详情面板 + 编辑（PATCH 支持）
  - 实现筛选控制（status/scene/folder/tag/important/source）
  - 实现访问记录打点

- [x] Task 3: **⌘K 命令面板**
  - 端侧 MiniSearch 索引构建
  - 输入即筛，结果跳转

- [x] Task 4: **批量 + 回收站 + 建议**
  - 批量选择工具栏 + 批量 PATCH
  - 回收站列表分页、恢复、永久删除、清空（二次确认）
  - AI 建议四落点占位 UI（查看/接受/延后/忽略）

- [x] Task 5: **组织管理（Scene/Folder/Tag）**
  - Scene/Folder/Tag 选择器和管理控件
  - 创建、修改、删除、挂载/摘除

- [x] Task 6: **日志、设置、Job**
  - 操作日志列表
  - 设置读写（筛选敏感字段）
  - Skill 能力开关 + 用量展示
  - Job 列表 + 重试/取消

- [x] Task 7: **视觉验收 + 测试**
  - 对照 DESIGN.md 视觉验收
  - 纯函数 + API 客户端层测试
  - 运行 pnpm test、pnpm typecheck、pnpm build

- [x] Task 8: **git 提交**
  - 更新 CHANGELOG.md
  - 前端代码单独提交

# Task Dependencies
- Task 1 是基础，Task 2~7 依赖 Task 1
- Task 2、3 可并行
- Task 4、5 可并行
- Task 6 依赖 Task 1
- Task 7 依赖 Task 1~6
- Task 8 依赖 Task 7