# DogEar · 折耳书签 技术总纲

> **版本**：v0.2-draft
> **日期**：2026-09-02
> **作者**：DogEar
> **对应需求文档**：[需求说明书 v1.0.7](../wiki/DogEar_折耳书签_需求说明书_v1.0.7.md)
> **状态**：技术总纲重建稿。产品约束以 PRD 为准；实现栈凡未讨论确认的一律标 **方向性 / 暂定**，不擅自定稿。
> **写法**：骨架取自 [`docs/技术总纲文档范例.md`](技术总纲文档范例.md)（范例原文不动）。不改 [`docs/归档/`](归档/) 内旧总纲 / 旧方案。
> **冲突时**：PRD > 本文 > `docs/Draft/` 旧落地文档（多数仍写旧口径，不可当作现行方案）。

------

## 1. 项目概述

### 1.1 项目背景

DogEar（折耳书签）是以 **Bookmark（书签地址）** 为核心实体的个人网页信息收集与管理工具。产品要解决的不是「再做一个阅读器 / 笔记库」，而是：链接要好存、存完能按场景整理、过一段时间还能被找到。

应用数据始终为真源。Raindrop、S3、WebDAV 等是数据管理选项（输入源和/或导出 / 备份），不是登录门槛，也不是多端同步通道。不接任何第三方时，产品仍须完整可用。

现行产品需求已定稿为 PRD v1.0.7。原技术总纲 / 技术方案 v0.1 因结构不满意已归档；本文按范例骨架重建，把「需求要什么」映射成「系统有哪些模块、数据怎么走、哪些已决、哪些还不能写死」。

### 1.2 核心目标

- **好存（Capture）**：能连上本应用即可保存 Link。保存不依赖 Scene / Folder / Tag / Snapshot / 第三方通道。
- **好管理（Organize）**：Scene / Status / Folder / Tag 四维解耦；一套工作台；AI 只建议、默认不自动写入结构。
- **好找（Rediscover）**：搜索 + 访问记录先落地；导航页是访问 / 展示层，不是第二个管理器。
- **核心框架过关（最小集）**：工作台能保存书签 **+** Agent（Skill）能保存书签。
- **工作台核心功能（必须有）**：Inbox、列表、搜索、筛选、单条 / 批量改 Scene·Folder·Tag·状态、AI 建议（输入时 / 整理时 / Inbox / 未整理详情）、回收站。

### 1.3 使用场景

- **使用者**：个人用户（无多人协作）。
- **运行环境**：Web 工作台 + Skill API 为当前核心；浏览器插件为加速形态；部署默认 Cloudflare Workers，其次 Docker 自托管。
- **典型场景**：
  - 工作台粘贴 URL，立刻得到一条待处理 Bookmark。
  - 对 AI 说「把这个链接存下来」，Skill `save_bookmark` 写入应用并回显。
  - 稍后在 Inbox / 列表里补 Scene、改状态、搜索找回。
  - 打开导航网页，点图标访问已圈选的书签。
  - 可选：把已有 Raindrop 库当作输入源导入，或把 Link 级记录导出为存档。

### 1.4 非目标

- 不是笔记工具，不是阅读器；不提供重型文本编辑。
- Reader / 手动选正文 / 高亮产品入口：愿景规划，本期不方案化。
- 移动端 App / Share Extension / URL Scheme：不作为本版核心。
- 本版不定义 URL 去重规则。
- Raindrop **不是**默认双向持续同步，也 **不是**多端真源。
- Scene / Status / Inbox 语义 / AI 建议 / 导航圈选 **不写入** Raindrop 存档。
- 不为愿景能力预支复杂引擎（Scene 层级、规则工作流、CRDT）。

------

## 2. 技术选型

> **产品已决（PRD §8.1，可写进架构）**：默认 Cloudflare Workers，其次 Docker；两轨二选一、互不级联；多端走该部署，不靠 Raindrop。
>
> **实现栈（PRD §8.x / `AGENTS.md` 目录）**：下列为方向性候选，**状态 = 暂定**。未与用户确认前，拆解与代码不得把某一行当成已定框架。

### 2.1 技术栈

| 层级 | 选型（候选） | 版本 | 选型理由（方向） | 状态 |
| --- | --- | --- | --- | --- |
| 前端 / 工作台 | Vite + React + TypeScript | 待定 | 与现有 `dev/dogear-workbench` 原型同族；虚拟列表服务 600 条基线 | 暂定 |
| 导航页 · 网页 | 与工作台同栈、同鉴权会话 | 待定 | 核心过关只需网页形态能打开 | 暂定 |
| 导航页 · 插件 | Chrome 扩展 MV3（新标签页） | 待定 | 加速形态，与网页同一套表现；不挡核心过关 | 暂定 |
| 后端 / 核心 | TypeScript + Hono | 待定 | Web Standards，Workers / Docker 可共用业务代码 | 暂定 |
| 结构化存储 | 服务端真源 + 端侧缓存（方向） | — | 分层已定；引擎（D1 / SQLite / IndexedDB 等）待确认 | 方向性 |
| 内容存储 | 与结构化数据分离；S3 兼容为候选 | — | Snapshot 按需归档；落点 / 多目标 / 冗余待确认 | 方向性 |
| 打包 / 部署 | Workers 轨一键部署；Docker 轨自托管 | 待定 | 产品已决双轨；具体 CLI / 镜像 / 运行时待确认 | 产品已决轨 · 引擎暂定 |

