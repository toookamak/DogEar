# DogEar · 折耳书签 技术总纲文档

> **版本**：v1.0_DeepSeek
> **日期**：2026-09-02
> **作者**：DogEar 项目组（匿名）
> **状态**：技术总纲（按 PRD v1.0.7 需求驱动重建；实现选型标注「✅已定 / ⏳暂定 / 💡方向性 / ❓待决策」）
> **对应需求文档**：需求总纲 v1.0.7（wiki/DogEar_折耳书签_需求总纲_v1.0.7.md，唯一需求源）
> **写作骨架**：docs/技术总纲文档范例.md（只读范例）
> **本版说明**：本文档以 v1.0_DeepSeek 命名，与既有 v0.2 稿作区分；撰写时不参考任何历史总纲/技术方案稿，从产品与技术双视角独立推导。PRD 附录 C（属性总表）已迁移承接至 §5.7 字段与 Raindrop 映射总表，字段级口径以本文为准。凡与旧落地文档口径冲突处，一律以 PRD v1.0.7 为准。
>
> **v1.0.8 口径修订（2026-09-03）**：保存入口拆分（工作台可缓存加速，Skill/Agent 同步写真源）；保存成功=落到服务端真源；Drizzle 只管 SQL 真源，Dexie 为独立镜像；Snapshot 优先单 HTML 文件；PDF 导出不作为 Track A 默认能力。

---

## 0. 阅读指南

### 0.1 文档定位

本文档是 DogEar 项目的**技术总纲**：把需求总纲（PRD v1.0.7）中已定稿的产品边界翻译成可执行的工程蓝图，说明"为什么这样设计、怎么落地、边界在哪、先做什么"。

- **需求源**：`wiki/DogEar_折耳书签_需求总纲_v1.0.7.md`（唯一需求源，冲突以它为准）。
- **细部承接**：字段、阈值、编码、布局等未决细部在 `docs/modules/Scene-AI与待设计细部.md`；本文不重复展开。
- **落地承接**：API、DATA_MODEL、DESIGN 等 Draft 文档多数仍写旧口径，仅作参考；技术口径以本文为准。

### 0.2 状态标记约定

本文统一使用下列标记，避免把"方向"写成"已定"：

| 标记 | 含义 | 使用示例 |
| --- | --- | --- |
| ✅已定 | 产品/技术方向已定稿，本期按此执行 | 双轨部署；端侧缓存 + 服务端真源 |
| ⏳暂定 | 有倾向但仍需验证或确认 | Docker 运行时选 Bun 或 Node |
| 💡方向性 | 方向认可，暂不落地或落地方式待评估 | KV 边缘缓存 |
| ❓待决策 | 悬而未决，需专题讨论 | 导航页展示规则算子的冲突语义 |

### 0.3 术语口径提示

- 需求分层用**核心需求 / 近期需求 / 远景规划**，本文不使用 P0/P1/P2。
- "Metadata"专指系统保存时自动抓取的网页描述字段；数据库里的结构化记录称"元数据"或直呼表名，不混用。
- "归档（Status 搁置）"与"Archive（内容保全副本）"是两件事，正文与 UI 禁止用"已归档"指代状态。
- "保存"是动作（Capture）；状态名只用 待处理 / 已确认 / 搁置。

---

## 1. 项目概述

### 1.1 项目背景

个人网页信息长期积累后普遍面临三类问题：**存下来太麻烦**（收藏时要分类）、**存完就乱**（固定文件夹/标签体系维护成本高）、**存完就丢**（检索与重新发现手段弱）。

DogEar（折耳书签）以"书签"为核心对象，围绕三个一级问题组织产品：

1. **好存（Capture）**：多入口零成本保存链接，不要求收藏瞬间做分类决策；
2. **好管理（Organize）**：系统理解用途与上下文，按"场景（Scene）"辅助分流，不依赖用户维护固定信息架构；
3. **好找/好重新发现（Rediscover）**：通过搜索、场景、最近收藏、访问记录、长期资料等让旧书签重新进入视野。

**产品事实（PRD §1.1 定稿）**：

- 应用数据始终为真源，**不依赖 Raindrop 即可完整使用**；Raindrop/S3/WebDAV 是可选数据管理通道（输入源和/或导出/备份方向），不是登录门槛。
- 归档能力分层：**Link**（默认，URL+Metadata）→ **Snapshot**（核心能力、非默认、可勾选）→ **Reader**（远景规划）。
- 当前核心聚焦 **Web 工作台 + Skill API**；浏览器插件与导航页插件形态为加速形态，不挡核心完成；移动端/Share 不作为本版核心。
- 多端数据走应用自己的服务：默认 Cloudflare Workers 云端部署，其次 Docker 自托管。

### 1.2 核心目标（本技术总纲的工程化转译）

| 产品目标（PRD） | 工程目标 | 验收口径 |
| --- | --- | --- |
| 保存流畅、能连上本应用即可保存 | 保存主链路只依赖本应用；第三方通道故障不阻塞保存 | 第三方未配置/中断时保存仍成功并落库 |
| 保存与整理解耦、渐进式归档 | Capture 只写 Link；Snapshot 是异步追加任务，失败不回滚 Bookmark | Archive Job 失败 ≠ Bookmark 失败 |
| 场景化 Organize、四维解耦 | Scene/Status/Folder/Tag 独立建模、可自由组合；Scene 是可配置数据而非硬编码枚举 | 用户自定义 Scene 无需改代码/表结构 |
| AI 辅助分流、安全边界 | Skill API 自描述、AI 产出以"建议"呈现、写操作全留痕可撤销 | AI 默认不得删除/批量/自动改结构 |
| 数据可靠、分层存储 | 结构化数据与应用内真源、内容数据入内容存储层（S3 API 抽象） | 任一存储/渠道故障不丢核心数据 |
| 轻量高效、600 条基线 | 首屏/检索按 600 条基线考核；非核心不增负、必要时可精简 | 600 条 Bookmark 下首屏与搜索不劣化 |

### 1.3 使用场景与运行环境

- **使用者**：个人用户；无多人协作诉求。
- **运行环境**：
  - 工作台/导航页：现代浏览器（Chrome/Edge/Firefox/Safari 桌面优先）；
  - 浏览器插件：Chrome MV3（WXT 跨浏览器框架，可扩展至 Firefox/Safari）；
  - 服务端：Cloudflare Workers（默认）或 Docker 自托管（Bun/Node）；
  - 端侧存储：IndexedDB（缓存与离线整理）；服务端真源：D1（Workers）/ SQLite（Docker）；内容存储：S3 API 兼容对象存储（R2/MinIO/其他）。
- **典型场景**：
  1. 浏览网页 → 点击保存（工作台/插件/Skill）→ 进 Inbox；
  2. AI 对话中丢来一个链接 → Skill 保存 → 系统异步理解 → 建议 Scene；
  3. 打开工作台 → 处理 Inbox → 接受/修改 AI 建议 → 归入 Scene/Folder/Tag；
  4. 打开导航页 → 规则圈定的收藏作为浏览起点 → 点开访问 → 留下访问记录 → Rediscover 卡片回捞；
  5. 长尾保全：对重要网页勾选 Snapshot → 归档作业异步抓取 → 内容入对象存储。

### 1.4 非目标（本期不做）

- **不是笔记工具/阅读器**：不提供重型文本编辑；Reader 阅读版、手动选正文、高亮、批注为远景规划。
- **不做多人协作**：纯个人工具。
- **Raindrop 不是数据核心**：不做默认双向同步；Scene/Status 不写回 Raindrop。
- **不做移动端优先交付**：Share Extension、URL Scheme 等为后续方向。
- **不做逐条点选作为导航圈选唯一方式**：导航展示范围用规则/工具圈定。
- **不依赖插件形态过关**：网页形态即可过关；应用不可达时不承诺离线保存。
- **不做全文正文索引**：搜索范围为标题/URL/标签/备注 + 结构化筛选。
- **不设"在读"持续性状态**：状态只有 待处理/已确认/搁置。
- **不把"优先级"列为独立属性**：收藏标星（important）覆盖"我更在意"语义。

---

## 2. 需求映射总览

### 2.1 需求分层与交付边界

PRD 要求拆解与实现只针对**核心需求**；近期与远景不入当期排期。本文档所有"本期/当前"表述均指核心需求范围。

| 分层 | 含义 | 本总纲的落点 |
| --- | --- | --- |
| **核心需求** | 基础框架必须具备 | §3–§9 全量覆盖。**过关门槛只有**：工作台能保存 Link ＋ Agent(Skill) 能保存 Link。工作台 Inbox/列表/搜索/筛选/单条·批量改/AI 建议四落点/回收站、Snapshot、访问记录、导航页网页形态为本期核心，但不计入过关门槛 |
| **近期需求** | 核心完善后再扩展 | 看板/标签聚合/独立整理模式/死链统计、插件打磨、Rediscover 卡片、组织记忆、更稳 Snapshot、移动端评估（§10 里程碑 M5+ 及预留接口） |
| **远景规划** | 形态成型后再评估 | Reader 清洗阅读、Markdown 轻量剪藏、高级 AI、URL 去重、导航页匿名公开、手动选正文等（**只保留方向，不排期**；仅做架构预留：Archive.type 扩展位、S3 多目标、Navigation 实体演化；清单与引入时机见 PRD 附录 B） |

### 2.2 需求 → 功能 → 模块映射表

| PRD 章节 | 需求要点 | 功能点 | 模块落点（§3） | 本章详述 |
| --- | --- | --- | --- | --- |
| §3.0 首次使用 | 不引导登录 Raindrop；数据管理可选、可跳过 | 首次引导 / 通道选择（可跳过） | 界面层设置 + 同步层 | §6.6 |
| §3.1 Capture | 零成本保存、Link 默认、Snapshot 可勾选 | 快速保存表单、多入口录入、同步截取开关 | 接入层 Capture 模块 | §6.1 |
| §3.0 导入梳理 | 首次导入后可选过库 | 导入梳理页（复用整理能力） | 界面层工作台 | §6.2 |
| §3.2.2 内联编辑 | 悬浮卡片直接改 Scene/文件夹/标签/状态、触发归档 | 卡片悬浮操作区（单条改的一种交互实现） | 界面层工作台 | §6.2–6.3 |
| §4.1 录入层 | 页面/Agent/插件三类入口 | Skill save_bookmark、插件保存 | 接入层 Skill/Extension | §7.2 |
| §4.2 工作台 | Inbox/列表/搜索/筛选/批量/AI 建议/回收站 | 主视图、详情面板、批量工具栏、AI 建议四落点 | 界面层 + 服务层 | §6.2–6.3 |
| §2.0 Scene | 可扩展非枚举、多对多、AERR 内部原型 | Scene 管理（建/改/并/停/删）、数量统计 | 数据层 Scene 模型 + 规则层 | §5.2 |
| §2.1.1 Status | 待处理/已确认/搁置，与 Scene 解耦 | 状态流转、分区过滤 | 数据层 | §5.2 |
| §2.2/§2.3 Archive | Snapshot 非默认可补做；Archive Job 异步 | Snapshot 抓取/查看/补做/重抓 | 服务层 Archive 引擎 + 内容存储层 | §6.4 |
| §4.4 Skill API | 自描述、能力开关、限速、AI 边界 | capabilities 端点 + 7 个 skill | 接入层 Skill 模块 | §7.2 |
| §4.5 搜索 | ⌘K 命令面板；标题/URL/标签/备注 + 筛选 | 工作台命令面板；导航页顶部下拉 | 界面层 + 搜索（端侧为主、服务端兜底） | §7.1 |
| §4.5 Rediscover | 访问记录（核心）；卡片（近期） | 打开行为打点 | 数据层访问记录 | §5.2/§6.5 |
| §3.3/§4.3 导航页 | 展示层、规则圈选、默认登录 | 展示集合求值、网格/浮层/搜索 | 展示层 + 规则层 | §6.5 |
| §5.2 数据通道 | Raindrop 输入/导出、S3/WebDAV 选项 | 通道配置、导入梳理、导出存档 | 同步层 | §6.6 |
| §4.6 备份 | 三档备份、单条内容导出 | 轻/中/重三档 + HTML/PDF/MD | 同步层导出引擎 | §6.7 |
| §4.6.2 导出筛选 | 备份/导出前圈定范围（全部/文件夹/标签/状态/时间） | 导出筛选参数 | 同步层导出引擎 | §6.7 |
| §4.2.12 日志/回收站 | 操作日志有限保留、软删除 7 天 | 日志表 + 回收站 | 数据层 | §5.3/§8 |
| §4.2.8 工具面板 | 工具 Tab（死链检测/标签整理/域名统计，**非过关**）、待处理 Tab、统计 Tab | 可折叠工具面板（默认收起） | 界面层工作台 | §6.2 |
| §7 性能 | 600 条基线、核心优先 | 游标分页、懒加载、局部刷新 | 横切关注点 | §9.4 |
| §6 安全 | AI 边界、鉴权、隐私 | Bearer Token、密码页、隐私标记 | 横切关注点 | §8.2 |

