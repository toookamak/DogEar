<!-- 项目名：DogEar · 折耳书签 -->

> **文档版本**：v1.0
> **应用版本**：v0.2.0
> **文档状态**：生效
> **目的和适用范围**：开发约束。实现 `apps/server` 路由与 `packages/shared` Zod 时只按本表的路径、字段、错误码接线。为什么这样设计见 [API 设计](./modules/20260904_API设计.md)。列含义见 [数据库结构表](./数据库结构表.md)。不进 wiki。
> **权威级别**：模块规则（实现规格）。路径、回执形状、错误码以本文为准。
> **配套**：[数据库结构表](./数据库结构表.md) · [API 设计](./modules/20260904_API设计.md)
> **最后更新日期**：2026-09-04
> **修改记录**：
>
> | 文档版本 | 应用版本 | 日期 | 修改摘要 | 修改模型ID |
> | --- | --- | --- | --- | --- |
> | v1.0 | v0.2.0 | 2026-09-04 | 初稿：从设计稿抽出工作台 REST、Skill、回执与错误码 | grok-4.6 |
> | v1.0 | v0.2.0 | 2026-09-04 | 文头补当前覆盖与升级条件 | grok-4.6 |
> | v1.0 | v0.2.0 | 2026-09-04 | 当前覆盖与升级条件改为正文第 1 章，避免文头被跳过 | grok-4.6 |

# API 结构表

## 1. 当前覆盖与升级条件

写代码前先读本章。v1.0 只覆盖到这里；超出范围先停、先讨论、先升文档版本，再接线。

| 项 | 口径 |
| --- | --- |
| 当前覆盖 | **v1.0 = M3 + M4**。在 M2 登录/创建/Inbox/未推送数/访问打点之上，补全整理与 Agent 能存。 |
| 本版有的 | `/api/auth/*` 书签 CRUD/搜索/批量 Inbox 回收站 场景/文件夹/标签 建议 日志 设置 Job 占位；`/.well-known/capabilities`；七个 `POST /api/skill/<name>` |
| 本版没有的 | `/channels/*`、`/backup`、归档内容下载/上传、`/navigation/rules`、Skill 批量与删除、离线保存接口 |
| 升级规则 | 下表任一触发即停。先讨论升级方案、升本文档版本，再接线。禁止边写代码边加路由。M3/M4 做完本身不构成升级。 |

### 1.1 何时讨论升级（触发即停）

| 触发 | 典型要补的 | 对应里程碑 |
| --- | --- | --- |
| 要配置或走 Raindrop / S3 / WebDAV | `CRUD /channels/*`；导入导出；未推送数可能不再恒为 0 | M5 |
| 端侧缓存上线，工作台不再每笔直打真源 | 成功口径与 pending-count 语义；Skill 仍禁止走缓存 | M5 |
| 要下载/替换快照文件，而不只是 Job | `GET/PUT /archives/:id/content`；回执不得再用「文件还没有」撒谎 | M6 |
| 要跑备份并查历史 | `POST /backup`、`GET /backup/history` | M6 |
| 导航页要读写圈选规则 | `GET /navigation`、`CRUD /navigation/rules` | M7 |
| 要打开 Skill 改结构/删除/批量，或改默认能力 | 能力开关默认值、`confirmStructure`、批量 Skill | M4 末期或之后，须单独立项 |
| 要改 M2 已有路径名或书签回执必含字段 | 破坏兼容，必须升级讨论 | 随时 |
| 实现中发现缺接口，不补就做不完当前 Mx | 先对照设计稿；仍缺则升级讨论，不私加 | 随时 |

工程约定（未升级前不变）：Hono + Zod；JSON 驼峰；时间毫秒；id 为 UUID；禁止 `tmp_`；工作台 Cookie、Skill Bearer；同一仓库。落点 `apps/server`、`packages/shared`。

## 2. 通用

