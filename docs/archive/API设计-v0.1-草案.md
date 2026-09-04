<!-- 项目名：DogEar · 折耳书签 -->

> **文档版本**：v0.1
> **应用版本**：v0.2.0
> **文档状态**：归档
> **说明**：2026-09-04 升格前的草案原文，仅追溯。现行生效稿：[docs/modules/API设计.md](../modules/API设计.md)。
> **目的和适用范围**：规定工作台与 Skill 两扇门如何读写同一本账。每个接口先说明「用户或 AI 在办什么事」，再给路径、请求与回执。覆盖 M3（Agent 能存）与 M4（工作台整理）将用到的窗口；M5–M7 的通道、快照文件、导航圈选只留口。
> **权威级别**：历史参考。实现勿读本文。
> **配套文档**：[数据库设计](./数据库设计.md) · [Scene / AI 细部](./Scene-AI与待设计细部.md)
> **唯一需求源**：[需求总纲](../../wiki/DogEar-需求总纲.md)
> **技术口径**：[技术总纲](../../wiki/DogEar-技术总纲.md)
> **最后更新日期**：2026-09-04
> **修改记录**：
>
> | 文档版本 | 应用版本 | 日期 | 修改摘要 | 修改模型ID |
> | --- | --- | --- | --- | --- |
> | v0.1 | v0.2.0 | 2026-09-04 | 初稿：两扇门、通用约定、工作台 REST、七个 Skill、错误码与明确不做的接口 | grok-4.6 |

# 核心窗口（API 设计）

## 1. 介绍：API 在产品里是什么

数据库是官方账本。**API 是办事窗口**：谁来、要办哪件事、允不允许、办成了给什么回执。

工作台（你在浏览器里点的）和 AI 助手（Skill）必须看到**同一批书签**。差别只是进门的钥匙，以及默认允许做到哪一步：

```text
你（工作台） ──登录密码──┐
                         ├── 窗口 ──► 同一本账
AI 助手      ──Skill 口令──┘
```

如果做成两套互不相干的接口、两套编号，就会出现「AI 说存好了，Inbox 里没有」——这正是 M3 过关要堵住的。

本文里每个接口都带三块：

- **办什么事**（产品）
- **规则**（成功/失败、红线）
- **契约**（路径、请求、回执）

实现时路径可以按这里接线；解释产品时看「办什么事」。

---

## 2. 范围

### 2.1 本版提供

| 门 | 能办的事 |
| --- | --- |
| 工作台 | 登录退出；存链接；看 Inbox 与列表；打开打点；改四维与状态；搜索；回收站；看建议并接受/忽略；读操作日志与未推送数 |
| Skill | 自描述能力清单；保存；搜索；列出；改一条；统计；登记截网页待办；给出场景建议（不自动挂） |

两边走**同一套仓库**（同一张书签表）。Skill 不是第二套数据。

### 2.2 本版不提供

通道配置、导入导出、备份、快照文件上传下载、导航规则、命令面板专用接口（命令面板复用搜索）、插件消息桥。

M2 已经存在、本版继续保留的：登录 Cookie、创建书签、Inbox、未推送计数、访问打点。本版是在它们上面补全，而不是换一套 URL。

---

## 3. 通用约定

### 3.1 怎么读这份契约

- 工作台路径都以 `/api` 开头（与 M2 一致）。
- Skill 路径为 `/api/skill/<技能名>`；能力发现在 `/.well-known/capabilities`（总纲写法，不放在 `/api` 下）。
- JSON 字段用驼峰（`createdAt`），与 M2 回执一致。账本列名是蛇形，对照见数据库文档。
- 时间是毫秒整数。
- 书签编号是 UUID 字符串。创建成功回执里的 `id` 就是正式号，禁止 `tmp_` 前缀。

### 3.2 成功怎么算

窗口回答「保存成功」时，账本里必须已经有这一行。页面上先画出卡片可以，但回执失败必须让用户知道没存上。应用连不上就是失败，不要假装成功。

Skill 保存必须同步写真源，回执当场带正式 `id`。Skill 路径**不得**经过浏览器缓存。