### 2.3 模块全景图

```text
DogEar
├── 接入层（Entry）
│   ├── Web 工作台 / 导航页（React SPA，登录态）
│   ├── Skill API（/skill/* + /.well-known/capabilities，Bearer Token）
│   ├── 浏览器插件（WXT MV3：popup 保存 / content script 抓 DOM / background 通信）
│   └── 数据通道适配（Raindrop / S3 / WebDAV，可选启用）
├── 服务层（Core）
│   ├── Bookmark 服务（CRUD + 批量 + 状态流转）
│   ├── Scene/组织服务（Scene 管理、Tag/Folder、AI 建议落地）
│   ├── Archive 引擎（Archive Job 队列、Metadata/Snapshot 抓取编排）
│   ├── 理解服务（Metadata 抓取 + AI 理解/建议，走 Skill 侧或服务端）
│   ├── 展示集合求值（导航圈选规则）
│   ├── 同步引擎（本地↔真源对账；Raindrop 导入/导出；对象存储）
│   └── 系统服务（操作日志、回收站、备份、鉴权、限速）
├── 数据层（Data）
│   ├── 端侧 IndexedDB（Dexie，**独立镜像缓存**，非 Drizzle 驱动）
│   ├── 服务端真源 D1/SQLite（Drizzle ORM，packages/db）
│   ├── 内容存储层（S3 API 兼容对象存储）
│   └── sync_queue / 冲突表 / 操作日志 / 回收站
├── 规则/策略层（Rule）
│   ├── Scene AERR 行为原型（内部）
│   ├── AI 安全边界（禁删/禁批量/禁自动结构改动/限速）
│   └── 导航展示规则（全部/按规则-或/自定义搜索勾选/隐藏）
├── 界面层（UI）
│   ├── 工作台：Inbox、列表/网格/看板(近期)、详情、批量、AI 建议、设置
│   └── 导航页：规则圈定展示、文件夹浮层、Rediscover 卡片(近期)、Docker 栏
├── 共享层（packages/shared）
│   ├── types.ts / schema.ts（Zod） / utils.ts
│   └── packages/db 只适配 D1/SQLite；端侧 Dexie 在 apps/web（或 packages/cache）单独映射
└── 工具层（Utils）
    ├── 抓取（Metadata/Snapshot）、ID 生成、日期、重试退避
    └── 导出（Netscape HTML/CSV/Markdown；PDF 非 Track A 默认）
```

---

## 3. 系统架构

### 3.1 总体架构

架构围绕三条产品铁律展开：**应用为真源、保存不依赖第三方、保存与内容保全解耦**。由此形成三层数据 + 五条横向能力：

```text
┌─────────────────────────── 接入层 ───────────────────────────┐
│  Web 工作台（登录）   导航页（同会话）   浏览器插件(MV3)        │
│  Skill API（Bearer）  数据通道（Raindrop/S3/WebDAV 适配）      │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTP(S) / 同域 / chrome.* 消息桥
┌──────────────▼───────────────────────────────────────────────┐
│                        服务层（真源侧）                        │
│  Bookmark/Scene/Tag/Folder 服务 │ Archive 引擎(Job 队列)       │
│  理解服务(Metadata/AI 建议)      │ 展示集合求值(导航规则)        │
│  同步引擎(对账/导入/导出)         │ 系统服务(日志/回收站/备份/鉴权) │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼─────────────── 数据层 ─────────────────────────┐
│  服务端真源：D1(Workers) / SQLite(Docker)   ← 权威元数据        │
│  内容存储层：S3 API 兼容对象存储(R2/MinIO)   ← Snapshot/资源     │
│  端侧缓存：IndexedDB（各设备，离线可用）                        │
│  队列：sync_queue / archive_queue（顺序消费）                   │
└───────────────────────────────────────────────────────────────┘

横向能力：鉴权与隐私 │ AI 安全边界 │ 操作日志与撤销 │ 限速与退避 │ 观测(条/秒、时延、成功率、队列、429)
```

**两条轨（互斥二选一，用户选定一种部署）**：

- **轨 A · Cloudflare Workers**：D1 真源 + R2 内容 + KV 预留；Pages 托管前端；Cron Trigger 只跑**轻量定时任务**（≥1min）；本地↔真源同步由**客户端 flush** 驱动，不挂服务端 Cron。
- **轨 B · Docker 自托管**：Bun(bun:sqlite) 或 Node(better-sqlite3) + 本地文件/挂载卷做 SQLite；内容存储接 S3 兼容服务（含 MinIO）；无 Cron 则用进程内调度器。

### 3.2 设计原则与取舍

| 原则 | 落法 | 取舍说明 |
| --- | --- | --- |
| **应用为真源** | 所有写操作先落本应用存储；Raindrop 等仅"导入/导出" | 不依赖第三方可用性；第三方中断只影响其所在通道 |
| **端侧缓存 + 服务端真源** | **读**：首屏走缓存。**写（工作台/插件）**：可先写缓存再异步对账，但保存成功仍以真源落库为准。**写（Skill/Agent）**：同步写入真源，不经 IndexedDB | 缓存加速界面，不是第二真源。应用不可达时不承诺保存成功 |
| **本地优先 + 异步同步** | 工作台操作可即时回显，同步引擎后台对账；冲突本地优先、保留两端可手动合并 | 见 PRD §6.2。Skill 路径不适用「先缓存后对账」 |
| **保存与内容保全解耦** | Capture 只建 Link；Snapshot 由 Archive Job 异步产出 | Archive Job 可失败/重试/补做，绝不回滚 Bookmark |
| **分层存储** | 结构化元数据（轻、随需）与内容数据（重、按需）分置 | 使"只存 Link"路径轻快；内容存储可多目标、可替换 |
| **流畅操作优先** | 同步不阻塞保存；批量端点、游标分页、懒加载 | 600 条基线内首屏零网络请求（读缓存） |
| **AI 插件化与安全边界** | Skill 自描述；建议先行、默认不自动写结构 | 减少对单一 AI 平台绑定；AI 破坏面收敛为可追溯写操作 |

### 3.3 模块依赖关系

```text
界面层/接入层 ──> 服务层（经 HTTP / RPC / 本地调用）
   服务层 ──> packages/db（Drizzle schema + D1/SQLite 适配器）──> D1 / SQLite
   工作台 ──> Dexie（IndexedDB 镜像缓存，schema 与真源对齐但独立维护）
   服务层 ──> 内容存储客户端（S3 API 统一接口）
   服务层 ──> 同步引擎（第三通道适配）
   共享层 packages/shared（types/schema/utils）<── 各层引用，禁止反向依赖
   规则层：被服务层引用（Scene AERR 呈现、导航圈选求值、AI 边界判定）
```

依赖红线：`shared` 不得依赖任何 app；`db` 只依赖 `shared`；UI 不得直连第三方 API（一律经服务层）；插件对应用的写操作一律走服务层接口（跨域时经消息桥中转）。

### 3.4 目标仓库结构（落地目标）

```text
DogEar/
├── wiki/                      # PRD v1.0.7（唯一需求源）
├── docs/                      # 本文档与落地细化、模块细部
├── apps/
│   ├── web/                   # 工作台 + 导航页（Vite + React，两套路由同包或分包）
│   │   └── src/{app,features,components,hooks,lib,types,utils}
│   ├── extension/             # WXT MV3（newtab/popup/shared content）
│   └── server/                # Hono 服务（Workers 入口 + Docker 入口）
│       └── src/{routes,middleware,services,types}
├── packages/
│   ├── shared/                # types/schema(Zod)/utils（前后端同构）
│   ├── db/                    # Drizzle schema + D1 / SQLite 适配器（不含 IndexedDB）
│   └── cache/                 # 可选：Dexie 镜像 schema（或放在 apps/web）
├── dev/dogear-workbench/      # 高保真原型（React 19 + Vite 6，mock 数据，不入正式工程）
└── scripts/ / Logs/           # 仅 NAS 归档场景使用，勿与仓库混用
```

> 现状说明：截至本文档撰写，`apps/`、`packages/` 尚未落盘，仅有 `dev/dogear-workbench` 原型。上图为**落地目标结构**，新功能按此归属放置。

---

## 4. 技术选型

### 4.1 技术栈总表

| 层级 | 选型 | 版本基线 | 状态 | 理由 |
| --- | --- | --- | --- | --- |
| 前端框架 | React | 19（原型已用） | ✅已定 | 生态成熟；原型已验证 |
| 构建 | Vite | 6 | ✅已定 | 快、TS 一等公民 |
| 前端路由 | 工作台 wouter（轻量）或 react-router（按需） | — | ⏳暂定 | 视图少、路由浅，优先轻量 |
| 全局状态 | Zustand | — | ✅已定 | 轻量、按模块拆分状态 |
| 服务端状态/缓存 | TanStack Query | — | ✅已定 | 增量更新、懒加载、失效管理 |
| UI 组件 | shadcn/ui（Radix + Tailwind） | — | ✅已定 | 可维护、可主题化 |
| 表格 | TanStack Table | — | ✅已定 | 列表/筛选 |
| 看板拖拽 | dnd-kit | — | 💡方向性（近期） | 看板属近期需求，不进本期核心栈 |
| 服务端 | Hono（TypeScript） | — | ✅已定 | Web Standards 通杀 Workers/Bun/Node |
| ORM | Drizzle ORM + packages/db 适配器 | — | ✅已定 | 类型安全、可运行时切驱动 |
| 校验 | Zod（前后端共享 schema） | — | ✅已定 | 契约单一来源 |
| 端侧缓存 | IndexedDB（Dexie 封装） | — | ✅已定 | **仅作镜像缓存**（首屏、弱网回显）。与 Drizzle 真源分开，不是同一 adapter |
| 真源 DB（轨 A） | Cloudflare D1 | — | ✅已定 | Workers 一键、SQLite 兼容 |
| 真源 DB（轨 B） | SQLite：bun:sqlite 或 better-sqlite3 | — | ⏳暂定 | Bun 零依赖优先，需验证兼容性 |
| 内容存储 | S3 API 兼容对象存储（R2 默认/MinIO 自托管） | — | ✅已定 | 统一 S3 API，可替换、多目标 |
| 浏览器插件 | WXT（Vite 驱动，MV3） | — | ✅已定 | Chrome/Firefox/Safari 兼容，HMR |
| 语言/包管理 | TypeScript；pnpm + Turborepo | — | ✅已定 | monorepo、依赖隔离 |