### 2.2 关键依赖

| 依赖名 | 版本 | 用途 | 状态 |
| --- | --- | --- | --- |
| Hono | 待定 | 工作台 API、Skill API、鉴权中间件 | 暂定 |
| Dexie / IndexedDB | 待定 | 端侧缓存候选（`packages/db`） | 暂定 |
| SQLite 驱动（Docker 轨） | 待定 | 服务端真源候选；运行时 Bun vs Node 未确认 | 暂定 |
| D1（Workers 轨） | 平台 | 服务端真源候选 | 暂定 |
| Zod 或等价 schema | 待定 | 前后端共享校验 | 暂定 |
| Raindrop.io API | 官方 | **可选**输入源读入 / 导出存档写出；非核心依赖 | 已决角色 · 接法待方案 |
| S3 兼容 API | — | 内容 / 备份目标候选 | 方向性 |
| WebDAV 客户端 | 待定 | 备份目标候选 | 方向性 |

------

## 3. 功能规划与模块设计

从 PRD §03 工作流、§04 功能模块、附录 B 推导。**不新增能力，不改核心 / 近期 / 愿景分层。** 拆解与实现只针对核心需求。

编号供后文引用，不是实现优先级。

### 3.1 需求-功能映射表

| 需求章节 | 需求描述 | 功能点 | 分层 | 技术实现（方向） |
| --- | --- | --- | --- | --- |
| §1.2 / §4.1 | 核心过关：工作台保存 | C1 页面保存 Link | 核心 | 工作台表单 → 应用 API → 真源；默认 Inbox |
| §1.2 / §4.4 | 核心过关：Agent 保存 | C3 Skill `save_bookmark` | 核心 | `/.well-known/capabilities` + Bearer；只 URL 即可 |
| §3.1 / §4.1 | 插件保存 | C2 插件保存 Link（可用 DOM） | 近期（加速，不挡过关） | 扩展 → 同应用 API |
| §2.3 / §3.1 | 异步 Metadata | C4 保存后补抓取 | 核心 | Archive Job `type=metadata`；失败不回滚 Bookmark |
| §2.0 | Scene 可配置、多对多 | O1 Scene 模型与一套工作台 | 核心 | Scene 表 + 多对多关联；禁止硬编码枚举 |
| §2.0 / §2.1.2 | Folder / Tag / 标星 | O2 组织维度 | 核心 | 应用内完整；导出时可写 Raindrop 同构字段 |
| §2.1.1 | 三态；Inbox 可长期停留 | O3 Status | 核心 | 对外待处理 / 已确认 / 搁置；底层 `unread` / `saved` / `archived` |
| §4.2 | Inbox / 列表 / 搜索 / 筛选 / 单批量改 | O4 工作台核心操作 | 核心 | `apps/web`；过关先做列表 |
| §4.2.7 | AI 建议四落点 | O6 建议分流 | 核心 | 建议态；默认不自动写 Scene/Folder/Tag；可撤销 |
| §4.4.2 | Skill 读改列建议 | O7 其余 Skill | 核心（search/update/list/suggest）；`batch_organize` 实验 | 与保存同鉴权 |
| §4.5 | 搜索 | R1 标题 / URL / 标签 / 备注 | 核心 | 本地索引为主，不做正文全文 |
| §4.5 | 访问记录 | R2 打开行为落库 | 核心（先记；历史页非必须） | 各端打开原链接时写记录 |
| §4.3 | 导航页网页形态 | R3 圈选范围 + 图标打开 | 核心（网页）；插件形态近期 | 工作台写圈选规则；导航页只展示 |
| §2.2 / §4.1 | Snapshot 可勾选、非默认 | A1 按需快照 | 核心能力、非默认 | Archive Job `type=snapshot`；失败不回滚 Link |
| §3.3.2 | 查看 / 下载 / 重抓 / 替换 | A2 Snapshot 管理 | 核心 | 内容存储层；不进 Raindrop |
| §4.6.3 | 单条内容导出 | A3 先选内容再选格式 | 核心 | HTML / PDF / Markdown |
| §3.0 / §5.2 | 首次数据管理选择 | D1 可跳过、可多选、可稍后 | 核心 | 设置 / 向导；不引导登录 Raindrop |
| §5.2 | Raindrop 输入源 | D2 可选导入 | 核心（能力有，默认关） | 导入任务；首次可进 Inbox 或保持原路径 |
| §5.2 | Raindrop 导出存档 | D3 可选写出 | 核心（能力有，默认关） | Link 级；不带 Scene / Inbox |
| §4.2.10 / §4.6.1 | 三档备份 | D5 轻 / 中 / 重 | 核心 | 备份是灾备兜底，不是多端手段 |
| §6 / §8.3 | 鉴权、软删除、日志 | S1 / S2 | 核心 | 工作台必须鉴权；回收站；操作日志有限保留 |
| §4.2.3 | 看板 / 标签聚合 | — | 近期 | 不进本期拆解 |
| §4.2.6 | 独立整理模式 | O5 | 近期（可选加速，非过关） | 可留数据位，不做当期页面承诺 |
| §4.2.7a | 组织记忆 / 迁移建议 | — | 近期 | 不做当期方案 |
| 附录 B | Reader / 手动选正文 | — | 愿景 | 总纲不写实现 |