| 项 | 约定 |
| --- | --- |
| 工作台前缀 | `/api` |
| Skill | `POST /api/skill/<name>` + Bearer |
| 能力发现 | `GET /.well-known/capabilities`（无 Token） |
| 工作台鉴权 | Cookie `dogear_session`；无会话写接口 → 401 |
| Skill 鉴权 | `Authorization: Bearer`；错/缺 → 401 `UNAUTHORIZED` |
| 分页 | `limit` 默认 50、最大 100；`cursor`；下一页 `nextCursor`（无则 null） |
| Inbox 列表键 | 继续用 `bookmarks`（M2），另加 `nextCursor` |
| 其它列表键 | `items` |
| 创建幂等 | 头 `Idempotency-Key`，24h 内重放返回首次那条 |
| Skill 限速 | 读/写/批量分开；超限 429 `RATE_LIMITED` |
| 工作台限速 | 本版不限 |

错误体：

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

`details` 可省略。

Skill 能力默认：查=开，写新=开，改已有=关。关掉仍保留路径，返回 403 `CAPABILITY_DISABLED`。

| 级 | 默认 | Skill |
| --- | --- | --- |
| 查已有的 | 开 | `search_bookmarks` `list_bookmarks` `get_stats` `suggest_scene` |
| 写新的 | 开 | `save_bookmark` `trigger_archive` |
| 改已有的 | 关 | `update_bookmark` |

---

## 3. 书签对象（共用回执）

未出现的栏用 `null` / `[]`，不要省略。`folder` = `{id,name}` 或 `null`。`scenes`/`tags` = `{id,name}[]`。

创建接口可精简，但必须含：`id, url, status, source, createdAt`。

| JSON 字段 | 来源列 | 备注 |
| --- | --- | --- |
| `id` | bookmarks.id | 正式 UUID |
| `url` | url | |
| `title` | title | |
| `excerpt` | excerpt | |
| `cover` | cover | |
| `type` | type | 默认 `link` |
| `author` | author | |
| `favicon` | favicon | |
| `publishedAt` | published_at | |
| `note` | note | |
| `intent` | intent | |
| `important` | important | boolean |
| `status` | status | `unread` \| `saved` \| `archived` |
| `source` | source | `page` \| `agent` \| `extension` |
| `private` | private | boolean |
| `folder` | folders | 嵌套或 null |
| `domain` | domain | |
| `broken` | broken | boolean |
| `raindropId` | raindrop_id | |
| `syncStatus` | sync_status | 服务端创建=`synced` |
| `version` | version | |
| `deletedAt` | deleted_at | |
| `lastOpenedAt` | last_opened_at | |
| `createdAt` | created_at | |
| `updatedAt` | updated_at | |
| `scenes` | bookmark_scenes | |
| `tags` | bookmark_tags | |
| `pendingSuggestionCount` | suggestions pending | 整数 |

客户端禁止改：`id` `createdAt` `source` `raindropId`。

---

## 4. 工作台 REST

除注明外均需会话。默认列表排除回收站。

### 4.1 鉴权（M2 保持）

