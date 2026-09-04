<!-- 项目名：DogEar · 折耳书签 -->

> **文档版本**：v1.0
> **应用版本**：v0.2.0
> **文档状态**：生效
> **目的和适用范围**：把需求总纲里的「书签、四维组织、建议先行、访问记录、回收站、操作留痕」收成一份可落地的账本规格。给后续 M3（Agent 能存）与 M4（工作台整理）共用，避免工作台和 Skill 各长一套表。M3/M4 建表与迁移以本文为准。
> **权威级别**：模块规则。服从需求总纲与技术总纲；冲突时以需求总纲的产品对错为准，以技术总纲的工程口径为准。不取代总纲，也不规定界面长什么样。
> **配套文档**：[API 设计](./DogEar-API设计.md)（窗口怎么办这些事）· [Scene / AI 细部](../docs/modules/Scene-AI与待设计细部.md)（场景交互与未决细部，不管表结构）· [定稿目录](./README.md)
> **唯一需求源**：[需求总纲](./DogEar-需求总纲.md)
> **技术口径**：[技术总纲](./DogEar-技术总纲.md)
> **最后更新日期**：2026-09-04
> **修改记录**：
>
> | 文档版本 | 应用版本 | 日期 | 修改摘要 | 修改模型ID |
> | --- | --- | --- | --- | --- |
> | v0.1 | v0.2.0 | 2026-09-04 | 草案：M3/M4 核心账本。含业务逻辑说明、表清单、与 M2 的演进，以及明确延后的表 | grok-4.6 |
> | v1.0 | v0.2.0 | 2026-09-04 | 正式注册：用户确认思路后升为 wiki 定稿；正文规则未改 | grok-4.6 |

# 核心账本（数据库设计）

## 1. 介绍：这份文档在说什么

DogEar 是个人书签工具。用户要的不是「一张漂亮的表」，而是三件事：

1. **先存下来**：能连上本应用，一条链接就算保存成功。
2. **以后再整理**：场景、文件夹、标签、处理状态可以空着，也可以慢慢补。
3. **还能找回来**：按 Inbox、场景、搜索、打开记录把旧书签再看见。

**数据库就是这件事的官方账本。** 工作台刷新、换一台电脑、AI 助手刚存进来的链接，都以这里为准。浏览器里的缓存以后可以加快打开速度，但不能当第二本账。

本文分两层写：

- **逻辑**：为什么要有这张表、成功/失败怎么算、和别的概念如何互不替代。
- **规格**：有哪些表、记哪些栏、栏与栏之间的约束。实现时按规格建表；解释产品时看逻辑。

接口怎么访问这些表，见 [API 设计](./DogEar-API设计.md)。本文不写 URL。

---

## 2. 范围

### 2.1 本版要定稿的

覆盖开发计划里 **M3 + M4 会真正读写** 的账本，以及 M2 已经存在、需要演进而不能拆掉的部分：

| 要记住的事 | 对应产品能力 | 本版表 |
| --- | --- | --- |
| 一条书签是什么 | 保存 Link；Inbox；标星；私密；回收站 | `bookmarks` |
| 我为什么存它 | Scene，可多属，保存时不强制 | `scenes`、`bookmark_scenes` |
| 它放在哪 | Folder，一条最多一个 | `folders` |
| 它是什么主题 | Tag，可多枚 | `tags`、`bookmark_tags` |
| 系统建议但用户还没答应 | 建议先行，不自动挂场景 | `suggestions` |
| 打开过哪些 | 访问记录，先记下来 | `access_records`（M2 已有） |
| 谁改过什么 | 操作留痕；Agent 保存必记 | `operation_log` |
| 实例级开关与口令摘要 | Skill 能力、保留天数等 | `settings` |
| 「请截一份网页」的待办 | Skill 可登记，本版不产文件 | `archive_jobs`（占位） |

### 2.2 本版只留口、不展开

这些能力产品上存在，但本轮不为它们设计完整栏目。表不建，或只建 Job 占位：

