# Changelog

- 2026-09-11 / v0.7.23 / ef20ae2 — **备份恢复**（`POST /api/backup/:id/restore`）：此前备份只能下载、无法还原。语义按 `docs/modules/20260904_备份功能设计.md` §2.8 定为**全量替换**（覆盖当前书签表，非增量合并），并实现文档要求的三道保护：①**恢复前强制自动创建全量备份作为回滚点**（建不出来就拒绝恢复，不冒「替换了却无法回退」的险）；②复用备份中的书签 id 使身份一致，标签/场景按名字查找或创建后重新挂载；③二次确认对话框讲清「备份之后新增的书签会被移除」而非只问「确认恢复？」。服务端额外要求显式 `confirm: true`（破坏性端点不接受隐式确认）。`full` 档是数据库文件副本，服务运行中替换被持有的库文件不安全，故**明确返回 501 并给出替代做法**，不假装支持。**API 结构表升 v1.3** 并同步修订三处原本写着「备份恢复本版不做」的条目。新增 CSV 解析器（按 RFC 4180 处理引号/字段内逗号/换行/`""` 转义/BOM/CRLF，不用 `split(',')`——书签标题带逗号很常见）与 11 项测试；`packages/db` 的 `BookmarkInput` 增可选 `createdAt`（否则恢复回来的书签全变成「今天创建」，与恢复语义不符）。端到端 **25 项全通过**（在**数据库副本**上跑，未触碰真实库）：契约守卫 4 项、全量替换验证（恢复后总数回基线、恢复前新增的书签确被移除）、数据保真、回滚点可用可下载、重档 501、操作日志、中档恢复。全仓 146 项测试通过。

- 2026-09-10 / v0.7.22 / 8255612 — 操作日志补**类型筛选 / 关键词搜索 / 分页**（对齐原型 `LogSection`）：此前 293 条日志平铺一屏、无法定位。**类型筛选走服务端**（`?action=` 本就支持，是真过滤），搜索与分页在端侧（服务端无 `q` 参数且一次返回全部，不为此新增接口）；纯逻辑下沉到 `utils/log-query.ts`。细节：页码越界收敛到末页不出现空白页、空列表报 1 页、分页控件仅在多于 1 页时显示、无匹配给出明确提示。新增 20 项纯函数测试（web 48→68），浏览器实测 11/11（服务端筛选 293→83 且仅含 create、标题计数、分页「1 / 15」、切类型后可见行全为「新建」、无匹配零行且隐藏分页）。**排查记录**：验证中日志页一度持续显示「加载中…」20 秒不恢复，逐层排查（后端 1.6ms → 模块新鲜 → Vite 代理 3ms → 抓包发现请求无响应）后确认是**复用了十几轮的 headless Edge 实例把连接池搞坏**，换全新实例即 11/11 通过——与「Vite 模块陈旧」并列的另一类假性故障，已记入 TODO。

- 2026-09-10 / v0.7.21 / d991683 — **工作台入参拒绝未知字段，Skill 入参保持宽松**（按用户确认的方案）。此前 12 个写接口中 10 个会静默吞掉不认识的字段并照常返回成功，字段名打错时看起来保存成功、实际该字段被丢弃。改动：工作台书签创建/更新接上早已存在却从未接入的 workbench 变体并加 `.strict()`；批量/回收站清空/渠道配置加 `.strict()`；**补上 scenes/folders/tags 的入参 schema（此前完全没有）**——那三条路由原先把 `{ ...body }` 直接展开进 `create()`，才是 `aer`/`enabld`/`parentid` 能溜进去的根因，白名单以 `docs/API结构表.md` §8.4 为准。**Skill API 有意不加 strict**：它是对外接口，第三方 agent 可能回传含多余字段的完整对象，收紧会直接让它保存失败，故 strict 加在使用点而非 base。实测 zod 3.25.76 的 `.strict().extend()` 保持严格、`.strict()` 必须在 `.refine()` 之前。新增 22 项契约测试专门锁住这一不对称；SQLite 与 D1 两侧端到端各 26 项全通过；界面回归 7/7（经真实表单保存书签与场景均确实入库）。全仓 115 项测试通过。

- 2026-09-10 / v0.7.20 / a320dea — **修设置白名单静默吞掉未知键**：`docs/API结构表.md` 约定「`PUT /api/settings` 只允许白名单、未知 key 返回 `VALIDATION_ERROR`」，但 `settingsWhitelistSchema` 是普通 `z.object`，zod 默认**静默剥离**未知键——`{bogus:1}` 被剥成 `{}` 后返回 `200 + {items:[]}`。实测典型危害：键名打错（`recycle.retention_day` 少个 s）也返回 200，**界面显示已保存、服务端仍是旧值**，属静默失败。给 schema 加 `.strict()`（空对象仍合法），SQLite 与 D1 两侧复核：未知键/打字错误 → 400，白名单内 → 200；并确认界面两处真实保存路径（回收站保留期限、Agent 能力开关）与数值型入参均不受影响。新增 5 项契约测试锁住该行为。**同时完成 D1（Track A）57 项全接口巡检**：读路径 20 项、写路径（含版本冲突、导出、回收站全流程）、组织维度 CRUD、导航规则 CRUD、设置白名单、Workers 专属 501 兜底、鉴权边界，**全绿**——此前在 SQLite 上修过的 nav/rules 500 与事务问题在 D1 侧同样已修复。全仓 102 项测试通过。

