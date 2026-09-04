<!-- 项目名：DogEar · 折耳书签 -->

> **产品名**：DogEar · 折耳书签
> **文档**：开发计划
> **版本**：v0.1
> **日期**：2026-09-03
> **状态**：草案
> **权威级别**：执行计划（临时规则）。服从需求总纲与技术总纲，不得与二者冲突。

> **唯一需求源**：[`wiki/DogEar-需求总纲.md`](../wiki/DogEar-需求总纲.md)
> **技术口径**：[`wiki/DogEar-技术总纲.md`](../wiki/DogEar-技术总纲.md)（v1.0_DeepSeek，2026-09-03 修订）
> **冲突处理**：产品边界与过关标准以 PRD v1.0.7 为准；实现选型与保存/快照/双轨口径以技术总纲 2026-09-03 修订为准。本文只排期、拆任务、定验收，不另立需求，不复制字段树或 Raindrop 映射表。
> **分层用语**：过关 / 本期核心 / 近期 / 远景。不用 P0/P1/P2。
> **版本记录**：仓库根目录 [`CHANGELOG.md`](../CHANGELOG.md)。

***

# DogEar · 折耳书签 开发计划

## 0. 文档头与怎么用

### 0.1 本文是什么、不是什么

| 文档 | 路径 | 本文怎么用它 |
| --- | --- | --- |
| 需求总纲 v1.0.7 | `wiki/DogEar_折耳书签_需求总纲_v1.0.7.md` | 唯一需求源。做什么、不做什么、怎样算过关，一律回指这里。 |
| 技术总纲 v1.0_DeepSeek | `docs/DogEar_折耳书签_技术总纲_v1.0_DeepSeek.md` | 工程蓝图（栈、真源、双轨、Skill、快照口径）。实现选型回指这里。 |
| Scene / AI 细部 | `docs/modules/20260904_Scene-AI与待设计细部.md` | 四维组织与建议先行的未决细部。M4 开工前读，不在本文展开。 |
| 数据库设计 | `docs/modules/20260904_数据库设计.md` | 给人看的账本设计说明。不进 wiki。 |
| API 设计 | `docs/modules/20260904_API设计.md` | 给人看的窗口设计说明。不进 wiki。 |
| 数据库结构表 | `docs/数据库结构表.md` | 开发约束：建表/迁移只按此。 |
| API 结构表 | `docs/API结构表.md` | 开发约束：路由/Zod 只按此。 |
| 本文 | `docs/` 过程文档（本文件为草案） | **执行顺序、任务拆解、验收清单**。不是第二份 PRD，也不是第二份技术总纲。 |

定稿放 `wiki/`（禁止擅自改删）；过程与专项放 `docs/`、`docs/modules/`；过期稿放 `docs/archive/`（默认不读，除非任务点名）。根目录 `CHANGELOG.md` 每次改动最上追加一行。

### 0.2 怎么执行

1. **一次只做一个里程碑。** M2 未过关，不得开工 M4；M1 未过关，不得开工 M2。M4 可与 M3 末期重叠（见第 3 节），其余默认串行。
2. **新功能先确认再写代码。** 每个里程碑开工前，用该里程碑「开工前要向用户说清的一句话」讲清做什么、不做什么、关键取舍；用户点头后再动仓库。中途扩范围同样先说。
3. **过关路径优先。** M1 → M2 → M3 是框架站住的唯一路径。M4–M7 是本期核心，做完才像产品，但不计入「框架没站住」。
4. **每次改动写 CHANGELOG 一行**（无序列表，插在文件最上方）：`- YYYY-MM-DD / vX.Y.Z[ / <hash>] — 一句话`。代码与文档分开提交；中文 Conventional Commits；Git 身份匿名（GitHub noreply，禁止真实姓名/私人邮箱）。
5. **不要翻 `docs/archive/`** 当实现依据。落地细部不够时，在 `docs/modules/` 补专项，不要改 `wiki/`。

### 0.3 文档状态与修订

| 文档版本 | 应用版本 | 日期 | 摘要 |
| --- | --- | --- | --- |
| v0.1 | — | 2026-09-03 | 初稿：按 PRD v1.0.7 + 技术总纲 v1.0_DeepSeek（2026-09-03 修订）排出 M1–M7 全量执行计划 |
| v0.2 | — | 2026-09-03 | 对齐开源选用：M4 MiniSearch；M6 SingleFile（AGPL）+ monolith + metascraper；不自研 inliner |
| v0.2 | v0.2.0 | 2026-09-04 | 0.1 表补数据库设计、API 设计入口（M3/M4 核心契约草案） |
| v0.2 | v0.2.0 | 2026-09-04 | 账本与窗口升格 wiki 定稿；0.1 表路径改指 wiki |
| v0.2 | v0.2.0 | 2026-09-04 | 撤回误入 wiki 的注册；0.1 表路径改回 docs/modules |
| v0.2 | v0.2.0 | 2026-09-04 | 0.1 表区分设计说明（modules）与开发约束（docs 根目录结构表） |

本文档状态为**草案**。定稿进入 `wiki/` 须用户明确同意。

***

## 1. 目标与分层

### 1.1 产品一句话（执行时不要走偏）

DogEar 是**个人书签工具**：低成本把链接存下来，再按场景整理、再找回来。不是阅读器，不是笔记应用，不是知识库。Reader、高亮、正文编辑属远景，本计划不排期。

### 1.2 三层目标（本计划只排过关 + 本期核心）