| 延后到 | 不在本版展开的 |
| --- | --- |
| M5 | 与 Raindrop / S3 / WebDAV 对账的队列、冲突表、端侧镜像缓存（Dexie） |
| M6 | 快照文件本体、Archive 内容记录、三档备份历史 |
| M7 | 导航页圈选规则、展示集合缓存、页面标签与 Docker 栏 |
| 远景 | Reader、高亮、正文编辑、URL 去重、多人 |

`bookmarks.raindrop_id` 现在就可以是空列，免得以后没地方写 Raindrop 的编号；**不**因此提前做同步。

### 2.3 和现行总纲的一点对齐

需求总纲术语表仍写：本地未推送真源前可用 `tmp_` 前缀临时 ID。技术总纲与开发计划已改为：**保存成功 = 已经写入服务端真源，创建当场发稳定 UUID。** 本文按后者。Skill 和工作台都不使用 `tmp_` 号。需求总纲本文不改，只在实现口径上跟技术总纲。

本产品是纯个人工具，**一个运行实例一本账**，不建用户表、不建协作权限。能进门的人（登录密码或 Skill 口令）面对的是同一本账；两扇门的差别见 API 文档。

---

## 3. 设计原则（先懂这几条，再看表）

1. **书签是主体。** Scene、Folder、Tag、快照都是挂在书签上的，不能反过来让书签从属于某一个分类才能存在。
2. **四维互相独立。** 状态、场景、文件夹、标签回答四个不同问题，一张表里用一个「分类」字段塞不下。待处理的书签也可以已经有场景；已确认的书签也可以没有场景。
3. **空是合法的。** 只有 URL、状态为待处理、其它全空的书签，是完整有效的保存结果。
4. **建议不是归属。** 系统可以写「我建议它属于工作研究」；在用户确认之前，书签并不属于该场景。建议表和成员表必须分开。
5. **删除不是搁置。** 搁置是「先放着」；进回收站是「我想删，但短期内还能捡回来」。
6. **打开记录只追加。** 访问记录是流水，不拿来改书签的状态。
7. **M2 能继续活。** 现有 `bookmarks` 与 `access_records` 只加列、加表，不改已有行的编号含义。

---

## 4. 概念关系（人话版）

```text
场景 Scene ←——（可多可零）——→ 书签 Bookmark ←——（可多可零）——→ 标签 Tag
                                      ↑
                                      │ 0 或 1 个文件夹
                                   Folder

书签 1 ── N 访问记录（打开过）
书签 1 ── N 建议（系统提议，未确认不是成员）
书签 1 ── N 操作留痕
书签 0 ── N 归档任务（本版只记「请截网页」，不存网页文件）
```

一条书签在账本里的最小合法样子：

- 有一生不变的编号
- 有一个链接
- 有一个处理状态（新来的默认「待处理」）
- 有一个来源（工作台 / AI / 以后的插件）
- 有创建时间

标题、备注、场景、文件夹、标签都可以以后再补。

---

## 5. 从 M2 怎么长过来

M2 已经落地的表：

| 表 | 现有列 | 本版怎么处理 |
| --- | --- | --- |
| `bookmarks` | `id, url, status, sync_status, created_at, updated_at` | **加列**，不改主键。已有行：`source` 视为 `page`，其它新列用默认值 |
| `access_records` | `id, bookmark_id, opened_at, source` | **保留表名**（总纲写作 access_log，产品名「访问记录」）。`source` 仍表示打开的是原文还是快照；本版增加 `client` 记从哪一端打开 |

总纲里的 `access_log` 与仓库里的 `access_records` 是同一件事。为了不让 M2 已有数据改名迁移，**物理表名继续叫 `access_records`**。

`sync_status` 的产品含义（M2–M4）：这条书签是否已经得到**本应用真源**的确认。工作台或 Skill 由服务端当场写入成功后，应为 `synced`。`pending` 只用于「界面已经显示、真源还没点头」的短暂窗口。以后和 Raindrop 对账**不复用**这一列，另走通道队列（M5）。