### 4.2 选型说明与关键取舍

- **React 19 + Vite 6（✅）**：与 `dev/dogear-workbench` 原型同栈，原型资产可平滑内化；19 的 Actions/useOptimistic 利于"本地即时响应 + 服务端对账"体验。
- **Hono + Drizzle + Zod（✅）**：一套 TS 契约从浏览器用到 Workers/Docker；`packages/db` 在运行时按环境注入驱动（d1 / better-sqlite3 / bun:sqlite），schema 单源。
- **IndexedDB 缓存 + 真源（✅）**：实现流畅回显与首屏零请求。**不能**用「断网写缓存」解释 PRD「能连上本应用即可保存」——连得上应用时，保存成功 = 服务端真源已落库；应用不可达则保存失败并提示。IndexedDB 只承担：界面即时回显、短暂排队、读缓存。
- **S3 API 内容层（✅，方向已定）**：Snapshot 大对象与结构化数据分离；R2 零出口费、可换 MinIO/其他 S3 兼容服务。
- **Cron Trigger 而非 Durable Objects（⏳暂定）**：成本考量；若未来需要实时双向与多实例一致性，再评估 DO/队列。
- **定时任务边界（✅，方向已定）**：Cron Trigger 最短粒度为 **1 分钟**，只承载**轻量任务**（触发通道拉取、Metadata 重抓调度、备份节流等）；本地↔真源同步由**客户端攒批推送**承担（**合并窗口默认 1 分钟**，可在设置中配置），不依赖亚分钟服务端定时。重任务（整页抓取、批量解析）不进 Worker 的 CPU/subrequest 预算，走浏览器端直传或 Track B/Docker（见 §6.4.1 抓取分级）。
- **Cloudflare 进阶计费能力（💡方向性，可选层）**：Queues / Workflows / Durable Objects 作为**可选增强**（各自带免费额度与计费边界），仅在规模需要队列/编排/多实例一致性时引入；不挡核心路径，也不写入 MVP 关键路径（对应 §11 T-11）。
- **KV（💡方向性）**：预留边缘缓存/会话；本期不绑定。

### 4.3 关键技术依赖清单

| 依赖 | 用途 | 归属 |
| --- | --- | --- |
| @hono/node-server / hono | 服务端 HTTP（Docker/Workers 双入口） | apps/server |
| drizzle-orm + drizzle-kit | schema/迁移/查询 | packages/db |
| zod | 输入校验、契约 | packages/shared |
| dexie | IndexedDB 封装 | packages/db |
| @aws-sdk/client-s3（或兼容轻封装） | S3 API 内容存取 | packages/db 或 server/services |
| @tanstack/react-query | 服务端状态 | apps/web |
| zustand | 模块级 UI 状态 | apps/web |
| shadcn/ui + tailwindcss + radix | 组件体系 | apps/web |
| lucide-react | 图标库 | apps/web |
| @tanstack/react-table | 表格/列表（含聚合视图） | apps/web |
| wouter | 工作台轻量路由（选型表 ⏳暂定，与 react-router 按需二选一） | apps/web |
| tailwindcss | 原子化样式（含于 shadcn/ui 行，独立列出便于显式锁定版本） | apps/web |
| wxt | 扩展脚手架 | apps/extension |
| vitest | 单测 | 根 |
| wrangler | Workers 部署/本地模拟 | apps/server |
| tsx / bun | 本地开发运行 | 根/apps/server |

---

## 5. 核心数据设计

### 5.1 概念模型总览

```text
Scene ──< M:N >── Bookmark ──1:N── Archive（内容保全副本，Snapshot 当前 / Reader 远期）
                     │                │
                     │                └──1:N（经 Archive Record 记录 storage_location）
                     ├── Folder（0..1，Raindrop collection 同构）
                     ├── Tags[]（M:N）
                     ├── Status（unread/saved/archived，仅应用内）
                     ├── Important（收藏标星，独立于状态）
                     ├── Source（page/agent/extension）
                     ├── 访问记录 AccessLog[]（核心先记）
                     ├── 导航展示（由展示集合规则求值，非逐条存储）
                     └── 回收站标记（软删除 deleted_at）

配套系统表：
  Archive Job（type=metadata/snapshot，状态机）
  sync_queue（本地↔真源/通道 顺序消费）
  operation_log（写操作留痕）
  backup_run（三档备份历史）
  通道配置 / 设置（settings）
  展示规则（navigation_rules，持久化为展示集合）
```

### 5.2 核心实体定义

#### 5.2.1 Bookmark

| 字段 | 类型 | 说明 | Raindrop 映射 |
| --- | --- | --- | --- |
| id | string | **应用 ID**，创建时即生成稳定 UUID（Skill/服务端同步写入时当场生成并返回）。工作台乐观回显可用同一 UUID，禁止对 Skill/Agent 返回 `tmp_` 后再回填 | — |
| raindropId | string? | Raindrop 侧 `_id`；仅启用 Raindrop 通道时存在，同步时作为匹配键传出 | `_id` |
| url | string | 必填 | `link` |
| title | string | Metadata 自动抓取，可修正 | `title` |
| excerpt | string | 网页描述（自动抓取，可修正） | `excerpt` |
| cover | string | 封面 | `cover` |
| type | enum | link/article/video/image 等 | `type` |
| author / favicon / publishedAt | string? | **本地扩展抓取**，不同步 Raindrop | — |
| tags | string[] | 用户维护 | `tags` |
| folderId | string? | 0..1；Raindrop 官方字段 collection | `collection` |
| note | string? | 备注 | `note` |
| important | boolean | 收藏标星，独立于状态 | `important` |
| status | enum | unread(待处理) / saved(已确认) / archived(搁置)；仅应用内 | — |
| source | enum | page / agent / extension | — |
| scenes[] | string[] | 多对多，仅应用内 | — |
| private | boolean | 私密标记：导航页默认隐藏、需解锁、不入 AI 记忆（可选） | — |
| broken | boolean | 链接失效（Raindrop 派生，只读） | `broken` |
| domain | string | URL 派生（只读） | `domain` |
| deletedAt | datetime? | 软删除进回收站；导出存档默认不含 | — |
| createdAt / updatedAt | datetime | 应用侧维护；映射 Raindrop created/lastUpdate | `created`/`lastUpdate` |
| version | int | 乐观锁/对账版本 | — |

> 字段红线：`highlights`/`reminder`/`file`/`creatorRef` 本版**无产品入口**，读入只读保存以不丢数据；不把 Scene/Status/删除语义写入 Raindrop 存档；`cache`（Raindrop PRO）不启用。

#### 5.2.2 Scene（可配置数据，非固定枚举）

| 字段 | 说明 |
| --- | --- |
| id / name / description | 基本属性；name 可重复？→ ❓待决策（倾向允许，靠 id 区分） |
| icon / appearance | 可选 |
| sortOrder | 排序 |
| enabled / archived | 停用/归档不删除，历史书签引用不断 |
| aerr | 内部行为原型 Action/Explore/Read/Reference（不展示给用户），新建时给默认 |
| createdAt / updatedAt | 时间戳 |

- 默认预设四 Scene（工作研究/灵感收集/稍后再读/长期资料），可改名、停用、删除；用户自定义 Scene 无需改表结构。
- 与 Bookmark 多对多；Capture 不要求选 Scene；不设 Primary Scene（第一版）。
- **AERR 呈现方向（此处只写需求与方向）**：AERR 不直接决定独立页面，而是按当前 Scene 所挂原型调整工作台的**默认排序、信息密度与主按钮**——工作台只有一套，第一版可共用列表、只换主操作文案（PRD §2.0.3）。具体映射规则、算子与阈值属于细部，**后续单独模块讨论**（承接于 `docs/modules/Scene-AI与待设计细部.md`），本版不展开。

#### 5.2.3 Archive 与 Archive Record

- **Archive（内容保全副本）**：`id / bookmarkId / type(snapshot|reader-预留) / status / 资源引用 / createdAt / updatedAt`。
- **Archive Record（归档记录，存真源）**：`archiveId / parser / parserVersion / source(server|browser|manual) / storageLocation(指向内容存储层) / createdAt`。
- Snapshot 内容本体入**内容存储层**，不存关系库。**格式优先：单 HTML 文件**。不自研 inliner：**Track A（有 DOM）用 SingleFile / `single-file-core`（AGPL-3.0，已接受）** 打当前页；单独成包，服务端只收现成 HTML。**Track B（按 URL、无用户 DOM）用 monolith（CC0）**。目录分包、mhtml 不作本期默认。
- **能力边界（Track A）**：整页 Snapshot 依赖**有浏览器 DOM 的一端**（插件/工作台把当前页打成单 HTML，签名 URL 直传）。无 DOM 的触发源（Agent 保存、纯服务端批量）在 Track A 上**只产出 Metadata**，并明确返回「快照未生成、已入队等待浏览器补做」；整页快照需等浏览器端补做或 Track B/Docker（见 §6.4）。失败不影响 Bookmark（Link 成立）。

#### 5.2.4 Archive Job（异步任务）

| 字段 | 说明 |
| --- | --- |
| id | 任务 ID |
| bookmarkId | 关联 Bookmark |
| type | metadata / snapshot（reader 预留） |
| source | agent / browser / server / manual |
| status | pending / processing / completed / failed / cancelled |
| createdAt / startedAt / completedAt | 生命周期时间 |
| error | 失败原因分类（fetch_failed / parse_failed / timeout / quota / unknown） |
| result | 归档结果引用（Archive Record id 等） |
| retryCount | 重试次数 |

**状态机**：pending → processing → completed | failed（可 retry/cancel）。核心原则：**Job 失败不等于 Bookmark 失败**。

### 5.3 配套系统数据

| 表/集合 | 关键字段 | 用途与策略 |
| --- | --- | --- |
| operation_log | actor(ai/agent/user/system)、action、target、detail、ts、revertToken | 所有写操作留痕；默认保留 5000 条/30 天（可配置），支持清理/导出/循环覆盖；AI 写操作可据此批量撤销 |
| sync_queue | kind(bookmark_push/import/export/backup)、payload、status、attempt、nextRetryAt | 顺序消费；本地↔真源对账；Raindrop 导入/导出；对象存储批量；429 指数退避（1s/2s/4s…封顶） |
| conflict | bookmarkId、localVer/remoteVer、payload、resolved | 冲突保留两端，本地优先，用户可单/全选合并 |
| recycle_bin（或软删字段） | deletedAt、autoPurgeAt | 回收站软删除，默认 7 天自动清理，可配置；支持恢复与清空 |
| settings / channel_config | 键值、凭证引用、能力开关、备份目标 | 凭证不落明文（见 §8.2）；Raindrop/S3/WebDAV 通道开关与 Token 集中管理 |
| navigation_rules + 展示集合 | 规则定义（全部/按规则-或/自定义搜索勾选/隐藏）、求值产物 snapshot | 规则持久化，展示集合可缓存；关闭导航不丢 page_tab/Docker 配置。**page_tab（页面标签区，导航页内按内容维度分组的分页）本期轻量持久化**：并入导航展示配置，不单独建重型实体；详细设计待 PRD §4.3.3 后再细化（不约束过细） |
| access_log | bookmarkId、openedAt、source(original/snapshot) | 访问记录核心先记；字段/去噪/界面后定（见 module 细部） |
| backup_run | tier(轻/中/重)、target、status、size、detail | 备份历史展示（时间/目标/结果/体积） |
| aerr / scene_prototype | 系统内部映射 | 随 Scene 配置存储 |