- 2026-09-10 / v0.7.19 / 3b0513b — **修筛选/搜索结果重复**：`repository.list` 在带 `sceneId` / `tagId` / `q` 过滤时 `LEFT JOIN` 了 `bookmark_scenes`、`bookmark_tags`、`tags` 三张多对多表且无 `DISTINCT`/`GROUP BY`，产生笛卡尔积。实测挂 2 场景 + 2 标签的书签：按场景/标签筛选时重复 2 次、按关键字搜索时重复 4 次——侧栏点场景、工作台筛选、搜索命中标签名都会看到重复卡片，分页也会因虚高行数错乱。改为 **EXISTS 子查询**表达关联过滤（结构上不可能重复、无需 `DISTINCT` 以免破坏 keyset 分页、且能用既有索引），`list` 只查 `bookmarks` 一张表。修复后 7 种查询全部「命中 1 次」，返回条数由虚高的 4 条降为真实的 1 条；筛选下的分页完整性复测通过（SQLite 与 D1 双侧：多筛选 × 多页大小，均无重复无漏项）；性能未回退（limit 1→100 中位 1.1/2.1/4.4/7.2/14.8ms）。新增结构性回归测试并**验证它会失败**（临时把 JOIN 加回后测试立刻失败）。全仓 97 项测试通过。

- 2026-09-10 / v0.7.18 / 1acb1c4 — CI 部署前置检查补强：`preflight` 原先只查 Cloudflare 凭据，现增查 `apps/server/wrangler.toml` 的 `database_id` 是否仍是占位符 `REPLACE_WITH_YOUR_D1_DATABASE_ID`（凭据配齐却忘了替换时，`wrangler d1 migrations apply` 会抛出难懂报错，提前拦下并指明该改哪个文件）。三种情形用 `bash -eo pipefail` 实跑验证（缺凭据 / 占位符未替换 / 齐备），均 exit 0 且 `ready` 取值正确。**同时确认该仓库为私有仓库**：未鉴权访问 repo 页与 `/actions` 均 404、`raw.githubusercontent.com` 上的文件亦 404，而账号页返回 200——因此 Actions 运行结果与 badge 需登录才能查看，**「推送后一键部署」只验证到「配置与脚本正确」这一层，工作流是否真的跑过未经确认**，已记入部署文档待仓库拥有者核对。

- 2026-09-10 / v0.7.17 / 83d7f7a — 表格行与看板卡补键盘可达与焦点样式：网格卡与图标卡早已支持 Enter/Space 打开详情，表格行与看板卡此前只能鼠标点，属一致性缺口。两者加 `tabIndex=0`、`aria-label`、Enter/Space 打开详情，并补 `:focus-visible` 轮廓。浏览器实测（真实 `Input.dispatchKeyEvent`）表格 50 行与看板 50 卡均可 Enter/空格打开详情、Esc 关闭，无异常。**未确认**：程控 `.focus()` 不触发 `:focus-visible`（浏览器按启发式判定键盘交互），故真实 Tab 导航下的轮廓需人工确认。

- 2026-09-10 / v0.7.16 / fd5f054 — 详情页就地新建标签（对齐原型 `DetailPanel`）：此前必须先到「组织管理 → 标签」建好再回来挂。标签为库级资源，新建即刻落库并广播 org 变更（侧栏同步），挂到当前书签仍随详情「保存」一起提交；兼容服务端「重复 name_key 返回已有标签」的行为，重复输入直接复用并选中；`WorkbenchPage` 同时订阅 `onOrgChanged` 重载组织维度，堵住「新建的标签不在本页列表里、看不到也摘不掉」的同类坑。**同时补验上一轮标记未验证的状态栏失败态**：根因是 node 的 `fetch`(undici) 在本环境连不上 CDP 端口，改用 `node:http` 即通——CDP 一直可用。实测拦截 `/api/sync/pending-count` 返回 500 时显示「同步状态读取失败」+「重试」，解除后点重试恢复「待同步 0」。

- 2026-09-10 / v0.7.15 / de25faa — 按一次原型对照审计补齐 5 项「必须补」能力：①批量加标签（原型 `SelectionToolbar` 有，正式此前只支持批量挂场景）；②空状态可操作（`EmptyState` 早已支持 action 但三个调用点都没传，等于死胡同）；③状态栏同步失败态与「重试」（原先失败被 catch 吞掉，用户会把「取不到」误读成「没有待同步」）；④侧栏维度计数（取自已加载列表、零额外请求；各维度下书签数需统计接口，本版不允许新增路由故不做）；⑤回收站批量（全选/批量恢复/批量永久删除，对既有单条端点客户端扇出并如实上报成功与失败条数）。①②④⑤ 已用真实数据在浏览器实测；③ 因注入拦截在重载后失效、且沙箱收紧后 node 无法连 CDP 端口，**仅经 typecheck 与构建，需人工确认**。

- 2026-09-10 / v0.7.14 / bda224a — AI 建议四个落点按真实数据落地（PRD §6.1、实施计划 §WEB-4.6）：此前只有「未整理详情」一处真实存在，其余三处缺失（计划里标 ✅ 的「占位 UI 排入」并未落地）。四落点全部由服务端真实字段 `pendingSuggestionCount` 驱动：①「输入时」保存成功后取回该条，若已有预备建议则打开详情待确认，无建议时只提示已保存（不假装有）；②「整理时」工具栏新增「整理建议」按钮带计数，点击打开第一条有建议的书签，批量选择时提示「其中 N 条有 AI 建议」；③「Inbox 内」卡片与表格行显示「AI 建议 N」徽标；④「未整理详情」沿用既有建议面板。验证方式为用 Skill API 造出真实建议后逐落点实测。

- 2026-09-10 / v0.7.13 / ee3ca5b — Scene 停用（PRD §2.0.1 要求可停用，此前界面只能删）。语义按 `docs/modules/20260904_数据库设计.md` 落实：停用后**挑选器隐藏**，但**不删历史挂载**——已挂上的书签仍能按它筛到。据此区分两种取用面并收敛为可测纯函数 `utils/scene-filtering.ts`：挑选器隐藏停用项、但保留该书签已挂的（否则看不到也摘不掉），筛选面保留全部并弱化显示。同时把删除撞 `SCENE_IN_USE` 的原始英文错误改为可执行提示（改用停用）。侧栏、筛选下拉、详情挑选器、批量加场景均同步。