| 分层 | 含义 | 本计划中的位置 |
| --- | --- | --- |
| **过关**（唯一门槛） | 框架站住：① 工作台能保存 Link；② Agent/Skill 能保存 Link。两处都没做成，才叫框架没站住。 | M2 = 过关 1；M3 = 过关 2。M1 是过关管道，本身不过关。 |
| **本期核心** | 要做，但不计入过关：Inbox/列表/搜索/⌘K/四维单条+批量/AI 建议四落点/回收站；访问记录先记；Snapshot 可勾选非默认；通道可选；三档备份；导航页网页形态；双轨可部署。 | M4–M7（M2 已含 Inbox、访问打点、鉴权）。 |
| **近期 / 远景** | 核心站住后再评估。 | **不排 Mx**。清单见第 6 节。 |

插件保存、导航页插件形态、看板、Rediscover 卡片均**不是过关，也不是本期 Mx 交付**。

### 1.3 保存成功口径（全里程碑共用，不得改写）

- 应用可达时：**成功 = 已写入服务端真源**（Track A 的 D1 / Track B 的 SQLite）。IndexedDB 只是缓存，写进缓存不算成功。
- 应用不可达：保存失败并提示。本版不承诺离线保存。
- **工作台**：允许乐观 UI（界面先出），但成功仍以真源落库为准；未推送条数必须可见。
- **Skill/Agent**：同步写真源，响应立即返回**稳定 UUID**；禁止 `tmp_` 后再改 id；路径**不得经过 IndexedDB**。
- Capture 默认只存 Link。Snapshot 可选、非默认；失败**不回滚** Bookmark。

字段级对齐、Raindrop 官方对象映射、Scene/Status 不写回等口径见技术总纲，本文不复述对照表。

### 1.4 双轨部署（一份代码、两种运行）

| 轨 | 默认 | 运行时 | 真源 | 内容存储 |
| --- | --- | --- | --- | --- |
| **Track A** | 是 | Cloudflare Workers + Pages | D1 | R2（S3 API） |
| **Track B** | 否 | Docker（Bun 或 Node） | SQLite | 本地卷或 MinIO 等 |

两轨互斥二选一。同一实例不要求同时跑两套。`packages/db` 启动时选驱动；业务代码不感知 D1 还是 SQLite。本地开发默认走 Track B（本地 SQLite）。

整页 Snapshot 口径：

- Track A：浏览器里用 **SingleFile / single-file-core（AGPL-3.0，已接受）** 打当前 DOM 为单 HTML，再直传。单独成包。Agent 带 snapshot=true 时返回 queued_pending_browser，不得声称文件已存在。
- Track B：用 **monolith（CC0）** 按 URL 抓公开页。登录墙仍走浏览器 SingleFile。

### 1.5 工程栈（已定，本计划不重选）

工程栈已定，本计划不重选。详见技术总纲第 4 节。

shared 包用 Zod。db 包只用 Drizzle 管 D1 与 SQLite，不含 Dexie。Dexie 是独立镜像缓存，建议放在 web 应用或 cache 包。
前端 React 19 与 Vite。

***

## 2. 里程碑总表

| ID | 名称 | 目标 | 过关? | 依赖 |
| --- | --- | --- | --- | --- |
| M1 | 骨架 | 一条书签经服务端写入真源，工作台能读出。 | 否（管道） | 无 |
| M2 | 工作台能存 | 登录后把 Link 存进真源，刷新/换端仍在。 | 过关 1 | M1 |
| M3 | Agent 能存 | Skill 同步写真源并返回正式 id。 | 过关 2 | M2 |
| M4 | 工作台本期核心 | 工作台必须项走通。 | 本期核心 | M2 |
| M5 | 通道与同步 | 数据管理可选；真源仍是本应用。 | 本期核心 | M2 |
| M6 | 快照与备份 | 单 HTML 快照 + 三档备份。 | 本期核心 | M2 |
| M7 | 导航页 | 网页导航按规则圈选。 | 本期核心 | M2；M4 有帮助 |

**M1 主要交付 / 退出**

交付：workspace、最小 Bookmark 契约与表、双驱动冒烟、真 API 列表。
退出：重启后书签仍在；typecheck 通过。
不含：鉴权、通道、快照、AI、Dexie、插件、搜索。

**M2 主要交付 / 退出（过关 1）**

交付：密码页；保存表单；Inbox 列表；同步状态栏（未推送数）；打开即写访问记录；创建即稳定 UUID。
退出：登录后存一条 URL，刷新仍在；另一客户端能读到；应用不可达时保存失败并提示。

**M3 主要交付 / 退出（过关 2）**

交付：capabilities 自描述；七个 skill；Bearer；限速；审计；save_bookmark 同步真源返回稳定 id。
Track A 上 snapshot=true 只返回 queued_pending_browser。
退出：持 Token 保存一次得到 UUID，工作台立刻可见；无 Token 被拒。

**M4 主要交付 / 退出（本期核心）**

交付：搜索与筛选；命令面板；Scene/Status/Folder/Tag 单条与批量；AI 建议四落点（建议先行）；回收站 7 天；操作日志；首次引导可跳过 Raindrop。
退出：四维可改可批量；命令面板能搜到刚存的书签；600 条列表可操作。

**M5 主要交付 / 退出（本期核心）**

交付：Raindrop 导入导出；S3；WebDAV；sync_queue；客户端 1 分钟攒批；导入梳理页；冲突表本地优先；通道可跳过；引入 Dexie 镜像。
退出：未配通道仍能保存；配了能导入一次、导出一次；冲突本地赢。

**M6 主要交付 / 退出（本期核心）**

交付：Archive Job；有 DOM 时 **SingleFile** 产出单 HTML 并签名直传；无 DOM 时入队；Track B 可用 **monolith**；Metadata 用 **metascraper**；失败不回滚；轻/中/重备份；单条 HTML/MD 下载；Track A 不做默认 PDF。
退出：勾选快照得到一份内联资源的 HTML；Skill 勾选不谎称已生成；备份至少跑出轻档。

