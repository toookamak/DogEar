<!-- 项目名：DogEar · 折耳书签 -->

> **文档版本**：v1.1
> **应用版本**：v0.2.0
> **文档状态**：评审中
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
> | v1.1 | v0.2.0 | 2026-09-04 | 补齐 M4 工作台 API 的请求、回执、分页、错误和 Skill 管理契约，供正式前端接线评审 | gpt-5 |

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

---

## 8. M4 实现补充契约（v1.1）

本章是 v1.1 为正式前端接线补充的明确约定。与前文的概略描述冲突时，以本章的请求、回执、错误和状态约定为准；本章不新增 M5/M6 路径。

### 8.1 查询参数与分页

所有带“分页”标记的列表接口使用同一规则：`limit` 缺省为 50，允许 1–100 的十进制整数；`cursor` 是服务端生成的不透明字符串，客户端不得解析或拼接。非法 `limit`、`cursor` 返回 400 `VALIDATION_ERROR`。排序必须稳定，并以 `id` 作为同时间排序的次级键。

列表接口不得先读取全量数据后在内存中截断。无下一页时 `nextCursor` 为 `null`。空字符串参数按缺省处理；布尔 query 只接受 `true` 或 `false`，其它值返回 `VALIDATION_ERROR`。

书签列表和搜索的 query：

```text
status=unread|saved|archived
sceneId=<uuid>
folderId=<uuid>|none
tagId=<uuid>
important=true|false
source=page|agent|extension
q=<string>
limit=<1..100>
cursor=<opaque string>
```

`GET /api/inbox` 只接受 `limit`、`cursor`，回执固定为 `{bookmarks: Bookmark[], nextCursor: string|null}`。

### 8.2 统一成功和错误回执

除特别注明外，列表回执使用 `{items: [], nextCursor: null}`；单对象回执使用完整书签对象或资源对象；删除、恢复和动作回执必须使用明确的 `{ok: true, ...}` 或动作结果对象，不返回 `null`。

