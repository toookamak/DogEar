# DogEar 待办清单

> 文档状态：生效  
> 最后更新：2026-09-10  
> 用途：未完成项与下一轮待办。已完成的主线不列在这里。  
> 对照：`docs/TODO/20260904_后续补齐计划.md`、结构表 / API 结构表 v1.2。

用 `- [ ]` / `- [x]` 勾选。做完一项就勾上，并在本文件或 CHANGELOG 记一句。

## 下一轮（未完成）

### N1 前端对齐原型 · 收尾（先做）

- [ ] **前端人工验收**：本轮改了大量界面（外壳/四视图/详情浮层/Toast/骨架屏/设置六分区/组织管理/通道表单/建议四落点/Scene 停用与 AERR），全部只经过程序化核验（DOM/计算样式/数据库断言），**画面观感未经人工确认**。需逐页对照原型 `dev/dogear-workbench` 提出具体问题
- [ ] 工作台窄屏细节：详情浮层在窄屏的表现、看板拖拽的触摸手感需人工确认
- [ ] 剩余内联样式（约 50 处）继续下沉到 `styles/app.css`
- [ ] 场景**合并**（PRD §2.0.1 允许「合并」；停用与删除已完成，合并尚无工作流，细部文档亦标为待设计）

### N2 AERR 细部定稿（本轮留的尾巴）

- [ ] `docs/modules/20260904_Scene-AI与待设计细部.md` 中 AERR 仍标「待设计」：`aerr_archetype` 存储名、是否允许改挂原型、改挂后已有书签是否立即变化。本轮按原型口径先落地映射表，**定稿后只需改 `apps/web/src/utils/scene-presentation.ts` 一张表**
- [ ] 用户自建 Scene 时选择/继承原型（当前新建走服务端默认 `reference`，界面无入口）
- [ ] 组织管理页是否暴露 AERR 设置（PRD 说不展示给用户，需确认「可改」通过什么方式体现）

### L2 通道队列

- [ ] `sync_queue` 按 channel 真正消费（Raindrop / S3 / WebDAV），禁止无 handler 标 `succeeded`
- [ ] 429 指数退避（1s / 2s / 4s 封顶），记下 `retry_count`
- [ ] 新增 `conflict` 表：两端都留、本地赢、可单条/全部合并
- [ ] 客户端 1 分钟攒批 + 页面隐藏/卸载 flush；状态栏未推送数接到真实队列
- [ ] **D1 事务语义**：轨 A（Workers + D1）不支持 SQL 级事务，多步写入按序执行、整组不保证原子回滚（已按运行时关闭驱动事务，见 `docs/modules/20260910_Cloudflare部署.md` §5）。若要求强一致，需改用 D1 batch 或换存储——属技术选型，**须先讨论再动**

### L3 快照文件

- [ ] 工作台有 DOM 时用 SingleFile 产出单 HTML（单独成包，AGPL 不进 Hono）
- [ ] Track B 无 DOM 时用 monolith 抓公开页；Skill `snapshot=true` 仍只入队
- [ ] 快照有 `file_path` 才能下载；没有文件不得声称已生成
- [ ] 元数据提取改 metascraper（失败不影响 Link）

### L4 导航圈选

- [ ] 规则求值：全部 / 规则-或 / 搜索集 / 隐藏
- [ ] 工作台侧规则编辑 UI
- [ ] 改规则后刷新导航，结果与配置一致
- [ ] 导航顶栏轻量搜索（不是完整 ⌘K）

### L5 缓存与备份（本轮不做，仅登记）

- [ ] Dexie 启动 hydrate，首屏可读缓存；保存成功仍以真源为准
- [ ] 备份恢复、每目标独立频率、ZIP 导入
- [ ] Raindrop 默认双向自动同步（开发计划明确不做，除非重新拍板）

## 已知小缺口

- [ ] **Track A 真实部署未跑**：Workers 入口、`wrangler.toml`、Actions 均就绪且本地（wrangler 4.42 + 模拟 D1）全链路验证通过，但**从未在真实 Cloudflare 上部署过**。需：`wrangler d1 create dogear_prod` → 回填 `database_id` → `db:migrate:remote` → `secret put DOGEAR_PASSWORD` → 推 main（详见 `docs/modules/20260910_Cloudflare部署.md`）
- [ ] Cron Trigger 未配置（Workers 上同步队列无调度；自托管侧队列消费仍顺延）
- [ ] R2 未接入（快照内容存储）
- [ ] **`docs/Draft/README.md` 是失效索引**：其 5 处核心引用全部指向不存在的路径（重命名前的旧文件），且现行 `AGENTS.md` 目录规范中已无 `docs/Draft/`。照它办事会走错方向，建议单独收口
- [ ] 浏览器插件（近期，不进本期 Mx）
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