### 3.3 两把钥匙

| 谁 | 怎么证明 | 钥匙从哪来 |
| --- | --- | --- |
| 工作台 | Cookie 会话（M2 已有 `dogear_session`） | 登录密码；本版来自环境变量 |
| Skill | `Authorization: Bearer <token>` | 与登录密码分开的口令；只存摘要 |

工作台写接口无会话 → `401 UNAUTHORIZED`。
Skill 写接口无口令或口令错 → 同样 `401`，错误码仍为 `UNAUTHORIZED`（不额外透露是哪把钥匙错了）。

`GET /.well-known/capabilities` **不要求**口令：这是给 AI 平台发现「这里能做什么」的说明书，里面没有用户数据、没有密钥。真正存书签仍然要口令。

### 3.4 Skill 默认能做什么（三级）

需求上按三级能力开关，可在设置里改。数据库存在 `settings.skill.capabilities`。默认值服务 M3 过关，同时不让助手随便改结构、随便删：

| 级 | 含义 | 默认 | 覆盖的 Skill |
| --- | --- | --- | --- |
| 查已有的 | 只读 | 开 | `search_bookmarks`、`list_bookmarks`、`get_stats`、`suggest_scene` |
| 写新的 | 新增书签或登记截网页 | 开 | `save_bookmark`、`trigger_archive` |
| 改已有的（含删） | 改字段、改归属、删除 | **关** | `update_bookmark`（以及以后的批量/删除） |

`suggest_scene` 只往建议表写，不改场景归属，所以算「查 / 建议」，不算「改已有的」。

某 Skill 被关掉时：接口仍在，返回 `403 CAPABILITY_DISABLED`，不要假装成功、不要静默空列表（空建议除外，空建议是合法结果）。

### 3.5 错误体