**M7 主要交付 / 退出（本期核心）**

交付：导航页路由；规则（全部 / 按规则-或 / 自定义搜索集 / 隐藏）；默认登录；接上 M2 访问记录展示；Docker 栏可轻量。
退出：登录可见圈定条目；未登录进密码页；私密与 Inbox 默认不出现。不要求插件新标签页。

### 2.1 读表说明

- **M1 到 M3 是过关路径。** 管道（M1）→ 工作台能存（M2）→ Agent 能存（M3）。这三程没走完，不要把精力换成通道、快照或导航。
- **M4 到 M7 是本期核心。** 做完才构成能整理、能通道、能保全、能当首页；任一项没做都不否定框架已站住。
- **近期不进本表**：看板 / dnd-kit、Rediscover 卡片、组织记忆、插件打磨、移动端。
- **远景不进本表**：Reader、Capture 时 URL 去重、导航页匿名公开、Markdown 轻量剪藏。
- 里程碑是**顺序**，不是工时承诺，不绑定日历周。

***

## 3. 计划表

下列「顺序」是粗粒序列，**不是工时或日历承诺**。不要把顺序 1 读成「第 1 周」。

### 3.1 阶段顺序

| 阶段 | 里程碑 | 建议顺序 | 依赖 | 并行可否 |
| --- | --- | --- | --- | --- |
| 过关管道 | M1 骨架 | 顺序 1 | 无 | 否，必须先做 |
| 过关 1 | M2 工作台能存 | 顺序 2 | M1 | 否 |
| 过关 2 | M3 Agent 能存 | 顺序 3 | M2 | 末期可与 M4 脚手架并行；Skill 保存实现不并行 |
| 本期核心 | M4 工作台本期核心 | 顺序 4 | M2 必须 | 可与 M3 收尾重叠 |
| 本期核心 | M5 通道与同步 | 顺序 5 | 真源+鉴权（M2） | 不可与 M2 并行 |
| 本期核心 | M6 快照与备份 | 顺序 6 | M2 的 DOM 保存路径 | 可与 M5 部分并行 |
| 本期核心 | M7 导航页 | 顺序 7 | M2 访问记录+鉴权 | 不建议早于 M4 |

各阶段主要产出与验收看什么：

- 顺序 1 / M1：真 API 最小读写。看一条书签重启后还在。
- 顺序 2 / M2：密码页 + 保存 + Inbox + 状态栏 + 访问打点。看登录保存、刷新/换端仍在。
- 顺序 3 / M3：well-known + 7 skills + Bearer。看 Token 保存返回稳定 UUID。
- 顺序 4 / M4：工作台必须项。看命令面板、四维、建议、回收站走通。
- 顺序 5 / M5：三通道 + sync_queue + Dexie。看跳过通道仍能用；导入/导出各一次。
- 顺序 6 / M6：Archive Job + SingleFile 单 HTML + 三档备份。看有 DOM 出文件；无 DOM 只入队；Link 不回滚。不自研 inliner。
- 顺序 7 / M7：网页导航 + 规则圈选。看登录打开；圈选结果与工作台配置一致。

**推荐串行**：M1 → M2 → M3（过关路径不断）。M4 可在 M3 Skill 联调后期切入工作台搜索/四维。M5 必须等真源和鉴权。M6 等 M2 的 DOM 保存路径，不必等 Skill 真的产出文件。M7 等访问记录已在写、场景数据能圈。

### 3.2 功能 × 里程碑矩阵

图例：✓ 本程交付；部分 = 薄实现或铺垫；— = 本程不做。

| 能力 | M1 | M2 | M3 | M4 | M5 | M6 | M7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 工作台保存 Link | 部分 | ✓ | — | — | — | — | — |
| Agent 保存 Link | — | — | ✓ | — | — | — | — |
| Inbox 列表 | 部分 | ✓ | — | ✓ | — | — | — |
| 鉴权（密码页） | — | ✓ | ✓ | — | — | — | ✓ |
| 访问记录 | — | ✓ | — | — | — | — | 部分 |
| 搜索 / 命令面板 | — | — | 部分 | ✓ | — | — | 部分 |
| Scene 四维 | — | — | 部分 | ✓ | — | — | 部分 |
| AI 建议四落点 | — | — | 部分 | ✓ | — | — | — |

| 能力 | M1 | M2 | M3 | M4 | M5 | M6 | M7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 回收站 7 天 | — | — | — | ✓ | — | — | — |
| 首次引导 | — | — | — | ✓ | ✓ | — | — |
| Raindrop / S3 / WebDAV | — | — | — | — | ✓ | 部分 | — |
| Snapshot 单 HTML | — | — | 部分 | — | — | ✓ | — |
| 三档备份 | — | — | — | — | — | ✓ | — |
| 导航页（网页） | — | — | — | — | — | — | ✓ |
| 插件 | — | — | — | — | — | — | — |
| Reader | — | — | — | — | — | — | — |
| 看板 / dnd-kit | — | — | — | — | — | — | — |

备注：插件、Reader、看板全表为 —（近期或远景，见第 6 节）。访问记录 M2 落库、M7 接展示；卡片属近期。命令面板在 M4；导航顶栏下拉在 M7。Dexie 在 M5。M3 的 search/list/suggest 可为薄实现。

***

## 4. 各里程碑详细拆解

执行纪律：每一程都写清「本程做 / 明确不做」。不要把下一程的表、通道、快照提前做进本程，除非该程验收显式要求。

---

### 4.1 M1 骨架