### 3.2 功能全景图

```text
DogEar
├── 核心需求（本期拆解只针对这一层）
│   ├── Capture：工作台保存、Skill 保存、异步 Metadata
│   ├── Organize：Scene/Status/Folder/Tag、Inbox、列表、搜索筛选、单批量改、AI 建议四落点、回收站
│   ├── Rediscover：本地搜索、访问记录落库、导航页网页形态（规则圈选）
│   ├── 保全：按需 Snapshot（可勾选、失败不挡保存）
│   ├── 数据管理：可选 Raindrop 输入/导出、S3/WebDAV 等选项、三档备份
│   └── 系统：工作台鉴权、Skill Token、操作日志、软删除
├── 近期需求（核心过关后再扩展；总纲只留位）
│   ├── 插件保存与导航页插件形态打磨
│   ├── 看板 / 标签聚合 / 独立整理模式 / 死链统计
│   ├── Rediscover 卡片、组织记忆
│   └── 更稳 Snapshot、移动端评估
└── 愿景规划（不写方案）
    ├── Reader 清洗阅读版
    ├── 手动选正文 / 高亮
    └── 更高级 AI（显式自动分流等）
```

### 3.3 模块划分与职责

对应仓库规划目录（`AGENTS.md`）。正式工程尚未按此落地时，路径仍是目标归属，不是「已经存在的代码」。

| 模块名 | 职责 | 包含功能点 | 对应源码路径 |
| --- | --- | --- | --- |
| **入口层（Entry）** | 三种写入入口汇聚为同一套「创建 Link」 | C1 页面、C2 插件、C3 Skill | `apps/web`、`apps/extension`、`apps/server` Skill 路由 |
| **界面层（UI）** | 工作台管理；导航页只访问 / 展示 | O1–O4、O6、R1、R3、S2 | `apps/web/src/{app,features,components}`；导航网页同应用或独立路由；插件 `apps/extension` |
| **核心逻辑层（Core）** | Bookmark 生命周期、状态机、异步任务 | C4、A1/A2、O3、访问记录 | `apps/server/src/services` |
| **规则 / 策略层（Rule）** | 导航圈选（全部 / 按规则-或 / 自定义搜索勾选 / 隐藏）；AI 建议策略；AERR 仅内部 | R3、O6、Scene 呈现 | `apps/server` + `packages/shared`；细部见 `docs/module/` |
| **数据层（Data）** | 真源、缓存、内容对象、可选通道 | 分层存储、D1–D5 | `packages/db`、`apps/server` 通道适配器 |
| **工具层（Utils）** | 共享类型、校验、ID、观测 | 全模块 | `packages/shared` |

依赖方向：Entry / UI → Core → Data；Rule 被 Core / UI 调用；禁止 Data / Server 反向依赖 UI。

### 3.4 核心功能详细设计

#### 3.4.1 Capture：创建 Link

- **设计模式**：命令式写入 + 异步后续（Metadata / 可选 Snapshot）。
- **设计原则**：保存路径最短；任何整理、抓取、第三方失败都不得回滚 Bookmark。
- **扩展性**：入口可加（插件、其它 App），创建语义不变。
- **关键模块**：`saveBookmark`（Core）、入口适配（Web 表单 / Skill / 扩展）、`ArchiveJob(metadata)`。
- **输入**：`url`（必填）；可选 `note`、`intent`、`snapshot=false`。
- **输出**：Bookmark（临时或正式 ID）、默认 Status=待处理、可选 AI 建议（不自动写入结构）。
- **处理流程**：校验 URL → 写入应用真源 → 立即返回 → 入队 Metadata →（仅当显式勾选）入队 Snapshot。

#### 3.4.2 Organize：四维 + 一套工作台

- **设计模式**：四个独立维度自由组合；工作台单壳，Scene 只换上下文（排序 / 密度 / 主按钮文案，第一版可先共用列表）。
- **设计原则**：Capture 不强制 Scene；Inbox 不强制转出；不把 AERR 展示给用户。
- **扩展性**：Scene 为可配置数据，禁止 `union` 死枚举。
- **关键模块**：Scene 实体与成员表（细部 `docs/module/Scene-AI与待设计细部.md`）、Status 状态机、Folder/Tag、列表查询。
- **输入**：筛选条件、单条 / 批量补丁。
- **输出**：更新后的 Bookmark；写操作日志；可撤销。
- **处理流程**：读真源 / 缓存 → 校验补丁（AI 路径另走建议态）→ 事务写入 → 刷新列表。

#### 3.4.3 Skill API

- **设计模式**：自描述能力清单 + Bearer Token；不绑定特定 AI 平台。
- **设计原则**：`save` 必须回显；结构字段默认建议不自动写；`batch_organize` 标 experimental，需确认才生效。
- **扩展性**：capabilities 增技能即可被再发现；改契约升 version。
- **关键模块**：`GET /.well-known/capabilities`、各 `POST /skill/*`、限速与用量观测。
- **输入 / 输出**：见本文 §7.2。
- **处理流程**：鉴权 → 限速 → 执行允许的写 / 读 → 写操作日志（写操作）→ 统一错误体。

#### 3.4.4 Snapshot / Archive Job