### 5.4 属性分层（数据级别）

| 层 | 定义 | 存储 | 同步 Raindrop |
| --- | --- | --- | --- |
| 基础属性（Raindrop 同构） | `_id`/url/title/excerpt/cover/type/tags/collection/note/important/created/lastUpdate/domain/broken | 应用数据库 | ✅ |
| 基础属性（本地扩展抓取） | author/favicon/publishedAt 等 | 应用数据库 | ❌ |
| 基础属性（仅应用内） | status/scenes/source/private/deletedAt/access 相关 | 应用数据库 | ❌ |
| 内容信息 | Snapshot/Reader 内容 | 内容存储层 | ❌ |
| 扩展属性 | 用户自定义（仅声明存在） | 应用数据库 | ❌ |

### 5.5 数据存储与同步分工

| 存储 | 承载 | 一致性角色 |
| --- | --- | --- |
| 端侧 IndexedDB | 当前视图数据、离线写缓冲、访问打点暂存 | 写优先、读优先；由同步引擎对账 |
| 服务端真源 D1/SQLite | Bookmark 元数据、Job、日志、配置、队列、回收站 | **权威**；所有跨端一致性的基准 |
| 内容存储层（S3 API） | Snapshot 本体、备份压缩包 | 对象级唯一；Archive Record 存指针 |
| Raindrop（可选通道） | Link 级导出存档 / 输入源导入 | 非真源；单向导入或导出 |

### 5.6 数据生命周期

| 数据 | 创建 | 更新 | 删除 | 归档/保留 |
| --- | --- | --- | --- | --- |
| Bookmark | Capture（多入口） | 用户/批量/AI 建议落地 | 软删入回收站（7 天默认） | 导出存档不含回收站 |
| Metadata | 保存后异步抓取（metadata Job） | 用户修正优先；可重抓 | 随 Bookmark | — |
| Snapshot | 勾选或事后 trigger_archive | 重抓/上传替换 | 由 Bookmark 软删级联或用户主动 | 内容存储层，Archive Record 记录 |
| Archive Job | 保存勾选/手动/批量触发 | pending→…→completed/failed | cancelled | 失败记录保留可重试 |
| 访问记录 | 打开原链接/Snapshot 时打点 | 追加 | 随 Bookmark 或按策略去噪 | 字段与保留后定 |
| 操作日志 | 每次写操作 | 追加 | 循环覆盖/用户清理 | 默认 5000 条/30 天 |
| 展示集合 | 规则变更时重算 | 规则增删改 | 规则删除 | 关闭导航不丢配置 |

### 5.7 字段与 Raindrop 映射总表

本小节是 PRD v1.0.7「附录 C：属性总表」的迁移承接处：PRD 附录 C 已改为指向本小节的引用，全量属性清单的口径以本小节为准。表内 `§`/`附录` 编号指 PRD v1.0.7 内部章节，用于追溯需求上下文；数据级别分层总览见 §5.4，存储与同步分工见 §5.5。

每行标明四件事：是否对应 Raindrop 官方 API、属于哪一级数据、存储位置、是否随**输入源读入 / 导出存档写出**（不是默认双向同步）。Raindrop 对应关系以官方 API 字段名为准，校准说明见 PRD §2.2。

数据级别说明：**基础属性**（随链接保存、一般不变，分 Raindrop 同构与本地扩展抓取两组）；**内容信息**（Archive 归档内容）；**扩展属性**（用户自定义，仅声明）。
存储位置说明：**应用数据库**＝端侧 IndexedDB 缓存＋服务端 D1/SQLite 真源（结构化数据，分工见 §5.5）；**内容存储层**＝Archive 内容等对象数据，与结构化数据分开放置，具体形态待定（见 §5.5）。

#### 5.7.1 Raindrop 同构字段（可作为输入读入 / 导出存档写出）

| 本地概念/字段 | Raindrop 官方字段 | 说明 | 数据级别 | 存储位置 | 同步 Raindrop |
| --- | --- | --- | --- | --- | --- |
| `_id`（Raindrop ID） | `_id` | Raindrop 侧 ID，仅启用该通道时存在；**应用 ID 为创建时生成的稳定 UUID**（Skill 立即返回该值）。同步 Raindrop 时以对方 `_id` 作为匹配键，写入 `raindropId` | 基础属性 | 应用数据库 | ✅ |
| URL | `link` | 链接地址（必填） | 基础属性 | 应用数据库 | ✅ |
| Title | `title` | 标题（Metadata 自动抓取，可修正） | 基础属性 | 应用数据库 | ✅ |
| 描述 | `excerpt` | 网页描述（Metadata 自动抓取，可修正；Raindrop 描述字段官方名为 `excerpt`，本产品不另设 description） | 基础属性 | 应用数据库 | ✅ |
| 封面 | `cover` | 封面（Metadata 自动抓取，可上传图片） | 基础属性 | 应用数据库 | ✅ |
| 类型 | `type` | `link`/`article`/`video`/`image` 等（Metadata 自动抓取或手动） | 基础属性 | 应用数据库 | ✅ |
| Tags | `tags` | 标签（用户维护） | 基础属性 | 应用数据库 | ✅ |
| Folder | `collection` | 文件夹（用户维护；Raindrop 文件夹字段官方名为 `collection`，本产品不另设 folder） | 基础属性 | 应用数据库 | ✅ |
| Notes | `note` | 备注（用户维护；Raindrop 备注字段官方名为 `note`，本产品不另设 notes） | 基础属性 | 应用数据库 | ✅ |
| Important | `important` | 收藏标星（用户维护，见 PRD §2.1.2） | 基础属性 | 应用数据库 | ✅ |
| Highlights | `highlights` | Raindrop 高亮字段；当前版本无高亮入口，读入只读 | 基础属性（观察） | 应用数据库 | ⚠️ 兼容保留，不依赖 |
| Reminder | `reminder` | Raindrop 提醒字段；**本版无提醒产品入口**，读入只读保存，工作台不提供到期提醒 UI | 基础属性（观察） | 应用数据库 | ⚠️ 兼容保留，不依赖 |
| Created At | `created` | Raindrop 侧创建时间（系统派生） | 基础属性 | 应用数据库 | ✅ |
| Updated At | `lastUpdate` | Raindrop 侧更新时间（系统派生） | 基础属性 | 应用数据库 | ✅ |
| Domain | `domain` | Raindrop 由 URL 派生（系统派生，只读） | 基础属性 | 应用数据库 | ✅（Raindrop 单向） |
| Broken | `broken` | 链接失效标记（Raindrop 字段，只读） | 基础属性 | 应用数据库 | ✅（Raindrop 单向） |
| File | `file` | Raindrop 附件；**本版无附件产品入口**，同步保留以免丢数据 | 基础属性（观察） | 应用数据库 | ⚠️ 兼容保留，不依赖 |
| CreatorRef | `creatorRef` | 创建者引用（Raindrop 多用户字段）；个人工具无产品含义，只读兼容 | 基础属性（观察） | 应用数据库 | ✅（Raindrop 单向） |
| 状态（待处理/已确认/搁置） | — | 仅应用内；导出存档不携带 Inbox 语义（见 PRD §2.1.1） | 基础属性 | 应用数据库 | ❌ |
| 删除（回收站） | — | 应用内软删除；导出存档默认不含回收站条目（见 PRD §4.2.12） | 基础属性 | 应用数据库 | ❌ |

#### 5.7.2 本地扩展抓取字段（Raindrop 无对应，仅存本地、不同步）

| 字段 | Raindrop 对应 | 说明 | 数据级别 | 存储位置 | 同步 Raindrop |
| --- | --- | --- | --- | --- | --- |
| `author` | ❌ 无 | 作者（Metadata 自动抓取） | 基础属性 | 应用数据库 | ❌ |
| `favicon` | ❌ 无 | 站点图标（Metadata 自动抓取） | 基础属性 | 应用数据库 | ❌ |
| `publishedAt` | ❌ 无 | 页面发布时间（Metadata 自动抓取） | 基础属性 | 应用数据库 | ❌ |
| 其他本地扩展抓取字段 | ❌ 无 | 未来按需新增的本地抓取描述字段，遵循同一规则 | 基础属性 | 应用数据库 | ❌ |

#### 5.7.3 内容信息（Archive 内容，不入 Raindrop）

| 数据/字段 | Raindrop 对应 | 说明 | 数据级别 | 存储位置 | 同步 Raindrop |
| --- | --- | --- | --- | --- | --- |
| Snapshot 内容 | ❌ 无 | 网页快照，**优先单 HTML 文件**（资源内联） | 内容信息 | 内容存储层 | ❌ |
| Reader 内容（远期） | ❌ 无 | 清洗后的正文 + 必要资源（见 PRD 附录 B） | 内容信息 | 内容存储层 | ❌ |
| Archive Record | ❌ 无 | 归档记录（parser/parser\_version、source、storage\_location） | 内容信息 | 应用数据库（记录）＋ 内容存储层（内容） | ❌ |

#### 5.7.4 扩展属性（用户自定义，仅声明）

| 数据/字段 | Raindrop 对应 | 说明 | 数据级别 | 存储位置 | 同步 Raindrop |
| --- | --- | --- | --- | --- | --- |
| 用户自定义属性 | ❌ 无 | 本版仅声明存在，字段清单与交互待后续细化 | 扩展属性 | 应用数据库 | ❌ |

#### 5.7.5 DogEar 本地字段（Raindrop 官方对象无对应，正文已出现、总表不缺失）

以下字段在 PRD §2.1 结构中已出现，但不属于 Raindrop 官方对象；补入以免只在正文出现、总表缺失。

| 数据/字段 | Raindrop 对应 | 说明 | 数据级别 | 存储位置 | 同步 Raindrop |
| --- | --- | --- | --- | --- | --- |
| `Scenes[]` | ❌ 无原生字段 | 多对多情境关联；**不进入 Raindrop**（PRD §09 #10） | 基础属性 | 应用数据库 | ❌ |
| Scene.AERR 原型 | ❌ 无 | 系统内部行为原型，不展示给用户（PRD §2.0.3） | 配置 | 应用数据库 | ❌ |
| `Source` | ❌ 无 | 录入来源：page / agent / extension | 基础属性 | 应用数据库 | ❌ |
| 导航展示集合 | ❌ 无 | 由规则/工具圈定，非逐条必选（PRD §4.3）；关闭导航不丢 page_tab / Docker | 配置 | 应用数据库 | ❌ |
| 访问记录 | ❌ 无 | 核心需求要记；字段与界面后定（PRD §4.5） | 基础属性 | 应用数据库 | ❌ |
| 私密标记 | ❌ 无 | 导航页默认隐藏，需解锁（PRD §6.3） | 基础属性 | 应用数据库 | ❌ |