#### 目标

把仓库变成：一条 Bookmark 经服务端同步写入真源，工作台用真 API 读出来。这是过关管道，不是过关本身。

#### 依赖

无。原型目录只作视觉参考，不把 mock 数据带进正式工程。

#### 本程做

- 初始化四包 workspace。
- Bookmark 最小契约与最小表：url、稳定 id、默认 unread。
- 本地 SQLite 迁移跑通；D1 适配器至少冒烟。
- 服务端创建与列表同步写真源；无队列、无端侧缓存。
- web 输入框加列表打真实 API，无 mock。
- 进程重启后数据仍在。

#### 明确不做

鉴权、Raindrop、快照、AI、Dexie、插件、搜索、Scene、回收站、导航页、访问记录、同步状态栏。M1 不要引入第二套存储。

#### 任务清单

1. 根目录 workspace 配置；四包能安装且互相引用。
2. packages/shared：Bookmark Zod 最小对象（id 为 UUID、url、status 默认 unread）。本程不铺四维与 Raindrop 字段。
3. packages/db：Drizzle bookmarks 最小表（id、url、status、时间戳）加 SQLite 迁移；本包不含 Dexie。
4. D1 驱动接线冒烟：同一 schema 在本地 SQLite 与 D1 各跑一次插入/查询。
5. apps/server：Hono 入口；创建接口由服务端生成 UUID 并同步插入；列表按时间倒序。

6. apps/web：Vite + React 19 最小页，请求真 API，禁止 fixture。
7. 开发脚本：server 与 web 的 dev，以及根 typecheck。
8. README 三条（安装、启动、数据文件位置）；根 CHANGELOG.md 建好。
9. 一条真实 URL 走完创建、列表、停进程、再列表，确认落在 SQLite 文件。

#### 验收标准

- 提交一条 URL，列表出现该条，id 为 UUID。
- 停掉 server 再启动，列表仍返回该条。
- 工作台列表来自 API，不是写死数组。
- typecheck 通过。
- 仓库中无 Dexie、无鉴权中间件、无 Raindrop 客户端。

#### 开工前要向用户说清的一句话

> M1 只搭四包和真源读写一条 Bookmark；不做登录、缓存、通道、快照。

---

> **Dexie 落点（明确）**：M1 禁止；M2 不引入；M5 作为真源镜像缓存引入。理由：M2 过关看的是真源落库，缓存会把「成功」口径搅浑；M5 才有攒批窗口和未推送的真实来源。

---

### 4.2 M2 工作台能存（过关 1）

#### 目标

过关门槛之一：登录后的工作台能把 Link 存进真源；刷新和其他设备仍在。Inbox 可看见刚存的待处理项。访问打开开始记。未推送可见。

#### 依赖

M1 退出标准全部勾上。

#### 本程做

- 工作台鉴权：密码页（公网最小实现；URL Token / IP 白名单可留设置位）。
- 保存表单：必填 URL；可选 note；本程不要 Snapshot 开关。
- Inbox：status=unread 列表。
- 创建即稳定 UUID；禁止事后改 id。
- 同步状态栏：未推送条数常驻；若每次都等真源 ACK，则未推送可为 0，但栏必须存在。
- access_log：打开原链接时写一条（bookmarkId、openedAt、source=original）。Rediscover 卡片不做。
- 应用不可达：保存失败提示，不把只写在内存/草稿当成功。

#### 明确不做

Dexie（推荐放到 M5，与 sync_queue / 1 分钟攒批一起上；M2 工作台直打 API，乐观 UI 用内存即可）。Skill API、Raindrop、Snapshot、AI 建议、命令面板、Scene 表、回收站、插件、导航页。

#### 任务清单

1. apps/server 鉴权中间件：工作台写接口需登录；密码来自环境变量/设置；未登录 401。会话选最简单可工作的一种，写进 docs/modules 一小段，不改 wiki。
2. apps/web 密码页：未登录进保存页会被拦；登录后进工作台。
3. 保存表单：URL 必填、note 可选；成功后列表插入；失败提示。乐观 UI 允许，ACK 失败必须回滚或标失败。
4. Inbox 视图：只列 unread 且未软删；空状态一句引导。
5. 真源确认：保存响应含正式 id；刷新后记录仍在。
6. 同步状态栏：展示未推送数；本程值为已提交未收到成功的条数。不得隐藏。
7. packages/db 增 access_log 最小表；打开动作打点。不去噪、不做长期未访问 UI。
8. 不可达路径：停 server 再保存，UI 明确失败。
9. 换端验证：另一浏览器登录后能看到第一条书签。
10. operation_log 本程可只记 user 保存；完整日志在 M4。

#### 验收标准

- 未登录不能保存。
- 登录后保存一条 Link，刷新仍在，id 不变。
- 另一客户端登录后能读到。
- Inbox 能列出该条（默认待处理）。
- 打开该书签原链接后 access_log 有行。
- 状态栏能看到未推送数（可为 0）。
- server 关掉时保存失败，不出现已保存假成功。
- 无 Dexie 依赖（若评审坚持提前引入，须用户确认，且仍不得把端侧缓存当成功）。

#### 开工前要向用户说清的一句话

> M2 做密码页、保存表单、Inbox 和访问打点，过关看「真源里有这条且刷新还在」；本程不上 Dexie、不上 Skill、不上快照。

---

### 4.3 M3 Agent 能存（过关 2）

#### 目标

过关门槛之二：AI 平台用 Base URL + Bearer 调 save_bookmark，同步写入真源，马上拿到稳定 UUID；工作台立刻能看见。Track A 上若带 snapshot=true，只入队等待浏览器，不谎称文件已生成。

#### 依赖

