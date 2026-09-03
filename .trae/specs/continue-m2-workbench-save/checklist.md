# M2 Verification Checklist

- [ ] 登录接口接受正确密码并设置 HttpOnly、SameSite=Lax 会话 Cookie。
- [ ] 错误密码、缺失密码、无效会话和退出后的受保护请求均返回 401 稳定错误结构。
- [ ] 健康检查保持公开，Bookmark 与访问记录接口均需要认证。
- [ ] 已认证用户能够创建 Bookmark，服务端生成 UUID，刷新和第二客户端读取时 ID 保持不变。
- [ ] Inbox 只展示真实 API 返回的 `unread` Bookmark，并正确处理加载、空列表和网络失败。
- [ ] 未推送数量由服务端返回并在工作台展示，M2 不调用外部同步通道。
- [ ] 打开 Bookmark 时先写入访问记录再导航；访问记录失败不会阻断导航且会显示非阻塞反馈。
- [ ] 服务端重启后登录会话策略和 SQLite 中的 Bookmark、访问记录行为符合 Spec。
- [ ] shared、db、server、web 的测试、typecheck、lint 和 web build 全部通过。
- [ ] 代码中未引入 Dexie/IndexedDB、Raindrop、S3、WebDAV、Skill API 或多用户账号体系。
- [ ] 变更已写入 CHANGELOG，代码与文档按仓库规则分开提交，工作区干净。