- 2026-09-10 / v0.7.12 / df39af1 — Scene AERR 呈现落地（PRD §2.0.3 / 技术总纲 §5.2.2）：新增 `utils/scene-presentation.ts`（aerr → 默认排序 / 信息密度 / 主操作文案，与原型口径一致，未知取值回退默认），进入 Scene 时标题与主操作随该 Scene 变化、`data-density` 落到容器；排序调整收敛为纯函数 `nextSortOnSceneChange`（进入/切换用该 Scene 默认排序，离开回到默认排序，停留同 Scene 不覆盖用户手动选择）。**同时修一处既有缺陷**：侧栏顶部导航（Inbox / 书签）原先只跳路径不带参数，而已按场景筛过后筛选状态是页内局部 state，导致场景筛选与场景带来的排序一直黏住、点「书签」回不到全部列表；现由侧栏显式下达 `clear=1` 意图、工作台清空筛选并复位排序。另删除两处死代码：`hooks/useBookmarks.ts`（全仓无 import，且 `filters` 进了依赖却未使用）、`types/view.ts`（`ViewMode` 与 `WorkspaceToolbar` 重复且已过期）。全仓测试 88 项通过。

- 2026-09-10 / v0.7.11 / d5b40d4 — 补前端纯函数层测试：`apps/web` 此前无任何测试文件（`vitest run` 恒为 passWithNoTests），现为 `utils/format.ts`（17 项：标签映射、单位分界、时间格式兼容、相对时间分档，以及标签映射必须覆盖契约枚举）与 `toast.ts`（7 项：`errorMessage` 对 Error/字符串/空值/非 Error 对象的处理、失败提示停留时长最长）补测试。全仓测试 72 项通过。

- 2026-09-10 / v0.7.10 / a183963 — 修单条导出字段错配：导出 HTML/Markdown 的「来源」标签实际填的是 `domain`，且 `domain` 为空时渲染成「来源: 」空条目；改为「收集方式」取 `source` 的中文标签、「域名」单独一行，空值一律不输出；两种格式补齐此前完全丢失的摘要、场景与标签。

- 2026-09-10 / v0.7.9 / a0d2441 — 修查询串读取缺陷并完成其余页面对齐。**关键修复**：wouter 的 `useLocation()` 只返回 pathname、不含查询串，而 `OAuthCallbackPage` 与 `ImportResultPage` 都用 `location.split('?')[1]` 取参数——永远取不到，导致 Raindrop OAuth 回调固定报「缺少授权参数」（即 OAuth 登录从未成功过）、导入结果页从不显示数据；改用 `useSearch()` 后两者均正常。其余：登录页/首启向导/导入结果页/导航页/命令面板改 class-based；命令面板补键盘导航（↑↓/Enter/Esc 与 option/combobox 语义，此前只能鼠标点选）；`EmptyState` 补可选操作，`ErrorMessage` 去掉硬编码 oklab 颜色并支持重试；新增 404 兜底页（此前只渲染裸文本「404」）。TSX 内硬编码颜色清零，内联样式由 307 处降至 56 处。

- 2026-09-10 / v0.7.8 / 001bf39 — 数据通道表单改 class-based，并修三处通道缺陷：删除通道补二次确认（此前点「删除」立即抹掉配置与凭据且无撤销）；导出失败不再静默（原只显示 exported/failed 两个 0，失败原因无处可看）；`ChannelConfig` 修编辑态 WebDAV 地址与用户名「改不动」（原把 `channel.config` 直接当 value 用，输入不回显）；移除下拉里的 S3 选项（该分支只产出空 config，会存下无配置的 S3 通道，S3 由独立表单处理）；`S3Config` 不再把已保存的遮罩值当输入框内容显示。

- 2026-09-10 / v0.7.7 / 18f993a — 回收站补保留期限提示（取 `recycle.retention_days`）；恢复/永久删除/清理过期项均带按操作区分的确认弹窗；清空改回 `onlyExpired`（原传 `false` 会连未过期的一起删）。保存表单补「标题由服务端异步抓取」说明；建议面板展示类型/目标/置信度/理由，并明确不提供「撤销接受」（API 无该能力）。

- 2026-09-10 / v0.7.6 / 7d7e76f — 反馈层对齐原型：详情改覆盖式浮层（遮罩点击与 Escape 收起，补状态/来源徽标、摘要与 7 项来源信息）；新增 `toast.ts` + `ToastRegion`（aria-live=polite，按类型 3/3.5/6 秒自动消失）；新增 `Skeleton`（网格/表格/图标卡/看板四形态，支持 prefers-reduced-motion）；全部原生 `window.confirm`/`alert` 替换为 `ConfirmDialog` 与 toast，并识别版本冲突给出可行动提示。

- 2026-09-10 / v0.7.5 / f38d9bf — Cloudflare Workers（轨 A）一键部署：新增 `apps/server/src/worker.ts`（与自托管入口共用 `createApp`，仅运行时装配不同）、`wrangler.toml`、`.github/workflows/deploy-cloudflare.yml`（推送 main 即校验→迁移 D1→部署 Worker→可选发布 Pages）；备份路由改为按运行时装注入，避免 `node:fs` 污染 Workers 模块图（Workers 上返回 501 `NOT_SUPPORTED`）。修两处必修缺陷：**D1 不支持 SQL 级事务**（drizzle d1 session 发 `BEGIN TRANSACTION` 被拒，导致 PATCH/批量/回收站清理等写路径在 D1 上全部 500），改为按运行时关闭驱动事务；**迁移链缺 5 张表与 1 个索引**（`archives`/`backups`/`channel_config`/`nav_rules`/`sync_queue` 此前仅由 `initializeSqliteSchema()` 启动时补建，D1 只跑迁移链会缺表），新增 `0004_m5_m7_tables.sql` 并加 `scripts/verify-schema-parity.ts` 持续校验。详见 `docs/modules/20260910_Cloudflare部署.md`。