M2 过关（真源 + 工作台能读刚写入的书签）。Skill Token 与工作台密码分开。

#### 本程做

- GET /.well-known/capabilities：能力清单、参数 schema、限速与边界说明。
- 七个 skill 均可调用（与需求总纲同名）：save_bookmark、search_bookmarks、update_bookmark、list_bookmarks、get_stats、trigger_archive、suggest_scene。
- Bearer 鉴权；读/写/批量分限速（可配阈值与 429）。
- 写操作记 operation_log，actor=agent。
- save_bookmark：同步写真源，响应含正式 id；默认不写 Scene/Folder/Tag；snapshot 默认 false。
- Track A：snapshot=true → 建 Job 或占位，返回 snapshotStatus=queued_pending_browser；不得出现已有快照文件语义。
- 其余六个 skill 做最小可用：search/list 走真源简单过滤；update 单条；stats 计数；trigger_archive 建 Job 不抓页；suggest_scene 可返回空建议（不写结构）。

#### 明确不做

整页 Snapshot 文件（M6）、Raindrop、Dexie、工作台命令面板与四维 UI、导航页、插件、AI 自动挂 Scene。

#### 任务清单

1. apps/server：capabilities JSON（技能名、输入字段、是否写操作、限速提示）。该端点是否要求 Token 选定后写进 modules 一句。
2. Skill 路由统一 Bearer；错误体 {code, message}；与通道 Token 分环境变量。
3. save_bookmark：校验 url 必填；服务端生成 UUID；插入真源；source=agent；status=unread；不经 IndexedDB。
4. 响应契约：id 为 UUID；snapshot true 时带 queued_pending_browser（Track A）。
5. 其余六 skill 与 capabilities 登记一致；未实现的行为返回明确错误，禁止静默空成功（空建议算合法）。
6. 限速中间件：写操作单独计数；超限 429；至少打日志。
7. operation_log 表（若 M2 未建则本程建）：Agent 保存必有行。
8. 联调：带 Token 保存 → 打印 id → 工作台 Inbox 出现；不带 Token → 401。
9. trigger_archive 只插入 Job 行（pending），不抓 URL，避免滑进 M6。
10. docs/modules 一页 Skill 联调说明。不改 wiki。

#### 验收标准

- capabilities 列出全部 7 个 skill。
- 无效 Bearer 则写接口失败。
- save_bookmark 返回的 id 是 UUID，随后工作台能读到同一行，id 不再变化。
- 响应里没有 tmp_ 前缀 id。
- Track A 调用 snapshot=true 时 snapshotStatus=queued_pending_browser，对象存储中没有新快照文件。
- operation_log 有 actor=agent 的保存记录。
- 限速可触发 429（可用测试阈值验证）。

#### 开工前要向用户说清的一句话

> M3 把七个 Skill 挂上并让 save_bookmark 同步落真源、立刻返回正式 UUID；快照只入队不产文件，建议类接口不自动改结构。

---

### 4.4 M4 工作台本期核心

#### 目标

把工作台补到需求总纲「核心必须有」的样子：能找、能筛、能改四维、能看 AI 建议、能回收、有操作日志、首次使用不逼登录 Raindrop。不计入过关门槛。

#### 依赖

M2 必须。M3 不必须；可与 M3 末期并行。Scene 细部读 docs/modules/20260904_Scene-AI与待设计细部.md，有冲突停下来问，不改 wiki。

#### 本程做

- 列表搜索：标题 / URL / 标签 / 备注，端侧用 **MiniSearch**；筛选：来源、Scene、Folder、Tag、状态、时间。不做正文全文索引，不做自然语言检索。
- 工作台命令面板（⌘K）。
- Scene / Status / Folder / Tag：数据而非枚举。Scene 可建/改/停用；默认四条预设可改名。Bookmark 与 Scene 多对多。Capture 仍不要求选 Scene。
- 单条修改 + 批量修改（Scene/Folder/Tag/状态/软删）。四维互不改写。
- AI 建议四个落点：输入时、整理时、Inbox 内、未整理详情。一律建议先行，确认才写结构。无模型时也要有建议槽位 + 确认按钮。
- 回收站：软删，默认 7 天，恢复与清空。
- 操作日志可查看；写操作留痕；底部撤销至少覆盖本程批量/删除。
- 首次运行向导：数据管理可选、可跳过、不出现强制登录 Raindrop。通道真正接线在 M5。

#### 明确不做

看板 / dnd-kit、独立整理模式作为过关、死链/域名统计工具、插件、Raindrop 真导入、Snapshot 抓取、导航页、Rediscover 卡片、组织记忆。

#### 任务清单

1. shared + db：Scene 表、Folder、Tag、bookmark_scene 关系；Status 仍用 unread/saved/archived。种子四条默认 Scene。
2. 服务端：Scene CRUD；单条修改；批量修改（限长、逐条日志、可整体撤销）。
3. apps/web 列表：筛选条；空状态。600 条基线用游标分页或虚拟列表，保证可操作（不设硬性毫秒阈值）。
4. 命令面板：MiniSearch 按标题/URL/标签/备注检索并跳转/选中。不要自研倒排。
5. 单条与批量改四维的 UI。改 Status 不动 Scene。
6. AI 建议四落点组件：同一 Suggestion 模型；确认才写入；无后端时返回空建议，UI 不崩。
7. 回收站页：列出软删、恢复、清空；7 天清理（轻量定时或启动时扫；失败不挡保存路径）。
8. 操作日志页或抽屉：过滤 actor；写操作可点撤销。
9. 首次引导向导：可跳过落地为未配置通道。
10. 性能：600 条数据下列表滚动与搜索可用；非核心请求不得堵住保存。

