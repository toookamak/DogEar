<!-- 项目名：DogEar · 折耳书签 -->

> **文档版本**：v1.12
> **应用版本**：v0.7.34
> **文档状态**：生效
> **目的和适用范围**：开发约束。实现 `apps/server` 路由与 `packages/shared` Zod 时只按本表的路径、字段、错误码接线。为什么这样设计见 [API 设计](./modules/20260904_API设计.md)。列含义见 [数据库结构表](./数据库结构表.md)。不进 wiki。
> **权威级别**：模块规则（实现规格）。路径、回执形状、错误码以本文为准。
> **配套**：[数据库结构表](./数据库结构表.md) · [API 设计](./modules/20260904_API设计.md)
> **最后更新日期**：2026-09-13
> **修改记录**：
>
> | 文档版本 | 应用版本 | 日期 | 修改摘要 | 修改模型ID |
> | --- | --- | --- | --- | --- |
> | v1.0 | v0.2.0 | 2026-09-04 | 初稿：从设计稿抽出工作台 REST、Skill、回执与错误码 | grok-4.6 |
> | v1.0 | v0.2.0 | 2026-09-04 | 文头补当前覆盖与升级条件 | grok-4.6 |
> | v1.0 | v0.2.0 | 2026-09-04 | 当前覆盖与升级条件改为正文第 1 章，避免文头被跳过 | grok-4.6 |
> | v1.1 | v0.2.0 | 2026-09-04 | 补齐 M4 工作台 API 的请求、回执、分页、错误和 Skill 管理契约，供正式前端接线评审 | gpt-5 |
> | v1.2 | v0.6.0 | 2026-09-04 | 开放通道连通、备份三档下载、导航规则 CRUD；快照内容、冲突、双向同步、规则求值仍禁止 | grok-4.6 |
> | v1.3 | v0.7.23 | 2026-09-11 | 开放 `POST /api/backup/:id/restore`（备份恢复，全量替换 + 强制回滚点 + 显式 confirm）；`full` 档恢复明确 501 | deepseek-v4.1-flash |
> | v1.4 | v0.7.28 | 2026-09-12 | `save_bookmark` 输入扩展可选 `source`（`agent` 缺省 / `extension`，Chrome 扩展接入；向后兼容，不加严）；登记 `GET /.well-known/*` 为免鉴权能力发现端点（Workers 同域部署配 `run_worker_first`）。规则求值仍禁止，见 §1 | glm-5.3-flash |
> | v1.5 | v0.7.30 | 2026-09-12 | `POST /api/sync/process` 从占位升级为真实消费（回执摘要 + 退避语义，见 §4.3 与同步设计 §3.1）；登记 Workers Cron `[triggers]` 调度。冲突合并、双向拉回仍禁止（见 §1） | glm-5.3-flash |
| v1.6 | v0.7.30 | 2026-09-12 | **开放导航规则求值**：新增 `GET /api/nav/feed`（按 nav_rules 逐步圈定，语义见 evaluator）；`GET /api/nav/bookmarks` 标注**已过时**（保留兼容，勿新增依赖）。`POST/PATCH /api/nav/rules` 收紧 rule 形状校验（对象/字符串均可，PATCH 传对象此前会落库报错，一并修复） | glm-5.3-flash |
| v1.7 | v0.7.30 | 2026-09-12 | **本地导出/导入（备份设计 §3）**：`GET /api/backup/export-zip`（ZIP：bookmarks.csv + meta.json）与 `POST /api/backup/import`（multipart 上传 CSV/ZIP，25MB 上限，显式 confirm，ZIP 内 snapshots/ 暂跳过）。两路径均限 Track B（依赖文件备份回滚点），Workers 501。依赖新增 `fflate`（用户批准，记录见 TODO） | glm-5.3-flash |
| v1.8 | v0.7.30 | 2026-09-12 | **双向拉回侧**：`POST /api/sync/pull`（单页拉回，默认 50 条，防风控）；`GET /api/conflicts`、`GET /api/conflicts/pending-count`、`POST /api/conflicts/:id/resolve`、`POST /api/conflicts/resolve-all`。`bookmarks.source` 契约枚举扩展 `raindrop`（向后兼容）。`/api/channels/:id/import` 增加 `maxPages` 提示：自动拉取一律单页，全量导入走显式 import | glm-5.3-flash |
| v1.9 | v0.7.31 | 2026-09-13 | **导入改按页契约**：`POST /api/channels/:id/import`（Raindrop）请求改 `{page?:0, intoInbox?:true}`，回执改 `{page,imported,skipped,errors,total,hasMore}`——每次只导一页（50 条），由前端逐页驱动；全量循环在 Workers 上会撞单次调用 50 子请求（D1 每查一次都计入）/10ms CPU 上限（实测 397 条只进 50 条）。按 raindropId 去重，重导续传。破坏性：旧一次性全量回执 `{imported,skipped,errors}` 不再返回 | glm-5.3-flash |
| v1.10 | v0.7.32 | 2026-09-13 | **导出改按页契约（同一限额问题的收尾）**：`POST /api/channels/:id/export`（Raindrop）请求改 `{excludeIds?, count?}`，回执改 `{exported,failed,processed,total,hasMore,errors,failedIds}`——每次推一页（20 条，Raindrop create 无批量端点），前端把上一轮 `failedIds` 传回 `excludeIds` 跳过毒条目，直到 `processed=0`。S3/WebDAV 回执对齐同一形状（单轮即完，`hasMore=false`）。`/api/sync/pull` 与 sync_queue 消费器契约不变，内部改批量 D1（消费器不再写 processing 中间态，中断条目保持 pending 下个 tick 重试） | glm-5.3-flash |
| v1.11 | v0.7.33 | 2026-09-13 | **列表回执增加 `total`（加性变更）**：`GET /api/bookmarks`、`GET /api/bookmarks/search`、`GET /api/inbox` 回执新增 `total`（当前筛选条件下的总数，分页器「共 y 页」用；游标条件不计入统计）。配套：list 关联读取改页级批量（一页 4 条查询替代逐条 4~5 条，Workers Free 档 50 子请求内跑得动整页列表）。导航页 `GET /api/nav/feed` 未动 | glm-5.3-flash |
| v1.12 | v0.7.34 | 2026-09-13 | **Skill Token 工作台签发 + 快照内容**：`GET/POST /api/skill/token`（会话鉴权；POST 生成一次明文、库内只存 sha256）；`POST /api/archive/process` 在 Track A 用 fetch 轻量抓取；`GET /api/archive/:id/content` 返回已完成快照 HTML（inline metadata）。Skill `snapshot=true` 仍只入队 | glm-4.6 |