- **设计模式**：Job 与 Bookmark 解耦；多来源（server / browser / agent / manual）可降级。
- **设计原则**：内容保全 ≠ 保存成功；勾选失败也不回滚 Link。
- **扩展性**：`type` 预留 `reader`，本期不实现。
- **关键模块**：Job 队列、抓取执行器、内容存储适配器、Archive Record。
- **输入**：`bookmark_id` + `type=snapshot`。
- **输出**：内容对象 + Record（parser / source / storage_location）。
- **处理流程**：创建 Job → 选来源执行 → 写入内容层 → 回写 Record → 失败可重试，Bookmark 保持有效。

#### 3.4.5 导航圈选

- **设计模式**：工作台控「是否显示」，导航页控布局；规则先做 **或**。
- **设计原则**：非逐条点选作为唯一方式；关导航不丢页面标签 / Docker 配置。
- **扩展性**：长期可拆 `Bookmark → Navigation Item → Navigation Page`（待设计，不提前建表）。
- **关键模块**：圈选规则持久化、展示集合物化、导航只读查询。
- **输入**：全部 / 按规则（或） / 自定义搜索勾选 / 隐藏。
- **输出**：导航可渲染的条目集合（默认排除 Inbox、私密、被排除项，除非规则明确纳入）。
- **处理流程**：保存规则 → 计算集合 → 导航页读取集合 → 点击打开并写访问记录。

#### 3.4.6 数据通道（可选）

- **设计模式**：通道适配器；产品可零通道运行。
- **设计原则**：Raindrop = 输入源和/或导出存档，不是默认定时双向同步，不做双端 CRDT。
- **扩展性**：S3 / WebDAV 等同为选项，可多选。
- **关键模块**：导入任务、导出任务、字段映射（附录 C）、不映射表（Scene / Status / 圈选 / AI）。
- **输入**：用户启用的通道与方向。
- **输出**：导入进应用 / 导出 Link 级存档；回收站默认不导出。
- **处理流程**：见 §5.3。

### 3.5 功能边界与限制

| 场景 | 处理方式 | 理由 |
| --- | --- | --- |
| 第三方未配置或中断 | 仍可保存 / 整理；恢复后再做已配置的导出 | PRD §5.2.3 |
| 应用不可达 | 本版不承诺仍能保存 | 保存前提是「能连上本应用」 |
| Snapshot 失败 | Bookmark 成立，Job 失败可重试 | 保存与保全解耦 |
| AI 低把握 | 不写 Scene，留 Inbox | §2.0.2 / §4.2.7 |
| AI 想删数据 / 改文件夹结构 / 默认批量 | 拒绝 | §6.1 |
| 与外部记录冲突 | 保留两端，用户单选 / 全选 / 手工合；不阻塞本地 | §6.2；本地优先 |
| 超 600 条 | 允许非核心降级；保存与搜索不得失败 | 600 是性能基线不是上限 |
| Reader / 去重 / 移动端 | 不实现 | 愿景或明确非核心 |

### 3.6 功能迭代路线

对应 PRD 附录 B。表头保留范例的阶段名，含义改成产品分层，避免再引入 P0/P1/P2。

| 阶段 | 目标 | 包含功能 | 验收标准 |
| --- | --- | --- | --- |
| **MVP** | 核心框架过关 | 工作台保存 + Skill 保存；Bookmark 真源；Inbox 默认 | 能连上应用即可存；Agent 丢 URL 能在工作台看见 |
| **V1.0** | 核心工作台闭环 | Inbox、列表、搜索筛选、四维单批量改、AI 建议四落点、回收站、访问记录落库 | §1.2 工作台必须有的清单可演示 |
| **V1.1** | 核心其余项 | 导航页网页形态、按需 Snapshot、数据管理选项、三档备份、鉴权与日志 | 不接 Raindrop 仍完整；网页导航能打开圈选条目 |
| **V1.x 近期** | 核心完善后 | 插件形态、看板等非过关视图、Rediscover 卡片、组织记忆 | 不挤占保存 / 搜索 |
| **V2.0 愿景** | 评估后 | Reader 等 | 另立项，不进本期拆解 |

------

## 4. 系统架构

### 4.1 整体架构

```text
[工作台 Web]  [Skill / AI]  [浏览器插件 · 非过关]
        \         |         /
         \        |        /
          [入口层：创建 / 查询 / 更新 Bookmark]
                      ↓
          [核心逻辑：Status / Scene 关联 / Job / 建议]
                      ↓
          [数据层]
           ├── 应用数据库（结构化真源 + 端侧缓存，引擎待定）
           ├── 内容存储层（Snapshot 等，形态待定）
           └── 可选通道适配器（Raindrop 输入/导出 · S3 · WebDAV）
                      ↓
          [导航页网页（核心）/ 插件形态（近期）只读展示圈选集合]
```

产品约束在图上的含义：

- 三条入口都只打到应用，不直连 Raindrop。
- 多端以已部署的 Workers 或 Docker 为真源。
- 备份与可选导出不承担日常多端。

### 4.2 模块依赖关系

- **界面层** → 核心逻辑层（HTTP API）；不直接操真源引擎。
- **核心逻辑层** → 数据层接口（`packages/db` 抽象）；→ 规则层（圈选、建议）。
- **数据层** → 具体适配器（待定）；可选通道失败不影响本地写。
- **工具层** → 被各层使用；不依赖 UI。

### 4.3 目录结构