- 2026-09-10 / v0.7.4 / d2363aa — 组织管理接 `useOrganization` 单一数据源：三个 Manager 原先各持列表副本并直接调 API，导致该 hook 的增删改无调用方、且侧栏与组织页互不同步；新增 `org-events.ts` 广播组织变更，侧栏据此重取（新建场景无需刷新页面即出现）；失败不再吞掉，改为页内提示；`ConfirmDialog` 补 `role="dialog"` 与 class-based 样式。

- 2026-09-10 / v0.7.3 / d9e0dc8 — 工作台对齐原型：新增内容头与工具栏（搜索、来源筛选、排序、四视图切换），落地四视图（卡片网格 / 站点图标 / 六列表格含行内确认搁置 / 三列看板含 Pointer Events 拖拽改状态）；排序接服务端 `sort`，视图选择持久化；移除被取代的 `BookmarkListView`。

- 2026-09-10 / v0.7.2 / 3348fde — 书签列表支持 `sort`（`recent`/`title`/`domain`）：游标改为按排序键编码（`<sort>~<value>~<id>`）以避免改排序后翻页漏项，跨排序复用游标安全回退首页；title/domain 由数据库层排序（不读全量再内存排序）；`packages/db` 测试桩补 `innerJoin`（`repository.test.ts` 此前在 main 上长期失败）。

- 2026-09-10 / v0.7.2 / e0ea3b5 — 设置页对齐原型六分区（状态信息 / 输入源·导出 / 备份与恢复 / Agent 接入 / 日志 / 回收站），新增 `tabs/` 六个分区组件与 `utils/format.ts`，状态分区含同步队列、后台任务与 Skill 用量并 30 秒自刷新，日志分区可撤销操作与重试/取消归档任务；移除被取代的 `SettingsSection.tsx`。同时修两处后端缺陷：`POST/PATCH /api/nav/rules` 的 `createdAt/updatedAt` 由 number 改 Date（`nav_rules` 为 drizzle `timestamp_ms` 列，传数字会抛 `value.getTime is not a function` 致 500）；重档备份改由 `createApp` 注入真源库路径（原仅读 `DOGEAR_DB_PATH`，而 `index.ts` 未设置该变量，重档备份必然失败）。`packages/db` 的 `navRules.create` 入参类型同步改为 `Date`。

- 2026-09-10 / v0.7.1 — 修复两处既有缺陷：`apps/web/index.html` 补齐 doctype / html lang / head（charset、viewport、title），页面由 quirks 模式（`BackCompat`）回到标准模式，标签页有标题，手机端 `max-width:767px` 媒体查询恢复生效（此前无 viewport meta，布局视口按 980px 计算导致 ☰ 侧栏开关在手机上不显示）；胶囊按钮文字色由非法 CSS `oklab(0.263 / 0.6)` 改为 `rgba(38, 37, 30, 0.6)`（原写法缺 a/b 分量被浏览器丢弃，文字渲染成纯黑），与 DESIGN.md §9 的 rgba 回退规则一致。

- 2026-09-10 / v0.7.0 / c414074 — 正式工作台应用外壳按 DESIGN.md 重做：建立 class-based 样式层（`styles/tokens.css` + `styles/app.css`，`styles.css` 改为入口），新增应用级 TopBar（品牌/搜索/保存/退出）并把原页内标题栏下沉为 `PageHeader`，重写 Sidebar（主区导航 + Scene/文件夹/标签三段含空状态 + 底部设置）与 StatusBar（待同步数 + 撤销，改局部刷新），并修补 `.btn-secondary` 未定义与 6 个无 fallback 变量；外壳 4 个文件内联样式归零。屏稿与确认结论见 `docs/modules/20260910_工作台外壳屏稿.md`。

- 2026-09-10 / v0.6.3 / ab8b8a3 — 修复本地端口不一致：`apps/web/vite.config.ts` 代理目标由 8789 改回 8787，与服务端默认端口及 `apps/server/Dockerfile`、`docker-compose.yml`、`apps/web/nginx.conf` 的口径统一，`pnpm dev` 无需另设 `PORT` 即可登录；README 补充端口对照表与改端口须知。

- 2026-09-07 / v0.6.2 — 未完成项写入 `docs/TODO.md`；本地备份目录加入 gitignore。

- 2026-09-07 / v0.6.2 / ef321f2 — 修复 Raindrop 导入超时 500：Bun serve idleTimeout 默认提到 120s；导入合并 create+update 两次写为一次，写入减半；扩展 db 内部 BookmarkInput 支持 title/raindropId/raindropExtras。

- 2026-09-07 / v0.6.1 / e4c6b75 — Raindrop OAuth 登录：新增 Client ID/Secret 配置与「通过 OAuth 授权」按钮，后端加 /api/channels/oauth/exchange 换 access token 写回通道，新增 /settings/oauth/callback 回调页并挂路由，通道卡片展示授权状态；保留手动 Token 方式。

- 2026-09-04 / v0.6.0 — 修复登录无反应：Vite 代理改回 8789，登录成功后先刷新会话再进工作台。

- 2026-09-04 / v0.6.0 — L1：状态栏显示未推送条数；删除/批量可撤销；首次向导可跳过且不强制 Raindrop。

- 2026-09-04 / v0.6.0 — 修复设置页请求 GET /api/skill/usage 被当成 Skill Bearer 鉴权而 401、整页踢回登录。

- 2026-09-04 / v0.6.0 — 工作台能整理：详情可改 Scene/Folder/Tag/状态并删进回收站；列表筛选与加载更多；批量改状态/加场景/软删；⌘K 含标签；操作日志可加载；建议空槽保留。

- 2026-09-04 / v0.6.0 — M7 导航收口：导航列表只返回标题/图标/URL，排除 Inbox 与私密；最近访问走 access_records；点击记 client=navigation；未登录进密码页。

