# DogEar · 折耳书签

> 基于 Raindrop.io 的个人书签增强工具，围绕 **Capture · Organize · Rediscover**，帮助你低成本保存网页、按使用场景整理，并在需要时重新找到它们。

DogEar 是一个本地优先、支持异步同步的个人网页信息收集与管理工具。它以书签链接为核心对象，不要求保存时立即决定文件夹、标签或使用方式；先保存下来，剩下的以后再说。

## 当前状态

项目正从高保真原型进入正式工程骨架阶段：

- 需求方向已定稿，唯一需求源是 [需求总纲](wiki/DogEar-需求总纲.md)。
- 技术架构已定稿，详见 [技术总纲](wiki/DogEar-技术总纲.md)。
- `dev/dogear-workbench` 是使用 mock 数据的高保真工作台原型，用于验证界面与交互，不是正式产品实现。
- 正式工程按 M1 骨架计划逐步落地，当前目标是打通“服务端写入真源 → 工作台通过真实 API 读取 → 重启后数据仍存在”的最小真实链路。
- M1 的执行范围与验收标准见 [M1 骨架执行计划](docs/modules/M1-骨架执行计划.md)。

## 产品重点

### 好存：Capture

- 工作台页面和 Agent（Skill）是核心保存入口。
- 浏览器插件是加速入口，不作为核心过关条件。
- 默认只保存 Link；Snapshot 可选，不会因快照失败回滚书签。
- 保存不依赖 Raindrop、S3 或 WebDAV，也不要求首次使用时登录 Raindrop。

### 好管理：Organize

书签通过互相独立的维度组织：

- **Scene**：为什么保存、准备在什么情境下使用，例如工作研究、灵感收集、稍后再读、长期资料。
- **Status**：当前处理状态：待处理、已确认、搁置。
- **Folder**：希望放置的位置或项目归属。
- **Tag**：主题或内容属性。

保存时不强制选择 Scene。AI 只负责异步理解与提出建议，建议需要用户确认后才会写入，不自动删除或擅自改变组织结构。

### 好找：Rediscover

- 支持按标题、URL、标签、备注和结构化条件搜索。
- Inbox、最近收藏、访问记录、Scene 和导航页共同帮助书签重新进入视野。
- 导航页支持网页形态；浏览器插件形态用于加速访问，不是唯一入口。

## 技术架构

DogEar 采用“应用为真源、端侧缓存加速、内容分层存储”的双轨架构：

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

### 技术选型

- 前端：React 19、Vite 6、TypeScript
- 正式工程：pnpm workspace、Turborepo
- 服务端：Hono，兼容 Cloudflare Workers 与 Bun / Node
- 数据契约：Zod；数据库访问：Drizzle ORM
- Track A（默认云端）：Cloudflare Workers + D1，内容层使用 R2
- Track B（自托管）：Docker + Bun `bun:sqlite`，Node + `better-sqlite3` 作为回退；内容层可使用 MinIO 或其他 S3 兼容服务
- 端侧缓存：IndexedDB / Dexie，仅作镜像缓存，不是第二真源

当前正式工程的目标目录如下；目录会随着 M1 及后续模块实施逐步补全：

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

## 快速开始

### 运行高保真原型

原型独立使用自己的依赖和脚本：

```bash
cd dev/dogear-workbench
npm install
npm run dev
```

启动后按终端输出的地址打开浏览器。原型使用 mock 数据，适合查看工作台布局、书签卡片、详情面板、设置和主题交互。

### 运行正式工程

正式工程正在按 M1 计划建设。仓库根目录已采用 pnpm workspace 与 Turborepo，安装依赖后可使用统一脚本：

```bash
pnpm install
pnpm dev
```

常用检查命令：

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

M1 默认使用 Bun 运行本地 SQLite 服务。具体可执行范围以 [M1 骨架执行计划](docs/modules/M1-骨架执行计划.md) 的开发记录和验收结果为准，不把尚未实现的能力描述为可用功能。

## 文档导航

| 文档 | 用途 |
| --- | --- |
| [需求总纲](wiki/DogEar-需求总纲.md) | 产品定位、边界、用户流程、需求分层与验收方向；唯一需求源 |
| [技术总纲](wiki/DogEar-技术总纲.md) | 系统架构、技术选型、数据分层、接口方向、部署轨道与工程边界 |
| [Scene / AI 与待设计细部](docs/modules/Scene-AI与待设计细部.md) | Scene、AI 建议、导航规则和访问记录等模块细部 |
| [技术待定项收敛清单](docs/modules/技术待定项收敛清单.md) | 技术总纲待定项的判定依据、建议口径与承接位置 |
| [M1 骨架执行计划](docs/modules/M1-骨架执行计划.md) | 正式工程骨架的任务、范围、验收标准和开发记录 |
| [AGENTS.md](AGENTS.md) | 仓库协作、文档治理、验证和提交约定 |
| [CHANGELOG.md](CHANGELOG.md) | 文档与仓库变更记录 |

已归档文档不作为当前实现依据；当前开发优先遵循 `wiki/` 定稿和 `docs/modules/` 中对应的模块文档。

## 范围边界

DogEar 是网络保存服务，不是笔记工具，也不是阅读器。当前不以以下能力作为核心交付：

- 重型文本编辑、Reader 清洗阅读、高亮与笔记
- 多人协作
- 移动端 App、Share Extension 和 URL Scheme 优先交付
- 将 Raindrop 作为登录门槛或第二真源
- 将浏览器插件作为唯一的保存或导航形态
- 全文正文索引
- 自动分流、自动删除或未经确认的结构改动

## 性能与可靠性基线

- 默认按 600 条 Bookmark 评估首屏、检索和核心交互；超量能力按后续实测调整。
- 核心保存路径不依赖第三方通道；通道未配置或暂时中断时，不应阻塞应用内核心数据保存。
- Snapshot 与 Link 解耦，快照任务可失败、重试或补做，不回滚已保存的 Bookmark。
- 同步与归档关注条数/秒、时延、成功率、队列长度和 429 等可观测指标。

## 许可

项目许可尚未单独确定。
