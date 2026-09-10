# DogEar · 折耳书签

> 基于 Raindrop.io 的个人书签增强工具：低成本保存网页 → 按使用场景整理 → 需要时重新找到。

DogEar 是本地优先、异步同步的个人网页信息收集与管理工具。它把「保存」和「整理」拆成两步：收藏时只需存下链接，分类、打标签、归档都可以以后再说。

**本文导航**

- [当前进度](#当前进度)

- [产品主线](#产品主线)

- [快速开始](#快速开始)

- [技术架构](#技术架构)

- [文档导航](#文档导航)

- [边界与基线](#边界与基线)

- [许可](#许可)

## 当前进度

| 环节   | 状态          | 说明 / 入口                                   |
| ---- | ----------- | ----------------------------------------- |
| 需求方向 | 已定稿         | 唯一需求源：[需求总纲](wiki/DogEar-需求总纲.md)         |
| 技术架构 | 已定稿         | [技术总纲](wiki/DogEar-技术总纲.md)               |
| 界面原型 | 可用（mock 数据） | `dev/dogear-workbench`，用于验证界面与交互，不是正式实现   |
| 正式工程 | 已完工（M5-M7 已完成） | Capture（工作台保存 + Agent Skill API）、Organize（Scene/Folder/Tag/Status 多维组织）、Rediscover（搜索/导航页/最近访问）、Archive（Metadata 提取 + SingleFile 快照）、Backup（本地导入导出 + 通道同步）、Docker 部署（Track B 自托管）全部完成 |
| 核心契约 | 生效（docs）   | 设计说明：[数据库设计](docs/modules/20260904_数据库设计.md) · [API 设计](docs/modules/20260904_API设计.md)；开发约束：[数据库结构表](docs/数据库结构表.md) · [API 结构表](docs/API结构表.md) |

全部功能已在正式工程中实现，详见 [M1 骨架执行计划](docs/modules/20260903_M1-骨架执行计划.md) 及其后续开发记录。写代码以 `docs/` 根目录结构表为范围；设计说明在 `docs/modules/`。未经授权不写入 `wiki/`。

## 产品主线

### 存得轻松：Capture

- 工作台页面与 Agent（Skill）是核心保存入口；浏览器插件是加速入口。

- 默认只保存 Link；Snapshot 为可选能力，异步执行，失败不回滚已保存的书签。

- 保存不依赖 Raindrop、S3 或 WebDAV，也不要求先登录 Raindrop。

### 整理有余：Organize

书签通过四个互相独立的维度组织，保存时不必马上决定：

| 维度     | 含义         | 补充说明                           |
| ------ | ---------- | ------------------------------ |
| Scene  | 为什么保存、何时会用 | 如工作研究、灵感收集、稍后再读；可配置、可多选，保存时不强制 |
| Status | 处理状态       | 待处理 / 已确认 / 搁置                 |
| Folder | 位置或项目归属    | 使用者自行定义                        |
| Tag    | 主题或内容属性    | 使用者自行定义                        |

AI 原则：只做异步理解与建议，写入前必须用户确认；不自动删除、不擅自批量改变结构。

### 找得回来：Rediscover

- 支持按标题、URL、标签、备注与结构化条件搜索。

- Inbox、最近收藏、访问记录、Scene 与导航页共同帮助书签重新进入视野。

- 导航页是网页形态；浏览器插件只是加速入口，不是唯一形态。

## 快速开始

### 看界面：运行原型

```bash
cd dev/dogear-workbench
npm install
npm run dev
```

按终端输出的地址打开浏览器。原型使用 mock 数据，适合查看工作台布局、书签卡片、详情面板、设置与主题交互。

### 跑工程：正式项目命令

正式工程按 M1 计划建设，根目录使用 pnpm workspace + Turborepo。本地默认以 Bun 运行 SQLite 服务：

```bash
pnpm install
pnpm dev
```

本地默认端口（开发环境）：

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| Web 工作台（Vite） | 5173 | 浏览器访问入口 |
| API 服务（Hono + Bun） | 8787 | 服务端默认端口；工作台以相对路径请求 `/api`，由 Vite 代理转发至此 |

端口以 **8787** 为唯一基准：`apps/server/src/index.ts` 的默认端口、`apps/server/Dockerfile`（`EXPOSE` / `ENV PORT`）、`docker-compose.yml`（含健康检查）与 `apps/web/nginx.conf` 均使用 8787，`apps/web/vite.config.ts` 的代理目标同样指向 8787，因此 `pnpm dev` 无需另设端口即可直接登录。如需更换端口，用 `PORT` 环境变量指定服务端，并同步修改 `vite.config.ts` 的代理目标——两者必须保持一致，否则工作台会出现「登录无反应」或 API 请求失败。

常用检查命令：

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

实际可执行范围以 M1 开发记录与验收结果为准，尚未实现的能力不会出现在交付描述里。

## 技术架构

DogEar 采用「应用为真源、端侧缓存加速、内容分层存储」的双轨架构：

```text
接入层
├── Web 工作台 / 导航页
├── Skill API
├── 浏览器插件
└── Raindrop / S3 / WebDAV 可选通道
        │
服务层
├── Bookmark / Scene / 组织服务
├── Archive 引擎与异步任务
├── Metadata / AI 建议
├── 搜索与导航展示规则
├── 同步、备份、日志、回收站
└── 鉴权与限速
        │
数据层
├── 服务端真源：Cloudflare D1 或 SQLite
├── 内容存储：S3 API 兼容对象存储
└── 端侧镜像缓存：IndexedDB / Dexie
```

**关键取舍**

- 应用数据是真源；Raindrop、S3、WebDAV 只是可选数据通道，不是登录门槛。

- Link 与 Snapshot 解耦：默认保存链接，快照异步可选，失败、重试或补做都不回滚书签。

- 端侧缓存只做镜像，不升级为第二真源。

**技术选型**

| 关注点            | 选型                                                                        |
| -------------- | ------------------------------------------------------------------------- |
| 前端             | React 19、Vite 6、TypeScript                                                |
| 工程组织           | pnpm workspace、Turborepo                                                  |
| 服务端            | Hono，兼容 Cloudflare Workers 与 Bun / Node                                   |
| 数据契约 / 访问      | Zod（共享 schema）、Drizzle ORM                                                |
| Track A（默认云端）  | Cloudflare Workers + D1，内容层用 R2                                           |
| Track B（自托管兜底） | Docker；Bun `bun:sqlite`（Node + `better-sqlite3` 回退）；内容层可用 MinIO 等 S3 兼容服务 |
| 端侧缓存           | IndexedDB / Dexie，仅镜像缓存                                                   |

正式工程的目标目录如下，会随 M1 及后续模块逐步补全：

```text
DogEar/
├── apps/
│   ├── web/                   # 工作台与导航页
│   ├── extension/             # 浏览器插件
│   └── server/                # Hono 服务
├── packages/
│   ├── shared/                # 共享类型、Zod schema 与工具
│   ├── db/                    # Drizzle schema 与 D1 / SQLite 适配
│   └── cache/                 # 可选的 Dexie 镜像缓存
├── dev/dogear-workbench/      # 高保真原型，mock 数据
├── wiki/                      # 已定稿文档
└── docs/modules/              # 模块设计与执行文档
```

## 文档导航

| 文档                                                  | 用途                            |
| --------------------------------------------------- | ----------------------------- |
| [需求总纲](wiki/DogEar-需求总纲.md)                         | 产品定位、边界、用户流程、需求分层与验收方向（唯一需求源） |
| [技术总纲](wiki/DogEar-技术总纲.md)                         | 系统架构、技术选型、数据分层、接口方向、部署轨道与工程边界 |
| [数据库设计](docs/modules/20260904_数据库设计.md)                       | 给人看的账本设计说明 |
| [API 设计](docs/modules/20260904_API设计.md)                           | 给人看的窗口设计说明 |
| [数据库结构表](docs/数据库结构表.md)                           | 开发约束：物理表、列、索引、禁止项 |
| [API 结构表](docs/API结构表.md)                               | 开发约束：路径、回执、错误码、禁止接口 |
| [Scene / AI 与待设计细部](docs/modules/20260904_Scene-AI与待设计细部.md) | Scene、AI 建议、导航规则与访问记录等模块细部    |
| [技术待定项收敛清单](docs/modules/20260903_技术待定项收敛清单.md)              | 待定项的判定依据、建议口径与承接位置            |
| [M1 骨架执行计划](docs/modules/20260903_M1-骨架执行计划.md)              | 正式工程骨架的任务、范围、验收标准与开发记录        |
| [AGENTS.md](AGENTS.md)                              | 仓库协作、文档治理、验证与提交约定             |
| [CHANGELOG.md](CHANGELOG.md)                        | 文档与仓库变更记录                     |

阅读顺序建议：先读需求总纲理解「做什么」，再看技术总纲理解「怎么搭」。写代码以 `docs/数据库结构表.md` 与 `docs/API结构表.md` 为范围；设计说明在 `docs/modules/`。已归档文档（`docs/archive/`）不作为当前实现依据。

## 边界与基线

### 范围边界

DogEar 是网页保存工具，不是笔记工具、也不是阅读器。当前不把这些作为核心交付：

- 重型文本编辑、Reader 清洗阅读、高亮与笔记

- 多人协作

- 优先交付移动端 App、Share Extension 或 URL Scheme

- 把 Raindrop 作为登录门槛或第二真源

- 把浏览器插件作为唯一的保存或导航形态

- 全文正文索引

- 自动分流、自动删除或未经确认的结构改动

### 性能与可靠性基线

- 默认按 600 条 Bookmark 评估首屏、检索与核心交互；超量能力按实测调整。

- 核心保存路径不依赖第三方通道；通道未配置或中断时，不应阻塞应用内保存。

- Snapshot 与 Link 解耦，快照任务可失败、重试、补做，不回滚已保存的 Bookmark。

- 同步与归档关注条数/秒、时延、成功率、队列长度与 429 等可观测指标。

## 许可

项目许可尚未单独确定。