- 2026-09-04 / v0.6.0 — M5/M6 连通：通道配置改走 channel_config，GET 掩码且禁止把 *** 写回；三通道 test；Raindrop 按 raindrop_id 去重导入；S3/WebDAV 导出冒烟；轻档备份可下载；快照入队并入 archive_jobs。

- 2026-09-04 / v0.6.0 / 42a6f84 — 数据库/API 结构表升至 v1.2：收编已有 M5–M7 表名与路径；本版只覆盖通道测试连通与一次上下传、三档备份可下载、导航规则存储；冲突/双向同步/快照产文件/规则求值仍禁止。

- 2026-09-04 / v0.6.0 — F-1: Docker 部署：创建 `apps/server/Dockerfile`（Bun + pnpm monorepo 多阶段构建）、`apps/web/Dockerfile`（Vite 构建 + Nginx 静态托管）、`apps/web/nginx.conf`（API 反向代理 + SPA fallback）、`docker-compose.yml`（server + web 双服务编排、持久卷、健康检查）、`.dockerignore`；更新 README 进度表与 AGENTS.md 状态为 M5-M7 完工
- 2026-09-04 / v0.5.0 — M7-3: 前端导航页：创建 nav API 客户端 `apps/web/src/api/nav.ts`，创建 `NavPage` 组件 `apps/web/src/pages/NavPage.tsx`（展示最近访问 + 全部书签分页加载），添加 `/nav` 路由，在侧边栏添加导航链接；typecheck 通过。
- 2026-09-04 / v0.5.0 — M6-2: Archive Job 引擎：添加 `archives` 仓库方法到 `packages/db/src/repository.ts`（create/get/listByBookmark/updateStatus/listPending/countPending），创建 `apps/server/src/archive/archive-service.ts`（ArchiveJobService 状态机：createJob/getJob/getJobsByBookmark/processPending/retryJob/cancelJob），创建 `apps/server/src/archive/archive-routes.ts`（REST API：POST/GET /api/archive、GET /api/archive/bookmark/:id、POST retry/cancel），挂载到 `apps/server/src/app.ts`（requireSession 保护 `/api/archive`）；typecheck 通过。
- 2026-09-04 / v0.5.0 — M6-4: Metadata 增强：创建元数据提取服务 `apps/server/src/archive/metadata.ts`，暴露 `/api/metadata/extract` API 端点，在保存新书签时异步提取网页元数据（title/excerpt/cover/author/domain/favicon/publishedAt）并更新书签；typecheck 通过。
- 2026-09-04 / v0.5.0 — M6-3: SingleFile 快照：创建 archive API 客户端（apps/web/src/api/archive.ts）、SnapshotButton 组件（apps/web/src/components/bookmarks/SnapshotButton.tsx），集成到 BookmarkDetail 详情面板（备注字段后、保存按钮前）；typecheck 通过。
- 2026-09-04 / v0.5.0 — M5-7: 导入梳理页（ImportResultPage）：创建 ImportResultPage 组件展示导入结果统计与错误详情，添加 /import-result 路由，更新 ChannelManager 导入流程跳转至结果页；typecheck 通过。
- 2026-09-04 / v0.5.0 — M5-2: Dexie 端侧镜像缓存：新增 dexie 依赖，创建 DogEarCache 数据库类（bookmarks/scenes/folders/tags/settings 表），cacheSync 同步服务（syncAll/syncBookmarks/syncScenes/syncFolders/syncTags/getBookmark/queryBookmarks），以及 db 模块导出入口。

- 2026-09-04 / v0.4.0 — M4 正式工作台前端完整实现（C 步）：应用壳层 + 认证、书签主链路（Inbox/列表/保存/详情/筛选）、⌘K MiniSearch 端侧搜索、批量处理、回收站、AI 建议占位 UI、组织管理（Scene/Folder/Tag CRUD）、操作日志/设置/Job 列表；仅新增 wouter + minisearch 两个生产依赖；严格遵循 DESIGN.md 视觉规范；typecheck + test + build 全部通过。

- 2026-09-04 / v0.4.0 / 1935003 — M4 API 后端补齐（B 步）：repository 分页改造、幂等键/用量存储、batch skipped 返回 {id,reason}、purgeDeleted like→lt 修复、archiveJobs updatedAt 初始化；路由层 keyset 分页接线、Idempotency-Key 支持、version 冲突检测、settings 白名单、skill capabilities/usage 查询、job 状态守卫、suggestions/recycleBin 统一 envelope。

- 2026-09-04 / v0.4.0 — 确认 M4 前端开工口径：修订 AGENTS/README 进度表述（M3/M4 后端已完成作起点）、计划书待确认项收口并增补范围（wouter 路由、⌘K+MiniSearch、建议四落点占位、保存表单可选字段、DB schema 本轮允许、测试只做纯函数层）、修正计划 §3.3 目录大小写为 `docs/TODO/`，web package.json 将 @vitejs/plugin-react 移至 devDependencies。

- 2026-09-04 / v0.4.0 — 将正式前端与 M4 API 实施计划移至 `docs/todo/`，删除根目录 `todo/`，并同步修正计划内路径。

- 2026-09-04 / v0.4.0 — 同步正式前端与 M4 API 实施计划至 API 结构表 v1.1，并明确未明确内容可临时参考 dev 原型、API 变更需同步计划书。

- 2026-09-04 / v0.4.0 / 3e784bc — AGENTS.md 工作原则增补「反复失败则停」：同一问题一般不超过三次，仍错则告知用户并确认后续路线。

- 2026-09-04 / v0.4.0 / b63c1ef — AGENTS.md「额外补充」改为过时则标注。

- 2026-09-04 / v0.4.0 / 0208e2d — AGENTS.md「额外补充」去掉「过时则删除或迁入对应章节」。