# API 结构表

## 1. 当前覆盖与升级条件

写代码前先读本章。v1.2 只覆盖到这里；超出范围先停、先讨论、先升文档版本，再接线。

| 项 | 口径 |
| --- | --- |
| 当前覆盖 | **v1.8 = v1.7 + 双向拉回（单页）与冲突解决 API**。路径沿用已接线的 `/api/channels`、`/api/backup`、`/api/nav`、`/api/archive`、`/api/jobs`。 |
| 本版有的 | v1.3 全部；外加 `save_bookmark.source`（`agent` 缺省 / `extension`，向后兼容）与 `/.well-known/capabilities`（Workers 同域部署须配 `run_worker_first`，否则被 SPA 回退吞掉） |
| 本版没有的 | 快照文件 `GET/PUT .../content`、冲突合并、默认双向同步、Dexie 专用接口、ZIP 导入、`full` 档在线恢复、Skill 批量与删除、离线保存 |
| 升级规则 | 下表任一触发即停。先讨论升级方案、升本文档版本，再接线。禁止边写代码边加路由。 |

### 1.1 何时讨论升级（触发即停）

| 触发 | 典型要补的 | 对应里程碑 |
| --- | --- | --- |
| 要默认双向同步或冲突合并 | 队列真消费、`conflict` API | M5 后期（本版不做） |
| 端侧缓存上线，工作台不再每笔直打真源 | 成功口径与 pending-count；Skill 仍禁止走缓存 | M5 后期（本版不做） |
| 要下载/替换快照文件，而不只是 Job | `GET/PUT /api/archive/:id/content`；回执不得在无文件时给下载 URL | M6 后期（本版不做） |
| 备份恢复（已完成）、每目标调度 | 恢复接口已于 v1.3 开放（书签表）；每目标调度仍未做 | 备份设计稿，调度本版不做 |
| 导航按规则圈选并保证刷新一致 | 求值接口与展示集合 | M7 后期 |
| 要打开 Skill 改结构/删除/批量，或改默认能力 | 能力开关默认值、`confirmStructure`、批量 Skill | 须单独立项 |
| 要改 M2 已有路径名或书签回执必含字段 | 破坏兼容，必须升级讨论 | 随时 |
| 实现中发现缺接口，不补就做不完当前覆盖 | 先对照本文；仍缺则升级讨论，不私加 | 随时 |

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
| GET | `/api/sync/pending-count` | `{pendingCount}` | `sync_queue` 中 `pending` 条数；未入队则为 0。真源写入成功不占用此数 |
| POST | `/api/sync/pull` | `{processed pages...,created,skipped,conflicts,errors,hasMore}` | **v1.8**：Raindrop 拉回，**每次只拉一页（50 条）**防风控；新书签 `source=raindrop` 进 Inbox；同 raindropId 两端都有变化 → 本地赢并记入 conflicts（两端快照都存）。需要已启用的 Raindrop 通道，否则 400 |
| POST | `/api/sync/process` | `{processed,succeeded,failed,requeued,remaining}` | **v1.5 真实消费**：先把退避到期的 failed 重置回 pending，再按通道消费一批（最多 10 条；当前仅 Raindrop 书签推送）。失败按 1s/2s/4s 封顶退避 + `retry_count` 累加，超 8 次不再自动重试。调度另有两处：Workers Cron（`[triggers]` 每 5 分钟）与自托管定时器（60 秒）。入队点见同步设计 §3.1 |
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
| GET | `/api/skill/token` | `{configured,fromEnv,fromSettings}`；不返回明文或摘要 |
| POST | `/api/skill/token` | `{token,configured}`；明文只此一次，库内 `skill.token_hash` |
| POST | `/api/bookmarks/:id/archives` | 体 `{type:\"snapshot\"}`；只建 Job；回执必须带 `snapshotStatus:\"queued_pending_browser\"` |
| GET | `/api/jobs` | 与 `/api/archive` 读同一套 `archive_jobs`，禁止两套列表 |
| POST | `/api/jobs/:id/retry` | |
| POST | `/api/jobs/:id/cancel` | |