> **优先级**：正文排序曾出现「优先级」字样，**本版不单列为书签属性**（不以 `_priority:` 作为产品能力）。「我更在意」用收藏标星。若落地文档仍有该标签约定，视为过期，以本文为准。

#### 5.7.6 排除与观察（Raindrop 字段校准附注）

| 字段 | Raindrop 对应 | 状态 | 说明 |
| --- | --- | --- | --- |
| `cache` | `cache` | 🚫 排除 | Raindrop PRO 会员专属的永久副本，非会员不可用 |
| `media` | `media` | ⚠️ 观察 | Raindrop 自动收集的媒体列表，当前不依赖其存在，后续按需评估 |
| `html` / `data` 等 | — | ⚠️ 观察 | Raindrop 其他未启用字段，不依赖其存在，后续按需评估 |

---

## 6. 核心流程设计

### 6.1 Capture 主流程（保存链路）

产品目标：**能连上本应用即可保存**；保存动作"零成本"、不因分流/归档受阻。

**成功判定（已定）**：连得上本应用时，URL 已写入**服务端真源**（D1 / SQLite）即算保存成功。与 Metadata / AI / Snapshot 无关。应用不可达 → 保存失败并提示，不把「只写了 IndexedDB」当成成功。

入口拆成两条，禁止画成同一条 IndexedDB 先行流水线：

```text
A. 工作台 / 同域插件（有浏览器）
   输入：url（必填）＋ note/intent/snapshot 开关（可选）
   │  生成稳定 UUID（创建即确定，不使用 tmp_）
   ▼
   界面可先写入 IndexedDB 做即时回显
   │  同时（或合并窗口内）POST 服务端真源
   ▼
   真源落库 ＝ 保存成功（未推送条数>0 时状态栏可见，但成功不以「对账完成」延迟判定）
   │
   ├── Metadata Job（异步）
   ├── AI 理解/建议（异步，不自动写结构）
   └── Snapshot（仅 snapshot=true）
         有当前页 DOM → 打成单 HTML，签名 URL 直传内容存储
         无 DOM / 失败 → Job 入队，不回滚 Link；界面标明「快照未生成」

B. Skill / Agent（无浏览器、无 IndexedDB）
   POST /skill/save_bookmark  →  服务端当场生成稳定 UUID 并写入真源
   │  响应立即返回正式 id（禁止 tmp_ 后回填）
   ▼
   保存成功 ＝ 真源已有该行
   ├── Metadata Job（异步）
   ├── AI 建议（异步）
   └── snapshot=true（Track A）
         无 DOM：只建 Job + 返回 snapshotStatus=queued_pending_browser
         不声称已有快照文件；等浏览器端补做或 Track B 服务端抓取
```

**要点**：

- Skill 路径不经过 IndexedDB，也不走客户端攒批窗口。
- 插件与页面用已渲染 DOM 时，可把当前页打成单 HTML 再直传；**即使快照失败，Link 依然成立**。
- 保存之后可补做 Snapshot（`trigger_archive`）、可重抓 Metadata。

### 6.2 整理工作流（Organize）

**入口**：Inbox/待处理队列、列表多选、整理模式（可选两阶段分拣）、导入梳理页（复用同套能力）。

```text
Inbox（status=unread）
   │  单条/批量
   ▼
① 快速决策（阶段一，可选）：保留 / 删除 / 待定
   │
   ▼
② 分流（阶段二，可选）：确认价值 → 已确认 / 搁置
   │      系统按理解结果建议 Scene/Folder/Tag（AI 建议，可一键/批量采纳）
   ▼
③ 落地：状态流转 + Scene/Folder/Tag 变更 → 写操作日志（可撤销）
```

- 四维解耦落地：改 Status 不动 Scene/Folder/Tag；改 Scene 不动其余。
- 批量操作 = 批量端点一次提交 + 逐条日志 + 可整体撤销。
- Inbox 不强制清零；待处理可长期停留；搁置 ≠ 删除 ≠ 已 Snapshot。

### 6.3 AI 建议与安全边界（横切）

| 边界 | 实现 |
| --- | --- |
| 禁止执行 | 删除 Bookmark/Archive、改文件夹结构、默认批量、未经确认改 Scene/Folder/Tag（结构类默认不自动写） |
| 允许执行 | 保存新链接、搜索列出、单条修改、获取统计、触发单条 Archive |
| 建议先行 | 理解类产出（Scene/Folder/Tag/标题/描述）以建议呈现，用户确认后生效；采纳即撤销可回滚 |
| 可追溯 | AI 写操作全部记 operation_log（actor=ai），提供批量撤销 |
| 限速 | 连续写入超阈值触发提示/节流 |

> **取舍说明（对应 PRD §2.0.2 与 §6.1 的历史张力）**：PRD §2.0.2 曾表述「高把握时系统可后台挂上建议 Scene」，与 §6.1「禁止未经确认的自动分流」相冲突。**本版取严格口径，一律建议先行**：系统可后台**预备**建议（高把握时生成并在四个落点高亮提示），但写入 Scene / Folder / Tag 必须经用户点击确认。
> 理由：AI 判断错误会污染用户自建的组织体系，而确认成本仅一次点击——用一次点击换结构不被误伤是划算的。是否开放自动分流、置信度阈值如何设定，留待后续评估（PRD §09 #21）。

### 6.4 Archive 引擎与 Job 生命周期

```text
触发源：保存勾选 / 用户补做 / Agent 显式 trigger_archive / 批量 Snapshot
   ▼
Archive Job 入队（type=snapshot|metadata；pending）
   ▼
消费（顺序/并发受限；按触发源有无 DOM 分流）
   ├── Browser（推荐，Track A）：SingleFile 将当前 DOM 打成单 HTML → 签名 URL 直传内容存储层
   ├── Server（仅 Metadata）：metascraper 抽标题/描述/封面等 → 写 Bookmark；不抓整页
   ├── Docker（Track B 可选）：monolith 按 URL 产出单 HTML → 直传 S3 API
   └── Manual：用户主动触发（无 DOM 时同 Browser 路径或降级）
   ▼
completed：写 Archive + Archive Record（parser/version/source/storage_location）→ 更新卡片状态位
failed：error 分类（fetch/parse/timeout/quota）→ 保留可重试/可取消；不影响 Bookmark
```

**执行面分工（与 §4.2「定时任务边界」一致）**：

- **Track A（Cloudflare Workers）**：整页 Snapshot 走 **SingleFile（浏览器）直传单 HTML**；服务端 Metadata 用 **metascraper**。Agent/Skill 勾选快照时返回尚未生成文件。Worker 不承载整页抓取。SingleFile 核心单独成包，避免把 AGPL 扩散进全部服务端代码。
- **Track B（Docker 自托管）**：服务端整页用 **monolith** 按 URL 抓公开页；登录墙仍走浏览器 SingleFile。
- 无 DOM 可用的触发源（Agent 保存后补做、纯服务端批量）在 Track A 上**只产出 Metadata**；需要整页快照时等浏览器端补做，或在 Track B 提供服务端抓取。

**归档内容操作边界（用户侧四操作）**：查看（读取已保全网页）/ **下载**（把快照文件取回本地）/ **重新抓取**（原快照不佳或网页已更新，重建 Job）/ **上传替换**（用本地文件替换系统抓取版本）。本版对归档内容**无文本编辑**——PRD §1.4 的「只读」指不做编辑，下载与上传替换明确允许；下载与上传均经内容存储层（签名 URL），上传替换后写新 Archive Record。

#### 6.4.1 抓取能力分级与调度

> 本小节是 PRD §2.3「抓取分级（已确认方向）」的工程落点。

不同归档能力对性能与运行环境的消耗差异极大，不能一刀切地「保存即抓取」。分级按三个维度判断：**任务重量**（消耗多少预算）、**触发源**（有没有 DOM 可用）、**设备与网络条件**（当下适不适合做）。三者共同决定「先获取什么、什么时机获取、满足什么条件才获取」。

| 级别 | 任务 | 重量 | 触发与时机 | 执行面 | 条件门控 |
| --- | --- | --- | --- | --- | --- |
| **L0 · 即时** | Metadata 抓取（标题/描述/封面/类型/作者/favicon/发布时间） | 极轻（少量请求） | 保存后立即入队，任何触发源 | Server（Track A / B 均可承担） | 无 |
| **L1 · 机会** | Snapshot（**有 DOM**） | 重（整页资源内联成单 HTML） | 保存时勾选且当前页面已渲染完成 → 立即 | Browser 合成单 HTML，直传内容存储层（签名 URL） | 页面 load 完成 |
| **L2 · 延后** | Snapshot（**无 DOM**：Agent 保存后补做、纯服务端批量） | 重 | 入队排队，等浏览器端机会（用户下次打开该书签 / 进入工作台）；Track B 可直接服务端抓取 | Track A：Browser；Track B：Server 或 Browser | Track A 必须等 DOM；Track B 无此约束 |
| **L3 · 空闲** | 批量 Snapshot、失败任务重抓、Metadata 重抓 | 中～重 | 空闲或低峰时段 | Browser（Track A）/ Server（Track B） | 设备空闲 + 非计量网络（可配）+ 单次批量上限 |

**调度规则**：

- **优先级**：L0 > L1 > L2 > L3；同级按入队顺序（FIFO）。
- **并发**：L0 可并发；L1 / L2 串行或低并发（1–2）；L3 仅在无更高优先级任务时执行。
- **门控条件（设置中可配）**：仅 Wi-Fi / 仅设备空闲 / 仅充电时执行重任务；单次批量条数上限。
- **失败处理**：任何级别失败均入队保留、分类记录（fetch/parse/timeout/quota）、可重试或取消；**不影响 Bookmark**（Link 已成立）。

> **为什么这样分**：默认部署（Workers）有 CPU 时长与 subrequest 预算，整页抓取属于超出预算的重任务，因此 L1/L2 的整页 Snapshot 一律交给有 DOM 的浏览器端直传，服务端只承担 L0 的轻量 Metadata。这是**运行环境约束的结果，不是产品取舍**——改用 Docker 轨（Track B）后，L2/L3 可由服务端承担。

**降级链（Reader 远期，架构预留）**：URL/DOM → 通用解析器 → 站点规则 → 用户手动选正文 → 仍失败则保留原 URL，Bookmark 不受影响。

### 6.5 导航页展示集合与 Rediscover

- 展示范围由**规则/工具**圈定，非逐条勾选：**全部 / 按规则（或） / 自定义搜索勾选 / 隐藏**。
- 规则持久化为展示集合（求值产物可缓存）；Inbox/待处理、被规则排除、私密条目默认不出现（除非规则明确纳入）。
- 导航页第一版默认登录，与工作台同会话；匿名公开非默认能力。
- 访问记录：打开原链接（及 Snapshot）时打点 → 供"最近访问 / 长期未访问"；Rediscover 卡片（近期需求）在记录就绪后逐步开放。
- 长期演化预留：`Bookmark → Navigation Item → Navigation Page` 分层；本期不强制拆实体。

### 6.6 同步引擎（本地 ↔ 真源 ↔ 通道）