---

## 6. 表规格

下列「API 名」是 JSON 里用的驼峰名，便于和 [API 设计](./DogEar-API设计.md) 对照。库里的列用蛇形。时间一律存毫秒整数。

枚举在应用层用契约校验；SQLite 存文本。

### 6.1 `bookmarks` — 书签

**介绍**：账本的中心。一条网页引用。保存成功 = 这里有一行，并且有正式编号。没有这一行，其它表写了也不算存成。

**逻辑**：

- 创建当场生成 UUID，之后永不改号。
- 不要求标题、场景、快照。只有链接也可以。
- 同一 URL 允许存多条（本版不做保存时去重）。
- `status` 只表达「我处理到哪了」，不表达「我读了没」，也不表达「有没有网页快照」。
- `important`（标星）与状态独立：待处理也可以标星。
- `deleted_at` 为空表示在用；有值表示在回收站。Inbox、列表、搜索默认都看不见回收站里的。
- `folder_id` 为空表示还没放进任何文件夹；一条书签不能同时待在两个文件夹。
- `intent` 是保存时用户或 AI 说的「我为什么存」一句话，供建议使用，**不是**第四个组织维度。

| 列 | API 名 | 类型 | 必填 | 默认 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `id` | `id` | UUID 文本 | 是 | 创建时生成 | 应用内身份证，Skill 回执也用它 |
| `url` | `url` | 文本 | 是 | — | 链接，保存的真正对象 |
| `title` | `title` | 文本 | 否 | 空 | 标题；抓取或用户可改 |
| `excerpt` | `excerpt` | 文本 | 否 | 空 | 网页描述（对齐全站 `excerpt`，不另叫 description） |
| `cover` | `cover` | 文本 | 否 | 空 | 封面 URL |
| `type` | `type` | 文本 | 是 | `link` | 链接类型：`link` / `article` / `video` / `image` 等 |
| `author` | `author` | 文本 | 否 | 空 | 作者（仅本地，不同步 Raindrop） |
| `favicon` | `favicon` | 文本 | 否 | 空 | 站点图标 |
| `published_at` | `publishedAt` | 毫秒时间 | 否 | 空 | 页面发布时间 |
| `note` | `note` | 文本 | 否 | 空 | 用户备注 |
| `intent` | `intent` | 文本 | 否 | 空 | 保存时的一句话意图 |
| `important` | `important` | 0/1 | 是 | 0 | 收藏标星 |
| `status` | `status` | 文本 | 是 | `unread` | 见下表 |
| `source` | `source` | 文本 | 是 | `page` | `page` / `agent` / `extension` |
| `private` | `private` | 0/1 | 是 | 0 | 私密；导航页默认不出现，本版先落库 |
| `folder_id` | `folderId` | UUID | 否 | 空 | 所属文件夹，0 或 1 |
| `domain` | `domain` | 文本 | 否 | 由 URL 派生 | 域名，只读派生 |
| `broken` | `broken` | 0/1 | 是 | 0 | 链接失效（通道只读派生，本版可一直为 0） |
| `raindrop_id` | `raindropId` | 文本 | 否 | 空 | Raindrop 侧编号；未接通道则为空 |
| `raindrop_extras` | `raindropExtras` | JSON 文本 | 否 | 空 | 高亮/提醒/附件等无产品入口的兼容字段，整包存放 |
| `sync_status` | `syncStatus` | 文本 | 是 | 见逻辑 | `pending` / `synced` |
| `version` | `version` | 整数 | 是 | 1 | 每次用户可见的改写 +1，给以后对账/并发用 |
| `deleted_at` | `deletedAt` | 毫秒时间 | 否 | 空 | 进入回收站的时间 |
| `last_opened_at` | `lastOpenedAt` | 毫秒时间 | 否 | 空 | 最近一次打开；有访问记录时更新 |
| `created_at` | `createdAt` | 毫秒时间 | 是 | 现在 | 创建 |
| `updated_at` | `updatedAt` | 毫秒时间 | 是 | 现在 | 最后修改 |