所有失败统一：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "用一句话说明发生了什么",
    "details": {}
  }
}
```

`details` 可省略。`code` 是程序认的，`message` 是给人看的。本版常用码见第 9 节。

### 3.6 列表怎么翻页

不用页码（`page=3` 这种在插入新书签时会跳行）。用游标：

- 请求：`?limit=50&cursor=<上一页回执里的 nextCursor>`
- 回执：`{ items: [...], nextCursor: "..." | null }`
- `limit` 默认 50，最大 100。600 条基线靠多次翻页 + 工作台自己的虚拟列表，不靠一次拉全库。
- `nextCursor` 为空表示没有下一页。

Inbox 在 M2 是 `{ bookmarks: [] }`。本版 **Inbox 继续用这个形状**，并加上 `nextCursor`，以免工作台现有调用一次性全断。其它新列表用 `items`。

### 3.7 防重复提交

创建类请求（工作台 `POST /api/bookmarks`、Skill `save_bookmark`）接受头 `Idempotency-Key`。同一把钥匙 24 小时内重放，返回第一次那条书签，不再新建。没有这把钥匙时，连点两次可能存两条——这符合「本版 URL 不去重」；要去重是调用方自己带钥匙。

### 3.8 限速（Skill）

读、写、批量分开计数。超限返回 `429 RATE_LIMITED`。具体阈值可配，本版不写死验收数字；测试里允许把阈值调到很小来证明 429 真的会发生。工作台登录用户本版不限速。

---

## 4. 工作台窗口

除非另说，下列都要登录。回执里的书签对象形状见第 6 节。

### 4.1 登录与我是谁

**办什么事**：证明你是这台实例的主人，然后才能进工作台。

| 方法 | 路径 | 规则 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 体 `{ "password": "..." }`。对则种 Cookie，回 `{ "user": { "id": "user" } }` |
| `GET` | `/api/auth/me` | 有有效会话则回同样的 `user`，否则 401 |
| `POST` | `/api/auth/logout` | 作废当前会话。无会话也回 `{ "ok": true }` |

这三项 M2 已有，行为保持。本产品单人，没有注册、没有多账号。

---

### 4.2 保存一条链接

**办什么事**：把一个 URL 写进账本。这是 Capture。不要求选场景。

**规则**：

- 必填只有 `url`（合法 URL）。
- `note`、`intent`、`important`、`private` 可选。
- 不要在这个接口上提供 Snapshot 开关（工作台 M2/M4 保存表单默认只存 Link；截网页走另一次触发）。
- 服务端生成 UUID，`source = page`，`status = unread`，`syncStatus = synced`（当场真源落库）。
- 成功 HTTP 201。回执就是这条书签（正式 `id`）。
- 写入 `operation_log`，`actor = user`，`action = create`。

```
POST /api/bookmarks
```

请求例：

```json
{ "url": "https://example.com/article", "note": "做项目 A 时用" }
```

失败：URL 不合法 → `400 VALIDATION_ERROR`。未登录 → 401。

---

### 4.3 Inbox（待处理）

**办什么事**：看看我还没决定去向的书签。不是「未读文章」列表。

**规则**：只列出 `status = unread` 且不在回收站的。可以已经有场景或标签。空列表是合法的（新实例或全部整理完）。

```
GET /api/inbox?limit=&cursor=
```

回执：

```json
{
  "bookmarks": [],
  "nextCursor": null
}
```

M2 已有此路径。本版只加翻页字段。

---

### 4.4 列出、读取、修改、丢掉一条

**办什么事**：工作台主列表与详情。修改是整理（Organize），不是重新保存。

```
GET    /api/bookmarks
GET    /api/bookmarks/:id
PATCH  /api/bookmarks/:id
DELETE /api/bookmarks/:id
```

**列表筛选**（均可选，可组合）：

| 参数 | 含义 |
| --- | --- |
| `status` | `unread` / `saved` / `archived` |
| `sceneId` | 属于某场景 |
| `folderId` | 在某文件夹；特殊值 `none` 表示没有文件夹 |
| `tagId` | 带某标签 |
| `important` | `true` 只看标星 |
| `source` | `page` / `agent` / `extension` |
| `q` | 标题、URL、备注的简单包含（完整搜索见 4.5） |
| `limit` / `cursor` | 翻页 |

默认不含回收站。按 `createdAt` 倒序。回执 `{ "items": [...], "nextCursor": null }`。

**读取一条**：不存在或在回收站 → `404 NOT_FOUND`（回收站请走 4.8）。成功则带上当前场景、标签、文件夹、待处理建议摘要。

**修改（PATCH）**：只提交要改的字段。可改 `title`、`excerpt`、`note`、`important`、`private`、`status`、`folderId`（`null` 表示拿出文件夹）、`tagIds`（整份替换）、`sceneIds`（整份替换）。

规则：

- 改 `sceneIds` / `tagIds` / `folderId` 是用户写入，成员表 `source = user`。
- 不接受客户端改 `id`、`createdAt`、`source`、`raindropId`。
- 每次成功改写 `version + 1`。
- 记操作日志。
- 不存在 → 404。在回收站 → `409 BOOKMARK_DELETED`（先恢复再改）。

**DELETE**：软删除，进入回收站。回 `{ "ok": true, "deletedAt": 169... }`。再 DELETE 同一条仍算成功（幂等）。彻底消失走回收站清空。

---

### 4.5 搜索

**办什么事**：按字和条件把书签找回来（Rediscover 的搜索入口）。命令面板（⌘K）也打这里，不另做一套。

```
GET /api/bookmarks/search?q=&status=&sceneId=&folderId=&tagId=&limit=&cursor=
```

**规则**：搜标题、URL、标签名、备注。不做网页正文全文检索，不做自然语言保证。服务端是兜底；M4 工作台可用 MiniSearch 加速同一批已加载数据，但「刚被 AI 存进来、本机还没缓存」时仍以本接口为准。

回执形状与列表相同：`{ items, nextCursor }`。

---

### 4.6 批量整理

**办什么事**：多选后统一改场景 / 文件夹 / 标签 / 状态，或一起丢进回收站。

```
PATCH /api/bookmarks/batch
```

请求：

```json
{
  "ids": ["uuid-1", "uuid-2"],
  "status": "saved",
  "addSceneIds": ["..."],
  "removeSceneIds": ["..."],
  "folderId": null,
  "addTagIds": ["..."],
  "removeTagIds": ["..."],
  "deleted": true
}
```

**规则**：

- `ids` 必填，本版最多 100 条。超出 → `400 BATCH_TOO_LARGE`。
- 一次请求里的改动同一事务：要么都成，要么都不成，避免「一半已确认一半还待处理」。
- 每条仍写操作日志，便于以后整批撤回。
- 回收站中的 id 跳过并在回执 `skipped` 里说明，不让整批失败。
- AI 默认没有这个接口（Skill 本版不提供批量）。工作台登录用户可用。

回执：`{ "updated": ["uuid-1"], "skipped": [{ "id": "...", "reason": "deleted" }] }`。

---

### 4.7 打开打点（访问记录）

**办什么事**：用户点了「打开原文」。记下这一次，供以后「最近打开」。

```
POST /api/bookmarks/:id/access-records
GET  /api/bookmarks/:id/access-records
```

POST 体可选 `{ "source": "original" }`。本版工作台只记原文。成功 201，并更新该书签 `lastOpenedAt`。

书签不存在 → 404。在回收站仍允许记一次打开（从回收站点开原文是合理的），但产品上很少用。

GET 回 `{ "records": [ ... ] }`，按时间倒序。M2 已有这对路径。

---

### 4.8 回收站

**办什么事**：看最近丢掉的、捡回来、或彻底忘掉。

| 方法 | 路径 | 事 |
| --- | --- | --- |
| `GET` | `/api/recycle-bin` | 列出 `deletedAt` 非空的书签 |
| `POST` | `/api/recycle-bin/:id/restore` | 清空 `deletedAt`，回到进站前的状态 |
| `DELETE` | `/api/recycle-bin/:id` | 永久删除这一条及挂载 |
| `POST` | `/api/recycle-bin/empty` | 清空到期或全部（请求体 `{ "onlyExpired": true }` 默认只清到期） |

默认保留 7 天，见设置 `recycle.retention_days`。导出通道（以后）默认不带这里的行。

---

### 4.9 场景 / 文件夹 / 标签

**办什么事**：维护四个组织维度里「可配置」的三个（状态是书签自己的栏，不是一本名册）。

**场景**

| 方法 | 路径 | 事 |
| --- | --- | --- |
| `GET` | `/api/scenes` | 列出；含停用的，用 `enabled` 区分。工作台挑选器自己过滤 |
| `POST` | `/api/scenes` | 新建。可省略 `aerr`，服务端给默认 `reference` |
| `PATCH` | `/api/scenes/:id` | 改名、说明、图标、顺序、启用、内部原型 |
| `DELETE` | `/api/scenes/:id` | 无成员才允许；有成员 → `409 SCENE_IN_USE` |

把书签挂到场景、从场景摘下：走书签 PATCH 的 `sceneIds`，或批量接口的 add/remove。不另设一套易冲突的嵌套路由。

**文件夹** `CRUD /api/folders`：删除文件夹时书签的 `folderId` 置空，书签还在。

**标签** `GET/POST /api/tags`，`DELETE /api/tags/:id`：删除标签只解挂载。创建时若 `name_key` 已存在，返回已有那枚（避免满屏重复 UE5）。

四个默认场景在空库迁移时写入，不靠每次启动的接口去「确保存在」。

---

### 4.10 建议（给工作台点确认用）

**办什么事**：看见系统预备的分流，决定接受、稍后或忽略。**点确认之前，书签的场景归属不变。**

| 方法 | 路径 | 事 |
| --- | --- | --- |
| `GET` | `/api/bookmarks/:id/suggestions` | 该书签的建议，可按 `status` 滤 |
| `POST` | `/api/suggestions/:id/accept` | 写入对应成员表或文件夹，建议标为 accepted |
| `POST` | `/api/suggestions/:id/defer` | 稍后，归属不变 |
| `POST` | `/api/suggestions/:id/dismiss` | 忽略，归属不变 |

接受时的抄写规则见数据库文档 §6.6。工作台 Inbox、详情、整理四处都读同一份建议，不按界面各存一份。

本版工作台不提供「生成建议」按钮也没关系——生成可以是保存后的后台动作，或由 Skill `suggest_scene` 触发。

---

### 4.11 状态栏、日志、设置

**未推送条数**（M2 已有，栏必须一直在）：

```
GET /api/sync/pending-count  →  { "pendingCount": 0 }
```

直写真源成功后应为 0。M5 才有真正的「攒了一批还没推」；那时仍然用这个窗口，不要另做一条状态栏接口。

**操作日志**：

```
GET /api/operation-log?limit=&cursor=&actor=&action=
```

给设置页/日志区看。不含密钥。

**设置**：

```
GET /api/settings
PUT /api/settings
PUT /api/skill/capabilities
GET /api/skill/usage
```

GET 设置不得返回口令或摘要。`PUT /api/skill/capabilities` 改三级开关。`usage` 回今日请求量、写入量、被拦截次数（限速或能力关闭）。

---

### 4.12 归档任务（只登记，不产文件）

**办什么事**：用户或以后的按钮说「给这条截一份网页」。本版只建一条 Job，状态 `pending`。

```
POST /api/bookmarks/:id/archives     体 { "type": "snapshot" }
GET  /api/jobs
POST /api/jobs/:id/retry
POST /api/jobs/:id/cancel
```

成功回执必须让调用方看得出**文件还没有**：`snapshotStatus: "queued_pending_browser"`。禁止返回「已有快照 URL」。下载/上传替换是 M6 的接口，本版不要先做出来以免撒谎。

---

## 5. Skill 窗口（给 AI 助手）

绑定方式：Base URL + Bearer 口令。AI 先读能力清单，再按名字调用。七个名字与需求总纲一致，不要改名。

统一请求：`POST /api/skill/<name>`，体为该 Skill 的输入 JSON。统一要带 Bearer。

### 5.1 能力自描述

```
GET /.well-known/capabilities
```

不要求口令。回执给机器看：有哪些技能、哪些字段必填、是不是写操作、限速与红线（默认不改结构、截网页可能只入队、删除默认关）。

形状（字段可增补，不得缺这些）：

```json
{
  "name": "DogEar",
  "version": "0.2.0",
  "auth": "bearer",
  "skills": [
    {
      "name": "save_bookmark",
      "write": true,
      "capability": "write_new",
      "input": { "url": "required", "note": "optional", "intent": "optional", "snapshot": "optional" },
      "notes": "同步写入真源并返回正式 UUID；默认不挂场景；snapshot=true 只入队"
    }
  ]
}
```

---

### 5.2 `save_bookmark` — 帮我存这个链接

**办什么事**：AI 对话里用户丢来一个 URL。助手调用本技能后，工作台 Inbox 必须立刻能看到同一条。这是过关门槛之二。

**规则**：

- `url` 必填。`note`、`intent` 可选。`snapshot` 默认 `false`。
- 当场插入真源：正式 UUID，`source = agent`，`status = unread`，不写场景/文件夹/标签。
- 回执立刻含 `id`。没有 `tmp_`。
- `snapshot: true`：插入 `archive_jobs` 一行，回执 `snapshotStatus = "queued_pending_browser"`。不得声称已经有文件。
- 记 `operation_log.actor = agent`。
- 可以随后异步去写 `suggestions`，但**本回执不必等建议**。建议没就绪就 `suggestions: []`。

请求：

```json
{
  "url": "https://example.com/ue5-guide",
  "note": "项目 A",
  "intent": "做材质时要查",
  "snapshot": false
}
```

回执 201：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/ue5-guide",
  "status": "unread",
  "source": "agent",
  "note": "项目 A",
  "intent": "做材质时要查",
  "snapshotStatus": "not_requested",
  "createdAt": 1693800000000
}
```

