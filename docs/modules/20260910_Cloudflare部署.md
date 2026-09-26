> **文档版本**：v0.6
> **应用版本**：v0.7.40
> **文档状态**：生效（轨 A 默认路径已真实部署验证，2026-09-12 起线上运行）
> **目的和适用范围**：Cloudflare Workers（轨 A）的部署方式、必填配置与验收步骤。默认口径：**前后端同域合并部署**——前端工作台（apps/web）作为静态资源随 Worker 一起发布（Workers Builds 零 Token，建库/迁移/构建/部署由 `apps/server/scripts/ci-deploy.mjs` 一体完成）；GitHub Actions 为备用口径。以本文为准配置部署；不改 wiki。
> **权威级别**：模块规则。服从需求总纲与技术总纲；冲突时以需求总纲的产品对错为准。
> **配套文档**：[技术总纲](../../wiki/DogEar-技术总纲.md)（§3 部署双轨、§11 T-1~T-12）· [API 结构表](../API结构表.md) · [数据库结构表](../数据库结构表.md) · [待办清单](../TODO.md)
> **唯一需求源**：[需求总纲](../../wiki/DogEar-需求总纲.md)
> **最后更新日期**：2026-09-26
> **修改记录**：
>
> | 文档版本 | 应用版本 | 日期 | 修改摘要 | 修改模型ID |
> | --- | --- | --- | --- | --- |
| v0.6 | v0.7.40 | 2026-09-26 | 复核更正过时记录：Cron 已配置（v0.7.35）、真实部署已跑通（2026-09-12）、R2 已绑定（v0.7.39，仅封面）；§6 验收清单同步勾选，文档状态草案→生效 | deepseek-v4.1-flash |
| v0.5 | v0.7.39 | 2026-09-14 | 封面 R2：binding `COVERS` / 桶 `dogear-covers`；ci-deploy 确保桶存在；`/api/bookmarks/:id/cover` 命中缓存出图 | composer |
> | v0.4 | v0.7.26 | 2026-09-12 | 前端并入 Worker 同域部署（`[assets]` + `run_worker_first` + SPA 回退）：ci-deploy.mjs 增前端构建步骤、Actions 补构建步骤；**取消 Pages 项目与 CORS 配置**（前端相对路径 `/api` 同域零改动，跨域方案需改前端+Cookie 成本高，经用户拍板合并） | GLM-5.3-Flash |
> | v0.3 | v0.7.25 | 2026-09-12 | 默认路径改为 Workers Builds（Cloudflare 自带凭据，零 Token、零 GitHub Secrets）：新增 `ci-deploy.mjs` 一体完成建库/回填/迁移/部署；Actions 降为备用口径；补前端 Pages 与口令 Secret 的面板配置 | GLM-5.3-Flash |
> | v0.2 | v0.7.24 | 2026-09-12 | 部署改全自动口径：CI 自动建 D1 并回填 id（不再要求手动建库/回填）、口令与 Skill Token 从仓库 Secret 自动同步；preflight 仅查凭据；wrangler.toml 注释同步 | GLM-5.3-Flash |
> | v0.1 | v0.7.5 | 2026-09-10 | 初稿：Workers 入口与 D1 绑定、一键部署流程、能力差异、验收清单 | deepseek-v4.1-flash |

# Cloudflare Workers 部署（轨 A）

技术总纲 §3 已定：默认 Track A（Cloudflare Workers + D1），Track B（Docker 自托管）兜底。本文写轨 A 的落地方式。

## 1. 交付物

| 文件 | 作用 |
| --- | --- |
| `apps/server/src/worker.ts` | Workers 入口。与自托管入口 `src/index.ts` 共用同一份 `createApp` 与业务逻辑，差异只在运行时装配（D1 替代 SQLite 文件、不注入文件备份） |
| `apps/server/wrangler.toml` | Workers 配置：入口、`nodejs_compat`、D1 binding、R2 `COVERS`（`dogear-covers`）、`migrations_dir`、`[assets]`（前端同域静态资源） |
| `packages/db/drizzle/0004_m5_m7_tables.sql` | 补齐迁移链（见 §4） |
| `.github/workflows/deploy-cloudflare.yml` | 备用路径（Actions）：校验 → 构建前端 → 自动建 D1（无则创建并回填 id）→ 应用迁移 → 部署 Worker →（可选）同步密钥；需配置 API Token |
| `apps/server/scripts/ci-deploy.mjs` | 默认路径（Workers Builds）的一体部署脚本：构建前端工作台 → 确保 D1 存在（无则创建）→ 回填 database_id 到工作副本 → 应用迁移 → `wrangler deploy`（含前端静态资源） |
| `apps/server/scripts/verify-schema-parity.ts` | 校验「迁移链产出的 schema」与「运行时初始化器产出的 schema」一致 |