同步拆为**两个平面**，避免把「本应用内联机」与「第三方通道轮询」混为一谈：

**平面 1 · 本地 ↔ 真源（用户行为驱动，核心路径）**

| 方向 | 触发 | 策略 |
| --- | --- | --- |
| 本地 → 真源 | **客户端攒批推送，合并窗口默认 1 分钟**（可在设置中配置）；页面隐藏 / 卸载前尽力 flush | 攒批推送，游标续传；成功后回填正式 id；失败保留队列重试；**未推送条数在界面常驻显示** |
| 真源 → 本地 | 客户端拉取（可配）/ 手动 | 增量（updatedAt/version 游标），不拉全量 |

**平面 2 · Raindrop 通道（可选，独立于本应用内联机）**

| 方向 | 触发 | 策略 |
| --- | --- | --- |
| Raindrop 导入 | 用户启用输入源 | 首次可进 Inbox 或保持原路径；可走导入梳理页；首次梳理后新记录一律进 Inbox |
| Raindrop 导出 | 用户启用导出方向 | Link 级存档，不带 Scene/Status/回收站语义；失败不阻塞本地 |
| 拉取节奏 | **有在线客户端时轮询 / 无客户端时服务端 Cron（Track A）**，**统一 1 分钟** | 客户端与服务端定时同用 1 分钟口径，消除两套数值带来的歧义。429 指数退避（1s/2s/4s…封顶），队列持久化 |
| 冲突 | 任意双端改写 | 本地优先；冲突进 conflict 表保留两端，用户可单条/全部选择合并 |

> **窗口口径（统一 1 分钟，消除歧义）**：客户端攒批合并窗口与服务端定时任务（Track A Cron Trigger 平台下限）**统一默认 1 分钟**，两者均可在设置中配置。
>
> **未推送必须可见**：1 分钟窗口内若用户关闭页面，本地 IndexedDB 仍完整保有数据，下次启动继续推送，**不会丢失**；但为避免用户误判「数据已上真源」，**未推送条数须在界面常驻显示**（同步状态栏，未清零前不消失），条数较多时给出明确提示。这是把「窗口变长」的副作用转为可感知状态，而不是靠缩短窗口来解决。
>
> **与历史表述的关系**：早期 PRD §8.x.4 的「30 秒合并窗口」指**客户端攒批**，而 Cron Trigger 的 1 分钟下限约束的是**服务端定时**，两者本不是一回事。本版统一取 1 分钟，以消除两套数值长期并存带来的歧义；如需更快，可在设置中下调客户端窗口。

**可观测**：条/秒、时延、成功率、队列长度、**未推送条数**、429 次数须有日志与界面可见（同步状态栏）。

### 6.7 备份与导出

- **三档**：轻（Link 级：Netscape HTML / CSV / Markdown）→ 中（+个性化配置）→ 重（完整本地库 + Snapshot + 配置 ZIP 快照）。
- **导出筛选（先圈范围再导）**：支持按 **全部 / 按文件夹 / 按标签 / 按状态 / 按时间范围** 圈定导出范围，不必每次全量（对应 PRD §4.6.2）。
- 目标：WebDAV / S3 兼容对象存储等，独立启用；备份历史展示时间/目标/结果/体积。
- **单条内容导出**：先选内容（Snapshot 单 HTML / 关联全部内容信息）再选格式。**Track A 默认提供 HTML（即快照原件）与 Markdown**；PDF 不作为 Workers 默认能力（无头浏览器不进 Track A）。需要 PDF 时：浏览器打印/「另存为 PDF」，或仅 Track B 评估服务端转换。

---

## 7. 接口设计

### 7.1 内部模块接口（服务层 API 概要）

| 接口 | 方法/路径 | 职责 | 说明 |
| --- | --- | --- | --- |
| Bookmark CRUD | `POST/GET/PATCH/DELETE /bookmarks[/:id]` | 保存/查询/编辑/软删 | 校验走 shared schema；返回含 Archive 状态位 |
| 搜索 | `GET /bookmarks/search` | 标题/URL/标签/备注 + 结构化筛选（Scene/文件夹/标签/状态/时间） | **端侧 MiniSearch 为主、服务端兜底**；不做全文正文索引（§1.4） |
| 批量操作 | `PATCH /bookmarks/batch` | 批量改 Scene/Folder/Tag/状态/软删 | 单事务提交 + 逐条日志 + 可整体撤销 |
| Scene 管理 | `CRUD /scenes` | 建/改/并/停用/删除 | 停用不删历史引用 |
| 归档 | `POST /bookmarks/:id/archives`（触发）、`GET /archives/:id`（查看）、`GET /archives/:id/content`（下载）、`PUT /archives/:id`（上传替换） | 归档内容四操作：查看/下载/重抓/上传替换 | 触发即建 Job，异步返回；下载走内容存储层直链（签名 URL）；上传替换覆盖内容并追加 Archive Record |
| Archive Job | `GET /jobs`、`POST /jobs/:id/retry`、`POST /jobs/:id/cancel` | 队列观测与操作 | 失败分类返回 |
| Metadata 抓取 | `POST /bookmarks/:id/metadata/refresh` | 重抓 Metadata | 不阻塞主流程 |
| AI 建议 | `POST /ai/suggest` | 理解后给建议（Scene/Folder/Tag + 说明） | 建议不自动落库 |
| 展示集合 | `GET /navigation`、`CRUD /navigation/rules` | 圈选规则与集合 | 求值产物可缓存 |
| 访问记录 | `POST /access-log` | 打开打点 | 供 Rediscover |
| 通道 | `CRUD /channels/*` | Raindrop/S3/WebDAV 配置 | 凭证加密存 |
| 备份 | `POST /backup`、`GET /backup/history` | 三档备份/历史 | 异步任务；请求体支持导出筛选维度（全部/文件夹/标签/状态/时间范围，见 §6.7） |
| 系统 | `GET /stats`、`GET /operation-log`、`GET/POST /recycle-bin` | 统计/日志/回收站 | 管理员级鉴权 |
| 设置与能力 | `GET/PUT /settings`、`PUT /skill/capabilities`、`GET /skill/usage` | 设置读写 / AI 能力开关 / 用量观测 | 能力开关按三级权限组织（§7.2）；usage 含今日请求量/写入量/拦截次数 |

**通用规范**：REST + JSON；响应压缩 brotli；游标分页（`?cursor=&limit=`）避免 OFFSET；批量端点限长；幂等键（Idempotency-Key）防重复提交；错误码统一 `{ code, message, details? }`。

### 7.2 Skill API（AI 平台接入）

**绑定方式**：AI 平台只需 Base URL + Bearer Token。AI 访问 `/.well-known/capabilities` 自发现能力。

| Skill | 输入 | 输出/行为 | AI 边界 |
| --- | --- | --- | --- |
| `save_bookmark` | url（必填）、note、intent、snapshot（默认否） | **同步写入真源**，立即返回稳定 `id`。默认不自动写结构。`snapshot=true`：有 DOM 的入口可生成单 HTML；Skill/Track A 无 DOM 时返回 `snapshotStatus=queued_pending_browser`，不得声称已有快照 | 允许（保存） |
| `search_bookmarks` | query、filters | 标题/URL/标签/备注 + 结构筛选 | 允许（只读） |
| `list_bookmarks` | Scene/状态/文件夹/标签/limit | 筛选+分页列表 | 允许（只读） |
| `update_bookmark` | id、修改字段 | 单条修改 | 允许（单条）；结构字段建议模式可选 |
| `get_stats` | 无 | 统计 | 允许（只读） |
| `trigger_archive` | bookmarkId、type(snapshot) | 建 Archive Job | 允许（单条） |
| `suggest_scene` | bookmarkId / 批量 | 建议 Scene/Folder/Tag，**用户确认后生效** | 建议先行 |

**安全**：能力开关（查询/保存/编辑/批量整理/删除按需启用）；读、写、批量分别限速；今日请求量/写入量/拦截次数可观测；写操作全记 operation_log（actor=agent）。`/.well-known/capabilities` 返回能力清单、参数 schema、限速与边界说明，供 AI 自动发现。

**权限分级（Skill API 侧，方向性）**：AI 能力开关按**三级权限**组织——① **查已有的**（只读：`search_bookmarks`/`list_bookmarks`/`get_stats` 等）；② **写新的**（创建：`save_bookmark`、`trigger_archive` 等新建动作）；③ **改已有的（含删）**（`update_bookmark`、批量整理、删除）。能力粒度与数据库权限的绑定**待具体数据库定稿后再细化**（PRD §4.2.11），此处只定层级方向。

### 7.3 第三方通道接口约束

| 通道 | 角色 | 使用方式 | 约束 |
| --- | --- | --- | --- |
| Raindrop API | 输入源 / 导出方向 | 官方 REST；输入导入、导出 Link 级存档 | 非双向同步；不写 Scene/Status；429 退避；`lastUpdate` 增量 |
| S3 API（R2/MinIO/其他） | 内容存储层 | 对象存取（GET/PUT/DELETE）+ 预签名 URL | 统一 S3 API；多目标可换；压缩后存储 |
| WebDAV | 备份/导出目标 | 文件级写入 | 三档备份可选目标 |

### 7.4 鉴权设计

| 场景 | 方案 |
| --- | --- |
| 工作台/导航页（网页） | 密码页 / URL Token / IP 白名单（公网）；本地内网 + 隧道 |
| Skill API | Bearer Token（可轮换），与通道 Token 分开 |
| 插件 | 与应用同域共享会话；跨域走 Token + 消息桥 |
| 隐私内容 | 私密解锁（应用内二次验证） |

---

## 8. 异常与边界处理

### 8.1 异常场景总表

| 异常场景 | 触发条件 | 处理方式 | 用户反馈 |
| --- | --- | --- | --- |
| 第三方通道中断 | Raindrop/S3/WebDAV 不可达 | 仅影响该通道；本地保存/读正常；入队待恢复 | 同步状态栏提示；轻 Toast 限频 |
| 429 限频 | Raindrop/API 超阈值 | 指数退避（1s/2s/4s…封顶），队列持久化 | 状态栏/日志可见 |
| 抓取失败 | Metadata/Snapshot fetch/parse/timeout | Job failed 分类；不阻塞保存；可重试/补做 | 卡片 Archive 状态位（Link✓/Snapshot✗） |
| Snapshot 勾选但失败 | 目标站点反爬/超时/资源大 | 不回滚 Bookmark；Job 保留 | 保存仍成功 |
| 冲突 | 本地与真源/通道同改一条 | 本地优先；冲突表保留两端 | 可单/全选合并 |
| 重复提交 | 网络抖动双击 | 幂等键去重 | 无感 |
| 大列表性能 | 超 600 条基线 | 游标分页、虚拟列表、懒加载 | 保持流畅 |
| AI 越界 | 尝试删除/批量/自动改结构 | 按 §6.3 拦截 + 限速 + 日志 | 明确拒绝提示 |
| 软删恢复期过 | 回收站超期 | 自动清理（可配置） | 日志记录 |
| 应用不可达 | 断网或服务挂掉 | 保存失败并提示；工作台可保留草稿回显，但**不算保存成功** | 明确失败，待恢复后重试 |

### 8.2 数据校验与安全