---

### 5.3 `search_bookmarks` / `list_bookmarks` — 帮我找、帮我列

只读。不改账本。

`search_bookmarks` 输入：`query`（字）、`filters`（`status` / `sceneId` / `folderId` / `tagId` / 时间范围）、`limit`、`cursor`。搜标题、URL、标签、备注。

`list_bookmarks` 输入：筛选条件 + `limit` + `cursor`。按时间倒序列。没有 `query` 时用这个，避免助手把「列出待处理」硬塞进搜索。

两者回执都是 `{ "items": [书签], "nextCursor": null }`，与工作台列表同形，便于同一渲染。默认不含回收站、不含私密？**私密书签 Skill 本版仍可按 id 读到**（主人的助手），但 `list` / `search` 默认排除 `private = true`，除非输入 `includePrivate: true`。导航页匿名不是本扇门的事。

---

### 5.4 `update_bookmark` — 改这一条

默认能力为关。打开后才允许。

输入：`id` + 要改的字段（与工作台 PATCH 相同的可改集合）。

**规则**：

- 结构字段（场景 / 文件夹 / 标签）改写时，成员 `source = user` 不合适（实际是 agent）。记 `source` 仍用 `user` 会撒谎；本版若直接改结构，成员 `source` 记 `ai_accepted` 也不对（没经工作台确认）。
- **因此默认建议模式**：即使能力打开，PATCH 结构字段若请求没带 `confirmStructure: true`，则**只写建议表**，回执 `{ "applied": false, "suggestions": [...] }`，账本归属不变。
- 带 `confirmStructure: true` 且能力已开：才真正改归属，日志 `actor = agent`。
- 改备注、状态、标星：不算结构，可直接写（仍受「改已有的」开关约束）。