## 2. 首次准备（路径一 · Workers Builds，零 Token）

**默认口径：全程只用 Cloudflare 面板，不需要创建任何 API Token，也不需要 GitHub Secrets**——Workers Builds（面板的 Git 集成构建）跑在 Cloudflare 自己的构建机上，自带账号凭据。

### 2.1 Worker（后端 API + 数据）

| 步骤 | 位置 | 配置 |
| --- | --- | --- |
| 1. 构建设置 | Workers & Pages → `dogear` → Settings → Build | **Root directory**：`apps/server`；**Build command**：`echo skip`（Worker 由 wrangler 自己打包）；**Deploy command**：`node scripts/ci-deploy.mjs` |
| 2. 登录口令 | 同项目 → Settings → Variables and Secrets | 添加 Secret `DOGEAR_PASSWORD`（工作台登录口令，如 `admin123`；弱口令+公网域名有被猜到的风险，介意请换强口令） |
| 3. （可选）Skill Token | 同上 | 添加 Secret `DOGEAR_SKILL_TOKEN`（Agent(Skill) 调用鉴权） |

部署脚本会自动完成：D1 数据库 `dogear_prod` 不存在则创建 → 把真实 `database_id` 回填到构建机上的 `wrangler.toml` 工作副本（仓库保留占位符）→ 确保 R2 桶 `dogear-covers` 存在（封面本体，D1 只记原 URL）→ 应用迁移（建表与默认数据）→ 部署。之后每次推 main 自动重建部署。

### 2.2 工作台（apps/web 前端）——已并入 Worker，无需单独部署

前端作为静态资源与 API **同域**部署在同一个 Worker 上（v0.4 起，`wrangler.toml` 的 `[assets]`）：

- `/api/*` 与 `/health` 先经 Worker 处理（`run_worker_first`，已实测多级嵌套路径命中）；
- 其余路径由前端静态资源承接，未命中回退 `index.html`（SPA fallback）；
- `ci-deploy.mjs` 第 1 步自动构建前端，推 main 即随 Worker 一起发布——**没有独立 Pages 项目，也不需要配置 CORS**。

> 设计依据：前端请求全部使用相对路径 `/api/*`，同域部署零改动、Cookie 同源无跨站问题；跨域（Pages）方案需改前端 API 地址、开 CORS、处理跨域 Cookie，成本高且不满足「全自动」目标（2026-09-12 经用户拍板合并）。注意：本地 `dev:workers` 与 `pnpm --filter @dogear/server deploy` 前，需先 `pnpm --filter @dogear/web build`（`[assets]` 目录必须存在）。

### 2.3 手动路径（应急/排查用）

```bash
# 1. 建 D1，并把输出的 database_id 替换 apps/server/wrangler.toml 中的占位符
npx wrangler d1 create dogear_prod

# 2. 建表与默认数据（迁移链会插入 4 个默认 Scene 与 5 条设置）
pnpm --filter @dogear/server db:migrate:remote

# 3. 设置密钥（不要写进 wrangler.toml）
npx wrangler secret put DOGEAR_PASSWORD      # 工作台登录口令，必填
npx wrangler secret put DOGEAR_SKILL_TOKEN   # 可选，Agent(Skill) Bearer Token

# 4. 本地联调（可选，用模拟 D1，不需要真实凭据）
pnpm --filter @dogear/server dev:workers
```

> **设计说明（为什么 CI 回填、仓库保留占位符）**：真实 `database_id` 属于具体 Cloudflare 账号，不应提交进 git（否则换账号/换库即失效，多人场景还会互相覆盖）。故仓库始终保留占位符 `REPLACE_WITH_YOUR_D1_DATABASE_ID`，由部署环节查库→建库→仅改**工作副本**。wrangler 4.37+ 虽有资源自动开通，但各 4.x 小版本行为不一致（4.42 仍需 `experimentalProvision` 显式开启、`d1 migrations apply` 对无 id 配置的解析也不稳），`ci-deploy.mjs` 显式完成同样的事，对版本不敏感。本地 `dev:workers` 用模拟 D1，不校验远端 id，占位符不影响本地开发。

## 3. 路径二（备用）· GitHub Actions