请求 JSON 缺失、解析失败、字段类型错误或枚举值错误均返回：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数无效",
    "details": {"field": "原因"}
  }
}
```

以下错误映射在 M4 中固定：

| 场景 | HTTP | code |
| --- | ---: | --- |
| 无会话或密码/Token 错误 | 401 | `UNAUTHORIZED` |
| Skill 能力关闭 | 403 | `CAPABILITY_DISABLED` |
| 对象不存在或活接口访问回收站对象 | 404 | `NOT_FOUND` |
| 活书签 PATCH 命中回收站对象 | 409 | `BOOKMARK_DELETED` |
| version 不一致 | 409 | `CONFLICT` |
| 场景仍有成员 | 409 | `SCENE_IN_USE` |
| 批量 ids 超过 100 | 400 | `BATCH_TOO_LARGE` |
| Skill 限速 | 429 | `RATE_LIMITED` |

### 8.3 书签请求与回执

`POST /api/bookmarks` 接受：

```json
{
  "url": "https://example.com/article",
  "note": "可选备注",
  "intent": "保存原因",
  "important": false,
  "private": false
}
```

服务端必须保存上述可选字段，并返回完整书签对象；固定写入 `source=page`、`status=unread`、`syncStatus=synced`，记录 `actor=user` 的 create 日志。若带 `Idempotency-Key`，24 小时内同一会话和同一请求键重放首次成功回执，不重复创建。

`PATCH /api/bookmarks/:id` 接受部分字段：`title`、`excerpt`、`note`、`important`、`private`、`status`、`folderId`、`tagIds`、`sceneIds`、`version`。`folderId` 可为 null；数组字段表示整份替换。带 `version` 时必须与服务端当前版本一致，否则返回 `409 CONFLICT`，details 中包含 `currentVersion`。成功后 version 加一，并返回完整书签对象。

批量 PATCH 必须先校验整个请求，再在一个事务中执行；返回：

```json
{
  "updated": ["<uuid>"],
  "skipped": [{"id": "<uuid>", "reason": "not_found|deleted"}]
}
```

批量体中的 `ids` 至少 1 个且最多 100 个；数组 ID 必须为 UUID。`deleted=true` 执行软删，不能与 `folderId`、成员替换字段同时使用；冲突或非法组合返回 `VALIDATION_ERROR`。

### 8.4 组织资源

场景：

```json
{
  "name": "工作研究",
  "description": null,
  "icon": null,
  "sortOrder": 0,
  "enabled": true,
  "aerr": "reference"
}
```

POST 必须有非空 `name`；`aerr` 缺省为 `reference`。PATCH 只允许上述可编辑字段。GET `/api/scenes` 返回 `{items}`，按 `sortOrder`、`name`、`id` 稳定排序，并包含停用场景。删除仍有成员时返回 `SCENE_IN_USE`。

文件夹创建和更新字段为 `name`、`parentId`、`sortOrder`；`name` 非空，`parentId` 可为 null，父节点必须存在且不得形成环。GET `/api/folders` 返回 `{items}`。删除文件夹后，其书签 `folderId` 置 null。

标签创建字段为 `name`，服务端生成规范化的 `nameKey`；同一 `nameKey` 返回已有标签而不重复创建。GET `/api/tags` 返回 `{items}`。DELETE `/api/tags/:id` 不存在返回 `NOT_FOUND`，存在时只解除书签挂载，不删除书签。

### 8.5 回收站、建议、访问记录

`GET /api/recycle-bin` 使用 `deletedAt` 倒序分页。restore 成功返回 `{ok:true, bookmark}`；永久删除返回 `{ok:true}`，并清理书签成员、建议、访问记录和未完成归档 Job。`POST /api/recycle-bin/empty` 接受 `{onlyExpired?: boolean}`，缺省为 true，返回 `{ok:true,purged:<number>}`。

`GET /api/bookmarks/:id/suggestions` 返回 `{items,nextCursor}`，默认 `status=pending`，书签不存在返回 404。accept、defer、dismiss 成功返回 `{ok:true, suggestion}`；已处理建议再次执行返回当前状态，不重复写入归属，保持幂等。

访问记录 POST 接受可选 `{source:"original"}`，书签不存在返回 404；回收站书签允许记录一次打开。成功返回 201 的记录对象，并回写 `lastOpenedAt`。GET 返回 `{records}`。

### 8.6 设置、能力、用量和 Job

`GET /api/settings` 返回 `{items:[{key,value,updatedAt}]}`；敏感设置按 key 和 value 双重过滤，不返回口令、Token、摘要或密钥。`PUT /api/settings` 只允许 M4 白名单：`recycle.retention_days`、`skill.capabilities`，未知 key 返回 `VALIDATION_ERROR`。复杂 value 使用 JSON 原值，不向前端暴露内部字符串化细节。

`PUT /api/skill/capabilities` 接受并返回：

```json
{
  "read": true,
  "write_new": true,
  "update_existing": false
}
```

更新只允许工作台会话，立即影响后续 Skill 请求，并记录设置变更日志。`GET /api/skill/usage` 返回：

```json
{
  "date": "YYYY-MM-DD",
  "requests": 0,
  "writes": 0,
  "blocked": 0
}
```

Job 回执固定包含 `id`、`bookmarkId`、`type`、`status`、`retryCount`、`error`、`createdAt`、`updatedAt`。状态为 `pending|running|succeeded|failed|cancelled`；retry 只允许 failed，cancel 只允许 pending/running，状态不允许时返回 `CONFLICT`；不存在返回 `NOT_FOUND`。`POST /api/bookmarks/:id/archives` 返回 `{jobId,snapshotStatus:"queued_pending_browser"}`，仍不返回文件 URL。

### 8.7 M4 前端接线清单

正式前端只依赖以下 M4 路径：

```text
/api/auth/*
/api/bookmarks
/api/bookmarks/:id
/api/bookmarks/search
/api/bookmarks/batch
/api/bookmarks/:id/access-records
/api/inbox
/api/sync/pending-count
/api/recycle-bin*
/api/scenes*
/api/folders*
/api/tags*
/api/bookmarks/:id/suggestions
/api/suggestions/:id/{accept,defer,dismiss}
/api/operation-log
/api/settings
/api/skill/capabilities
/api/skill/usage
/api/bookmarks/:id/archives
/api/jobs*
```

本清单仅用于前端接线，不代表新增路由。`/channels/*`、`/backup`、归档内容传输和导航规则仍按第 7 章禁止实现。