#### 验收标准

- 命令面板能找到刚保存的书签。
- 可新建 Scene，把它挂到书签上，再摘掉；无需改表结构。
- 批量改状态 / 打标签成功，操作日志有记录，可撤销或进回收站再恢复。
- 四个建议槽位都在；未确认前数据库结构字段不变。
- 删除进回收站，7 天口径有配置位；恢复后可见。
- 首次启动不出现强制 Raindrop 登录。
- 无看板依赖（dnd-kit 不进本期核心栈）。

#### 开工前要向用户说清的一句话

> M4 把工作台补成能搜、能改四维、能看建议、能回收；建议一律确认才写；向导可跳过且不逼 Raindrop；不做看板和插件。

---

### 4.5 M5 通道与同步

#### 目标

Raindrop / S3 / WebDAV 成为可选项。不配照样能保存。配了能导入、能导出、能进梳理页。本地与真源对账有队列；冲突本地优先。本程引入 Dexie 镜像缓存。

#### 依赖

M2（真源 + 鉴权）。建议 M3 已过。M4 的整理能力会被导入梳理页复用。

#### 本程做

- 通道配置：Raindrop（输入源和/或导出方向）、S3、WebDAV；凭证密文存储，不入日志、不入仓库。
- sync_queue：顺序消费；429 指数退避（1s/2s/4s 封顶）。
- 客户端攒批推送，合并窗口默认 1 分钟（可配）；页面隐藏/卸载尽力 flush。未推送条数接 M2 状态栏。
- Dexie 镜像：schema 与真源对齐但独立维护；首屏可读缓存；保存成功仍以真源为准。Skill 路径继续绕过 Dexie。M1/M2 不上 Dexie，本程才上。
- Raindrop：首次导入可选进 Inbox 或保持原路径；导入梳理页复用 M4 能力，可跳过；梳理后新来的零散记录进 Inbox。导出 Link 级，不写 Scene/Status，回收站默认不进存档。字段名对齐官方对象，对照表只查技术总纲。
- 冲突表：保留两端，本地赢，用户可单条/全部合并。
- 首次/设置里通道步骤仍可跳过。

#### 明确不做

默认双向同步、把 Scene 写入 Raindrop、把 Raindrop 当多端真源、端对端互同步、插件同步。

#### 任务清单

1. packages/db：sync_queue、conflict、channel_config（凭证引用而非明文）。
2. apps/web 或 packages/cache：Dexie 镜像；启动 hydrate。禁止在 packages/db 里塞 Dexie。
3. 客户端 flush：1 分钟窗口 + 页面隐藏/卸载；状态栏绑定队列长度。
4. Raindrop 适配器：导入（增量）、导出（Link 级）。Scene/Status/软删不写回。
5. 导入梳理页：路由独立，复用 M4 批量与建议；可跳过。
6. S3 通道：配置与一次对象读写冒烟（备份/快照在 M6 真正用）。
7. WebDAV 通道：配置与一次文件写入冒烟。
8. 冲突 UI：保留本地 / 采用远端 / 稍后。
9. 设置页：三通道开关；未启用时保存路径零调用第三方。
10. 失败注入：断开 Raindrop 再保存，Bookmark 仍进真源，状态栏提示通道失败。

#### 验收标准

- 未配置任何通道，工作台与 Skill 保存仍成功。
- Raindrop 导入至少一次，梳理页可跳过；导出一次且不含 Scene/回收站。
- 1 分钟窗口内未 flush 的条数在状态栏大于 0，flush 后归零。
- Dexie 只作镜像：清掉端侧缓存后从真源能再拉回；Skill 保存不写端侧缓存。
- 冲突记录本地优先。
- 首次/设置可跳过通道。

#### 开工前要向用户说清的一句话

> M5 把 Raindrop/S3/WebDAV 做成可跳过的通道，并上 Dexie 镜像和 1 分钟攒批；真源仍是本应用，Scene/Status 不写回 Raindrop。

---

### 4.6 M6 快照与备份

#### 目标

Snapshot 成为可勾选、非默认、失败不回滚的内容保全：有 DOM 时用 SingleFile 产出单 HTML；无 DOM 时入队。Track B 可用 monolith。Metadata 用 metascraper。三档备份可跑。Track A 不把 PDF 当默认能力。不自研 inliner。

#### 依赖

M2 的工作台 DOM 保存路径。M3 的 queued_pending_browser 语义直接沿用。内容存储可用 M5 的 S3/R2 客户端。

#### 本程做

- Archive Job 状态机：pending → processing → completed 或 failed（可 retry/cancel）。Job 失败不等于 Bookmark 失败。
- 工作台保存增加 Snapshot 开关，默认关。
- Track A / 有 DOM：浏览器调 **SingleFile** 打成单 HTML，签名直传到 R2（或 S3 API）；服务端只编排 + 写 Archive Record。SingleFile 核心单独成包，不把 AGPL 编进 Hono/Drizzle。
- 无 DOM（Skill/Agent）：继续 queued_pending_browser，等浏览器补做；Track B 用 **monolith** 按 URL 抓公开页（登录墙仍须浏览器）。
- 归档四操作：查看 / 下载 / 重新抓取 / 上传替换。无文本编辑。
- 三档备份：轻（Netscape HTML / CSV / Markdown）、中（+配置）、重（库 + Snapshot + 配置 ZIP）。导出前可按全部/文件夹/标签/状态/时间圈范围。
- 单条导出：先选内容再选格式；默认 HTML 与 Markdown。PDF：浏览器打印，或不在 Workers 上做。

#### 明确不做

