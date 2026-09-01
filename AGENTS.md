# DogEar · 项目规范（AGENTS）

> 适用于本仓库所有协作（含 AI）。先读本文件再动手，禁止乱放文件、乱接功能。

## 1. 基本原则（强制约束）

- **提问/需求三步走（强制）**：当用户提问或提出需求时，必须先“理解→计划”，以简洁思路与用户确认后，才能执行任何改动、写入或提交

- 影响服务、不可逆、耗时较长的操作，先提风险和计划，确认后执行

- 性能优先：不为非核心功能增加过多负担，必要时精简需与用户确认；默认按 600 条基线考核

- 同步速率监测：本地↔Raindrop/ SQLite 的条数/秒、时延、成功率、队列长度、429 需可观测

## 2. 文档规范

- **PRD 为源**：`docs/DogEar · 折耳书签 — 需求说明书.md` 为唯一源，`docs/` 其余文件为落地细化

- **版本**：PRD 头部 `v0.3.x`，`docs/` 各文件头部标版本与日期，关联 PRD 版本

- **索引**：新增/修改 `docs/` 需同步更新 `docs/README.md`

- **归档**：时效已过、不再指导后续开发的文档移入 `docs/归档/`，索引同步标注归档理由

- **技术待定**：未定项标“方向性/暂定”，定稿后改“已定”，不擅自定技术选型

## 3. 文件结构（禁止乱放）

```
DogEar/
├── docs/                             # 设计文档（PRD 亦在此）
│   ├── README.md                     # 文档索引（总入口）
│   ├── DogEar · 折耳书签 — 需求说明书.md  # PRD 源
│   ├── MVP验收清单.md / 落地拆解.md
│   ├── DATA_MODEL.md / DESIGN.md / 技术方案路线.md
│   ├── API.md / Skill API合约.md / 同步引擎细化.md
│   └── 归档/                         # 已过期文档（数据模型草案/实施计划/组件注册表/原型与设置页规格/过程档案等，仅追溯）
├── AGENTS.md                         # 本文件
├── README.md                         # 项目说明
├── dev/                              # 隔离原型（不入正式工程）
│   └── dogear-workbench/             # 高保真工作台原型（Vite+React+TS，mock 数据）
├── apps/
│   ├── web/                          # 工作台（Vite+React）
│   │   └── src/{app,features,components,hooks,lib,types,utils}
│   ├── extension/                    # Chrome 扩展（MV3 新标签页）
│   │   └── src/{newtab,popup,shared}
│   └── server/                       # 本地服务（Hono + 同步引擎）
│       └── src/{routes,middleware,services,types}
├── packages/
│   ├── shared/                       # 共享类型与常量
│   └── db/                           # 存储抽象（Dexie/SQLite 适配器）
└── scripts/ / Logs/                  # 仅 NAS 归档时使用，勿与本仓库混用
```

- 新功能按 `apps/*` 与 `packages/*` 归属放置，禁止在根目录散落业务文件

- 跨模块共享放 `packages/shared` 或 `apps/*/shared`，禁止跨层反向依赖

## 4. 组件规范

- 原型组件遵循 `docs/COMPONENTS-原型版.md`，正式工程组件遵循 `docs/COMPONENTS.md`（原子设计：Atoms → Molecules → Organisms → Templates → Pages）

- 新建组件前必搜对应注册表，按“合并对照表”判定复用/扩展/新建，禁止重复造轮子

- 文件命名 PascalCase，登记到对应注册表

## 5. 开发规范

- **存储**：本地优先 + 异步同步，`showInNav` 持久化，开关关闭不丢 `page_tab/docker_items`

- **关联**：工作台控“是否显示”（全部/按规则-或/自定义搜索勾选/隐藏），导航页控布局，规则先做或

- **AI**：Skill 需自描述 `/.well-known/capabilities`，`save` 回显，`batch_organize` 标 experimental，需确认才生效

- **同步**：`sync_queue` 顺序消费，30s 推 / 5min 拉可配，429 指数退避，冲突保留两端可单/全选，轻 Toast 提示限频

- **备份**：轻（HTML/CSV/MD）/中（+配置）/重（快照）三档，日志有限保留 5000/30天可改

## 6. 提交规范

- 提交信息：`docs:` / `feat:` / `fix:` 前缀，关联 PRD/落地拆解里程碑（如 `M1.1`）

- 文档与代码分离提交，文档变更同步更新 `docs/README.md` 与 PRD 版本记录

## 7. 禁止事项

- ❌ 不经确认定技术选型/框架

- ❌ 乱放文件、根目录新增业务目录

- ❌ 不经搜索直接新建组件

- ❌ 跳过注册登记、跨层级依赖

- ❌ 自行精简非核心功能（需确认）

> 任何需求先理解与计划，确认后再改。