- **输入校验**：Zod schema 前后端共享；URL 合法性、字段长度、批量条数上限、分页上限。
- **凭证安全**：Raindrop/Skill/S3 Token 密文存储（加密 at-rest），绝不明文入日志/导出；密钥不落仓库（环境变量/秘密引用）。
- **AI 安全**：见 §6.3——结构类默认不自动写；删除/批量/重构默认拒绝；全部写操作留痕可撤销。
- **隐私**：私密标记默认不出现在导航页；匿名公开非默认（若开放仅限标题/图标/URL 且排除 Inbox/私密）。
- **鉴权**：公网密码页/URL Token/IP 白名单；Skill 独立 Bearer。

### 8.3 日志策略

- **操作日志**：actor/action/target/ts/detail；写操作全量；默认 5000 条/30 天循环覆盖，可清理/导出。
- **系统日志**：error/warn/info 分级；同步/归档/备份引擎关键步骤；429 与退避记录。
- **访问记录**：打点去噪；字段与保留后定。
- **可观测**：同步条/秒、时延、成功率、队列长度、429 计数上状态栏与统计面板。

---

## 9. 构建与部署

> 本版按「默认 Cloudflare Workers（Track A）／可选 Docker 自托管（Track B）」双轨部署（PRD §8.1 已决）。两条轨道互斥二选一：同一部署实例**不要求同时跑两套**，但应用层代码与数据库结构必须保持同一份，保证可迁移。

### 9.1 部署轨道总览

| 维度 | Track A · Cloudflare | Track B · Docker 自托管 |
| --- | --- | --- |
| 定位 | 默认部署，零运维个人云端 | 可选自托管，数据不出自己的机器 |
| 应用运行时 | Workers（含 Cron Trigger） | Bun 或 Node 进程 |
| 数据库（真源） | D1（SQLite 兼容） | bun:sqlite / better-sqlite3 |
| 内容存储（Archive 对象） | R2（S3 API） | 本地卷 或 自建 S3 兼容（MinIO 等） |
| 定时任务 | Cron Triggers（仅轻任务，≥1min；同步不挂服务端定时，见 §6.6） | 进程内 scheduler（Bun.cron / node-cron 或独立 job 容器；无 Cron 粒度限制，可承载重任务） |
| 部署方式 | `wrangler deploy` | `docker compose up -d` |
| 公网鉴权 | 密码页 / URL Token / IP 白名单 | 同左 + 可选反代加一层 |

**共同约束**：

- `packages/db` 数据访问层只在启动时按环境选择驱动，业务代码不感知底层是 D1 还是 bun:sqlite / better-sqlite3（§4.1）。
- Schema 由 Drizzle 管理，两轨共用同一份 migration 产物（D1 remote 与本地 SQLite 方言差异控制在最小面）。
- 通道 Token（Raindrop/S3/Skill）一律走环境变量或秘密引用，不落仓库。

### 9.2 开发环境（本地）

```text
# 安装依赖（pnpm workspace）
pnpm install

# 启动 workbench 原型（Vite+React+TS，mock 数据）
pnpm --filter dogear-workbench dev

# 启动本地服务（Hono；SQLite 走本地文件）
pnpm --filter @dogear/server dev

# 校验（类型 + lint + 测试）
pnpm typecheck
pnpm lint
pnpm test
```

- 本地默认走 Track B 的数据形态（本地 SQLite 文件），方便无网络开发；需要联调 D1 时用 `wrangler dev` 按 Track A 跑同一服务代码。
- 浏览器插件（`apps/extension`）与导航页（新标签页）以静态构建产物加载到 Chrome，`pnpm --filter extension build` 后 `load unpacked`。

### 9.3 构建与发布

**Track A（Cloudflare）**

```text
wrangler d1 create dogear_prod      # 建 D1，回填 binding 与 database_id
wrangler r2 bucket create dogear-content   # 建 R2（Snapshot 内容）
pnpm migrate:d1                       # 应用 Drizzle migration
wrangler deploy                        # 发布 Workers + Pages
# Cron Trigger 单独配置（见 wrangler.jsonc [triggers]）：只挂轻量任务（如通道拉取、Metadata 重抓调度），最短 1 分钟
# 本地↔真源同步不由服务端定时驱动：客户端在线即 flush（见 §6.6）
```

**Track B（Docker）**

```text
docker compose up -d                  # 拉起 server + 内容卷；首次自动建库 + migration
docker compose logs -f                # 观察同步/归档/备份引擎日志
```

**发布清单（两轨通用）**：

- [ ] migration 已应用到目标环境（D1 / SQLite 卷）
- [ ] R2 / 内容卷 bucket 已建，`CONTENT_STORAGE` 指向正确
- [ ] 各通道 Token 注入环境变量/秘密引用（Raindrop / Skill Bearer / S3）
- [ ] Cron（Track A Trigger / Track B scheduler）已注册：**仅轻量定时任务（默认 1 分钟，如通道拉取、Metadata 重抓调度、备份节流）**；本地↔真源同步由客户端攒批推送驱动（窗口默认 1 分钟，可配），不依赖服务端定时
- [ ] 未推送条数在同步状态栏可见；设置项已暴露（客户端攒批窗口 / 服务端定时周期）
- [ ] 429 退避与审计保留（5000 条/30 天）参数按需配好
- [ ] 首次登录鉴权（密码页 / URL Token / IP 白名单）验证通过

### 9.4 多端数据策略

- 端侧（工作台/导航页/插件）**读**可走本地缓存；**写**以服务端真源为准（§6.1）。离线可读缓存、可提示失败，不把离线写入当成保存成功。联网后按 §6.6 对账。
- 备份兜底不依赖第三方通道：导出/三档备份可直接面向本地文件（HTML/CSV/MD/JSON），也可指向 S3 兼容目标。
- 多设备之间通过**同一部署实例**共享数据；不承诺 Peer-to-Peer 或跨实例互同步。

### 9.5 鉴权部署形态

| 场景 | 方案 |
| --- | --- |
| 工作台/导航页（公网） | 密码页 / URL Token / IP 白名单 |
| Skill API | Bearer Token（可轮换），与通道 Token 分开 |
| 本地内网 + 隧道 | Docker 自托管 + 反代；鉴权同上 |
| 隐私内容 | 私密解锁（应用内二次验证） |

### 9.6 性能策略（分级按需加载与可观测，方向性）

> 对应 PRD §7 性能要求的技术落点：**以分级按需加载补偿 Cloudflare 对国内网络的时延，以内置性能检测用数据反映网络/数据速度**。本版**不预设硬性速度验收阈值**——速度受网络与设备条件制约，主观阈值不可验收；以可观测数据作为后续调优依据（与 PRD §7.1「性能可观测（方向性）」同口径）。

- **分级按需加载（方向）**：静态资源（JS/CSS/封面/图标/字体）与数据（列表/详情/统计）按当前**网络与设备条件**分级加载——核心链路（保存、Inbox、搜索）优先且最小化；非核心（封面图、统计面板、批量工具等）可延迟/懒加载；弱网下降级为文本骨架优先。
- **延迟补偿（设计导向）**：工作台写操作可即时回显（缓存），保存成功仍以真源落库为准（§6.1）；首屏读缓存零网络请求；同步在后台对账（§6.6）。Skill 无此延迟补偿，直接写真源。
- **性能可观测（方向性）**：内置轻量性能检测面板，**用数据反映网络/数据速度**（首屏资源耗时、搜索响应、同步条/秒、时延、成功率、队列长度、429 次数），与 §6.6 同步可观测共用同一套埋点与界面。
- **关联**：600 条基线口径见 §1.2；超基线降级（游标分页/虚拟列表/懒加载）见 §8.1；同步可观测见 §6.6。

---

## 10. 里程碑路线

> 拆解与实现**只针对核心需求**；近期/远景只作演进方向保留，不排进当期计划（PRD 附录 B）。本文按「工程里程碑（M）」组织，与 PRD 的「核心/近期/远景」分层对应但不混写。

| 里程碑 | 目标 | 主要交付 | 退出标准（可验证） |
| --- | --- | --- | --- |
| **M1 骨架** | 仓库结构与基础链路打通 | workspace 初始化（apps/web、apps/server、packages/db、packages/shared）；Drizzle schema v1（仅 D1/SQLite）；Dexie 镜像另建；本地 SQLite + D1 双驱动冒烟 | 一条 Bookmark 经 **服务端 Capture** 写入真源并在工作台读出；类型/lint 通过 |
| **M2 工作台能存** | **过关**：工作台能存 Link | 保存表单；Inbox/列表；稳定 UUID 真源落库；同步状态栏（未推送条数）；**访问记录开始打点** | 登录后保存一条链接，刷新/换端仍在；应用不可达时保存失败提示 |
| **M3 Agent 能存** | **过关**：Agent 能存 Link | Skill API（自描述 + 七个技能 + Bearer + 限速 + 审计）；`save_bookmark` 同步写真源并返回正式 id | 外部 AI 调用一次保存，返回稳定 id，工作台立刻能看到 |
| **M4 工作台本期核心** | 本期核心（非过关门槛） | 搜索/筛选/⌘K；Scene/Status/Folder/Tag 单条与批量改；AI 建议四落点；回收站；操作日志；首次使用引导（不强制 Raindrop） | 按 PRD §4.2 工作台必须项走通；600 条基线列表流畅 |
| **M5 数据通道与同步** | 通道可用 + 数据管理可选 | Raindrop/S3/WebDAV；sync_queue；客户端攒批；导入梳理页；429 退避；conflict | 通道导入一次、导出一次；首次引导可跳过 |
| **M6 归档与备份** | Snapshot 单 HTML（非默认）+ 三档备份 | Archive Job；有 DOM 时产出单 HTML；无 DOM 时 queued 提示；失败不回滚；轻/中/重备份（HTML/MD；PDF 非 Track A 默认） | 勾选快照得到单 HTML 文件；Skill 勾选快照不谎称已生成 |
| **M7 导航页（网页形态）** | 导航页核心框架 | 网页形态导航页（规则/工具圈选）；访问记录已在 M2 落库，本里程碑接上展示 | 导航页可浏览、可直达；展示范围与工作台配置一致 |

**里程碑与产品分层的关系**：

- M1–M3 覆盖过关门槛（工作台保存 Link + Agent 保存 Link）。
- M4 覆盖工作台本期核心（搜索/批量/AI 建议/回收站等），**不计入过关**。
- M5/M6 对应数据通道、Snapshot 单 HTML、备份。
- M7 导航页网页形态。**访问记录从 M2 开始落库**（核心需求）；Rediscover 卡片仍是近期，不进本表。
- 近期（看板、Rediscover 卡片、组织记忆、更稳 Snapshot、移动端评估）与远景（Reader、Markdown 剪藏、高级 AI）**不进上表**，待核心稳定后按附录 B 引入时机评估。

> 里程碑不绑定时间承诺；每个里程碑按「先交验收再进下一步」推进，验收标准以上表退出标准为准。

---

## 11. 待确认 / 待决策事项

> 本节承接 PRD §09「待决策事项」与技术侧未决项。PRD 侧已决的不再罗列（导航页两种形态、插件加速入口、Snapshot 存储产品口径、部署双轨等均已决）。下表只保留**需要技术方案推进时确认或验证**的项，并按状态标记区分（✅已定 / ⏳暂定 / 💡方向性 / ❓待决策）。