无 `archives.file_path` 时禁止返回快照文件 URL。`/api/archive` 与 `/api/jobs` 必须互通，见第 9 章。

---

## 5. Skill

统一：`POST /api/skill/<name>`，JSON 体，Bearer。七个名字不得改。

| name | 输入 | 成功 | 约束 |
| --- | --- | --- | --- |
| `save_bookmark` | `url` 必填；`note` `intent` 可选；`snapshot` 默认 false；`source` 可选（v1.4：`agent` 缺省 / `extension`，Chrome 扩展保存；其余值 400） | 201 含正式 `id`；`source` 按入参（缺省 `agent`）`status=unread` | 不写场景/文件夹/标签；`snapshot=true` 只插 Job，`snapshotStatus=queued_pending_browser`；log actor=agent；建议可异步，本回执可 `suggestions:[]`；**回执不对称**：首次为扁平 receipt，24h 幂等重放为 `{bookmark,...}` 包裹（接入方按 `data.bookmark ?? data` 兼容） |
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
| `GET/PUT /api/archive/:id/content` | 本版不产快照文件 |
| 冲突合并接口 | `conflict` 未建表 |
| Raindrop 定时双向同步 | 开发计划不做默认双向 |
| Dexie 专用读写接口 | 缓存推后；Skill 禁止走缓存 |
| 导航规则求值后的展示集合接口 | 本版只存规则 |
| 备份恢复（v1.3 已开放，仅书签表）/ ZIP 导入 | 恢复见 §9.2；ZIP 导入仍未做 |
| Skill 批量/删除 | 过关不依赖；默认能力关 |
| 离线保存专用接口 | 应用不可达 = 失败 |
| 把 Cookie CORS 扩成 `*` | M2 已收紧工作台源 |
| 新路径替代 M2 已有 URL | 只加参数或新路径 |
| 把掩码密钥写回配置 | 会毁掉 Token |

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