> 适用于不想用 Workers Builds、或希望部署逻辑全部进 git 的场景。代价是需要在 Cloudflare 面板创建一次 API Token（Cloudflare 不支持 GitHub OIDC 联邦，无法免 Token）。注意：若两条路径同时启用会重复部署，择一即可。

仓库需配置以下 Secrets / Variables（`Settings → Secrets and variables → Actions`）：

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | 是 | 需 Workers Scripts:Edit、D1:Edit 权限（自动建库/迁移/部署都要用） |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | 是 | Cloudflare 账号 ID |
| `DOGEAR_PASSWORD` | Secret | 否（推荐） | 配置后 CI 自动 `wrangler secret put` 同步为工作台登录口令；不配则工作台无法登录（构建摘要会提示） |
| `DOGEAR_SKILL_TOKEN` | Secret | 否 | Agent(Skill) 调用鉴权 Bearer Token，同样由 CI 自动同步 |
| `CLOUDFLARE_PAGES_PROJECT` | Variable | 否 | 工作台 Pages 项目名；**不设则跳过前端发布步骤**，只部署 Worker |

配好后 **push 到 main 即全自动部署**（也可在 Actions 页手动 `workflow_dispatch`）。流程为四个阶段：

`verify`（typecheck + test + schema 一致性） → `preflight`（判断凭据是否齐备） → `deploy-worker`（构建前端 → 自动建 D1 并回填 id → 迁移 → 部署 → 同步密钥） → `deploy-web`（可选）。

**前置条件未满足时的行为**：`preflight` 只检查一件事——是否缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。缺少即把 `ready=false` 传给后续任务，**仅执行校验并跳过部署**，并在 Actions 的 Summary 里列出缺哪一项与配置步骤。D1 是否存在**不做检查**——由 deploy-worker 首步幂等处理（无则建、有则复用），首次部署与后续推送走同一条路。

**为什么不再检查 wrangler.toml 占位符**（v0.1 曾有该项检查）：v0.2 起占位符就是仓库的**正常状态**，由 CI 回填工作副本，无需人工替换；占位符不再代表「忘了配置」。旧检查会把每次正常推送都拦下来，故移除。

实现注意：job 级 `if` **无法读取 `secrets` 上下文**，故用一个 `preflight` 任务把前置条件转成 `outputs.ready` 再门控部署任务。该任务的 shell 用 `if [ -z ... ]; then` 而非 `[ -z ... ] && ...`：后者在判断为假时返回非零，会被 `bash -e` 直接终止脚本，反而在条件满足时失败（本轮在测试脚本里实际踩到过一次，可作反证——工作流本身用的是 `if...fi`，未受影响）。密钥同步用 `printf '%s'` 而非 `echo` 管道传入：`echo` 追加的换行会混进密钥值，导致口令校验失败。

**关于本仓库的可见性**：该仓库为**私有仓库**——未鉴权访问 `github.com/<owner>/<repo>` 与 `github.com/<owner>/<repo>/actions` 均返回 404，`raw.githubusercontent.com` 上的文件同样 404（而账号页 `github.com/toookamak` 返回 200，可排除「账号不存在」）。因此 **Actions 的运行结果与 workflow badge 都需要登录才能查看**，CI 是否跑通无法在无凭据环境下核对，需仓库拥有者自行在 Actions 页确认。

## 4. 为什么需要 0004 迁移

`0000`–`0003` 只覆盖到 M4。`archives`、`backups`、`channel_config`、`nav_rules`、`sync_queue` 这 5 张表此前**仅由 `packages/db` 的 `initializeSqliteSchema()` 在进程启动时补建**：

- 自托管（Bun/SQLite）因此一直正常——启动时把缺的表补上；
- **D1 不执行该初始化函数**，只跑迁移链，因此缺表会导致运行时报错（如备份、通道、导航规则）。

`0004_m5_m7_tables.sql` 把这 5 张表与缺失索引（含 `bookmarks_raindrop_id_idx`）补进迁移链，并将默认 Scene 与设置项写入迁移。DDL 与 `sqlite.ts` 的 `tableDefinitions` / `createIndexes` 保持一致。

一致性由 `pnpm --filter @dogear/server db:verify-schema` 持续校验（已纳入 CI）：它分别用「迁移链」和「初始化器」建两个库，比对表、列、索引与默认数据，不一致即失败。当前结果：18 张表、0 列漂移、0 缺索引、默认数据一致。

## 5. 两个轨道的运行时差异（必须知道的边界）