**状态（`status`）**：

| 对外名称 | 存库值 | 逻辑 |
| --- | --- | --- |
| 待处理（Inbox） | `unread` | 还没决定下一步。新保存默认。可长期停在这里 |
| 已确认 | `saved` | 整理后认为值得留着 |
| 搁置 | `archived` | 先放着，不是删除，也不是已经做了网页快照 |

对外文案禁止再说「已归档」来指这个状态，以免和 Snapshot 搞混。

**Inbox 的定义**：`status = unread` 且 `deleted_at` 为空。不要求场景/标签为空。

**回收站的定义**：`deleted_at` 不为空。默认 7 天后可被清空（天数在 `settings`，不把到期时刻再存一列，避免改保留天数时要回写所有行）。

---

### 6.2 `scenes` — 场景

**介绍**：回答「我为什么存、准备在什么情境下用」。不是文件夹，不是标签。默认四个，用户可改名、停用、新建。

**逻辑**：

- 名称允许重复，靠 `id` 区分（两个人都可能叫「工作」，本产品虽是单人，自定义场景仍可能重名）。
- 停用不删历史挂载：挑选器里不再出现，但已经挂上的书签仍能按这个场景筛到。
- 有书签挂着时禁止直接删除，须先把成员迁走或解绑（避免「删场景把回忆一笔勾掉」）。
- `aerr` 是系统内部原型，**不展示给用户**。四个默认场景各挂一个；用户新建时给一个默认原型，用户不必理解这四个英文词。
- 不做「主场景」。一条书签挂多个场景时，没有哪个更主要。

| 列 | API 名 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID | 是 | 场景身份证 |
| `name` | `name` | 文本 | 是 | 显示名 |
| `description` | `description` | 文本 | 否 | 说明 |
| `icon` | `icon` | 文本 | 否 | 可选图标名 |
| `sort_order` | `sortOrder` | 整数 | 是 | 侧栏顺序，越小越前 |
| `enabled` | `enabled` | 0/1 | 是 | 0 = 停用，挑选器隐藏 |
| `aerr` | `aerr` | 文本 | 是 | `action` / `explore` / `read` / `reference` |
| `created_at` / `updated_at` | 同左驼峰 | 毫秒 | 是 | 时间 |

实例初始化时写入四条默认场景（可随后改名，不按名字写死业务）：

| 默认名 | `aerr` | 用意（给系统，不给用户看词） |
| --- | --- | --- |
| 工作研究 | `action` | 近期要拿它办事 |
| 灵感收集 | `explore` | 浏览、发散 |
| 稍后再读 | `read` | 准备消费掉 |
| 长期资料 | `reference` | 以后反复查 |

「稍后再读」是场景，不是状态。一条书签可以同时是「稍后再读 + 待处理」。

---

### 6.3 `bookmark_scenes` — 书签属于哪些场景（已确认的）

**介绍**：只存放**用户已经答应**的归属。AI 还没被确认的提议，不要写进这张表。

**逻辑**：

- 一条书签可以有 0 到多条。
- 同一书签对同一场景只能有一行。
- `source` 只记录「这条归属是怎么写进来的」，用于以后撤回 AI 写入；**不是**「还在建议中」。
- 允许的 `source`：`user`（人在工作台点的）、`ai_accepted`（人确认了系统建议）。**没有 `ai_suggest`。**

| 列 | 类型 | 含义 |
| --- | --- | --- |
| `bookmark_id` | UUID | 书签 |
| `scene_id` | UUID | 场景 |
| `source` | 文本 | `user` / `ai_accepted` |
| `created_at` | 毫秒 | 挂上的时间 |

主键：`(bookmark_id, scene_id)`。

---

### 6.4 `folders` — 文件夹

**介绍**：回答「我希望它放在哪」。对应 Raindrop 的 collection。一条书签最多进一个文件夹，也可以哪个都不进。

**逻辑**：

