# M2 Verification Checklist

- [x] 登录接口接受正确密码并设置 HttpOnly、SameSite=Lax 会话 Cookie。agent-browser 已直接验证 localhost:5173 登录成功。

- [x] 错误密码、缺失密码、无效会话和退出后的受保护请求均返回 401 稳定错误结构。

- [x] 健康检查保持公开，Bookmark 与访问记录接口均需要认证。

- [x] 已认证用户能够创建 Bookmark，服务端生成 UUID，刷新和第二客户端读取时 ID 保持不变（server API 测试已证明）。agent-browser 另直接验证保存 `https://example.com/browser-m2` 后列表出现链接、独立 m2b 会话读取同一列表、刷新页面后仍保持工作台。

- [ ] Inbox 只展示真实 API 返回的 `unread` Bookmark，并正确处理加载、空列表和网络失败。agent-browser 已直接验证服务端现有 Inbox 数据可读，保存 `https://example.com/browser-m2` 后页面显示“已保存到 Inbox”且列表出现链接；加载、空列表和网络失败的独立页面行为尚未验证，因此该项仍未完成。

- [ ] 未推送数量由服务端返回并在工作台展示，M2 不调用外部同步通道。

- [ ] 打开 Bookmark 时先写入访问记录再导航；访问记录失败不会阻断导航且会显示非阻塞反馈。agent-browser 真实验证：阻断 `/api/bookmarks/*/access-records` 后点击 Inbox 链接，页面仍导航到 `https://example.com/browser-m2`，证明访问记录失败不阻断导航；没有可靠证据证明非阻塞提示在导航前可见，因此不勾选完整验收项。

- [x] 服务端重启后登录会话策略和 SQLite 中的 Bookmark、访问记录行为符合 Spec（使用隔离验证数据库和真实 Bun 进程重启验证：重启后健康检查、重新登录及同一 Bookmark 的访问记录均可读；会话 Cookie 本身按登录态重新建立，未宣称跨重启 Cookie 有效）。

- [x] shared、db、server、web 的测试、typecheck、lint 和 web build 全部通过（shared 5 tests、db 5 tests、server 13 tests；web 无测试文件但 `--passWithNoTests` 通过；四包 typecheck/lint 通过；web build 通过）。

- [x] 代码中未引入 Dexie/IndexedDB、Raindrop、S3、WebDAV、Skill API 或多用户账号体系。

- [ ] 变更已写入 CHANGELOG，代码与文档按仓库规则分开提交，工作区干净（CHANGELOG 已有 M2 收口记录；按用户要求未提交 git；工作区仍有未跟踪 `apps/server/data/dogear.sqlite`，因此不满足提交与工作区干净条件）。

