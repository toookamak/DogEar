# M4 API 后端补齐 Spec（B 步）

## Why
M3/M4 后端基础能力已完成，但 `docs/API结构表.md` v1.1（评审中）与现有实现存在关键差距：分页、幂等键、version 冲突、settings 白名单、skill capabilities/usage、job 状态机。需要按已确认的 API 结构表补齐这些缺口，确保正式前端可以接入完整契约。

## What Changes
- **packages/db**：在 repository 层增加 keyset 分页（list/search/listInbox/recycleBin）、idempotencyKeys 存储与重放检查、skillUsage 按日计数、archiveJobs updatedAt 初始化和状态守卫、batchUpdate 返回 `skipped: [{id, reason}]`、purgeDeleted 修复 `like`→`lt` 的 bug。
- **packages/shared**：已有 b2 阶段追加的 contracts-v1.1 共享契约，无需再改。
- **apps/server**：路由层增加分页 cursor/limit/nextCursor 接线、Idempotency-Key 读取与重放、PATCH version 冲突检测、settings PUT 白名单校验、PUT /api/skill/capabilities、GET /api/skill/usage、jobs retry/cancel 状态守卫、suggestions 返回统一 envelope、recycleBin restore/purge/empty 返回契约格式。
- 保持现有测试兼容，补充增量测试覆盖新契约路径。

## Impact
- Affected specs: M4 API 分页、幂等、版本管理、设置白名单、Skill 能力更新、用量回执、Job 状态机。
- Affected code: `packages/db/src/repository.ts`、`apps/server/src/app.ts`、`apps/server/src/app.test.ts`、`packages/db/src/repository.test.ts`。
- 不修改 `wiki/`，不新增数据库表（已有 idempotency_keys/skill_usage），不新增路由（仅补齐现有路由）。

## ADDED Requirements
### Requirement: Keyset pagination
系统 SHALL 在 `GET /api/bookmarks`、`GET /api/bookmarks/search`、`GET /api/inbox`、`GET /api/recycle-bin` 中支持 `limit`/`cursor` 参数，返回 `nextCursor`。分页基于 `(createdAt, id)` 的 keyset 稳定排序，不支持负偏移或 page number。

#### Scenario: Paginated list
- **WHEN** 已登录用户请求书签列表带 `limit=10`
- **THEN** 返回最多 10 条书签及 `nextCursor`，后续用此 cursor 请求下一页。
- **WHEN** 已是最后一页
- **THEN** `nextCursor` 为 `null`。

### Requirement: Idempotent bookmark creation
系统 SHALL 在 `POST /api/bookmarks` 和 `POST /api/skill/save_bookmark` 支持 `Idempotency-Key` 请求头。24 小时内同一 `(key, actor)` 返回相同结果，不重复创建。key 最小 8 字符。

#### Scenario: Idempotent create
- **WHEN** 客户端对同一请求重复发送相同 `Idempotency-Key`
- **THEN** 第二次及后续请求返回首次创建的完整结果，`idempotent=true`，不写入新记录。

### Requirement: Version conflict detection
系统 SHALL 在 `PATCH /api/bookmarks/:id` 中验证 `version` 字段，不匹配时返回 `409 CONFLICT` 含当前 `currentVersion`。

#### Scenario: Version mismatch
- **WHEN** 更新时提供 `version` 且与当前不匹配
- **THEN** 返回 `409 CONFLICT` 和 `{ error: { code: 'CONFLICT', message, details: { currentVersion } } }`。

### Requirement: Settings whitelist
系统 SHALL 在 `PUT /api/settings` 中只接受 `recycle.retention_days` 和 `skill.capabilities` 两个 key，其余拒绝。

### Requirement: Skill capabilities update
系统 SHALL 在 `PUT /api/skill/capabilities` 接受 `{ read, write_new, update_existing }` 并写入 settings。

### Requirement: Skill usage
系统 SHALL 在 `GET /api/skill/usage` 返回当日各 bucket 的用量计数 `{ date, requests, writes, blocked }`。

### Requirement: Job state guards
系统 SHALL 在 `POST /api/jobs/:id/retry` 只允许 `failed` 状态的 job 重试，`POST /api/jobs/:id/cancel` 只允许 `pending`/`running` 状态的 job 取消，不合法返回 `409 CONFLICT`。

### Requirement: Batch update skipped reason
系统 SHALL 在 `PATCH /api/bookmarks/batch` 的 `skipped` 数组中返回 `{ id, reason }`，reason 为 `not_found` 或 `deleted`。

## MODIFIED Requirements
### Requirement: Existing bookmark API envelope
M2 路面 `GET /api/bookmarks` 返回 `{ items, nextCursor }`（之前返回裸数组），`GET /api/inbox` 返回 `{ bookmarks, nextCursor }`（之前无 nextCursor）。回收站 restore/purge/empty 返回契约格式 `{ ok: true, bookmark }` / `{ ok: true }` / `{ ok: true, purged: n }`。

### Requirement: Existing batch update
`PATCH /api/bookmarks/batch` 的 `skipped` 数组从 `string[]` 改为 `{ id, reason }[]`。

## REMOVED Requirements
无。