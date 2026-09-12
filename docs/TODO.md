# DogEar 待办清单

> 文档状态：生效  
> 最后更新：2026-09-12  
> 用途：未完成项与下一轮待办。已完成的主线不列在这里；文末「已完成」区只保留**值得记住、否则会被误改**的条目（如有意为之的设计不对称）。  
> 对照：`docs/TODO/20260904_后续补齐计划.md`、结构表 / API 结构表 v1.4。

用 `- [ ]` / `- [x]` 勾选。做完一项就勾上，并在本文件或 CHANGELOG 记一句。条目过时（尤其写成「待决策/勿改」但实际已完成）会误导后来者，发现即修。**搁置项必须写明原因与重启条件**，避免无记录的悬空。

## 下一轮（未完成）

### N1 前端对齐原型 · 收尾（先做）

- [x] **前端人工验收（2026-09-12，v0.7.29）**：浏览器逐页截图对照原型完成（登录/工作台四视图/详情浮层/设置六分区/组织管理/回收站/导航页/通道表单/建议面板空态/骨架屏），并修复对照中发现的导航页白屏回归（见「已完成」）。窄屏 390 已验：☰ 抽屉、详情浮层全屏、顶栏压缩均正常
- [ ] 看板拖拽的**触摸手感**需人工确认（程序化验证只能到「拖放生效」，手感主观）
- [x] **剩余内联样式下沉（2026-09-12，v0.7.29）**：54 → 1，唯余看板拖拽 ghost 的动态坐标（正当内联）；新增约 20 个工具修饰符类于 `styles/app.css` 末节
- [ ] 场景**合并**（PRD §2.0.1 允许「合并」；停用与删除已完成，合并尚无工作流，细部文档亦标为待设计）。**搁置**：工作流未定义，待 AERR 细部定稿时一并拍板
- [ ] 审计列为「可选补」的剩余项（按需）：Toast 内撤销（与状态栏撤销功能重复，**需先定口径**再决定是否做）。**搁置**：等产品拍板两者的分工口径
- [ ] **开发注意（两类假性故障）**：改完代码后若页面异常，先排除环境问题再怀疑代码——
  1. **Vite 转换缓存不一致**：磁盘文件正确、服务产物缺 import，导致整页白屏（本轮在 `WorkbenchPage` 上实际踩到）。用 `curl /src/<file>` 核对 served 模块是否新鲜，必要时重启 dev server。
  2. **长期运行的 headless 浏览器会假性卡死**：日志页一度持续显示「加载中…」20 秒不恢复，看着像 loading 写坏了；逐层排查（后端 1.6ms → 模块新鲜 → Vite 代理 3ms → 抓包发现请求发出但无响应）后确认是**复用了十几轮的 Edge 实例把连接池搞坏**，换全新实例即 11/11 通过。跑浏览器验证前重启浏览器实例。

### N2 AERR 细部定稿（本轮留的尾巴）——**整组搁置：均需用户对「AERR 细部」拍板后才能动**

- [ ] `docs/modules/20260904_Scene-AI与待设计细部.md` 中 AERR 仍标「待设计」：`aerr_archetype` 存储名、是否允许改挂原型、改挂后已有书签是否立即变化。本轮按原型口径先落地映射表，**定稿后只需改 `apps/web/src/utils/scene-presentation.ts` 一张表**
- [ ] 用户自建 Scene 时选择/继承原型（当前新建走服务端默认 `reference`，界面无入口）
- [ ] 组织管理页是否暴露 AERR 设置（PRD 说不展示给用户，需确认「可改」通过什么方式体现）

### L2 通道队列（2026-09-12 落地，v0.7.30）