Reader、手动选正文、Track A 无头浏览器、自研 HTML inliner、目录分包/mhtml 作为默认、默认开启 Snapshot、把快照失败做成保存失败。

#### 任务清单

1. 表：archive_job、archive、archive_record、backup_run。Job.type 含 metadata 与 snapshot（reader 仅预留）。
2. Metadata Job：保存后用 **metascraper** 异步补标题/摘要/封面等，失败不影响 Link。
3. 工作台 Snapshot 开关 + 接入 **SingleFile**（单独包）；不手写资源内联。
4. 签名直传：server 签发 → browser 直传 → server 写 Record。
5. Skill snapshot=true 与 trigger_archive：Track A 入队；工作台打开该书签时可补做。
6. 失败分类：fetch/parse/timeout/quota；卡片状态位；重试/取消接口。
7. 备份引擎：轻档 Netscape HTML；中档加 settings；重档打 ZIP；历史列表。
8. 单条下载 HTML/MD；明确不提供 Workers PDF 端点。
9. 回归：勾选快照但合成抛错 → Bookmark 仍在，Job failed。
10. Track B：接 **monolith** 按 URL 产出单 HTML，默认关；文档注明与 SingleFile 路径的差异。

#### 验收标准

- 默认保存不产生快照对象。
- 工作台勾选快照且页面 DOM 可用：对象存储中有一份单 HTML。
- Skill snapshot=true：无新文件，状态为 queued；Link 已存在。
- 快照失败后 Bookmark 仍在，url 不变。
- 能下载该 HTML；能跑出轻档备份文件。
- Track A 代码路径无生成 PDF 的默认实现。

#### 开工前要向用户说清的一句话

> M6 做可选快照和三档备份：有 DOM 用 SingleFile 出单 HTML，Agent 只入队，Track B 用 monolith；失败不回滚 Link；不自研 inliner；Workers 上不做默认 PDF。

---

### 4.7 M7 导航页

#### 目标

网页形态的个人导航能打开：展示范围由规则/工具圈定（全部 / 按规则-或 / 自定义搜索集 / 隐藏），不是逐条点选。默认登录。M2 已在写的访问记录在本程接上展示（最近打开即可，不做卡片产品）。

#### 依赖

M2 鉴权与 access_log。M4 的 Scene/筛选让规则有东西可圈；没有 M4 也能做全部/隐藏，但不建议提前开工。

#### 本程做

- apps/web 增加导航路由（可与工作台同包不同入口）。
- 规则引擎：全部 / 按规则（或） / 自定义搜索勾选 / 隐藏；求值结果持久化为展示集合。
- 默认与工作台同一登录会话；未登录进密码页。匿名公开不做。
- 打开导航项时继续写 access_log；导航上可显示最近访问的简单列表（不是 Rediscover 卡片组件）。
- Docker 栏：可选轻量快捷栏，配置存本地/导航配置，不占网格。完整视觉打磨不挡本程。
- Inbox/待处理、私密、规则排除的条目默认不出现。

#### 明确不做

插件新标签页、匿名全库公开、逐条勾选作为唯一圈选方式、Rediscover 卡片、小组件打磨、行列布局精修。

#### 任务清单

1. navigation_rules 与展示集合存储；关闭导航不丢规则配置。
2. 工作台侧规则编辑 UI（四种模式）。
3. 导航接口返回求值后的条目（标题、图标、URL；不含笔记/Inbox 私货）。
4. 导航页网格：可点击直达原链接；记录访问。
5. 默认登录中间件复用 M2；无会话不渲染条目。
6. 私密标记默认过滤（字段若尚未有则预留 filter）。
7. 顶栏轻量搜索（下拉，不是工作台命令面板的完整版）。
8. Docker 栏：本地配置可空实现但数据结构在。
9. 与工作台配置一致性测试：规则改为隐藏某 Folder 后导航不再出现。
10. 不引入浏览器插件作为本程交付。

#### 验收标准

- 未登录打开导航 URL 进入密码页。
- 登录后只看到规则圈定的条目，能点进原站。
- 改规则后刷新导航，集合变化与配置一致。
- 点击写入 access_log（M2 表）。
- 无浏览器插件交付物作为本程验收项。

#### 开工前要向用户说清的一句话

> M7 做登录态网页导航和规则圈选，把 M2 的访问记录接上展示；不做插件新标签页、不做 Rediscover 卡片、不开放匿名全库。

---

***

## 5. 工程约束（开发时必守）

- **应用为真源。** Raindrop / S3 / WebDAV 是可选通道。第三方中断不阻塞保存。
- **保存成功 = 服务端真源已落库**（D1 / SQLite）。IndexedDB / Dexie 只是镜像缓存。
- **两条 Capture 路径不要画成一条。** 工作台可乐观 UI + 异步对账；Skill/Agent 同步写真源，不经 IndexedDB，返回稳定 UUID，禁止 tmp_ 回填。
- **UUID 创建即稳定。** 工作台与 Skill 同一套 id 规则。
- **Link 与 Snapshot 解耦。** 默认只存 Link；快照可选；失败不回滚 Bookmark。

- **Snapshot 格式：单 HTML。** Track A 用 SingleFile（AGPL，单独成包）打当前 DOM 再直传；Agent snapshot=true 返回 queued_pending_browser。Track B 用 monolith 按 URL 抓公开页。Metadata 用 metascraper。搜索用 MiniSearch。不自研 inliner。PDF 不是 Track A 默认能力。引用清单见技术总纲 §14，可搬进 README。
- **packages/db 只用 Drizzle 管 D1/SQLite。** Dexie 独立；M1/M2 不上，M5 才上。
- **AI 建议先行。** 不自动写 Scene/Folder/Tag；不默认给 AI 删除/批量/改结构。
- **工作台 M2 起必须鉴权。** Skill 用独立 Bearer。导航页第一版默认登录。
- **访问记录从 M2 写。** Rediscover 卡片不在 M1–M7。
- **回收站默认 7 天。** 搁置不等于删除，也不等于已 Snapshot。
- **性能基线 600 条 Bookmark**（基线不是上限）。保存与搜索不得因非核心功能失败。
- **首次运行不强制 Raindrop。** 通道可跳过。