- 2026-09-04 / v0.4.0 — API 结构表升级至 v1.1，补充 M4 正式前端接线所需的请求、回执、分页、错误、资源、设置、能力、用量和 Job 契约。

- 2026-09-04 / v0.4.0 / 019361e — AGENTS.md 增补「规则可演进」：限制并非一成不变，推进中有更好建议须主动提出、确认后再改本文件；文末「额外补充」改作随项目进行记录注意事项的位置。

- 2026-09-04 / v0.4.0 — 模块文档统一加创建日期前缀：`API设计/数据库设计/Scene-AI与待设计细部` 等 5 个改名并同步全仓引用；新增 `docs/modules/20260904_备份功能设计.md`（备份目标、频率、内容、保留、恢复/删除、本地导入导出）与 `docs/modules/20260904_同步功能设计.md`（Raindrop Token/自动手动同步）。

- 2026-09-04 / v0.4.0 / e69620b — M3+M4 后端：数据库结构补全、共享契约扩展、仓库层增强、M3 Skill API（7 个 Skill + Bearer 鉴权 + 能力开关 + 限速）、M4 工作台 REST（书签组织/回收站/Scene/Folder/Tag CRUD/建议/日志/设置/Job 占位）

- 2026-09-04 / v0.2.0 — 数据库/API 结构表将「当前覆盖与升级条件」改作正文第 1 章，不再放在文头注释里。

- 2026-09-04 / v0.2.0 — 数据库/API 结构表文头补充当前覆盖范围（M3/M4）与升级触发条件（M5–M7 及破坏性变更须先讨论再改表）。

- 2026-09-04 / v0.2.0 — 新增开发约束：`docs/数据库结构表.md`、`docs/API结构表.md`；设计说明仍留 `docs/modules/`，不进 wiki。

- 2026-09-04 / v0.2.0 — 撤回误写入 wiki 的账本/API 定稿与注册表；现行生效稿改回 `docs/modules/20260904_数据库设计.md`、`docs/modules/20260904_API设计.md`；技术总纲恢复原承接表述。

- 2026-09-04 / v0.2.0 / 453fa27 — 正式注册核心账本与窗口定稿：`wiki/DogEar-20260904_数据库设计.md`、`wiki/DogEar-20260904_API设计.md`（v1.0 生效）；新增 `wiki/README.md` 定稿目录；草案原文归档。

- 2026-09-04 / v0.2.0 — 新增 M3/M4 核心账本与窗口草案：`docs/modules/20260904_数据库设计.md`、`docs/modules/20260904_API设计.md`（含业务逻辑说明；不改 wiki、不写代码）。

- 2026-09-04 / v0.2.0 — 修复 M2 浏览器登录 CORS credentials 配置，仅允许 <http://localhost:5173> 携带 Cookie 的请求。

- 2026-09-03 / v0.2.0 — 完成 M2 Task 6 收口复核：通过 shared/db/server/web 自动化验证与真实 SQLite 进程重启验证，更新 M2 tasks/checklist；浏览器级页面联调因 Chromium 不可用仍未勾选。

- 2026-09-03 / v0.2.0 — 完成 M2 验证阻塞修复：补充跨客户端同 ID 与 SQLite 重启后访问记录持久化 API 测试，并更新验证清单。

- 2026-09-03 / v0.2.0 — 完成 M1 工程骨架：建立四包 workspace，打通 React → Hono → SQLite 的 Bookmark 创建、列表与重启持久化链路。

- 2026-09-03 / v0.1.1 — 优化根目录 README 的格式与易读性：新增本文导航与进度总览表，Scene/Folder/Tag 等组织维度与技术选型改为表格呈现，提炼「关键取舍」与阅读顺序建议，合并边界与基线小节。

- 2026-09-03 / v0.1.0 `bf51a54` — 重写根目录 README，补充当前工程状态、产品边界、双轨技术架构、运行方式与现行文档导航。

- **2026-09-03 · M1 骨架执行文档准备** `d8cc3c6`：修正开发计划现行文档引用，核实历史提交号，并新增 M1 专属执行计划与开发记录区。

文档与仓库的修改记录。**倒序（最新在上）**：新变更追加在最上方，读取前若干条即得近期状态。已提交条目标 `commit`；未进 git 标「未提交」。不用表格，用无序列表（免去每次增条改序号）。

- **2026-09-03 · AGENTS 项目简介同步技术收敛结果** `5a8dbf6`：AGENTS.md 项目简介回填技术待定项收敛结果——后端/部署标注双轨已定（轨 A Workers 默认、轨 B Docker 兜底，轨 B 默认 Bun + bun:sqlite，Node + better-sqlite3 回退）；数据行改真源 DB 双轨（轨 A D1 / 轨 B SQLite）＋ Dexie/IndexedDB 仅端侧镜像缓存；「现在做到哪」改为技术待定项已收敛（技术总纲 §11 T-1\~T-12，2026-09-03 定稿）

- **2026-09-03 · 技术待定项收敛（T-1\~T-12）** `8ad8145`：按 `docs/modules/20260903_技术待定项收敛清单.md` 建议口径收敛 wiki 技术总纲待定项——T-1 定 **Bun + bun:sqlite**（小基准已跑 2026-09-03，CRUD 量级与 better-sqlite3 打平，better-sqlite3 保留作 Node 回退）；T-2 同步 ✅（Dexie/IndexedDB 镜像缓存，SQLite WASM 不引入）；T-4 定「核心先记」方向；T-6\~T-11 定最小默认（软上限不主动删 / 单目标 / 仅类型预留 / KV 不启用 / 匿名不开 / CF 进阶能力不引入）；T-3 保持方向性（承接 Scene-AI 细部 §5.2）；§4.1 真源 DB 行与 wouter 行改 ✅；头部与 §12.1 参考表路径改为现行 wiki 文件名；§13 追加变更记录。同步修正 Scene-AI 细部旧路径引用