- [x] `sync_queue` 按 channel 真正消费：入队点接线（create/单条 update/单条 delete/批量/Skill 保存——已启用 Raindrop 通道才入队并标 `syncStatus=pending`）；消费器按 channel 分发，非 Raindrop 书签级条目标 failed（禁止无 handler 假装成功）。**只推 Raindrop 的决定**见同步设计 §3.1：S3/WebDAV 是文件级导出，保持手动触发
- [x] 429 指数退避（1s / 2s / 4s 封顶），记下 `retry_count`；超 8 次不再自动重试（防毒条目）
- [x] 新增 `conflicts` 表（2026-09-12，v0.7.30，迁移 0005，数据库结构表 v1.3）：两端都留（两端快照）、本地赢（自动）、可单条/全部按 kept_local/kept_remote/merged 解决；UI 在设置 → 输入源/导出「同步冲突」面板
- [x] 双向拉回侧（2026-09-12，v0.7.30）：`POST /api/sync/pull` 单页拉回（50 条/次，防风控）、新增书签 `source=raindrop` 进 Inbox、通道「导入」保留为显式全量
- [x] 客户端 1 分钟攒批 + 页面隐藏/卸载 flush（`apps/web/src/sync-scheduler.ts`，另带 60s 兜底轮询清积压）；状态栏未推送数已接真实队列
- [x] **D1 事务语义**：消费器按序单条处理，不依赖跨语句事务（D1 无 SQL 级事务的问题就此绕开）；若未来要求「多通道组原子推送」再讨论 D1 batch
- [x] 调度：Workers Cron（`[triggers]` 每 5 分钟，`worker.ts` scheduled）+ 自托管定时器（60 秒，防重入）+ `POST /api/sync/process` 升级为真实消费（API 结构表 v1.5）

### L3 快照文件（2026-09-12 部分落地，v0.7.30；用户批准引入依赖，登记见 `docs/modules/20260912_外部依赖登记.md`）

- [ ] 工作台有 DOM 时用 SingleFile 产出单 HTML（单独成包，AGPL 不进 Hono）。**已批准、待引入**：single-file-core 的浏览器侧消费者（领 `queued_pending_browser` Job → 目标页压缩 → 上传）需要真实浏览器环境开发联调，作为独立批次；服务端 monolith 路径已先行
- [x] Track B 无 DOM 时用 monolith 抓公开页：`apps/server/src/archive/snapshot-monolith.ts`（注入式执行器，Dockerfile 已装 monolith；`POST /api/archive/process` 消费 pending 快照 Job，`file_path` 有值才标 completed，失败不回滚书签，二进制缺失给可执行提示）。Skill `snapshot=true` 仍只入队 ✓（口径不变）
- [x] 快照有 `file_path` 才能下载；没有文件不得声称已生成（执行器只在拿到文件后写 `archives.completed`；此前下载路由已有 409/404 防线）
- [x] 元数据提取改 metascraper（Track B 注入式增强，`archive/metadata-enhancer.ts`；失败自动回退内置轻量提取，不影响 Link 保存；Workers 不引入、行为不变）

### L4 导航圈选（2026-09-12 落地，v0.7.30；用户批准 API 结构表升 v1.6）

- [x] 规则求值：全部 / 规则-或 / 搜索集 / 隐藏（`apps/server/src/nav/evaluator.ts`；`GET /api/nav/feed`，逐步圈定语义与回落行为见同步设计 §3.1 同款口径——无规则回落旧投影；私密与 Inbox 恒不展示）
- [x] 工作台侧规则编辑 UI（组织管理页新增「导航规则」tab：新建/编辑/删除/停用，条件为场景·文件夹·标签多选 + 状态；列表行带中文摘要与顺序号）
- [x] 改规则后刷新导航，结果与配置一致（保存后 `notifyOrgChanged` 驱动导航页重载求值；e2e 已验证 all+hide 组合与非法输入 400）
- [x] 导航顶栏轻量搜索（客户端过滤已加载条目——标题/域名/链接，不建完整 ⌘K）
- 附带修复：`PATCH /api/nav/rules/:id` 传对象 `rule` 会落库报错（此前无归一），并补齐字段级校验

### L5 缓存与备份（本轮不做，仅登记）

- [ ] Dexie 启动 hydrate，首屏可读缓存；保存成功仍以真源为准
- [ ] 备份恢复的**每目标独立频率**与 **ZIP 导入**（「从备份恢复」已于 2026-09-11 完成，见「已完成」与已知小缺口）
- [ ] Raindrop 默认双向自动同步（开发计划明确不做，除非重新拍板）

