# DogEar · 项目规范（AGENTS）

> 适用于本仓库所有协作（含 AI）。先读本文件再动手，禁止乱放文件、乱接功能。

## 1. 基本原则（强制约束）

- **提问/需求三步走（强制）**：当用户提问或提出需求时，必须先“理解→计划”，以简洁思路与用户确认后，才能执行任何改动、写入或提交

- 影响服务、不可逆、耗时较长的操作，先提风险和计划，确认后执行

- 性能优先：不为非核心功能增加过多负担，必要时精简需与用户确认；默认按 600 条基线考核

- 同步速率监测：本地↔Raindrop/ SQLite 的条数/秒、时延、成功率、队列长度、429 需可观测

## 2. 文档规范

- **PRD 为源**：当前活跃的《需求说明书》是唯一产品需求源，路径为 [`wiki/DogEar_折耳书签_需求说明书_v1.0.7.md`](wiki/DogEar_折耳书签_需求说明书_v1.0.7.md)。其余文档为落地细化，不得与 PRD 冲突。现行技术方案待重建（原技术总纲 / 技术方案已入 `docs/归档/`）

- **版本**：PRD 头部与文件名标识版本（当前 v1.0.7）；`docs/` 各文件头部标版本与日期，并关联该 PRD 版本。修改记录见根目录 `CHANGELOG.md`

- **索引**：新增/修改 `docs/` 或 `wiki/` 需求/技术文档时，同步更新 `docs/Draft/README.md`（以实际存在的索引为准）

- **归档**：时效已过、不再指导后续开发的文档移入 `docs/归档/`，索引同步标注归档理由

- **技术待定**：未定项标“方向性/暂定”，定稿后改“已定”，不擅自定技术选型

## 3. 文件结构（禁止乱放）

```
DogEar/
├── wiki/                             # 产品需求（PRD 在此）
│   └── DogEar_折耳书签_需求说明书_v1.0.7.md  # 当前 PRD 源（定稿）
├── docs/                             # 落地细化（现行技术方案待重建）
│   ├── README.md / Draft/README.md   # 文档索引（以实际存在者为准）
│   ├── 落地细化文档                    # MVP验收清单 / 拆解 / 数据模型 / 设计 / API 等
│   └── 归档/                         # 已过期文档（含原技术总纲、技术方案 v0.1，仅追溯）
├── AGENTS.md                         # 本文件
├── README.md                         # 项目说明
├── CHANGELOG.md                      # 文档与仓库修改记录
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

- 组件注册表与组件规范文档以 `docs/` 内实际存在且未归档的版本为准（原型版 / 正式版按文档标注区分），原子设计：Atoms → Molecules → Organisms → Templates → Pages

- 新建组件前必搜对应注册表，按“合并对照表”判定复用/扩展/新建，禁止重复造轮子

- 文件命名 PascalCase，登记到对应注册表

## 5. 开发规范

- **存储**：【待定】本地优先 + 异步同步，`showInNav` 持久化，开关关闭不丢 `page_tab/docker_items`

- **关联**：【待定】工作台控“是否显示”（全部/按规则-或/自定义搜索勾选/隐藏），导航页控布局，规则先做或

- **AI**：Skill 需自描述 `/.well-known/capabilities`，`save` 回显，`batch_organize` 标 experimental，需确认才生效

- **同步**：`sync_queue` 顺序消费，30s 推 / 5min 拉可配，429 指数退避，冲突保留两端可单/全选，轻 Toast 提示限频

- **备份**：轻（HTML/CSV/MD）/中（+配置）/重（快照）三档，日志有限保留 5000/30天可改

## 6. 提交规范

- 提交信息：`docs:` / `feat:` / `fix:` 前缀，关联 PRD/落地拆解里程碑（如 `M1.1`）

- 文档与代码分离提交，文档变更同步更新 `docs/README.md` 与 PRD 版本记录

- **身份匿名化（强制）**：所有提交必须使用匿名化邮箱（GitHub noreply 邮箱，避免暴露真实邮箱）。禁止使用真实个人姓名/邮箱提交，禁止在提交信息、分支名、Tag、文件内容中写入个人身份信息（姓名、个性化用户名、私人邮箱、手机号、家庭地址等）

- **GitHub 隐私设置**：账号需开启 `Settings → Emails → Keep my email addresses private`，本地 `git config user.email` 必须与 GitHub noreply 邮箱保持一致

## 7. 禁止事项

- ❌ 不经确认定技术选型/框架

- ❌ 乱放文件、根目录新增业务目录

- ❌ 不经搜索直接新建组件

- ❌ 跳过注册登记、跨层级依赖

- ❌ 自行精简非核心功能（需确认）

- ❌ 提交中包含个人身份信息（真实姓名/个性化用户名/私人邮箱/手机号等），以及相关密钥或ID

- ❌ 未经确认执行历史重写（filter-branch/新根提交）、强制推送、删除远端仓库等不可逆操作

> 任何需求先理解与计划，确认后再改。

