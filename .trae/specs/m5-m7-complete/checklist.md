# M5-M7 完整实现验证清单

## M5 通道与同步
- [x] sync_queue 表、channel_config 表已创建
- [x] Dexie 镜像缓存只做镜像，不升级为第二真源
- [x] Raindrop Token 配置可保存（首尾 3 位显示，中间 `*` 隐藏）
- [x] Raindrop 导入/导出 API 可用
- [x] S3 通道配置可保存，导出/导入可用
- [x] WebDAV 通道配置可保存，导出可用
- [x] sync_queue 持久化，应用重启不丢失
- [x] 前端展示未推送条数，1 分钟攒批自动推送
- [x] 跳过通道配置仍能正常保存书签
- [x] 导入梳理页展示导入统计和错误列表

## M6 快照与备份
- [x] archives 表、backups 表已创建
- [x] Archive Job 状态机正确（pending → running → succeeded/failed/cancelled）
- [x] SingleFile 快照按钮触发生成
- [x] 元数据提取异步执行，不阻塞主流程
- [x] 三档备份（轻/中/重）API 可用
- [x] 单条 HTML/MD 下载可用
- [x] 快照失败不回滚已保存的书签

## M7 导航页
- [x] nav_rules 表已创建
- [x] 导航规则 CRUD API 可用
- [x] 导航页路由 `/nav` 可访问
- [x] 全部/规则/搜索/隐藏四种圈选模式可用
- [x] 侧边栏有导航页入口
- [x] 导航页展示最近访问书签
- [x] 私密书签和 Inbox 默认不展示

## 收尾
- [x] README.md 进度状态已更新
- [x] CHANGELOG.md 已更新
- [x] Dockerfile + docker-compose.yml 可用
- [x] 代码已分阶段提交 git