这是把「建议先行」落到 Skill 上的方式，避免助手一句「帮我归档到工作研究」就改了用户的体系。

---

### 5.5 `get_stats` — 有多少条

只读。无输入。回总数、Inbox 数、各状态数、各场景数（停用场景也给，便于发现「还挂着人的旧场景」）。不含回收站。

---

### 5.6 `trigger_archive` — 给已有书签登记截网页

输入：`bookmarkId`，`type` 默认 `snapshot`。本版只插 Job，不抓页面。回执带 `snapshotStatus = "queued_pending_browser"` 与 `jobId`。书签不存在 → 404。`type = reader` → `400 NOT_SUPPORTED`。

---

### 5.7 `suggest_scene` — 建议分流，且仅建议

输入：`bookmarkId` 或 `bookmarkIds`（本版批量最多 20）。

**规则**：

- 理解后写入 `suggestions`（pending）。**不写** `bookmark_scenes`。
- 低把握可以返回空数组，这是合法成功，不是错误。
- 回执是建议列表，给工作台之后展示用，也给助手向用户复述「我建议放进工作研究，要我记下吗？」——记下必须再走确认，或用户自己在工作台点。

---

## 6. 书签回执长什么样

工作台与 Skill 共用同一形状，以免 Inbox 和 AI 回执对不上。未出现的栏用 `null` 或空数组，不要省略到让客户端猜。

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/article",
  "title": null,
  "excerpt": null,
  "cover": null,
  "type": "link",
  "author": null,
  "favicon": null,
  "publishedAt": null,
  "note": null,
  "intent": null,
  "important": false,
  "status": "unread",
  "source": "page",
  "private": false,
  "folder": null,
  "domain": "example.com",
  "broken": false,
  "raindropId": null,
  "syncStatus": "synced",
  "version": 1,
  "deletedAt": null,
  "lastOpenedAt": null,
  "createdAt": 1693800000000,
  "updatedAt": 1693800000000,
  "scenes": [],
  "tags": [],
  "pendingSuggestionCount": 0
}
```

`folder` 为 `{ id, name }` 或 `null`。`scenes` / `tags` 为 `{ id, name }[]`。列表接口可以带这些嵌套，避免工作台再打三次。

创建接口可以回精简版（M2 现有字段 + 上表里当时已有的列），但 `id` / `url` / `status` / `source` / `createdAt` 不得缺。

---

## 7. 产品动作对照

把「人想做什么」映射到窗口，避免实现时漏一条或做重。

| 人 / AI 的动作 | 走哪 |
| --- | --- |
| 打开工作台先登录 | `POST /api/auth/login` |
| 在表单里贴一个 URL 保存 | `POST /api/bookmarks` |
| 让 AI 存同一个 URL | `POST /api/skill/save_bookmark` |
| 看待处理 | `GET /api/inbox` |
| 打开原文 | 浏览器打开 URL，同时 `POST .../access-records` |
| 标已确认 / 搁置 | `PATCH /api/bookmarks/:id` 的 `status` |
| 挂上「工作研究」 | `PATCH` 的 `sceneIds`（或批量 add） |
| AI 提议「工作研究」 | `suggest_scene` 或后台写建议；用户 `POST .../accept` |
| 搜「UE5」 | `GET /api/bookmarks/search?q=UE5` 或 Skill `search_bookmarks` |
| 丢掉 | `DELETE /api/bookmarks/:id` |
| 后悔，捡回来 | `POST /api/recycle-bin/:id/restore` |
| 看还没推上真源的条数 | `GET /api/sync/pending-count` |
| 勾选截网页（Skill） | `save_bookmark` 带 `snapshot: true`，或事后 `trigger_archive` |

两条保存路径（工作台 / Skill）在账本里只差 `source`。Inbox 都要能看见。

---

## 8. 和 M2 已有路径的关系

| M2 已有 | 本版 |
| --- | --- |
| `POST /api/auth/login` 等三项 | 保持 |
| `POST /api/bookmarks` 只收 `url` | 仍只要求 `url`，可附 note/intent |
| `GET /api/bookmarks` 无筛选无翻页 | 加筛选与游标；旧客户端不带参数仍可用，只是一次最多 100 条 |
| `GET /api/inbox` | 保持 `bookmarks` 键，加 `nextCursor` |
| `GET /api/sync/pending-count` | 保持 |
| `POST/GET .../access-records` | 保持；POST 可带 `client` |

不改这些路径的名字。新增的都是新路径或新查询参数。

---

## 9. 错误码

| code | HTTP | 何时 |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | 没登录 / 口令无效 |
| `CAPABILITY_DISABLED` | 403 | Skill 的这一级开关是关的 |
| `VALIDATION_ERROR` | 400 | 缺 URL、类型不对、游标乱 |
| `NOT_FOUND` | 404 | 书签/场景/建议不存在 |
| `BOOKMARK_DELETED` | 409 | 在回收站，不能当活书签改 |
| `SCENE_IN_USE` | 409 | 还挂着书签，不能删场景 |
| `BATCH_TOO_LARGE` | 400 | 批量超过 100 |
| `RATE_LIMITED` | 429 | Skill 超限 |
| `NOT_SUPPORTED` | 400 | 如 `type=reader` |
| `CONFLICT` | 409 | `version` 对不上（本版可先不强制客户端带版本） |

消息用中文或英文均可，但同一 `code` 不要有两种含义。

---

## 10. 实现落点

- 路由写在 `apps/server`（Hono）。
- 校验用 `packages/shared` 的 Zod，前后端同一份。
- 读写只经过 `packages/db` 的仓库，页面和 Skill 都不要直接拼 SQL。
- CORS：工作台 Cookie 继续只放行本地开发源（M2 已收紧）。Skill 走 Bearer，按调用方需要另开，不把 Cookie CORS 扩成 `*`。
- 不在本版引入 Dexie。

---

## 11. 明确不要先做的接口

下面这些总纲里有名字，但本版做了会把范围拖进 M5–M7，或让回执撒谎：

| 接口 | 为什么现在不做 |
| --- | --- |
| `GET/PUT /archives/:id/content` | 还没有快照文件 |
| `CRUD /channels/*` | 还没有 Raindrop/S3/WebDAV |
| `POST /backup` | 还没有三档备份 |
| `CRUD /navigation/rules` | 导航页未开工 |
| Skill 批量整理 / 删除 | 默认能力关，且过关不依赖它们 |
| 离线保存专用接口 | 本版应用不可达 = 保存失败 |

需要时在对应里程碑另开一节补进本文或另文，不要在实现 M3 时顺手加上。