- **2026-09-03 · AGENTS 模板换新并迁移旧规范** `5fa38a0`：AGENTS.md 从旧版全仓规范换为通用模板；旧 `AGENTS-old.md` 内容经取舍迁移——项目简介填入实际信息（名称/一句话/版本/技术栈方向/原型位置/性能基线等），「额外补充」保留沿用约定（环节闭环/性能优先 600 条基线/源级噪音先验证再处理/不可逆操作先确认/技术待定标注）；与现章节重复及过时内容（旧目录结构、组件注册、备份三档、旧文档路径、GitHub 隐私设置操作、提交前缀格式）删除。旧文件移入 `docs/archive/AGENTS-old.md` 归档（仅追溯）

- **2026-09-02 · 文档治理：Draft 清空归档＋AGENTS 规范新增**（未提交）：`docs/Draft/` 中 10 份落地细化初稿（API / DATA\_MODEL / DESIGN / MVP验收清单 / Skill API合约 / 同步引擎细化 / 技术方案路线 / 网页收藏与内容归档子系统设计 / 落地拆解 / 部署方案）全部移入 `docs/归档/`（旧口径不再指导开发，仅追溯）；Draft 仅存索引 README（已同步更新）；AGENTS.md 新增两条规范——①「环节闭环」：环节完成即提交 git，待用户确认的疑问不算完整环节；②「阅读范围」：读取相关内容不考虑 `docs/归档/`，优先参考 `wiki/`，并查看 `docs/Draft/` 是否有正在讨论的文件

- **2026-09-02（未提交）· 更名：需求说明书 → 需求总纲**：现行 PRD v1.0.7 更名并改称《需求总纲》（文件 `wiki/DogEar_折耳书签_需求总纲_v1.0.7.md`），定位为项目最核心最根本的纲领性方向文件；头部「说明」补该定位。同步：AGENTS.md / 技术总纲 / Draft 索引 / MVP 清单 / module 细部引用；归档旧稿 3 份中指向现行 v1.0.7 的 7 处导航引用同步（正文追溯不动）；归档 v1.0.5 文件保留旧名，索引标注「保留旧称」。本 CHANGELOG 历史条目保留旧称（诚实历史）。

- **2026-09-02（未提交）· PRD v1.0.7 一致性整改**（核对报告 A/B/C 级，未提到项按建议执行）：

  - A1 §2.0.2：本版一律「建议先行」，系统只后台预备建议、不自动挂 Scene，写入须用户点击确认；§09 新增 #21（自动分流已决为不做）

  - A2 §2.3：抓取分级方向（任务重量＋触发源＋设备/网络条件三维判断）

  - B6：术语「愿景→愿景规划 笔误」统一为**远景**（远景＝时间描述保留）；§1.4 明确 URL 去重本版不做；附录 B.0 远景规划行补收 URL 去重 / 导航页匿名公开 / 手动选正文 / 高亮

  - B8 §7：新增「网络延迟补偿（设计导向）」「同步可观测」原则与 §7.3 性能可观测（方向性），不设硬性速度验收阈值

  - C1：§8.x.6 框架改 React 19（与原型栈一致）

  - C2：§8.x 节头补「过期提示」——冲突以技术总纲 v1.0\_DeepSeek 为准

  - C3：临时 ID 改「双 ID」——应用 ID（自维护，`tmp_` 前缀为未推送真源前临时值）＋ `raindropId`（Raindrop `_id`，同步时作匹配键）；术语表同步

- **2026-09-02（未提交）· 技术总纲 v1.0\_DeepSeek 整改**（A/B/C/D 级）：

  - A1 §6.3 补「取舍说明」取严格口径（建议先行）；A2 新增 §6.4.1 抓取能力分级与调度（L0 即时 Metadata / L1 机会 Snapshot 有 DOM / L2 延后无 DOM / L3 空闲批量）；A3 §4.2/§6.6/M4/§9.3 统一「客户端攒批与服务端定时默认 1 分钟可配＋未推送条数界面常驻可见」；A4 §10 M6 修正（导航页网页形态＋访问记录落库，Rediscover 卡片为近期，不进表）

  - B1 §7.1 补 `GET /bookmarks/search`（端侧 IndexedDB 为主、服务端兜底）；B2 §6.4/§7.1 补归档四操作与 `GET /archives/:id/content`、`PUT /archives/:id`；B3 §6.7/§7.1 补导出筛选维度与 `POST /backup` 参数；B4 §5.2.2 补 AERR 呈现方向（只写需求与方向，细节留单独模块）；B5 §5.3 补 page\_tab 轻量持久化口径（并入导航展示配置，不建重型实体）；B6 §2.1 远景规划行补 URL 去重等（只保留方向）；B7 §7.1 补 `GET/PUT /settings`、`PUT /skill/capabilities`、`GET /skill/usage`，§7.2 补 Skill 三级权限（查已有/写新的/改已有的含删，Skill API 侧，待数据库定稿细化）；B8 新增 §9.6 性能策略（分级按需加载补偿 Cloudflare 国内延迟＋性能可观测，不设硬阈值）

  - C4：§11 T-3/T-10 改 💡方向性（与 PRD 侧已决大方向对齐）；C5 §4.3 补 lucide-react / @tanstack/react-table / wouter / tailwindcss；C6 §2.2 映射表补内联编辑/工具面板/导出筛选三行

  - D2：§12.1 参考文档表收敛为两份现行文档（需求总纲＋本文档）；§13 变更记录追加「B/C/D 级整改」行；§12.3 §9 行补 §07 性能映射

- **2026-09-02（未提交）· module 细部 v0.2.1**：§2.2 置信度首条改写（A1 已决：后台只预备建议、不自动挂 Scene）；标题改「置信度与建议落地（A1 已决，余项待设计）」；术语「愿景→远景」统一