- 与 Scene 独立：在「项目 A」文件夹里，也可以同时属于「工作研究」场景。
- 本版允许可选的父文件夹（`parent_id`），以便以后对齐 Raindrop 的嵌套；M4 界面可以先当扁平列表用。
- 停用/删除规则比场景宽松：文件夹更多是位置。删除文件夹时，其中书签的 `folder_id` 置空，书签本身还在。不级联进回收站。

| 列 | API 名 | 类型 | 含义 |
| --- | --- | --- | --- |
| `id` | `id` | UUID | 文件夹身份证 |
| `name` | `name` | 文本 | 显示名 |
| `parent_id` | `parentId` | UUID，可空 | 父文件夹 |
| `sort_order` | `sortOrder` | 整数 | 顺序 |
| `raindrop_id` | `raindropId` | 文本，可空 | 通道侧编号，本版空着 |
| `created_at` / `updated_at` | 驼峰 | 毫秒 | 时间 |

同层名称建议唯一，便于挑选；不把重名当成错误的硬拦（实现时可警告）。

---

### 6.5 `tags` 与 `bookmark_tags` — 标签

**介绍**：回答「它是什么主题」。一条书签可以挂很多枚，也可以一枚没有。

**逻辑**：

- 标签按名称识别。同一实例内名称大小写不敏感唯一（`UE5` 与 `ue5` 视为同一个）。
- 删除标签 = 去掉这枚标签，并解开所有挂载；**不**删除书签。
- 标签不进「建议成员表」；系统建议某标签时走 `suggestions`，确认后再写 `bookmark_tags`。

`tags`：

| 列 | 类型 | 含义 |
| --- | --- | --- |
| `id` | UUID | 标签身份证 |
| `name` | 文本 | 显示名（用户怎么写怎么存） |
| `name_key` | 文本 | 规范化小写，用于去重 |
| `created_at` | 毫秒 | 时间 |

`bookmark_tags`：

| 列 | 类型 | 含义 |
| --- | --- | --- |
| `bookmark_id` | UUID | 书签 |
| `tag_id` | UUID | 标签 |
| `source` | 文本 | `user` / `ai_accepted` |
| `created_at` | 毫秒 | 挂上的时间 |

主键：`(bookmark_id, tag_id)`。

---

### 6.6 `suggestions` — 系统建议（尚未成为归属）

**介绍**：这是「建议先行」能成立的关键。系统可以在保存后理解书签，准备「它像工作研究、像 UE5」；这些话先写在这里。用户点确认，才抄到 `bookmark_scenes` / `bookmark_tags` / `bookmarks.folder_id`。

**逻辑**：

- 低把握也可以不写建议（没有行 = 不打扰）。高把握只影响以后界面上显不显眼，**绝不**因为把握高就直接改归属。
- 一条书签可以同时有多条待处理建议（一个场景 + 两个标签 + 一个文件夹）。
- 状态：`pending`（待你处理）/ `accepted`（已按它写入归属）/ `deferred`（稍后）/ `dismissed`（忽略）。
- 已接受的建议行保留，便于「这项是 AI 建议来的」追溯；真正的归属仍以成员表为准。
- 隐私书签（`private = 1`）本版**可以**写建议，但默认不把该书签送进任何「组织记忆」（组织记忆是近期需求，本表不承担）。

| 列 | API 名 | 类型 | 含义 |
| --- | --- | --- | --- |
| `id` | `id` | UUID | 建议编号 |
| `bookmark_id` | `bookmarkId` | UUID | 针对哪条书签 |
| `kind` | `kind` | 文本 | `scene` / `folder` / `tag` |
| `target_id` | `targetId` | UUID，可空 | 建议已有对象时填 |
| `target_label` | `targetLabel` | 文本，可空 | 建议一个还不存在的名字时填 |
| `confidence` | `confidence` | 实数 0–1，可空 | 仅供排序/展示，不触发自动写入 |
| `rationale` | `rationale` | 文本，可空 | 一两句为什么这么建议 |
| `status` | `status` | 文本 | `pending` / `accepted` / `deferred` / `dismissed` |
| `created_at` | `createdAt` | 毫秒 | 提出时间 |
| `resolved_at` | `resolvedAt` | 毫秒，可空 | 接受/忽略/稍后的时间 |