`GET /api/settings` 返回 `{items:[{key,value,updatedAt}]}`；敏感设置按 key 和 value 双重过滤，不返回口令、Token、摘要或密钥。`PUT /api/settings` 只允许白名单：`recycle.retention_days`、`skill.capabilities`，未知 key 返回 `VALIDATION_ERROR`。通道配置不走本接口，走 `/api/channels`。复杂 value 使用 JSON 原值，不向前端暴露内部字符串化细节。必须提供 `GET /api/settings`，不得只实现 PUT。

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

本清单仅用于 M4 前端接线。v1.2 通道、备份、导航路径见第 9 章。归档内容传输仍按第 7 章禁止。

---

## 9. M5–M7 基础连通契约（v1.2）

与第 4–8 章冲突时，路径以已接线的 `/api/channels`、`/api/backup`、`/api/nav`、`/api/archive`、`/api/jobs` 为准。本版只做配置、测试连通、一次上传或下载、三档备份可下载、导航规则能存。复杂同步与快照产文件仍禁止。

除注明外均需工作台会话。

### 9.1 通道

配置落 `channel_config`，不落 `settings`。列表回执必须掩码 `token` `secretAccessKey` `password`（首尾可见、中间 `*`）。创建/更新不得把掩码串当新密钥保存：密钥字段空或仍是掩码则保留库中旧值。

| 方法 | 路径 | 请求 | 成功 | 要点 |
| --- | --- | --- | --- | --- |
| GET | `/api/channels` | — | `{items}` | 掩码后的配置 |
| POST | `/api/channels` | `{channel,label,config,enabled?}` | 201 `{ok,id}` | `channel`=`raindrop`\|`s3`\|`webdav`；`config` 为对象或 JSON 字符串，键见数据库结构表 §17 |
| PATCH | `/api/channels/:id` | 部分字段 | 200 掩码后的对象 | 可省略；没有则用删+建 |
| DELETE | `/api/channels/:id` | — | `{ok:true}` | 真删行，不要写成 `settings` 空字符串 |
| POST | `/api/channels/:id/test` | — | `{ok:true,message?}` | **本版必做**。Raindrop：调用户信息或等价轻量接口。S3：HeadBucket 或列举。WebDAV：PROPFIND/OPTIONS 目标 URL。失败 400 `VALIDATION_ERROR` 或 502 用 `NOT_SUPPORTED` 以外的明确 message，不要空成功 |
| POST | `/api/channels/:id/export` | 可选 `{excludeIds?: string[], count?}` | `{exported,failed,processed,total,hasMore,errors,failedIds}` | **v1.10 起按页（Raindrop）**：每次推一页（20 条，create 无批量端点）；前端逐轮驱动，上一轮 `failedIds` 传回 `excludeIds` 跳过，`processed=0` 即耗尽停止。S3/WebDAV 单轮回执同形状（`hasMore=false`）。候选集排除已推送（`raindrop_id` 非空）与回收站条目；未测通允许失败，不得把失败标成 exported |
| POST | `/api/channels/:id/import` | 可选 `{page?:0, intoInbox?:true}` | `{page,imported,skipped,errors,total,hasMore}` | **v1.9 起按页**：每次只导一页（50 条），调用方循环驱动直到 `hasMore=false`（Workers 单次调用 50 子请求/10ms CPU 上限，禁止在请求内循环全量）。Raindrop 按 `raindrop_id` 去重，重导续传；`total` 为 Raindrop 侧总数（不可知为 0）；`intoInbox` 默认 true（`status=unread`）。WebDAV 本版可返回 400 `NOT_SUPPORTED` 并写明「仅导出/测试」 |

未配置通道时，`POST /api/bookmarks` 与 Skill `save_bookmark` 行为与 v1.1 完全相同。

### 9.2 备份

三档：`light` \| `medium` \| `full`。默认 `target=local`。完成后必须能下载，禁止只写库记录没有文件。