- **2026-09-02（未提交）· 文档治理（D1/D3）**：`docs/网页收藏与内容归档子系统设计.md` 移入 `docs/Draft/`（主体已被 PRD §2.2–§2.4、总纲 §5.2.3/§6.4 承接，转草稿）；`docs/Draft/README.md` 索引同步；本 CHANGELOG 弃分类表格改倒序有序列表（最新在上，减少读取 token）

- **2026-09-02 · 需求说明书 v1.0.7** `225188f`：无 Raindrop 也可完整使用；数据管理可选 Raindrop / S3 / WebDAV；Raindrop 改为输入源和/或导出存档；Scene 不进 Raindrop；分层改为核心 / 近期 / 远景（当时写作「愿景」，2026-09-02 已统一为「远景」）；§1.1 写入核心说明三段。需求定稿收口：核心过关＝工作台保存＋Agent 保存；工作台核心功能清单；Snapshot 核心非默认、保存可勾选；导航网页/插件同一表现；默认 Workers、其次 Docker，备份兜底；§8.x 标明非需求源

- **2026-09-02 · 需求说明书 v1.0.6** `225188f`：一致性修订；首次关联可选进 Inbox 或保持原路径；能连上应用即可存；Inbox 不强制；导航用规则圈选；访问记录纳入核心；v1.0.5 已归档

- **2026-09-02 · 需求说明书 v1.0.5** `225188f`：Scene 可多属、Capture 不强制选 Scene；AERR 仅系统内部；一套工作台；AI 先建议后写入

- **2026-09-02 · 需求说明书 v1.0.4**（未提交）：状态对外改为待处理 / 已确认 / 搁置；Capture 只存 Link；Reader / 高亮 / 手动选正文不作为当前入口；600 条是性能基线

- **2026-09-02 · 需求说明书 v1.0.3** `b894585`：定位改为 Capture + Organize + Rediscover；引入可扩展 Scene；Snapshot / Reader / 导航页重新定位

- **2026-09-02 · 需求说明书 v1.0.2** `9fe5e96` `0c8631a` `7011eed` `0a3631b` `eb0a0d6` `f660d04` `8d23a54` `f52f3e0`：核心流程与三态；术语（保存 / 收藏标星）；属性分层；Snapshot 主归档、Reader 后置；附录 C；存储口径降为方向性

- **2026-09-02 · 需求说明书 v1.0.1** `3c2d884`：需求说明书重写为 draft，旧版归档

- **2026-09-02 · 技术总纲 v1.0\_DeepSeek 初稿** `bfde716`：不参考旧稿，从产品+技术双视角按 PRD v1.0.7 重建技术总纲（需求分层/系统架构/选型/数据与流程/接口/异常/部署/里程碑/待决项）；索引与依赖关系改为以本文为现行总纲

- **2026-09-02 · 技术总纲 §5.7 增补** `6cfc41d`：新增字段与 Raindrop 映射总表，承接 PRD v1.0.7 附录 C（C.1–C.6 全量迁移）；PRD 附录 C 改为引用本小节，PRD 正文与 module/Scene 细部交叉引用同步更新

- **2026-09-02 · 技术总纲 §1.4 修订** `e26deb7`：非目标移除「本版不定义 URL 去重产品规则」——总纲面向整个项目规划，不写版本限定

- **2026-09-02 · 技术总纲（同步/归档平面修订）**（待提交）：§6.6 同步引擎拆两平面：本地↔真源由客户端 flush 驱动，Raindrop 通道独立（轮询走在线客户端或 Cron ≥1min，429 退避）；删除 Cron 30s（平台下限 1min）；§6.4/§5.2.3 明确 Track A 整页 Snapshot 走浏览器直传、服务端仅 Metadata，Docker 可选服务端整页抓取；§4.2/§11 补定时任务边界与 Queues/Workflows/DO 进阶可选层（T-11/T-12）；§13 同步

- **2026-09-02 · 技术总纲 v0.2-draft** `2a6dfa7`：按范例骨架新建；质量不满意，已删除，不再作为现行或追溯稿

- **2026-09-02 · 技术总纲 v0.1 / 技术方案 v0.1 归档** `225188f`：结构不满意，移入 `docs/归档/`，不再作为现行技术方案

- **2026-09-02 · 其它文档** `225188f` `c496e35`：`docs/module/20260904_Scene-AI与待设计细部.md`（Scene / AI / 导航圈选等细部，不取代 PRD）；`docs/归档/…v1.0.5_draft.md` 整份归档；`docs/Draft/README.md` 索引改指现行 PRD；`docs/技术总纲文档范例.md`（写作骨架）；wiki 补 Raindrop 官方 API 参考链接

- **2026-09-02 · 维护记录** `27e2889` `2083c2a`：修订记录补记（§5.7 增补行补迁移提交号 `6cfc41d`、§1.4 修订 `e26deb7`）；源级噪音事件（表格补宽/转义/插空行，回退 HEAD `e26deb7` 净化）；预防措施新增根目录 `.editorconfig`＋AGENTS.md §2「源级噪音先验证再处理」

- **2026-09-02 · 无语义表格对齐** `7ad6fde`：同日另有无语义的表格分隔行对齐提交，属源级噪音（见上）

- **2026-09-01 · 落地文档目录** `225a1b2` `753e554`：落地文档先移入 Pending，再改名为 `docs/Draft/`

- **2026-09-01 · 网页收藏与内容归档子系统** `d0c901c` `1c1061e`：新增 `docs/网页收藏与内容归档子系统设计.md` 并补流程图（2026-09-02 依 D1 移入 `docs/Draft/`）

- **2026-09-01 · AGENTS.md** `93162d4` `03626a6`：待定标注、提交匿名化

- **2026-09-01 · 工作台原型主题** `34d7e55` `cbf843a` `79f6d84`：六套主题色板与持久化

- **2026-09-01 · 仓库初始化** `6074e36`：清空历史重新开始

