# M3/M4 Verification Checklist

- [x] SQLite 初始化和迁移可幂等执行，并兼容现有 M1/M2 数据。
- [x] `bookmarks` 及 M3/M4 所需表、列、索引、默认值与 `docs/数据库结构表.md` v1.0 一致。
- [x] shared 契约覆盖完整 Bookmark 回执、分页、错误、Skill 和建议状态，并通过 schema 测试。
- [x] `GET /.well-known/capabilities` 无 Token 可访问，准确列出七个固定 Skill，不泄露用户数据或密钥。
- [x] 缺失、错误 Bearer Token 的 Skill 请求均返回 `401 UNAUTHORIZED`。
- [x] 有效 `save_bookmark` 请求同步写入真源，返回稳定 UUID、`source=agent`、`status=unread`，并产生 agent 操作日志。
- [x] `snapshot=true` 与 `trigger_archive` 只创建 pending Job，返回 `queued_pending_browser`，不产生快照文件。
- [x] 能力关闭返回 `403 CAPABILITY_DISABLED`，限速可触发 `429 RATE_LIMITED`，输入错误返回统一 `400 VALIDATION_ERROR`。
- [x] 工作台搜索、筛选、详情、单条修改、最多 100 条批量修改均符合 API 结构表。
- [x] Scene/Folder/Tag 可创建、修改、挂载、摘除；Scene 有成员时不能删除。
- [x] 建议在接受前不改变结构归属；接受后正确写入成员/文件夹并记录日志。
- [x] 软删、回收站查询、恢复和默认 7 天清理可用，活跃列表不显示回收站条目。
- [x] M2 既有认证、Inbox、未推送数量和访问记录路径保持兼容。
- [x] Agent 保存后，工作台通过真实 API 可立即看到同一 UUID 的 Inbox 记录。
- [x] shared、db、server 的测试、typecheck、lint 全部通过。
- [x] 未引入 Dexie、Raindrop、S3、WebDAV、快照内容、备份、导航页或 Skill 批量/删除接口。
- [x] `CHANGELOG.md` 已追加变更记录，代码与文档按规则分别提交，未提交密钥、本地数据库或构建缓存。