| 方法 | 路径 | 请求 | 成功 | 要点 |
| --- | --- | --- | --- | --- |
| POST | `/api/backup` | `{tier, target?}` | 202 或 201 记录 | `tier` 必填；`target` 缺省 `local` |
| GET | `/api/backup` | — | `{items}` | 时间倒序 |
| GET | `/api/backup/:id` | — | 记录 | 无文件也返回记录，`filePath` 为 null |
| GET | `/api/backup/:id/download` | — | 文件流 | **本版必做**。`status!=completed` 或无 `file_path` → 409 `CONFLICT` 或 404 |
| POST | `/api/backup/:id/restore` | `{confirm:true, bookmarks?}` | `{ok,restored,removed,createdTags,createdScenes,rollbackBackupId}` | **破坏性**。语义见下 |
| GET | `/api/backup/export-zip` | — | ZIP 文件流 | **v1.7（Track B）**：`bookmarks.csv`（列同轻档）+ `meta.json`；文件名 `dogear_export_YYYYMMDD_HHMMSS.zip`。纯内存生成，不写备份记录 |
| POST | `/api/backup/import` | multipart：`file`（CSV/ZIP，≤25MB）+ `confirm:true` | `{ok,restored,removed,createdTags,createdScenes,rollbackBackupId,skippedSnapshots,sourceFile}` | **v1.7（Track B，破坏性）**：全量替换书签表；导入前自动创建回滚点备份；ZIP 内 `snapshots/` 暂跳过并在回执报告数量（快照存储待 L3）；Workers 501 |

`light` 至少一种可下载格式（CSV 即可）。`medium` = 轻档 + 设置（无密钥）。`full` = SQLite 或全表导出；没有快照文件则 `includes` 不得声称含快照。失败不删书签。

**恢复（`POST /api/backup/:id/restore`，v1.3 新增）**：语义按 [备份功能设计](../modules/20260904_备份功能设计.md) §2.8「恢复操作」——**全量替换**当前书签表，非增量合并。约束：

- 请求体必须含 `confirm: true`，否则 400 `VALIDATION_ERROR`。破坏性端点不接受「隐式确认」，`confirm` 缺省为 false 不生效
- 恢复前**必须**自动创建一次全量备份作为回滚点；回滚点创建失败则整次恢复失败，不得「替换了却无法回退」
- 复用备份中的书签 `id`，使恢复后的身份与原记录一致；标签/场景按名字查找或创建后重新挂载
- 完成后写操作日志（`action=import`，含恢复与替换条数、回滚点 id）
- `tier=full` → **501 `NOT_SUPPORTED`**：数据库文件正被运行时持有，服务运行中替换库文件不安全。需停服后手工替换
- 备份不存在 → 404 `NOT_FOUND`；`status!=completed` 或无文件 → 409 `CONFLICT`；文件内容非法（如 medium 档 JSON 缺 CSV）→ 409 `BAD_BACKUP`
- 恢复不触发滚动保留逻辑

### 9.3 归档 Job（两套路径必须同一数据）

| 方法 | 路径 | 成功 | 要点 |
| --- | --- | --- | --- |
| POST | `/api/archive` | 201 `{jobId,snapshotStatus:"queued_pending_browser"}` | 体 `{bookmarkId,type?}`；写入 `archive_jobs` |
| GET | `/api/archive/:id` | Job | |
| GET | `/api/archive/bookmark/:bookmarkId` | `{items}` | |
| POST | `/api/archive/:id/retry` | `{ok,job}` | 仅 failed |
| POST | `/api/archive/:id/cancel` | `{ok,job}` | 仅 pending/running |
| GET | `/api/jobs` | `{items,nextCursor}` | **必须列出同一批 Job** |
| POST | `/api/bookmarks/:id/archives` | `{jobId,snapshotStatus:\"queued_pending_browser\"}` | 与 POST `/api/archive` 同语义 |
| POST | `/api/archive/process` | `{processed,succeeded,failed}` | 消费 pending 快照；Track A fetch / Track B monolith；未注入 501 |
| GET | `/api/archive/:id/content` | HTML | 仅 completed 且 metadata 含 html；无内容 404 |

创建时无文件则 `snapshotStatus` 仍为 `queued_pending_browser`。工作台随后触发 process。元数据提取可异步，失败不影响 Link。

### 9.4 单条导出

| 方法 | 路径 | 要点 |
| --- | --- | --- |
| GET | `/api/bookmarks/:id/export/html` | 元数据卡片 HTML，**不是**快照文件 |
| GET | `/api/bookmarks/:id/export/markdown` | 元数据 Markdown |