**落地规则**（写代码时按此，不要另发明）：

1. 接受场景建议：若 `target_id` 有值，向 `bookmark_scenes` 插入 `source = ai_accepted`；若只有名字，先建场景再挂。
2. 接受标签建议：同上，写 `bookmark_tags`。
3. 接受文件夹建议：设置 `bookmarks.folder_id`（一条只能有一个，接受即替换，并记操作日志）。
4. 未接受之前，成员表与 `folder_id` 不变。

---

### 6.7 `access_records` — 访问记录

**介绍**：记下「我打开过它」。这是 Rediscover（最近打开、以后的长期未访问）的原料。本版界面可以没有独立「历史页」，但打开原文时必须落行。

**逻辑**：

- 只追加，不改写旧行。
- 只在用户明确打开原链接或（以后）打开快照时记。预览面板扫一眼不记。
- `source` 表示打开的是原文还是快照，不是录入来源（录入来源在书签的 `source`）。
- 打开记录不入 Raindrop。
- 书签进回收站后，访问记录仍留着；书签被彻底清空时一并删掉（避免无主流水）。
- 每次追加后，回写该书签的 `last_opened_at`。

| 列 | API 名 | 类型 | 含义 |
| --- | --- | --- | --- |
| `id` | `id` | UUID | 这条打开记录 |
| `bookmark_id` | `bookmarkId` | UUID | 打开的是哪条 |
| `opened_at` | `openedAt` | 毫秒 | 打开时刻 |
| `source` | `source` | 文本 | `original`（原文）/ `snapshot`（快照；本版可暂不产生） |
| `client` | `client` | 文本 | `workbench` / `navigation` / `plugin` / `unknown`，默认 `workbench` |

M2 已有前四列；`client` 为新增，旧行视为 `workbench`。

---

### 6.8 `operation_log` — 操作留痕

**介绍**：谁对哪条记录做了什么。用来事后看、用来撤回 AI 写错的结构、用来证明 Agent 真的保存过。不是给用户当日记写的。

**逻辑**：

- 所有**改变账本**的动作都要记：新建、改字段、改归属、进回收站、恢复、清空、接受建议。
- 只读（列表、搜索、打开记录本身）不记操作日志；打开走访问记录。
- Agent 保存即使只存了一个 URL，也必须有一行，`actor = agent`。
- 保留策略默认 5000 条或 30 天（可配），循环覆盖最旧的。不在每行上存到期日。
- `revert_token` 预留给「一键撤回这次写入」；本版可空，M4 再接撤销。

| 列 | API 名 | 类型 | 含义 |
| --- | --- | --- | --- |
| `id` | `id` | UUID | 日志编号 |
| `actor` | `actor` | 文本 | `user` / `agent` / `system` |
| `action` | `action` | 文本 | `create` / `update` / `delete` / `restore` / `purge` / `accept_suggestion` / `dismiss_suggestion` / `attach` / `detach` |
| `target_type` | `targetType` | 文本 | `bookmark` / `scene` / `folder` / `tag` / `suggestion` |
| `target_id` | `targetId` | UUID | 对象编号 |
| `detail` | `detail` | JSON 文本 | 改了哪些字段、旧值新值（不含密钥） |
| `revert_token` | `revertToken` | 文本，可空 | 撤回凭证 |
| `created_at` | `createdAt` | 毫秒 | 时间 |

---

### 6.9 `settings` — 实例设置

**介绍**：这一份 DogEar 自己的开关，不是书签。密码、Skill 口令摘要、能力开关、回收站天数都放这里。

**逻辑**：

- 键值表。值用 JSON 文本，按键解释。
- **禁止**把明文口令、Raindrop Token、Skill Token 写进来。Skill 口令只存单向摘要。工作台登录密码本版仍可只来自环境变量；若以后改存库，同样只存摘要。
- 读设置的接口不得把摘要当密码返回。