- **字段名与 Raindrop 官方对象对齐**以便导入导出；Scene/Status 不写回。细节只查技术总纲，不在业务 PR 里复制对照表。
- **中文 Conventional Commits**；Git 身份匿名（noreply）；不提交密钥、.env、本地库、上传文件、测试素材。
- **CHANGELOG**：每次改动在根目录文件最上方追加 `- YYYY-MM-DD / vX.Y.Z — 一句话`。
- **wiki/ 冻结**除非用户同意。新设计进 docs/modules/。docs/archive/ 默认不读。
- **新功能：先用几句话讲思路，用户确认，再写代码。** 一次只推进一个里程碑（M4 与 M3 末期重叠除外）。
- **产品边界：** 书签工具。不要把阅读器、笔记、知识管理的交互做进本期路径。

***

## 6. 本期不排期

下列能力不设 Mx、不进顺序表、不在执行中顺便做。核心路径（M1–M7）未退出前，遇到这些需求记到 docs/modules 或议题，不开工。

### 6.1 近期（核心完善后再扩展）

| 项 | 为什么现在不做 |
| --- | --- |
| 看板视图 + dnd-kit | 需求总纲写明非过关；拖拽会绑状态机，干扰列表过关。 |
| Rediscover 卡片 | 访问记录已在 M2 落库；卡片是展示产品，等导航与工作台稳定。 |
| 组织记忆 | 依赖建议先行用一段时间后的数据；本版只要浅理解建议。 |
| 浏览器插件保存 / 新标签页导航 | 加速形态，不挡网页工作台与 Skill。 |
| 独立整理模式、标签聚合、死链/域名统计 | 工具面板非过关；会稀释 Inbox 主路径。 |
| 更稳 Snapshot | M6 用 SingleFile/monolith 最小可用与失败不回滚，不自研打包器。 |
| 移动端 / Share Extension | 本版不优先。 |
| 自然语言检索 | 搜索先做标题/URL/标签/备注 + 结构化筛选。 |

### 6.2 远景（形态成型后再评估）

| 项 | 为什么现在不做 |
| --- | --- |
| Reader 清洗阅读版、高亮、批注、手动选正文 | 产品不是阅读器；Archive.type 仅预留。 |
| Markdown 轻量剪藏 | 与 Reader 同层的内容消费，不进 Capture 主路径。 |
| Capture 时 URL 去重 | 本版明确不做；重复保存不当产品规则。 |
| 导航页匿名公开 | 第一版默认登录；公开范围未作为本期决策。 |
| 高级 AI（自动分流、记忆联动推荐） | 与建议先行、不自动写结构冲突，需单独评估。 |
| Primary Scene、Raindrop 双向同步、把 Scene 写入 Raindrop | 与已定数据边界冲突。 |

***

## 7. 风险

| 风险 | 主要落在 | 现象 | 本计划中的对策 |
| --- | --- | --- | --- |
| D1 与 SQLite 方言差异 | M1 | 迁移、时间函数、JSON 行为不一致 | M1 就做双驱动冒烟；差异关在 packages/db 适配层，禁止业务 SQL 分叉。 |
| 国内访问时延 vs 缓存口径 | M2 / M5 | 首屏慢，或把端侧缓存误当成保存成功 | M2 直打真源、成功以 ACK 为准；M5 才上 Dexie 做读缓存；状态栏暴露未推送数。Skill 永不走缓存。 |
| Skill id 不稳定 | M3 | 先返回 tmp_ 再改成正式 id，外部 Agent 丢引用 | 服务端创建即 UUID；契约测试禁止 tmp_；工作台乐观 UI 也必须带着最终 id 去提交。 |
| 单 HTML 体积大 / 内联不全 | M6 | 文件过大、缺字体/图、动态站空白 | 用 SingleFile，不自研；验收看「有一份 HTML 对象 + 失败不回滚」，不看像素级还原；超大资源可降级省略并记 Job 警告。 |
| SingleFile AGPL 扩散 | M6 | AGPL 代码编进主栈，污染 Hono/Drizzle 许可 | 快照核心单独成包；服务端只收 HTML blob。 |
| Track A 无 PDF / 无头浏览器 | M6 | 有人按导出 PDF 做 Workers 方案，撑爆 CPU | 计划写死：浏览器打印或以后 Track B；M6 不接 PDF 库。 |

| 风险 | 主要落在 | 现象 | 本计划中的对策 |
| --- | --- | --- | --- |
| 通道拖死过关路径 | M5 提前 | Raindrop 联调占用 M2/M3 时间 | 顺序表强制过关路径串行；未配通道必须仍能保存，用失败注入验收。 |
| 范围膨胀（看板/插件/Reader） | 全程 | 顺便引入 dnd-kit、插件工程、阅读视图 | 第 6 节不排期；开工前一句话确认；发现冲突停写。 |
| 建议先行被做成自动分流 | M3 / M4 | suggest_scene 直接改 Scene 关系 | 无确认按钮不得写结构；单测覆盖「建议存在但关系表为空」。 |

---

*草案 v0.2 · 2026-09-03 · 执行时一次一个里程碑；过关只看工作台能存 Link 与 Agent 能存 Link。开源选用见技术总纲 §14。*
