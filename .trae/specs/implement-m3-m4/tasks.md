# Tasks

- [x] Task 1: 补全数据库结构与迁移
  - [x] 按 `docs/数据库结构表.md` 扩展 `bookmarks`，新增 Scene、Folder、Tag、关系、suggestions、operation_log、settings、archive_jobs，并补齐索引与默认 Scene。
  - [x] 扩展 `access_records` 的 client 字段，保证 SQLite 初始化对 M1/M2 数据幂等兼容。
  - [x] 编写迁移/初始化测试，覆盖已有数据库升级、重复初始化和关键外键关系。

- [x] Task 2: 扩展共享契约
  - [x] 在 `packages/shared` 定义完整 Bookmark 回执、分页、统一错误、Skill 输入输出、能力发现和建议契约。
  - [x] 为稳定 UUID、快照状态、能力关闭和结构建议先行编写 schema 测试。

- [x] Task 3: 扩展数据库仓库能力
  - [x] 为书签详情、搜索筛选、单条更新、批量更新、软删/恢复/清空提供仓库方法。
  - [x] 为 Scene/Folder/Tag、关系、建议、操作日志、设置和 Job 提供最小事务安全读写方法。
  - [x] 确保默认列表排除 `deleted_at` 非空条目，硬删时按结构表清理关联数据。

- [x] Task 4: 实现 M3 Skill 基础设施
  - [x] 增加 capabilities 端点、Bearer 鉴权、统一错误响应、能力开关读取和读/写/批量限速。
  - [x] 实现 `save_bookmark` 同步落真源、正式 UUID、agent 审计和 `snapshotStatus` 语义。
  - [x] 实现其余六个 Skill 的最小可用行为；未支持行为返回明确错误，不静默空成功。
  - [x] 增加 Skill API 测试：有效/无效 Token、七项能力、429、UUID 稳定性、snapshot 入队和建议不改结构。

- [x] Task 5: 实现 M4 工作台 REST
  - [x] 扩展书签列表、详情、搜索、PATCH、批量 PATCH、软删和回收站接口，保持 M2 路径兼容。
  - [x] 实现 Scene/Folder/Tag CRUD、建议查询与接受/暂缓/忽略、操作日志、设置和 Job 占位接口。
  - [x] 增加 API 测试：过滤、批量上限、回收站恢复/清空、Scene 删除保护、建议事务和日志记录。

- [ ] Task 6: 验证 M3/M4 后端闭环并收口
  - [ ] 运行 shared、db、server 的 test、typecheck、lint，修复全部失败。
  - [ ] 联调有效 Token 保存 Bookmark，确认返回正式 UUID 且工作台 Inbox 可见；验证无 Token 被拒。
  - [ ] 检查本变更未引入 Dexie、通道、快照文件、备份、导航页、Skill 批量/删除。
  - [ ] 按仓库规则更新根目录 `CHANGELOG.md`；代码与文档分别提交 git。

# Task Dependencies
- Task 2 depends on Task 1.
- Task 3 depends on Task 1 and Task 2.
- Task 4 depends on Tasks 2 and 3.
- Task 5 depends on Tasks 2 and 3; Task 4 may run in parallel after shared/database contracts are ready.
- Task 6 depends on Tasks 1–5.