建议键（可随实现增减，键名稳定即可）：

| 键 | 含义 |
| --- | --- |
| `skill.token_hash` | Skill 口令摘要 |
| `skill.capabilities` | 三级能力开关，见 API 文档 |
| `recycle.retention_days` | 回收站保留天数，默认 7 |
| `operation_log.retention_days` | 日志按天保留，默认 30 |
| `operation_log.max_rows` | 日志条数上限，默认 5000 |

主键：`key`。另有 `updated_at`。

---

### 6.10 `archive_jobs` — 归档任务（占位）

**介绍**：产品上「保存链接」和「截一份网页」是两件事。截网页失败，链接仍在。Skill 若说「顺便截一下」，本版只登记一个待办，**不声称文件已经生成**。

**逻辑**：

- 本表只证明「有过这个请求、现在进行到哪」。网页文件、存储位置是 M6 的事。
- `type` 本版只允许 `snapshot`（`metadata` 以后抓标题用，列预留；`reader` 远景，本版拒绝）。
- Skill / 无浏览器环境：状态记 `pending`，结果语义是「等有浏览器的一端补做」，对应接口里的 `queued_pending_browser`。
- Job 失败不回头去删书签。

| 列 | API 名 | 类型 | 含义 |
| --- | --- | --- | --- |
| `id` | `id` | UUID | 任务编号 |
| `bookmark_id` | `bookmarkId` | UUID | 为哪条书签 |
| `type` | `type` | 文本 | `snapshot` / `metadata` |
| `source` | `source` | 文本 | `agent` / `browser` / `server` / `manual` |
| `status` | `status` | 文本 | `pending` / `processing` / `completed` / `failed` / `cancelled` |
| `error` | `error` | 文本，可空 | `fetch_failed` / `parse_failed` / `timeout` / `quota` / `unknown` |
| `retry_count` | `retryCount` | 整数 | 默认 0 |
| `created_at` / `started_at` / `completed_at` | 驼峰 | 毫秒 | 生命周期 |

没有 `storage_location`。有了这一列，就等于开始做 M6。

---

## 7. 跨表规则（比单张表更重要）

### 7.1 保存成功

服务端插入 `bookmarks` 一行（正式 UUID）即成功。场景、标签、快照、建议都可以没有。IndexedDB / 页面内存不算成功。

### 7.2 四维怎么组合

| 动作 | 改哪 |
| --- | --- |
| 改处理状态 | 只改 `bookmarks.status` |
| 挂/摘场景 | 只改 `bookmark_scenes` |
| 改文件夹 | 只改 `bookmarks.folder_id` |
| 挂/摘标签 | 只改 `bookmark_tags` |
| 标星 | 只改 `bookmarks.important` |

一次整理可以同时改几项，但它们在账本里仍是独立栏。禁止用 Tag 冒充「工作要用」，禁止用状态冒充「稍后再读」。

### 7.3 建议落地

```text
suggestions.status = pending
        │
        ├─ 用户接受 → 写成员表或 folder_id（source = ai_accepted）
        │              suggestions.status = accepted
        │              记 operation_log
        ├─ 稍后     → suggestions.status = deferred（归属不变）
        └─ 忽略     → suggestions.status = dismissed（归属不变）
```

任何路径都**不会**在用户动手前改 `bookmark_scenes`。

### 7.4 回收站

- 进站：写 `deleted_at = 现在`，不物理删除，不改 `status`（恢复时还是进站前那个状态）。
- 列表/Inbox/搜索：默认 `deleted_at IS NULL`。
- 恢复：`deleted_at` 清空。
- 到期清空：硬删除书签行，并删除其场景挂载、标签挂载、建议、访问记录、未完成 Job。操作日志可保留（对象已不在，日志仍证明发生过删除）。
- 导出到 Raindrop 时（M5）默认不带回收站里的行。

### 7.5 场景停用与删除