目标结构（与 `AGENTS.md` 一致）。`dev/` 只放隔离原型，不入正式工程。

```text
DogEar/
├── wiki/                                      # PRD 源
├── docs/                                      # 本文与落地细化
│   ├── DogEar_折耳书签_技术总纲_v0.2.md       # 本文
│   ├── 技术总纲文档范例.md                    # 范例（勿覆盖）
│   ├── module/                                # 从 PRD 迁出的细部
│   ├── Draft/                                 # 旧落地文档（口径落后）
│   └── 归档/                                  # 旧总纲 / 旧方案 / 旧 PRD
├── apps/
│   ├── web/                                   # 工作台（目标）
│   ├── extension/                             # Chrome 扩展（目标）
│   └── server/                                # 应用服务 + Skill + 任务
├── packages/
│   ├── shared/
│   └── db/
└── dev/dogear-workbench/                      # 高保真原型，mock 数据
```

------

## 5. 核心流程设计

### 5.1 主流程（Capture）

```text
开始
  ↓
入口：工作台 / Skill /（可选）插件
  ↓
校验：能连上本应用；URL 合法
  ↓
写入 Bookmark（Link 级，默认待处理）
  ↓
立即回显（Skill 必须回显建议，结构默认不落库）
  ↓
异步：Metadata Job
  ↓
可选：用户勾选才入 Snapshot Job（失败不回滚）
  ↓
可选：高把握才给出 Scene 建议（低把握不写）
  ↓
结束（整理发生在以后，不在这条关键路径上）
```

### 5.2 关键算法 / 逻辑说明

#### 保存与保全解耦

- **输入**：创建 Bookmark 的请求。
- **输出**：始终先有 Link；内容对象可有可无。
- **核心思路**：Link 成功是过关条件；Snapshot 是另一条 Job。
- **处理步骤**：同步写结构化记录 → 入队异步工作 → 前端不转圈等待抓取。
- **复杂度**：创建为 O(1) 写；抓取成本隔离在 Job。

#### 导航圈选（规则 · 或）

- **输入**：规则集（全部 / 条件或 / 自定义勾选 / 隐藏）。
- **输出**：展示集合。
- **核心思路**：工作台算「进不进导航」，导航页不算业务规则。
- **处理步骤**：持久化规则 → 物化或查询时求值 → 私密需解锁。
- **复杂度**：第一版按 600 条基线全量求值可接受；超基线再谈增量物化（暂定）。

#### Raindrop 字段映射

- **输入**：应用 Bookmark。
- **输出**：Raindrop 同构字段子集（附录 C.1）；**不输出** Scene / Status / 圈选 / AI。
- **核心思路**：导出是存档，不是把 DogEar 使用场景搬过去；导入不把对方数据变成 Scene。
- **处理步骤**：按附录 C 白名单投影；回收站默认跳过。
- **复杂度**：逐条投影；限频时退避，不阻塞应用内写。

#### AI 建议分流

- **输入**：URL / 标题 / 可选 intent / 已有维度。
- **输出**：建议 1 个 Scene + 很少 Tag/Folder + 一句说明。
- **核心思路**：建议先行；默认不自动执行；可撤销。
- **处理步骤**：浅理解 → 置信不够则空建议 → 用户采纳才写结构并记日志。
- **复杂度**：不得拖慢保存返回；建议异步可接受。

### 5.3 通道流程（选用时）

```text
首次使用
  → 数据管理选择（可跳过）
  → 立刻可保存

若启用 Raindrop 为输入源
  → 首次导入：进 Inbox 或保持原路径（可走梳理页，可跳过）
  → 之后从该源新来的零散记录 → Inbox

若启用 Raindrop 为导出方向
  → 将 Link 级记录写成存档
  → 不写 Scene / Inbox 语义
  → 不把删除标签双向推送当作核心模型
```

通道怎么接、任务怎么跑、是否增量：实现方案待讨论（见 §11），本文只锁定产品方向。

------

## 6. 数据设计

字段级总表以 PRD 附录 C 为准，本文不重复抄表。此处只定对象与生命周期。

### 6.1 配置文件结构（方向示意）

应用配置与通道开关属于「中档备份」要带走的对象。形态待定，语义如下：

```json
{
  "app_name": "DogEar",
  "version": "待定",
  "data_management": {
    "raindrop": { "enabled": false, "as_input": false, "as_export": false },
    "s3": { "enabled": false },
    "webdav": { "enabled": false }
  },
  "capture": {
    "default_status": "unread",
    "agent_auto_snapshot": false
  },
  "navigation": {
    "selection": { "mode": "all|rule_or|custom|hidden" },
    "require_auth": true
  },
  "retention": {
    "trash_days": 7,
    "operation_log_max": 5000,
    "operation_log_days": 30
  }
}
```

`showInNav` 关闭导航或改规则时，**不得丢掉** `page_tab` / `docker_items`。

### 6.2 核心数据结构

```text
Bookmark
├── id（应用主键；未导出 Raindrop 前可临时 id）
├── url
├── Metadata（自动抓取，可修正）
├── tags[] / folder / note / important
├── scenes[]（多对多，可空）
├── status（unread | saved | archived）
├── source（page | agent | extension）
├── archives[]
├── visit records（先落库）
└── timestamps

Scene
├── id / name / description / appearance?
├── sort_order / enabled
└── aerr_profile（系统内部，不展示）

ArchiveJob
├── id / bookmark_id
├── type（metadata | snapshot | reader预留）
├── source / status / error / result

ArchiveRecord
├── parser / parser_version / source / storage_location

NavSelection / PageTab / DockerItem
└── 本地（相对通道）配置，关导航不删

OperationLog / Trash
```

