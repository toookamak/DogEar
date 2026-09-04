# Tasks

- [x] Task 1: **packages/db repository 分页改造**
  - list/search/listInbox 返回 `{ items, nextCursor }`（inbox 为 `{ bookmarks, nextCursor }`），基于 `(createdAt, id)` keyset 游标。
  - 新增 `listRecycleBin` 方法（原 `list({ includeDeleted: true })` 分离）。
  - 游标编码/解码工具函数，支持从编码字符串还原 `(createdAt, id)`。

- [x] Task 2: **packages/db repository 幂等键与用量**
  - 新增 `idempotencyKeysRepo.findReplay(key, actor)` 和 `idempotencyKeysRepo.store(key, actor, ...)`。
  - 新增 `skillUsageRepo.increment(date, bucket)` 和 `skillUsageRepo.getDaily(date)`。
  - 在 `index.ts` 导出新 repo 类型。

- [x] Task 3: **packages/db repository 其他修复**
  - `batchUpdate` 返回 `skipped: { id, reason }[]`（not_found / deleted 区分）。
  - `purgeDeleted` 修复 `like`→`lt` 的 bug。
  - `archiveJobs.create` 设置 `updatedAt = createdAt`；`archiveJobs.update` 自动更新 `updatedAt`。
  - `archiveJobs.retry` 和 `archiveJobs.cancel` 状态守卫方法（或留在 route 层）。

- [x] Task 4: **apps/server 路由分页接线**
  - `GET /api/bookmarks` → keyset 分页，返回 `{ items, nextCursor }`。
  - `GET /api/bookmarks/search` → keyset 分页，返回 `{ items, nextCursor }`。
  - `GET /api/inbox` → keyset 分页，返回 `{ bookmarks, nextCursor }`。
  - `GET /api/recycle-bin` → 新 `listRecycleBin`，返回 `{ items, nextCursor }`。

- [x] Task 5: **apps/server 幂等键与 version 冲突**
  - `POST /api/bookmarks` 读取 `Idempotency-Key` 头，检查重放，24h 过期。
  - `POST /api/skill/save_bookmark` 同样支持幂等键。
  - `PATCH /api/bookmarks/:id` 校验 `version`，不匹配返回 `409 CONFLICT`。

- [x] Task 6: **apps/server settings 白名单与 skill 能力/用量**
  - `PUT /api/settings` 只接受白名单 key。
  - `PUT /api/skill/capabilities` 能力更新路由。
  - `GET /api/skill/usage` 用量查询路由。

- [x] Task 7: **apps/server job 状态守卫与建议/回收站 envelope**
  - `POST /api/jobs/:id/retry` 只允许 `failed` 状态。
  - `POST /api/jobs/:id/cancel` 只允许 `pending/running` 状态。
  - 回收站 restore/purge/empty 返回契约格式。
  - suggestions accept/defer/dismiss 返回 `{ ok: true, suggestion }`。
  - `GET /api/bookmarks/:id/suggestions` 返回 `{ items, nextCursor }`。

- [x] Task 8: **集成测试补齐**
  - 分页、幂等重放、version 冲突、settings 白名单、能力更新、用量回执、job 状态守卫、batch skipped reason、回收站 envelope。
  - 运行 `pnpm test`、`pnpm typecheck`、`pnpm lint` 全绿。

- [x] Task 9: **git 提交**
  - 后端代码单独提交，不动 apps/web 与 docs。
  - 更新 `CHANGELOG.md`。

# Task Dependencies
- Task 1、2、3 可并行。
- Task 4 依赖 Task 1（分页 repo 方法）。
- Task 5 依赖 Task 2（幂等 repo 方法）。
- Task 6 依赖 Task 2（用量 repo 方法）。
- Task 7 依赖 Task 3（batch/archive 修复）。
- Task 8 依赖 Task 4~7。
- Task 9 依赖 Task 8。