## 已知小缺口

- [x] **ZIP 导入 / 导出（2026-09-12，v0.7.30，用户批准 fflate + 25MB）**：`GET /api/backup/export-zip` 与 `POST /api/backup/import`（Track B，与文件备份同注入；Workers 501）。导入为全量替换 + 自动回滚点（复用恢复的保护链）；ZIP 内 snapshots/ 暂跳过（待 L3）。**依赖登记**：`fflate@^0.8.3`（MIT，纯 JS 零依赖，仅 apps/server 使用——若效果不佳可整体摘除：删依赖 + backup-routes/service 的 export-zip/import 路径即可，无其他耦合）
- [ ] **`full` 档在线恢复**：当前明确返回 501（服务运行中替换被持有的库文件不安全）。若要支持，需先解决「关闭并重建数据库连接」的架构问题——属技术选型，**须先讨论**。**搁置：架构问题待讨论**
- [x] **Track A 真实部署已跑通（2026-09-12）**：推 main 后 Workers Builds 自动构建部署成功，线上工作台为新版视觉（用户确认「配色好了」）——零 Token 默认路径（面板 root directory=`apps/server`、Deploy command=`node scripts/ci-deploy.mjs`）全链路实证可用，本条闭环
- [ ] **CI 是否跑通未经确认**：部署已成功即间接证明 workflow 可用；如需核对每次运行的日志与耗时，到仓库 Actions 页查看。**待用户可选确认**
- [ ] **线上 Skill Token 未配置**：线上要启用 Chrome 扩展 / Agent 保存，须 `wrangler secret put DOGEAR_SKILL_TOKEN`（或配 GitHub Secret `DOGEAR_SKILL_TOKEN` 由 Actions 同步）。**待用户操作**
- [ ] Cron Trigger 未配置（Workers 上同步队列无调度；自托管侧队列消费仍顺延）。**依赖 L2 队列真消费，先做 L2**
- [ ] R2 未接入（快照内容存储）。**依赖 L3，先做 L3**
- [x] **`docs/Draft/README.md` 失效索引已收口（2026-09-12）**：整体移入 `docs/archive/Draft-README-失效索引.md` 并在文首加废弃说明；`docs/Draft/` 仅剩 `sync-card-showcase.html` 演示素材
- [x] **浏览器插件（Chrome）已落地（2026-09-12，v0.7.28 / `91b5999`）**：`apps/extension` MV3 扩展（填地址 + Skill Token 即可连通），`save_bookmark` 扩展可选 `source: 'extension'`（API 结构表 v1.4）；接入说明见 `docs/modules/20260912_浏览器扩展与Agent接入.md`。**未验证**：Chrome 真机加载后的端到端点击（本环境无扩展加载自动化），按 `apps/extension/README.md` 手动加载即可
- [ ] 本地 `apps/server/backups/` 不入库（已加入 gitignore）

## 已完成（备忘，勿再开）