| 动作 | 成员表 | 挑选器 |
| --- | --- | --- |
| 停用 | 不动 | 隐藏 |
| 删除（无成员） | 无 | 去掉该场景 |
| 删除（有成员） | 拒绝 | 提示先迁走或解绑 |

合并（把 A 的成员并入 B）本版只要求数据上做得到：改 `bookmark_scenes.scene_id`。专门的合并向导留在 Scene 细部，不挡表结构。

---

## 8. 查询怎么理解（给实现看的产品定义）

这些不是 SQL 教程，是「产品上的这个列表」等于账本上的什么条件。默认都排除回收站。

| 产品列表 | 条件 |
| --- | --- |
| Inbox | `status = unread` |
| 已确认 | `status = saved` |
| 搁置 | `status = archived` |
| 某场景下的书签 | 在 `bookmark_scenes` 有该 `scene_id`（停用的场景仍可如此筛） |
| 某文件夹 | `folder_id = ?` |
| 某标签 | 在 `bookmark_tags` 有该 `tag_id` |
| 标星 | `important = 1` |
| 最近收藏 | 按 `created_at` 倒序 |
| 最近打开 | `last_opened_at` 非空，按它倒序 |
| 未推送条数（状态栏） | `sync_status = pending` 的条数；直写真源成功后应为 0 |
| 回收站 | `deleted_at` 非空 |

搜索（标题 / URL / 标签名 / 备注）本版以服务端过滤为底；工作台端侧 MiniSearch 是 M4 的加速，不另建搜索表。不做网页正文全文索引。

基线：按 600 条书签考虑。为 Inbox、时间线、文件夹、标签挂载、场景挂载、打开记录准备普通索引即可，不必上独立搜索引擎。

建议索引：

- `bookmarks(status, created_at)`
- `bookmarks(deleted_at, created_at)`
- `bookmarks(folder_id)`
- `bookmarks(sync_status)`
- `bookmark_scenes(scene_id)`
- `bookmark_tags(tag_id)`
- `access_records(bookmark_id, opened_at)`
- `suggestions(bookmark_id, status)`
- `tags(name_key)` 唯一
- `operation_log(created_at)`

---

## 9. 以后怎么接（避免这轮把口封死）

| 以后 | 怎么接，而不改主体 |
| --- | --- |
| M5 通道 | 用 `raindrop_id` 做匹配键；另建 `sync_queue` / `conflict`，不要把通道状态写进 `status` |
| M5 端侧缓存 | Dexie 镜像这些表的结构，但保存成功仍以本账本为准 |
| M6 快照文件 | 新增 `archives` / `archive_records`；`archive_jobs.result` 指向它们。文件进对象存储 |
| M6 备份 | 新增 `backup_run` |
| M7 导航 | 新增规则表；求值时读书签 + 四维。Inbox 与私密默认不进导航 |
| 元数据抓取 | 可把 `archive_jobs.type = metadata` 跑起来，回写 title/excerpt/cover，不挡保存 |

---

## 10. 实现落点（工程，不改产品含义）

- 真源：Track B 本地 SQLite / Track A D1，同一套 Drizzle schema（`packages/db`）。
- 契约：Zod 放 `packages/shared`，与列含义一致。
- 迁移：在 M2 的 `0001_m2_data_layer.sql` 之后追加，**加列 + 建新表 + 写入四个默认场景**。已有书签行用默认值填新列。
- 本包仍然不含 Dexie。

---

## 11. 还没写进表、也不该在实现时擅自加的

- 主场景（Primary Scene）——已决不做。
- 用标签编码场景（例如 `_scene:`）——已决不做。
- 把建议写成 `bookmark_scenes.source = ai_suggest` ——与建议先行冲突。
- URL 唯一约束 ——与「本版保存时不去重」冲突。
- 多用户 / 工作区。

Scene 的合并向导、AERR 如何改变工作台按钮文案、建议在四种界面上怎么画，仍然看 [Scene / AI 细部](../docs/modules/Scene-AI与待设计细部.md)。那些是交互问题；账本已经能撑住「挂上 / 没挂上 / 只是建议」。
