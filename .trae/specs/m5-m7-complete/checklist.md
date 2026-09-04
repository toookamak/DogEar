# M5-M7 完整实现验证清单

## M5 通道与同步
- [ ] sync_queue 表、channel_config 表已创建
- [ ] Dexie 镜像缓存只做镜像，不升级为第二真源
- [ ] Raindrop Token 配置可保存（首尾 3 位显示，中间 `*` 隐藏）
- [ ] Raindrop 导入/导出各完成一次功能验证
- [ ] S3 通道配置可保存，导出/导入可用
- [ ] WebDAV 通道配置可保存，导出/导入可用
- [ ] sync_queue 持久化，应用重启不丢失
- [ ] 前端展示未推送条数，1 分钟攒批自动推送
- [ ] 429 退避策略生效
- [ ] 跳过通道配置仍能正常保存书签
- [ ] 冲突时本地优先
- [ ] 导入梳理页展示导入统计和冲突列表
- [ ] pnpm typecheck、pnpm test 通过

## M6 快照与备份
- [ ] archive 表、backup 表已创建
- [ ] Archive Job 状态机正确（pending → running → succeeded/failed/cancelled）
- [ ] SingleFile 有 DOM 时产出内联资源的单 HTML
- [ ] 文件签名直传存储
- [ ] 无 DOM 时任务入队等待
- [ ] metascraper 提取元数据异步执行，不阻塞主流程
- [ ] 三档备份（轻/中/重）各可独立配置频率和目标
- [ ] 备份保留上限可配置
- [ ] 单条 HTML/MD 下载可用
- [ ] 快照失败不回滚已保存的书签
- [ ] pnpm typecheck、pnpm test 通过

## M7 导航页
- [ ] nav_rule 表已创建
- [ ] 导航规则 CRUD API 可用
- [ ] 导航页路由 `/nav` 可访问
- [ ] 全部/按规则/自定义搜索集/隐藏四种圈选模式可用
- [ ] 登录后展示圈定条目，基于访问记录倒序排列
- [ ] 未登录跳转密码页
- [ ] 私密书签和 Inbox 默认不展示
- [ ] 支持分页加载
- [ ] pnpm typecheck、pnpm test 通过

## 收尾
- [ ] README.md 进度状态已更新
- [ ] CHANGELOG.md 已更新
- [ ] Dockerfile + docker-compose.yml 可用，`docker compose up` 一键启动
- [ ] 代码已分阶段提交 git