| 方法 | 路径 | 请求 | 成功 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{password}` | 200 `{user:{id}}` + Set-Cookie |
| GET | `/api/auth/me` | — | 200 `{user:{id}}` |
| POST | `/api/auth/logout` | — | 200 `{ok:true}` |

无注册、无多账号。密码错 → 401。

### 4.2 书签

| 方法 | 路径 | 请求 | 成功 | 要点 |
| --- | --- | --- | --- | --- |
| POST | `/api/bookmarks` | `{url}` 必填；`note` `intent` `important` `private` 可选 | 201 书签 | `source=page` `status=unread` `syncStatus=synced`；无 Snapshot 开关；记 log actor=user |
| GET | `/api/bookmarks` | 见筛选 | 200 `{items,nextCursor}` | `createdAt` 倒序 |
| GET | `/api/bookmarks/:id` | — | 200 书签（含 scenes/tags/folder/建议摘要） | 回收站中 → 404 |
| PATCH | `/api/bookmarks/:id` | 只传要改的：`title` `excerpt` `note` `important` `private` `status` `folderId` `tagIds` `sceneIds` | 200 书签 | `sceneIds`/`tagIds` 整份替换，成员 `source=user`；`version+1`；回收站中 → 409 `BOOKMARK_DELETED` |
| DELETE | `/api/bookmarks/:id` | — | 200 `{ok,deletedAt}` | 软删；再删幂等 |
| GET | `/api/bookmarks/search` | `q` + 同列表筛选 | 200 `{items,nextCursor}` | 标题/URL/标签名/备注；无正文索引 |
| PATCH | `/api/bookmarks/batch` | 见下 | 200 `{updated[],skipped[]}` | 最多 100；同一事务；回收站 id 进 skipped |

列表/搜索 query：`status` `sceneId` `folderId`（`none`=无文件夹）`tagId` `important` `source` `q` `limit` `cursor`。

批量体：

```json
{
  "ids": ["uuid"],
  "status": "saved",
  "addSceneIds": [],
  "removeSceneIds": [],
  "folderId": null,
  "addTagIds": [],
  "removeTagIds": [],
  "deleted": true
}
```

Skill 本版无批量。

### 4.3 Inbox / 同步 / 访问（M2 保持并扩展）

| 方法 | 路径 | 成功 | 要点 |
| --- | --- | --- | --- |
| GET | `/api/inbox` | `{bookmarks,nextCursor}` | `status=unread` 且未软删 |
| GET | `/api/sync/pending-count` | `{pendingCount}` | 直写真源成功后为 0 |
| POST | `/api/bookmarks/:id/access-records` | 201 记录 | 体可选 `{source:"original"}`；回写 `lastOpenedAt` |
| GET | `/api/bookmarks/:id/access-records` | `{records}` | 时间倒序 |

### 4.4 回收站

| 方法 | 路径 | 请求 | 要点 |
| --- | --- | --- | --- |
| GET | `/api/recycle-bin` | 分页 | `deletedAt` 非空 |
| POST | `/api/recycle-bin/:id/restore` | — | 清空 `deletedAt`，状态保持进站前 |
| DELETE | `/api/recycle-bin/:id` | — | 硬删 + 挂载（见数据库结构表 §15） |
| POST | `/api/recycle-bin/empty` | `{onlyExpired?:true}` | 默认只清到期（`recycle.retention_days`） |

### 4.5 场景 / 文件夹 / 标签

挂/摘书签走书签 PATCH 或 batch，不另做嵌套路由。

| 方法 | 路径 | 要点 |
| --- | --- | --- |
| GET | `/api/scenes` | 含停用，靠 `enabled` |
| POST | `/api/scenes` | 可省 `aerr`，默认 `reference` |
| PATCH | `/api/scenes/:id` | 名/说明/图标/顺序/启用/aerr |
| DELETE | `/api/scenes/:id` | 有成员 → 409 `SCENE_IN_USE` |
| GET/POST | `/api/folders` | |
| PATCH/DELETE | `/api/folders/:id` | 删文件夹：书签 `folderId=null` |
| GET/POST | `/api/tags` | POST 遇已有 `name_key` 返回已有 |
| DELETE | `/api/tags/:id` | 只解挂载 |

四默认场景由迁移写入，不靠启动接口补种。

### 4.6 建议

确认前不改归属。

| 方法 | 路径 | 要点 |
| --- | --- | --- |
| GET | `/api/bookmarks/:id/suggestions` | 可 `?status=` |
| POST | `/api/suggestions/:id/accept` | 按 kind 抄到成员表/`folder_id`，`source=ai_accepted` |
| POST | `/api/suggestions/:id/defer` | 归属不变 |
| POST | `/api/suggestions/:id/dismiss` | 归属不变 |

### 4.7 日志 / 设置 / Job

| 方法 | 路径 | 要点 |
| --- | --- | --- |
| GET | `/api/operation-log` | `limit` `cursor` `actor` `action`；无密钥 |
| GET | `/api/settings` | 不得返回口令或摘要 |
| PUT | `/api/settings` | |
| PUT | `/api/skill/capabilities` | 三级开关 |
| GET | `/api/skill/usage` | 今日请求量/写入量/拦截次数 |
| POST | `/api/bookmarks/:id/archives` | 体 `{type:"snapshot"}`；只建 Job；回执必须带 `snapshotStatus:"queued_pending_browser"` |
| GET | `/api/jobs` | |
| POST | `/api/jobs/:id/retry` | |
| POST | `/api/jobs/:id/cancel` | |

禁止返回快照文件 URL。下载/上传是 M6，本版不做。

---

## 5. Skill

统一：`POST /api/skill/<name>`，JSON 体，Bearer。七个名字不得改。

| name | 输入 | 成功 | 约束 |
| --- | --- | --- | --- |
| `save_bookmark` | `url` 必填；`note` `intent` 可选；`snapshot` 默认 false | 201 含正式 `id`；`source=agent` `status=unread` | 不写场景/文件夹/标签；`snapshot=true` 只插 Job，`snapshotStatus=queued_pending_browser`；log actor=agent；建议可异步，本回执可 `suggestions:[]` |
| `search_bookmarks` | `query` `filters` `limit` `cursor` | `{items,nextCursor}` | 标题/URL/标签/备注；默认排除回收站与 `private`（`includePrivate:true` 才含私密） |
| `list_bookmarks` | 筛选 + `limit` `cursor` | 同上 | 无 query 时用此，勿塞进 search |
| `update_bookmark` | `id` + 可改字段；结构字段另见下 | 见下 | 默认能力关 |
| `get_stats` | 无 | 总数、Inbox、各状态、各场景（含停用） | 不含回收站 |
| `trigger_archive` | `bookmarkId`；`type` 默认 `snapshot` | `{jobId, snapshotStatus:queued_pending_browser}` | 不抓页；`type=reader` → 400 `NOT_SUPPORTED` |
| `suggest_scene` | `bookmarkId` 或 `bookmarkIds`（最多 20） | 建议列表 | 只写 `suggestions` pending；空数组合法；不写 `bookmark_scenes` |

`save_bookmark` 最小回执：

```json
{
  "id": "<uuid>",
  "url": "...",
  "status": "unread",
  "source": "agent",
  "note": null,
  "intent": null,
  "snapshotStatus": "not_requested",
  "createdAt": 0
}
```

`snapshotStatus`：`not_requested` \| `queued_pending_browser`。

`update_bookmark` 结构字段（scene/folder/tag）：无 `confirmStructure:true` → 只写建议，`{applied:false, suggestions}`，归属不变。有该标志且能力已开 → 才改归属，log actor=agent。备注/状态/标星不算结构，但仍受「改已有的」开关约束。

`GET /.well-known/capabilities` 必须含：`name` `version` `auth` `skills[]`（`name` `write` `capability` `input` `notes`）。无用户数据、无密钥。

---

## 6. 错误码

| code | HTTP | 何时 |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | 无会话 / Token 无效 |
| `CAPABILITY_DISABLED` | 403 | Skill 该级关闭 |
| `VALIDATION_ERROR` | 400 | 缺字段、类型错、游标乱 |
| `NOT_FOUND` | 404 | 对象不存在（含活书签接口打到回收站条目） |
| `BOOKMARK_DELETED` | 409 | 回收站中当活书签改 |
| `SCENE_IN_USE` | 409 | 有成员仍删场景 |
| `BATCH_TOO_LARGE` | 400 | 批量 > 100 |
| `RATE_LIMITED` | 429 | Skill 超限 |
| `NOT_SUPPORTED` | 400 | 如 `type=reader` |
| `CONFLICT` | 409 | version 冲突（本版可不强制客户端带 version） |

同一 `code` 不得有两种含义。

---

## 7. 本版禁止实现

| 不要做 | 原因 |
| --- | --- |
| `GET/PUT /archives/:id/content` | 无快照文件 |
| `CRUD /channels/*` | M5 |
| `POST /backup` | M6 |
| `CRUD /navigation/rules` | M7 |
| Skill 批量/删除 | 过关不依赖；默认能力关 |
| 离线保存专用接口 | 应用不可达 = 失败 |
| 把 Cookie CORS 扩成 `*` | M2 已收紧工作台源 |
| 新路径替代 M2 已有 URL | 只加参数或新路径 |

M2 已有且必须保留：`/api/auth/*`、`POST/GET /api/bookmarks`、`GET /api/inbox`、`GET /api/sync/pending-count`、`POST/GET .../access-records`。