| 能力 | 轨 B（Bun/Docker） | 轨 A（Workers） | 说明 |
| --- | --- | --- | --- |
| 真源库 | 本地 SQLite 文件 | D1 | 同一个 `createBookmarkRepository`，驱动不同 |
| **SQL 事务** | 支持（`BEGIN/COMMIT`） | **不支持** | D1 拒绝 SQL 级事务，要求用 Durable Objects 的 `storage.transaction()`。已改为按运行时关闭驱动事务（`RepositoryOptions.sqlTransactions`）：D1 上多步写入按序执行，每条语句自身原子，**整组不保证原子回滚**；自托管仍为真事务 |
| 备份文件 | 可创建并下载（`/api/backup`） | **不可用，返回 501 `NOT_SUPPORTED`** | Workers 无本地文件系统。备份路由改为按运行时装注入：自托管入口注入本地文件实现，Workers 入口不注入 |
| 会话签名 | `node:crypto` | `node:crypto` + `nodejs_compat` | `wrangler.toml` 已开启该兼容标志 |

**事务差异的后果要说清**：在 D1 上，`PATCH /api/bookmarks/:id`、批量更新、回收站清理、建议接受等多步写入若中途失败，**已执行的语句不会回滚**。这是 D1 平台限制下的取舍（总纲 §11 已定 D1 为轨 A 真源），若后续要求强一致，需改用 D1 的批处理接口或迁移到支持事务的存储。

## 6. 验收清单

本地（已通过，wrangler 4.42.0 + 模拟 D1）：

- [x] `wrangler deploy --dry-run` 构建成功，产物中**无 `node:fs` / `node:path` 引用**（确认 Workers 模块图干净）
- [x] `wrangler d1 migrations apply dogear_prod --local` 五个迁移全部应用成功
- [x] 迁移后默认数据就位：4 个 Scene、5 条设置
- [x] `GET /health` 200；登录 200
- [x] `POST /api/bookmarks` 201 并落库；`GET /api/bookmarks` 读回；`PATCH` 200 且 version 递增（**修复前此处 500**，即 §5 的事务问题）
- [x] `sort=recent|title|domain` 均 200
- [x] `/api/backup` 返回 501 `NOT_SUPPORTED`（符合 §5 预期）
- [x] 全仓 typecheck 通过、48 个测试全绿

真实平台验证（2026-09-26 复核更新）：

- [x] 真实首次部署（路径一）：2026-09-12 推 main 后 Workers Builds 自动建库/迁移/部署跑通，线上工作台为新版视觉（用户确认），`DOGEAR_PASSWORD` 登录可用
- [ ] （可选）路径二 Actions 在真实 Secrets 下跑通（workflow 变更后需重验）——本仓库为私有仓库，Actions 结果与 badge 需登录查看，仍待仓库拥有者核对
- [x] 打开 Worker 域名根路径即见工作台登录页（前端同域），登录后列表可读、保存可用。2026-09-26 复核：根路径 200 出登录页、`/health` 200、未鉴权 `/api/*` 401、`/.well-known/capabilities` 返回 JSON；线上前端资源哈希与本仓库 HEAD 重建产物**逐字节一致**（应用版本 v0.7.40）

## 7. 未做的事（2026-09-26 复核）

- **快照内容入 R2 仍未做**：R2 桶 `dogear-covers`（binding `COVERS`）已绑定，但**只存封面**（v0.7.39）。总纲 §9 提到的「快照内容入 R2」尚未实现——轨 A 无文件系统，快照走浏览器侧 `queued_pending_browser`，轨 B 仍落本地 `data/snapshots/`（见 `docs/TODO.md` L3）。不要为了快照去动 `COVERS` 这个 binding。
- **KV / Queues / Durable Objects 未启用**：按总纲 §11 T-9，本期不启用。
- **Cron、R2、真实部署已不再是「未做」**（原文记在此，2026-09-26 更正）：
  - **Cron Trigger 已配置**（v0.7.35）：`[triggers] crons = ["*/5 * * * *"]`，`worker.ts` 的 `scheduled` 每 5 分钟消费 `sync_queue`；自托管侧由入口定时器承担。5 分钟比总纲「≥ 1min」更疏，是为换 Free 档 CPU / 50 子请求余量。
  - **R2 已绑定**（v0.7.39）：`COVERS` / `dogear-covers`，用途见上一条。
  - **真实部署已跑通**（2026-09-12）：推 main 后 Workers Builds 自动建库/迁移/部署成功，线上工作台为新版视觉（用户确认）——§2.1 的零 Token 默认路径全链路实证可用，见 `docs/TODO.md`「已知小缺口」。