Bookmark ↔ Scene 多对多。Folder 通常单属。不要把 Scene 做成 Tag 前缀。

### 6.3 数据存储格式

- **用户配置**：应用数据库内的设置对象（引擎待定）；中档备份导出。
- **操作日志**：结构化记录；默认 5000 条 / 30 天，可配置，可清理 / 导出 / 循环覆盖。
- **业务数据**：Bookmark / Scene / Folder / Tag / Job / Record。
- **缓存数据**：端侧缓存（候选 IndexedDB），首屏与离线读；不能取代真源。
- **内容数据**：Snapshot 资源，与结构化数据分开放；不进 Raindrop。
- **其它**：访问记录（核心，字段后定）；AI 组织记忆（近期，本期可无表）。

### 6.4 数据生命周期

| 数据类型 | 创建时机 | 更新方式 | 删除策略 | 持久化方式 |
| --- | --- | --- | --- | --- |
| Bookmark | Capture 成功瞬间 | 用户 / 采纳建议 / Metadata 回填 | 软删除进回收站（默认 7 天） | 应用真源 |
| Scene | 预置四场景 + 用户新建 | 改名 / 停用 / 合并（合并细部待设计） | 停用优先于物理删 | 应用真源；不进 Raindrop |
| Metadata | 异步 Job | 用户修正优先 | 随 Bookmark | 同构字段可随导出写出；本地扩展仅本地 |
| Snapshot | 勾选或事后触发 | 重抓 / 上传替换 | 可删内容，不删 Bookmark | 内容存储层 |
| 访问记录 | 打开原链接（及日后打开 Snapshot） | 追加 | 策略后定 | 应用真源 |
| 导出存档 | 用户启用导出 | 按通道任务 | 不删除应用数据 | Raindrop 等外部 |
| 备份包 | 用户触发 | 新文件 | 保留策略后定 | 轻 HTML/CSV/MD；中 +配置；重含 Snapshot |

------

## 7. 接口设计

路径与字段名为方向示意，正式契约另文（现有 `docs/Draft/Skill API合约.md` 仍对应旧 PRD，需按 v1.0.7 回写后才能当实现依据）。

### 7.1 内部模块接口

| 函数 / 方法 | 所属模块 | 输入 | 输出 | 职责 |
| --- | --- | --- | --- | --- |
| `storage.saveBookmark` | Data | Link 字段 | Bookmark | 写入真源，默认 Inbox |
| `storage.updateBookmark` | Data | id + patch | Bookmark | 单条改维度 / 备注 / 状态 |
| `storage.list / search` | Data | 过滤 + 分页 | 列表 | 600 条基线索引查询 |
| `jobs.enqueue` | Core | type + bookmark_id | Job | Metadata / Snapshot |
| `suggest.scene` | Rule | bookmark 或草稿 | 建议（可空） | 不直接写库 |
| `nav.evaluate` | Rule | 规则 | 展示集合 | 或逻辑 |
| `channels.importRaindrop` | Data | 选项（Inbox / 原路径） | 导入报告 | 不生成 Scene |
| `channels.exportRaindrop` | Data | 范围 | 导出报告 | 白名单字段 |
| `backup.export` | Data | 档位 | 文件 | 轻 / 中 / 重 |

### 7.2 外部接口

#### Skill 自描述

- **接口地址**：`GET /.well-known/capabilities`
- **请求方式**：GET
- **请求参数**：无
- **返回结果**：`{ version, skills[] }`，含 `save_bookmark` / `search_bookmarks` / `update_bookmark` / `list_bookmarks` / `get_stats` / `trigger_archive` / `suggest_scene`；`batch_organize` 标 `experimental`
- **错误码**：401 无令牌
- **认证方式**：可公开发现清单；调用技能需 Bearer

#### save_bookmark

- **接口地址**：`POST /skill/save`（路径暂定）
- **请求方式**：POST
- **请求参数**：`url*`、`note?`、`intent?`、`snapshot?`（默认 false）
- **返回结果**：创建后的 Bookmark 摘要 + `aiSuggestion`（结构默认未写入）
- **错误码**：`INVALID_URL` / `RATE_LIMITED` / `UNAUTHENTICATED`
- **认证方式**：`Authorization: Bearer <Token>`
- **约束**：截取失败不回滚；禁止借此删除

#### 其它 Skill（摘要）

| 技能 | 输入 | 说明 |
| --- | --- | --- |
| `search_bookmarks` | query、filters? | 核心：标题 / URL / 标签 / 备注 + 条件；自然语言为近期 |
| `update_bookmark` | id、patch | Scene / Folder / Tag / note / status；禁删、禁改文件夹树 |
| `list_bookmarks` | 过滤 + limit | 分页 |
| `get_stats` | 无 | 总数、分 Scene / 状态 |
| `trigger_archive` | bookmark_id、type=snapshot | 事后保全 |
| `suggest_scene` | id 或批量 id | 仅建议，确认后才生效 |