| # | 事项 | 状态 | 备注 / 关联章节 |
| --- | --- | --- | --- |
| T-1 | Docker 运行时选 Bun 还是 Node | ⏳暂定 | `bun:sqlite` 与 `better-sqlite3` 二选一；倾向 Bun，需做一次基准与生态核对（§4.1） |
| T-2 | 端侧缓存形态（Dexie/IndexedDB vs SQLite WASM） | ⏳暂定 | 网页端 IndexedDB 更顺；插件侧可复用同一 adapter（§5.5） |
| T-3 | 导航页展示规则「按规则-或」的算子集合与冲突语义 | 💡方向性 | 「全部/规则-或/自定义搜索集/隐藏」大方向已决（PRD #18）；叠加取并集还是可配置优先级等**算子细部**随模块文档推进（§6.5） |
| T-4 | 访问记录字段与去噪规则 | ⏳暂定 | 先记、字段后定；打点去噪避免自刷干扰「长期未访问」（§8.3） |
| T-5 | Raindrop 通道的字段映射边界 | ✅已定 | 基础字段名与官方对象对齐（§5.7）；Scene/Status/Archive/本地扩展不同步。观察字段（highlights/reminder/file 等）只读保留 |
| T-6 | Archive 内容保留策略与容量上限 | 💡方向性 | Snapshot 存储与容量产品已决不阻塞；技术侧保留周期/压缩/去重待评估（§5.3） |
| T-7 | 多目标对象存储容灾策略 | 💡方向性 | S3 兼容多目标并存；校验与自动容灾细化（PRD §B.4） |
| T-8 | Reader 相关字段预留在 Schema 中的深度 | 💡方向性 | 只做类型预留字段，不实现（§5.2.3）；避免过度建模 |
| T-9 | KV 边缘缓存是否启用 | 💡方向性 | 默认不加；压测后再评估（§3.1/§4.1） |
| T-10 | 匿名公开是否开放及范围 | 💡方向性 | PRD #12 已决：第一版默认登录；是否开放匿名公开及范围（标题/图标/URL、排除 Inbox/私密）待评估（§8.2） |
| T-11 | Cloudflare 进阶计费能力（Queues/Workflows/DO）是否引入 | 💡方向性 | 仅规模需要队列/编排/多实例一致性时评估；各自带免费额度与计费边界，作为可选层不挡核心路径（§4.2） |
| T-12 | Track A 无 DOM 源的整页快照 | ✅已定（产品口径） | 只产 Metadata + `queued_pending_browser`；格式优先单 HTML。不在 Track A 做服务端整页抓取（§5.2.3/§6.4） |

> 定稿原则：与技术方案强相关的项在落地细化文档中收敛，不回流 PRD；PRD 冲突以 PRD v1.0.7 为准。

---

## 12. 附录

### 12.1 参考文档

| 文档 | 路径 | 说明 |
| --- | --- | --- |
| 需求总纲 v1.0.7 | `wiki/DogEar_折耳书签_需求总纲_v1.0.7.md` | 唯一需求源 |
| 本文档 | `docs/DogEar_折耳书签_技术总纲_v1.0_DeepSeek.md` | 技术总纲 v1.0_DeepSeek（现行技术口径） |

> 参考文档表**只列两份现行文档**（需求总纲 + 技术总纲）；其余落地细化 / 模块细部 / Draft / 归档文档不在此列（D2 口径），需要时按 §0.1 承接关系定位。

> 撰写说明：本文撰写时不参考既有 v0.2 稿及任何历史总纲/技术方案稿；`docs/Draft/` 与 `docs/archive/` 中旧口径文档仅作追溯参考，冲突以本文与 PRD 为准。

### 12.2 术语表

> 术语口径以 PRD §10 术语表为准，本表只列本文高频且易混的术语，避免两份定义打架。

| 术语 | 本文口径 |
| --- | --- |
| Bookmark | 长期引用对象核心；Link 为默认基础形态（URL+Metadata） |
| Scene | 使用情境维度（可多属、可扩展）；仅 DogEar 内有效，不写入 Raindrop |
| Status | 待处理/已确认/搁置（底层 `unread`/`saved`/`archived`）；与内容 Archive 无关 |
| Archive | 内容保全副本：Snapshot（当前）/ Reader（远景）；通过 ArchiveJob 异步产生 |
| Capture / Organize / Rediscover | 好存 / 好管理 / 好重新发现，三个一级产品目标 |
| 软删除 | 标记删除 + 保留周期可恢复；回收站默认 7 天（可配） |
| 真源（source of truth） | 应用自身数据库；Raindrop/S3/WebDAV 只是可选通道 |
| 双轨部署 | Track A Cloudflare Workers（默认）/ Track B Docker 自托管（可选），互斥二选一 |
| 核心/近期/远景 | 需求分层（PRD 附录 B）；不用 P0/P1/P2 |

### 12.3 需求文档对应索引

| 本文章节 | 主要对应 PRD 章节 |
| --- | --- |
| §1 项目概述 | §01 产品定义、§1.4 边界声明 |
| §2 需求映射总览 | §01–§06、附录 B（分层总览） |
| §3 系统架构 | §8.1 部署方向、§8.2 多设备策略、§8.x 技术路线（暂定，非需求源） |
| §4 技术选型 | §8.x（暂定技术路线）、§08 部署与运行环境 |
| §5 核心数据设计 | §02 核心概念、§05 数据与同步；PRD 附录 C 属性总表已迁移至本表 §5.7 |
| §6 核心流程设计 | §03 用户工作流、§04 功能模块、§4.5 搜索与 Rediscover |
| §7 接口设计 | §4.4 Skill API、§4.2.11 Agent 接入 |
| §8 异常与边界处理 | §06 安全与约束、§07 性能要求 |
| §9 构建与部署 | §08 部署与运行环境、§8.1–8.3；§07 性能要求（§9.6 方向落点） |
| §10 里程碑路线 | 附录 B Roadmap（产品分层） |
| §11 待确认/待决策 | §09 待决策事项 |

---

## 13. 文档变更记录

| 版本 | 日期 | 作者 | 说明 |
| --- | --- | --- | --- |
| v1.0_DeepSeek | 2026-09-02 | DogEar 项目组（匿名） | 初稿：按 PRD v1.0.7 从产品+技术双视角重建技术总纲；与既有 v0.2 稿分离命名，独立成文 |
| v1.0_DeepSeek（同步/归档平面修订） | 2026-09-02 | DogEar 项目组（匿名） | §6.6 拆「本地↔真源（客户端 flush）」与「Raindrop 通道（轮询+429）」两平面；删除 Cron 30s（平台下限 1min）；§6.4/§5.2.3 明确 Track A 整页 Snapshot 走浏览器直传、Server 仅 Metadata、Docker 可选整页抓取；§4.2/§11 补定时任务边界与 Cloudflare 进阶能力（Queues/Workflows/DO）可选层 |
| v1.0_DeepSeek（增补） | 2026-09-02 | DogEar 项目组（匿名） | §5.7 新增字段与 Raindrop 映射总表：承接 PRD v1.0.7 附录 C（C.1–C.6 全量迁移）；PRD 附录 C 改为引用本小节，正文交叉引用同步更新 |
| v1.0_DeepSeek（B/C/D 级整改） | 2026-09-02 | DogEar 项目组（匿名） | 依一致性核对报告作 B/C/D 级整改：§2.2 补内联编辑/工具面板/导出筛选三行映射；§4.3 补 lucide-react、@tanstack/react-table、wouter、tailwindcss；§5.2.2 补 AERR 呈现方向（细节留待单独模块）；§5.3 补 page_tab 轻量持久化口径；§6.4/§7.1 补归档四操作与下载/上传替换端点；§6.7/§7.1 补导出筛选维度与接口参数；§7.1/§7.2 补搜索端点、设置/能力/用量端点与 Skill 三级权限；§9.6 新增性能策略（方向性，不设硬阈值）；§11 T-3/T-10 改 💡方向性；§12.1 参考表收敛为两份现行文档 |
| v1.0_DeepSeek（保存链路与快照口径） | 2026-09-03 | DogEar 项目组（匿名） | 拆工作台/Skill 保存路径；保存成功=真源落库；Drizzle≠Dexie；Snapshot 优先单 HTML；PDF 非 Track A 默认；访问记录提前到 M2；T-5/T-12 已定；路径改为 docs/modules 与 docs/archive |
| v1.0_DeepSeek（开源引用） | 2026-09-03 | DogEar 项目组（匿名） | 接受 SingleFile AGPL；Track A 快照用 SingleFile、Track B 用 monolith；Metadata 用 metascraper；搜索用 MiniSearch；文末增 §14 引用表供 README 搬用 |

> **文档维护说明**：本文档随项目开发进度持续更新。重大技术方案、架构或功能变更应同步修订本文档，并记录于文档变更记录中。凡与旧落地文档口径冲突处，一律以 PRD v1.0.7 与技术总纲 v1.0_DeepSeek 为准。

---

## 14. 引用的开源项目

> 本节可整段搬进 `README.md` 的致谢/依赖说明。许可以各仓库当时文本为准。DogEar **接受 SingleFile 的 AGPL-3.0**：快照核心单独成包，服务端只接收其产出的 HTML，不把 AGPL 代码编进 Hono/Drizzle 主栈。

### 能力层（按需引用，不自研）

| 项目 | 许可 | 在本项目中的用途 | 仓库 |
| --- | --- | --- | --- |
| SingleFile / single-file-core | AGPL-3.0-or-later | Track A：把当前页打成单 HTML 快照 | https://github.com/gildas-lormeau/SingleFile · https://github.com/gildas-lormeau/single-file-core |
| monolith | CC0-1.0 | Track B：按 URL 将公开页打成单 HTML | https://github.com/Y2Z/monolith |
| metascraper | MIT | 保存后异步抽取标题/描述/封面等 Metadata | https://github.com/microlinkhq/metascraper |
| MiniSearch | MIT | 工作台本地搜索（标题/URL/标签/备注） | https://github.com/lucaong/minisearch |

### 工程栈（已定）

| 项目 | 许可 | 在本项目中的用途 | 仓库 |
| --- | --- | --- | --- |
| React | MIT | 工作台 / 导航页 | https://github.com/facebook/react |
| Vite | MIT | 前端构建 | https://github.com/vitejs/vite |
| Hono | MIT | 服务端 HTTP（Workers / Docker） | https://github.com/honojs/hono |
| Drizzle ORM | Apache-2.0 | D1 / SQLite 真源 | https://github.com/drizzle-team/drizzle-orm |
| Zod | MIT | 前后端共享校验 | https://github.com/colinhacks/zod |
| Dexie.js | Apache-2.0 | 端侧 IndexedDB 镜像缓存（M5 引入） | https://github.com/dexie/Dexie.js |
| TanStack Query | MIT | 服务端状态 | https://github.com/TanStack/query |
| TanStack Table | MIT | 列表 | https://github.com/TanStack/table |
| Zustand | MIT | 模块级 UI 状态 | https://github.com/pmndrs/zustand |
| shadcn/ui | MIT | 组件体系（Radix + Tailwind） | https://github.com/shadcn-ui/ui |
| WXT | MIT | 浏览器插件脚手架（加速形态，不挡过关） | https://github.com/wxt-dev/wxt |
| wrangler | Apache-2.0 / MIT（以仓库为准） | Workers 部署 | https://github.com/cloudflare/workers-sdk |

Raindrop.io、Cloudflare D1/R2/Workers、S3 兼容对象存储为服务/平台，不是本表意义上的嵌入式开源库；使用时遵守其条款。
