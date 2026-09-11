> **文档版本**：v0.1
> **应用版本**：v0.7.5
> **文档状态**：草案（待用户按本机实际情况执行一次验证）
> **目的和适用范围**：Cloudflare Workers（轨 A）的部署方式、必填配置与验收步骤。确定「推送到 GitHub 即自动部署」的落地口径，以及 Workers 与自托管（轨 B）的能力差异。以本文为准配置部署；不改 wiki。
> **权威级别**：模块规则。服从需求总纲与技术总纲；冲突时以需求总纲的产品对错为准。
> **配套文档**：[技术总纲](../../wiki/DogEar-技术总纲.md)（§3 部署双轨、§11 T-1~T-12）· [API 结构表](../API结构表.md) · [数据库结构表](../数据库结构表.md) · [待办清单](../TODO.md)
> **唯一需求源**：[需求总纲](../../wiki/DogEar-需求总纲.md)
> **最后更新日期**：2026-09-10
> **修改记录**：
>
> | 文档版本 | 应用版本 | 日期 | 修改摘要 | 修改模型ID |
> | --- | --- | --- | --- | --- |
> | v0.1 | v0.7.5 | 2026-09-10 | 初稿：Workers 入口与 D1 绑定、一键部署流程、能力差异、验收清单 | deepseek-v4.1-flash |

# Cloudflare Workers 部署（轨 A）

技术总纲 §3 已定：默认 Track A（Cloudflare Workers + D1），Track B（Docker 自托管）兜底。本文写轨 A 的落地方式。

## 1. 交付物

| 文件 | 作用 |
| --- | --- |
| `apps/server/src/worker.ts` | Workers 入口。与自托管入口 `src/index.ts` 共用同一份 `createApp` 与业务逻辑，差异只在运行时装配（D1 替代 SQLite 文件、不注入文件备份） |
| `apps/server/wrangler.toml` | Workers 配置：入口、`nodejs_compat`、D1 binding、`migrations_dir` |
| `packages/db/drizzle/0004_m5_m7_tables.sql` | 补齐迁移链（见 §4） |
| `.github/workflows/deploy-cloudflare.yml` | 推送 main 即：校验 → 应用 D1 迁移 → 部署 Worker →（可选）发布 Pages |
| `apps/server/scripts/verify-schema-parity.ts` | 校验「迁移链产出的 schema」与「运行时初始化器产出的 schema」一致 |

## 2. 首次准备（一次性）

```bash
# 1. 建 D1，把输出的 database_id 回填到 apps/server/wrangler.toml
npx wrangler d1 create dogear_prod

# 2. 建表与默认数据（迁移链会插入 4 个默认 Scene 与 5 条设置）
pnpm --filter @dogear/server db:migrate:remote

# 3. 设置密钥（不要写进 wrangler.toml）
npx wrangler secret put DOGEAR_PASSWORD      # 工作台登录口令，必填
npx wrangler secret put DOGEAR_SKILL_TOKEN   # 可选，Agent(Skill) Bearer Token

# 4. 本地联调（可选，用模拟 D1，不需要真实凭据）
pnpm --filter @dogear/server dev:workers
```

## 3. 一键部署到 GitHub

仓库需配置以下 Secrets / Variables（`Settings → Secrets and variables → Actions`）：

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | 是 | 需 Workers Scripts:Edit、D1:Edit 权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | 是 | Cloudflare 账号 ID |
| `CLOUDFLARE_PAGES_PROJECT` | Variable | 否 | 工作台 Pages 项目名；**不设则跳过前端发布步骤**，只部署 Worker |

配好后 **push 到 main 即自动部署**（也可在 Actions 页手动 `workflow_dispatch`）。流程为四个阶段：

`verify`（typecheck + test + schema 一致性） → `preflight`（判断前置条件是否齐备） → `deploy-worker`（先迁移后部署） → `deploy-web`（可选）。

**前置条件未满足时的行为**：`preflight` 会检查两件事——① 是否缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`；② `apps/server/wrangler.toml` 的 `database_id` 是否仍是占位符 `REPLACE_WITH_YOUR_D1_DATABASE_ID`。任一未满足即把 `ready=false` 传给后续任务，**仅执行校验并跳过部署**，并在 Actions 的 Summary 里列出具体缺哪一项与配置步骤。

加第 ② 项的原因：若凭据配齐却忘了替换占位符，`wrangler d1 migrations apply` 会抛出难懂的 wrangler 报错；提前拦下并直接指明该改哪个文件，比事后排查省事。

实现注意：job 级 `if` **无法读取 `secrets` 上下文**，故用一个 `preflight` 任务把前置条件转成 `outputs.ready` 再门控部署任务。该任务的 shell 用 `if [ -z ... ]; then` 而非 `[ -z ... ] && ...`：后者在判断为假时返回非零，会被 `bash -e` 直接终止脚本，反而在条件满足时失败（本轮在测试脚本里实际踩到过一次，可作反证——工作流本身用的是 `if...fi`，未受影响）。

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

待人工验证（需真实 Cloudflare 账号，本次未执行）：

- [ ] 真实 `wrangler d1 create` + `secret put` + `wrangler deploy`
- [ ] GitHub Actions 三个 Job 在真实 Secrets 下跑通
- [ ] （可选）工作台 Pages 发布与跨域 CORS（`DOGEAR_CORS_ORIGIN`）

## 7. 未做的事

- **Cron Trigger 未配置**：总纲 §3 提到轻量定时任务可用 Cron（≥1min）。当前 Worker 没有 `[triggers]`，同步队列的后台消费在 Workers 上尚无调度（自托管侧也是「队列消费顺延」，见 `docs/TODO.md` 的 L2）。
- **R2 未接入**：总纲 §9 提到快照内容入 R2。当前 Worker 未绑定 R2；快照本身在 `docs/TODO.md` L3 仍是未完成项。
- **KV 未启用**：按总纲 §11 T-9，本期不启用。
- **未在真实 Cloudflare 上部署过**：上述「本地已通过」均为 wrangler 的本地模拟（Miniflare），真实平台行为（尤其 D1 迁移的远程执行与兼容日期）需人工跑一次确认。
