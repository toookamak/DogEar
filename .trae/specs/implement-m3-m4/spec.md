# M3/M4 推进 Spec

## Why
当前正式工程已完成 M2 的工作台保存闭环，但数据库、共享契约和服务端接口尚未覆盖 M3 Agent 保存与 M4 工作台整理能力。需要按已生效的 API 结构表和数据库结构表补齐最小可用实现，确保 Skill 写入真源并让工作台可搜索、可整理、可回收。

## What Changes
- 按 `docs/数据库结构表.md` v1.0 补全 M3/M4 所需 Drizzle schema、SQLite 初始化与迁移，保留 M2 既有数据和路径兼容。
- 扩展 `packages/shared` 的 Bookmark、Skill、列表、错误和建议契约。
- 增加 `/.well-known/capabilities` 与七个 Skill 路由：`save_bookmark`、`search_bookmarks`、`update_bookmark`、`list_bookmarks`、`get_stats`、`trigger_archive`、`suggest_scene`。
- 为 Skill 增加独立 Bearer 鉴权、能力开关、读/写/批量限速、稳定 UUID、操作审计和统一错误结构。
- 增加 M4 工作台 REST：书签搜索/筛选/单条修改/批量修改、回收站、Scene/Folder/Tag CRUD、建议处理、日志/设置/Job 占位。
- 保持建议先行：未确认建议不得写入 Scene/Folder/Tag 归属；Skill 结构修改默认关闭。
- 保持快照、通道、Dexie、备份、导航页和 Skill 批量/删除不在本变更范围。

## Impact
- Affected specs: M3 Agent 能存、M4 工作台本期核心、M2 既有认证与书签 API 兼容性。
- Affected code: `packages/db/src/schema.ts`、`packages/db/src/sqlite.ts`、`packages/db/src/repository.ts`、`packages/db/drizzle/`、`packages/shared/src/`、`apps/server/src/app.ts` 及对应测试。
- 不修改 `wiki/`，不引入 Dexie、Raindrop、S3、WebDAV、快照文件存储或新的运行时。

## ADDED Requirements
### Requirement: M3 Skill capability discovery
系统 SHALL 在 `GET /.well-known/capabilities` 返回版本、鉴权说明以及七个 Skill 的名称、输入 schema、写入性质、能力开关和边界说明；该接口不得返回用户数据、Token 或密钥。

#### Scenario: Discover capabilities
- **WHEN** 客户端请求 capabilities 接口
- **THEN** 系统返回包含七个固定 Skill 名称的 JSON，且无需 Bearer Token。

### Requirement: M3 authenticated Skill operations
系统 SHALL 通过 `POST /api/skill/<name>` 接受 Bearer Token，并对缺失或错误 Token 返回 `401 UNAUTHORIZED`。`save_bookmark` SHALL 同步写入服务端真源，创建正式 UUID，返回 `source=agent`、`status=unread` 和快照状态；不经端侧缓存。

#### Scenario: Save through Skill
- **WHEN** 使用有效 Bearer Token 调用 `save_bookmark` 并提交合法 URL
- **THEN** 系统在真源创建一条 Bookmark，返回稳定 UUID，写入 `actor=agent` 的操作日志，工作台随后可读到该记录。

#### Scenario: Agent requests snapshot
- **WHEN** Track A 的 `save_bookmark` 携带 `snapshot=true`，或调用 `trigger_archive`
- **THEN** 系统只创建 pending Job 并返回 `snapshotStatus=queued_pending_browser`，不得声称已生成快照文件。

### Requirement: Skill safety controls
系统 SHALL 对 Skill 按查、写新、改已有分级控制能力，并对读/写/批量类别独立限速。能力关闭返回 `403 CAPABILITY_DISABLED`，超限返回 `429 RATE_LIMITED`，输入错误返回 `400 VALIDATION_ERROR`。

#### Scenario: Disabled update
- **WHEN** 调用 `update_bookmark` 且改已有能力关闭
- **THEN** 系统返回能力关闭错误，不修改 Bookmark 或结构关系。

### Requirement: M4 bookmark organization
系统 SHALL 支持工作台书签列表的标题、URL、标签、备注搜索，以及来源、Scene、Folder、Tag、状态、标星等筛选；支持单条和最多 100 条批量修改，并通过软删除进入回收站。

#### Scenario: Organize bookmarks
- **WHEN** 已登录用户搜索、筛选或批量修改有效 Bookmark
- **THEN** 系统只修改请求允许的字段，维护 Scene/Tag 关系，记录操作日志，并排除回收站条目。

### Requirement: M4 suggestions and recycle bin
系统 SHALL 支持四类建议槽位所需的建议查询与接受、暂缓、忽略动作；建议确认前不得改变结构归属。系统 SHALL 支持回收站查询、恢复、按保留期清空，默认保留 7 天。

#### Scenario: Accept suggestion
- **WHEN** 用户接受一个合法 Scene、Folder 或 Tag 建议
- **THEN** 系统在事务中写入对应归属、标记建议已接受并记录操作日志。

### Requirement: M4 supporting resources
系统 SHALL 支持 Scene、Folder、Tag 的最小 CRUD，以及操作日志、设置读取/更新和 Archive Job 查询、重试、取消占位接口；不得在本变更中产出快照内容。

#### Scenario: Create and attach scene
- **WHEN** 用户创建 Scene 并将其挂载到 Bookmark
- **THEN** 系统通过书签 PATCH 或批量接口维护关系，无需新增主场景字段。

## MODIFIED Requirements
### Requirement: Existing bookmark API compatibility
M2 已有 `/api/auth/*`、`POST/GET /api/bookmarks`、`GET /api/inbox`、`GET /api/sync/pending-count` 和访问记录路径 SHALL 保持可用。扩展后的书签回执 SHALL 补齐结构表字段，创建时仍由服务端生成 UUID，服务端真源成功后 `syncStatus` 为 `synced`。

### Requirement: Existing database initialization
SQLite 初始化 SHALL 幂等执行，并兼容已有 M1/M2 数据；新增表和列以迁移方式纳入，布尔值使用 0/1、时间使用毫秒、JSON 使用文本。

## REMOVED Requirements
无。