有快照文件之前，不要把这两条说成 Snapshot 下载。

### 9.5 导航

| 方法 | 路径 | 请求 | 成功 | 要点 |
| --- | --- | --- | --- | --- |
| GET | `/api/nav/rules` | — | `{items}` | |
| POST | `/api/nav/rules` | `{name,mode?,rule?,searchQuery?,sortOrder?,enabled?}` | 201 规则 | `mode` 默认 `all`；v1.6 收紧：`mode` ∈ all/rule/search/hide，`rule` 接受对象或 JSON 字符串（形状：sceneIds/folderIds/tagIds 字符串数组、status 三态），非法 400 |
| PATCH | `/api/nav/rules/:id` | 部分字段 | 200 规则 | v1.6：字段逐个校验；`rule` 同 POST（此前传对象会落库报错，已修） |
| DELETE | `/api/nav/rules/:id` | — | `{ok:true}` | |
| GET | `/api/nav/bookmarks` | `limit` `cursor` | `{items,nextCursor}` | **已过时（v1.6 起）**：不求值 `nav_rules` 的固定投影（排除 private/unread），仅为兼容保留，**勿新增依赖**；新代码一律用 `/api/nav/feed`。条目只返回 `id,title,favicon,url,domain`，不要把 `note` 带出 |
| GET | `/api/nav/feed` | `limit`（≤200） `offset` | `{items,nextCursor}` | **v1.6**：按 `nav_rules`（enabled，按 sort_order）逐步圈定的展示集合；`all`=全集重置 / `rule`=条件命中加入（OR）/ `search`=搜索命中加入 / `hide`=命中移出；候选恒为非私密、未软删、不含 Inbox；无规则回落旧投影语义。投影字段同旧行。分页为 offset（内存集合） |
| GET | `/api/nav/recent` | `limit` | `{items}` | 按 `access_records.opened_at` 倒序，去重书签；同样排除私密与 Inbox |

### 4.3.1 同步冲突（v1.8，拉回侧）

| 方法 | 路径 | 请求 | 成功 | 要点 |
| --- | --- | --- | --- | --- |
| GET | `/api/conflicts` | `resolution?` | `{items}` | 默认 pending；条目含 localSnapshot/remoteSnapshot（JSON 字符串） |
| GET | `/api/conflicts/pending-count` | — | `{pendingCount}` | |
| POST | `/api/conflicts/:id/resolve` | `{choice}` | 冲突记录 | `choice` ∈ `kept_local`（默认已生效，仅标记）/ `kept_remote`（远端覆盖本地 title/note）/ `merged`（本地为基，补远端非空字段） |
| POST | `/api/conflicts/resolve-all` | `{choice}` | `{resolved}` | 批量；写操作日志 |

冲突产生规则见同步设计 §3.1：拉回时同 raindropId 两端都有变化 → 本地赢 + 记录两端快照；同 id 只留一条 pending。

访问记录：`POST /api/bookmarks/:id/access-records` 体可带 `client`：`workbench` \| `navigation` \| `plugin` \| `unknown`，缺省 `workbench`。导航点击必须传 `navigation`。

未登录打 `/api/nav/*` → 401。前端无会话应进密码页，不要先渲染条目。

### 9.6 访问记录 `client`

v1.2 允许请求体 `{source, client}`。服务端写入 `access_records.client`。列表不按 client 过滤，除非调用方指定。

### 9.7 本版连通验收（实现时按此勾）

- 未配通道，工作台与 Skill 保存仍成功。
- 三个通道都能保存配置；GET 见掩码不见全文密钥。
- `POST .../test` 对已配通道返回真实连通结果（失败不得 ok:true）。
- S3 或 WebDAV 至少一次上传小对象或导出文件成功；Raindrop 至少一次导入或导出冒烟（按 `raindrop_id` 去重）。
- 三档备份能建记录，轻档可下载文件；轻/中档可从备份恢复书签表（全量替换，含回滚点）。
- Job 列表与快照按钮入队能对上同一条。
- 导航规则能增删改；`/nav` 书签不含备注、不含 Inbox/私密。
- 不实现：双向同步、冲突表、快照 HTML 文件、规则圈选求值、ZIP 导入、`full` 档在线恢复。