- [x] 结构表 v1.2
- [x] 通道配置 / 测试连通 / 一次上下传 / 备份下载
- [x] 导航投影、访问记录、登录门
- [x] 工作台四维、筛选、批量、⌘K 标签、操作日志
- [x] 首次向导、底部撤销、状态栏未推送数
- [x] 设置页用量接口 401
- [x] 登录代理打到 DogEar 并刷新会话
- [x] **M1 前端对齐原型（2026-09-10）**：外壳/四视图/排序/详情浮层/Toast/骨架屏/设置六分区/组织管理/通道表单/命令面板键盘导航/404；内联样式 307→56
- [x] **M2 数据下载 + 编辑功能（2026-09-10）**：单条导出 HTML/Markdown、备份三档下载（重档为真实 SQLite）、书签与组织维度增删改、批量、撤销
- [x] **M3 Cloudflare 一键部署能力（2026-09-10）**：Workers 入口 + wrangler + Actions；本地全链路验证通过（真实部署见上方缺口）
- [x] **Scene AERR 呈现（2026-09-10）**：默认排序 / 密度 / 主操作（映射细部待定稿）
- [x] **Scene 停用（2026-09-10）**：挑选器隐藏、已挂保留、筛选面弱化；删除撞 `SCENE_IN_USE` 给出可执行提示
- [x] **AI 建议四个落点（2026-09-10）**：输入时 / 整理时 / Inbox 内 / 未整理详情，均由 `pendingSuggestionCount` 真实数据驱动
- [x] **查询串读取缺陷（2026-09-10）**：wouter `useLocation()` 不含查询串导致 OAuth 回调从未可用、导入结果页从不显示数据
- [x] **CI 缺凭据时优雅跳过（2026-09-10）**：`preflight` 任务把凭据存在性转成 `outputs.ready` 门控部署，避免缺 Secrets 报红
- [x] **写接口未知字段收紧（2026-09-11，v0.7.21 / `d991683`）**：此前 12 个写接口中 10 个会静默吞掉不认识的字段并照常返回成功，字段名打错（如 `aerr`→`aer`）会「看起来保存成功、实际该字段被丢弃」。按「工作台收紧 + Skill 宽松」实施。**这是一处有意的不对称，改前务必知情**：
  - 工作台侧加 `.strict()`（字段名打错即 400）；Skill API **故意保持宽松**——它是对外接口，第三方 agent 可能回传含多余字段的完整对象，收紧会让 agent 保存书签直接失败，破坏外部契约比漏检字段名严重
  - 故 strict 加在**使用点**而非 base：`createBookmarkInputSchema` 被两侧共用（`workbenchCreateBookmarkInputSchema` 与 `saveBookmarkSkillInputSchema` 都指向它），写成 `createBookmarkInputSchema.strict()` 即可，**不要改 base**
  - 同时补上了 scenes/folders/tags 的入参 schema（此前完全没有，直接把 `{...body}` 展开进 `create()`）
  - 该取舍由 `packages/shared/src/contracts.test.ts` 的一组测试锁住，若有人改 base 会失败；详细理由见 CHANGELOG v0.7.21
- [x] **操作日志筛选/搜索/分页（2026-09-11，v0.7.22 / `8255612`）**：对齐原型 `LogSection`。类型筛选走服务端 `?action=`，搜索与分页在端侧（不为此新增接口）
- [x] **备份恢复（2026-09-11，v0.7.23 / `ef20ae2`）**：`POST /api/backup/:id/restore`，语义按备份设计稿 §2.8（**全量替换** + 强制回滚点 + 显式 `confirm`）；`full` 档明确 501。**API 结构表因此升 v1.3**（原三处写着「备份恢复本版不做」）
- [x] **表格行/看板卡键盘可达（2026-09-11，v0.7.17 / `83d7f7a`）**：补 `tabIndex`/`aria-label`/Enter·Space 打开详情与 `:focus-visible` 轮廓（网格与图标视图早已支持，此前仅此两处缺失）
- [x] **工作台视觉对齐原型（2026-09-12，v0.7.27 / `a71c1c9`）**：视觉源改为原型默认浅色主题（口径变更见 `docs/modules/20260912_工作台视觉对齐原型.md`）；`DESIGN.md` 未改，其与原型的冲突待用户确认是否修订
- [x] **导航页白屏回归修复（2026-09-12，v0.7.29）**：BookmarkCard 重构三段式后，导航页传入的投影子集（NavItem）缺 `tags` 等字段导致 `bookmark.tags.length` 抛错整页白屏。修复：缺字段防御性访问；且 source/status/tags 缺省（投影未返回）时**不渲染**来源/状态/「未整理」——避免展示缺省假信息
- [x] **Chrome 扩展与 Agent 接入（2026-09-12，v0.7.28 / `91b5999`）**：见「已知小缺口」与 `docs/modules/20260912_浏览器扩展与Agent接入.md`；同批修复 `/.well-known/capabilities` 被 SPA 回退吞掉（`run_worker_first` 补 `/.well-known/*`）