工作台 REST（列表 / 单条 / 批量补丁 / 回收站 / 备份）与 Skill **共用 Core**，鉴权方式可不同（会话 vs Token），禁止两套业务语义。

------

## 8. 异常与边界处理

| 异常场景 | 触发条件 | 处理方式 | 用户反馈 |
| --- | --- | --- | --- |
| 应用不可达 | 工作台 / Skill 连不上已部署服务 | 本版不保存 | 明确失败，不假装写入 |
| 第三方中断 | Raindrop / S3 / WebDAV 不可用 | 应用内照常写；通道任务挂起 | 轻 Toast，限频 |
| Snapshot 失败 | 抓取超时 / 站点限制 | Job=failed，Link 保留 | 可重试；不回滚保存 |
| Metadata 失败 | 无法抓标题等 | Bookmark 仍有效，可重试 | 列表可用 URL 占位 |
| 429 / 限频 | 外部 API 或 Skill 超限 | 指数退避；队列保留 | 「限频等待 N 秒」，不阻塞本地 |
| AI 越权 | 删除、默认批量、改结构 | 拒绝并记日志 | 不执行 |
| 冲突 | 导入 / 导出与本地交叉改 | 两端保留，用户选择 | 冲突入口，不自动覆盖 |
| 私密内容 | 导航未解锁 | 不展示 | 解锁后可见 |
| 超基线 | 远大于 600 条 | 非核心降级 | 保存 / 搜索仍可用 |

### 8.1 数据校验

- URL 必填且可解析；创建不要求 Metadata 完整。
- Scene / Folder / Tag / Status 补丁需存在且未停用。
- Skill 写操作走白名单字段；未知字段忽略或 400（实现时二选一，需在合约里定）。
- 导出投影只用附录 C 白名单。

### 8.2 错误处理原则

- 保存成功与否只看应用真源是否落下 Link。
- 异步失败可重试，不改写已成功的 Bookmark。
- 用户操作可撤销；AI 写操作必须可追溯、可批量撤销。
- 不把通道错误提升为「书签没存上」。

### 8.3 日志策略

- **日志级别**：写操作全留痕（用户 / sync / ai）；读操作抽样或仅用量（待定）。
- **日志格式**：`actor, action, target, before, after, at`。
- **日志存储位置**：应用数据库（与业务同真源，便于重备份）。
- **日志保留策略**：默认 5000 条 / 30 天，可配置；支持清理 / 导出 / 循环覆盖。
- **观测**：本地 ↔ 通道 / 真源 的条数每秒、时延、成功率、队列长度、429 可查看（`AGENTS.md`）。

------

## 9. 构建与部署

### 9.1 开发环境

- **操作系统**：不限；文档与脚本需同时考虑 Windows PowerShell。
- **运行环境**：Node 或 Bun（Docker 运行时 **待确认**）；浏览器最新 Chrome 系。
- **开发工具**：现有原型为 Vite；正式单仓工具链待确认。
- **依赖管理**：npm / pnpm / bun 待确认，全仓统一。

### 9.2 开发环境运行

正式 `apps/*` 尚未按本总纲落地。当前可运行的是隔离原型：

```bash
# 工作台原型（mock，不代表正式存储）
cd dev/dogear-workbench
npm install
npm run dev
```

正式工程启动命令在选定运行时与包管理器后写入本节。

### 9.3 构建

- **构建工具**：前端 Vite（暂定）；Workers 用 Wrangler（暂定）；Docker 用镜像构建（暂定）。
- **构建命令**：待确认。
- **构建产物**：工作台静态资源 + 服务端 Worker 或容器。
- **构建环境要求**：不把密钥打进产物；Token 部署后在初始化向导配置。

### 9.4 发布部署

- **部署方式**：默认 Cloudflare Workers；其次 Docker。二选一，互不级联（不存在 Workers 回连家庭 NAS）。
- **部署环境**：公网 Workers 必须鉴权；Docker 按内网 + 隧道等方向考虑。
- **运行要求**：多端只连用户选定的那一个服务端。
- **配置方式**：部署后首次打开做数据管理选择（可跳过）；**不**引导登录 Raindrop。
- **版本管理**：应用 version 与文档 version 分开；Skill capabilities.version 独立演进。
- **回滚方案**：Workers 平台回滚 / Docker 镜像回滚 + 重备份恢复；细则待方案。

鉴权方向（PRD §8.3，产品向，实现未定）：公网密码页 / URL Token / IP 白名单等；Skill 用 Bearer；工作台必须登录；导航页第一版默认同一会话，匿名公开不是默认能力。

------

## 10. 开发计划

不定工期。只排 **核心需求**。旧 `docs/Draft/落地拆解.md` 以 Raindrop 双向同步和逐条 `showInNav` 为骨架，**不能直接执行**，需按本表重写后再开工。

| 阶段 | 任务 | 预计时间 | 产出物 |
| --- | --- | --- | --- |
| Phase 1 | 存储抽象 + Bookmark / Scene / Status 模型 + 工作台保存 Link | 待估 | `packages/db` 接口；工作台创建即可见 |
| Phase 2 | Skill：capabilities + `save_bookmark` 回显 + Token | 待估 | Agent 保存过关 |
| Phase 3 | 工作台核心：Inbox、列表、搜索筛选、四维单批量改、AI 建议四落点、回收站、操作日志 | 待估 | §1.2 必须有清单 |
| Phase 4 | Archive Job：Metadata + 按需 Snapshot；访问记录落库 | 待估 | 失败不挡 Link |
| Phase 5 | 导航页网页形态 + 圈选规则（或） | 待估 | 基础能打开 |
| Phase 6 | 数据管理选项（Raindrop 输入/导出、S3/WebDAV 位）+ 三档备份 + 速率观测 | 待估 | 零通道仍完整可用 |
| 其后 | 插件、看板等近期项 | — | 不进本期过关 |

