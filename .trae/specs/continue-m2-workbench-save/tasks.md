# Tasks

- [x] Task 1: 固化 M2 共享契约与测试
  - [ ] 为登录请求、会话用户、未授权错误、访问记录和 Bookmark 同步状态定义共享 schema 与类型。
  - [ ] 为 Bookmark 列表、未推送数量和访问记录响应编写失败测试，先确认测试因实现缺失而失败。

- [x] Task 2: 扩展 SQLite/D1 数据层
  - [x] 为 bookmarks 增加同步状态字段，默认标记为未推送，并保留现有 M1 数据可迁移。
  - [x] 增加 access_records 表及创建、按 Bookmark 查询访问记录的 repository 方法。
  - [x] 增加 Inbox 查询和未推送数量查询，并补充迁移与数据层测试。

- [x] Task 3: 实现单用户会话认证
  - [x] 增加服务端密码配置读取、密码校验、HttpOnly 会话 Cookie、会话验证和退出登录。
  - [x] 增加登录、当前会话和退出 API；健康检查保持公开，Bookmark 与访问记录 API 统一保护。
  - [x] 为正确密码、错误密码、无 Cookie、过期/无效 Cookie 和退出后的请求编写 API 测试。

- [x] Task 4: 接入受保护的 Bookmark 与访问记录 API
  - [x] 让创建和列表 API 使用认证上下文，并返回正式 Bookmark 与同步状态。
  - [x] 增加 Inbox 专用列表和未推送数量接口。
  - [x] 增加访问记录创建与查询接口，服务端生成访问时间。
  - [x] 验证未登录请求不写入 Bookmark 或访问记录。

- [x] Fix: 服务启动时幂等初始化完整 M2 SQLite schema，并兼容 M1 数据库（含 sync_status 与 access_records）

- [x] Fix: 增加跨客户端同 ID 与重启后访问记录持久化 API 验证

- [ ] Task 5: 实现 M2 工作台页面
  - [ ] 增加登录页与登录态初始化、退出操作。
  - [ ] 增加保存表单、Inbox 列表、空状态、加载状态、错误状态和未推送数量状态栏。
  - [ ] 打开 Bookmark 时先写访问记录，再导航到目标 URL；记录失败时保留导航并显示非阻塞反馈。
  - [ ] 保证页面所有数据来自真实 API，不引入 mock、fixture 或 Dexie。

- [ ] Task 6: 完成 M2 验收与收口
  - [ ] 增加端到端或 API+页面联调验证：登录、保存、刷新、第二客户端读取、退出、失败提示和访问记录。
  - [ ] 运行 shared/server/db/web 的 test、typecheck、lint 和 web build。
  - [ ] 检查未引入 Raindrop、S3、WebDAV、Dexie、Skill API 或多用户账号。
  - [ ] 更新 M2 checklist 和开发记录，按仓库规则分别提交代码与文档。

# Task Dependencies
- Task 2 depends on Task 1.
- Task 3 depends on Task 1.
- Task 4 depends on Tasks 2 and 3.
- Task 5 depends on Task 4.
- Task 6 depends on Tasks 1–5.
- Tasks 2 and 3 can be developed in parallel after Task 1.
