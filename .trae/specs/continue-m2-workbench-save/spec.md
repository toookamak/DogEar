# M2 工作台能存 Spec

## Why
M1 已经打通了未认证的本地真实保存链路，但还不能作为可用的个人工作台：任何人都可以访问接口，页面没有 Inbox 语义，也没有访问记录和未推送状态。M2 需要在不引入第三方同步和端侧第二真源的前提下，完成工作台保存 Link 的第一个过关版本。

## What Changes
- 增加单用户密码登录、登录态保持和退出登录。
- 保护 Bookmark 与访问记录 API；未登录请求返回统一的未授权错误。
- 扩展 Bookmark 数据以支持 Inbox 展示和未推送数量统计。
- 增加访问记录持久化：打开书签时写入一次访问记录。
- 工作台增加登录页、保存表单、Inbox 列表、加载/空状态/失败状态和未推送数量状态栏。
- 保留服务端生成 UUID 的规则，刷新和跨客户端读取同一正式记录。
- 不接入 Raindrop、S3、WebDAV、Dexie/IndexedDB、Skill API、多用户账号或生产部署。

## Impact
- Affected specs: 工作台保存、认证、访问记录、同步状态展示。
- Affected code: `apps/web`、`apps/server`、`packages/shared`、`packages/db`；新增 M2 专项测试。
- Breaking changes: M1 的公开 Bookmark API 改为需要登录；健康检查保持公开。

## ADDED Requirements
### Requirement: Single-user password authentication
系统 SHALL 使用服务端配置的单用户密码验证登录，不在客户端暴露密码或服务端密钥。

#### Scenario: Login succeeds
- **WHEN** 用户向登录接口提交正确密码
- **THEN** 服务端设置仅 HttpOnly、SameSite=Lax 的会话 Cookie，并返回成功响应

#### Scenario: Login fails
- **WHEN** 用户提交错误或缺失密码
- **THEN** 服务端返回 401 和稳定的错误结构，不设置有效会话 Cookie

#### Scenario: Session survives refresh and restart
- **WHEN** 用户刷新页面，或服务端重启后携带仍在有效期内的会话 Cookie 请求
- **THEN** 服务端能够验证会话并允许访问受保护 API

#### Scenario: Logout
- **WHEN** 已登录用户退出
- **THEN** 服务端清除会话 Cookie，后续受保护请求返回 401

### Requirement: Protected bookmark operations
系统 SHALL 只允许已认证请求读取和创建 Bookmark，健康检查除外。

#### Scenario: Authenticated bookmark access
- **WHEN** 已登录客户端调用 Bookmark 列表或创建接口
- **THEN** 服务端正常返回列表或创建结果，创建记录使用服务端生成的 UUID

#### Scenario: Unauthenticated bookmark access
- **WHEN** 未登录客户端调用 Bookmark 列表或创建接口
- **THEN** 服务端返回 401，且不写入数据

### Requirement: Inbox and sync status
系统 SHALL 提供按 `unread` 状态展示的 Inbox，并显示当前尚未推送到外部通道的 Bookmark 数量。

#### Scenario: Inbox list
- **WHEN** 已登录用户打开工作台
- **THEN** 页面从真实 API 加载 `unread` Bookmark，按创建时间倒序展示 URL、状态和稳定 ID

#### Scenario: Empty inbox
- **WHEN** 当前没有 `unread` Bookmark
- **THEN** 页面显示空状态，不使用 mock 或 fixture 填充列表

#### Scenario: Pending sync count
- **WHEN** 已登录用户加载工作台
- **THEN** 页面显示服务端返回的未推送数量；M2 不执行外部同步，M1 新创建且未被通道确认的记录计入该数量

### Requirement: Access records
系统 SHALL 在用户从工作台打开 Bookmark 时写入访问记录，并允许工作台读取当前 Bookmark 的最近访问信息。

#### Scenario: Open bookmark records access
- **WHEN** 已登录用户点击 Inbox 中的 Bookmark
- **THEN** 页面先调用访问记录接口，再打开目标 URL；访问记录包含 Bookmark ID 和服务端生成的访问时间

#### Scenario: Access record failure
- **WHEN** 访问记录写入失败
- **THEN** 页面不伪造成功提示，仍可打开目标 URL，并显示非阻塞失败反馈

### Requirement: Failure and cross-client behavior
系统 SHALL 明确区分未登录、网络失败和输入校验失败，并保证服务端真源是工作台唯一成功依据。

#### Scenario: Refresh and second client
- **WHEN** 用户在一个客户端登录并保存 URL，再在刷新后的页面或另一个已登录客户端打开 Inbox
- **THEN** 两个客户端都能读取同一条记录，记录 ID 不变化

#### Scenario: Server unavailable
- **WHEN** 工作台无法连接服务端
- **THEN** 页面显示保存/加载失败状态，不显示已保存成功

## MODIFIED Requirements
### Requirement: Bookmark creation API
创建接口继续接收 URL 并由服务端生成 UUID，但从 M2 起必须经过认证，并返回包含 `id`、`url`、`status`、`createdAt`、`updatedAt` 与同步状态的正式记录。

### Requirement: Bookmark persistence
Bookmark 数据层需要支持 Inbox 查询、未推送数量查询和访问记录关联；SQLite 与 D1 两条适配方向使用同一共享契约。

## REMOVED Requirements
无。