Phase 1 是后续阻塞项：没有真源与保存，Skill / 导航 / 通道都无从接。

------

## 11. 待确认 / 待决策事项

产品议题 PRD §09 已收口。下列是 **技术方案仍须确认** 的项；确认前保持暂定，不写进实现。

- [ ] 结构化真源引擎：Workers 轨是否 D1、Docker 轨是否 SQLite，以及端侧是否 IndexedDB 缓存
- [ ] 内容存储：是否 S3 兼容、默认是否 R2、是否多目标 / 冗余
- [ ] Docker 运行时：Bun vs Node，以及 SQLite 驱动
- [ ] ORM / 查询层：Drizzle 或其它，对 `packages/db` 适配器的形态
- [ ] 前端状态库、UI 套件、扩展脚手架（WXT 等）是否采用 PRD §8.x 名单
- [ ] Raindrop 选用时的任务模型：一次性导入 / 按需再导入 / 定时导出；**默认不是** 30s 推 + 5min 拉的双向同步
- [ ] Snapshot 生成位置：浏览器 DOM 直传 vs 服务端抓取的主次与降级
- [ ] 公网鉴权具体形态（密码页 / URL Token / IP 白名单）
- [ ] 工作台 REST 路径与 Skill 路径的定稿（回写 Skill 合约）
- [ ] 访问记录字段、去噪、是否做历史页
- [ ] 圈选规则算子、与「隐藏」冲突时的优先级（模块文档仍待设计）
- [ ] 包管理器、单仓构建、一键部署脚本形态

`AGENTS.md` 里仍写「存储 / 关联【待定】」：与本文一致，待上表确认后改「已定」。

------

## 12. 附录

### 12.1 参考文档

- [需求说明书 v1.0.7](../wiki/DogEar_折耳书签_需求说明书_v1.0.7.md) — 唯一需求源
- [Scene / AI 与待设计细部](module/Scene-AI与待设计细部.md) — 字段 / 阈值 / 开放问题，不取代 PRD
- [技术总纲文档范例](技术总纲文档范例.md) — 本文骨架来源（勿改）
- [归档 · 技术总纲 v0.1](归档/DogEar_折耳书签_技术总纲_v0.1_draft.md) — 结构不满意，仅追溯
- [归档 · 技术方案 v0.1](归档/DogEar_折耳书签_技术方案_v0.1_draft.md) — 旧通道暂存，仅追溯
- `docs/Draft/*` — 旧落地（DATA_MODEL / 部署方案 / Skill 合约 / 落地拆解等），口径落后于 v1.0.7，回写前禁止当现行方案
- `AGENTS.md` — 目录、提交、性能基线、禁止擅自定选型

### 12.2 术语表

以 PRD §10 为准。实现时高频的几条：

| 术语 | 说明 |
| --- | --- |
| Bookmark | 长期网页引用，核心是 URL |
| Link | 仅 URL + Metadata 的基础形态 |
| Scene | 为何保存 / 在何种情境使用；可多属；不进 Raindrop |
| Status | 待处理 / 已确认 / 搁置；≠ Archive |
| Archive / Snapshot | 内容保全副本 / 网页快照；核心但非默认 |
| 应用真源 | 已部署的 Workers 或 Docker 上的应用数据 |
| 输入源 / 导出方向 | Raindrop 等的两种可选用法，不是默认双向同步 |
| 核心 / 近期 / 愿景 | 需求分层；不用 P0/P1/P2 |

### 12.3 需求文档对应索引

| 本章节 | 需求文档章节 |
| --- | --- |
| §1 项目概述 | PRD §01、§1.4 边界 |
| §2 技术选型 | PRD §08、§8.x（非需求源） |
| §3 功能规划 | PRD §03、§04、附录 B |
| §4 系统架构 | PRD §05、§08、`AGENTS.md` 目录 |
| §5 核心流程 | PRD §3.1–§3.3、§5.2 |
| §6 数据设计 | PRD §02、§5.1、附录 C |
| §7 接口设计 | PRD §4.4、§6.1 |
| §8 异常与边界 | PRD §06、§07 |
| §9 构建与部署 | PRD §08 |
| §10 开发计划 | PRD 附录 B.0 核心需求 |
| §11 待确认 | 技术方案未决（产品 §09 已收口） |

------

## 13. 文档变更记录

| 版本 | 日期 | 变更内容 | 作者 |
| --- | --- | --- | --- |
| v0.2-draft | 2026-09-02 | 按范例骨架重建技术总纲；对齐 PRD v1.0.7；实现栈标暂定 | DogEar |

------

> **文档维护说明**：重大架构或功能变更应同步修订本文，并写入根目录 `CHANGELOG.md` 与 `docs/Draft/README.md`。选型一经确认，把对应行从「暂定」改为「已定」，不要另起一份平行总纲。范例文件与 `docs/归档/` 旧稿保持只读。
