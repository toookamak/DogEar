# Tasks

## M5: 通道与同步

- [ ] Task M5-1: **数据库schema升级**
  - [ ] 添加 sync_queue 表定义到 packages/db
  - [ ] 添加 channel_config 表定义到 packages/db
  - [ ] 运行迁移验证

- [ ] Task M5-2: **Dexie 端侧镜像缓存**
  - [ ] 新增 dexie 依赖到 apps/web
  - [ ] 实现 Dexie 数据库 schema
  - [ ] 实现书签变更镜像同步（增删改）
  - [ ] 实现离线读取

- [ ] Task M5-3: **Raindrop 通道**
  - [ ] 在 settings 页添加 Raindrop Token 配置
  - [ ] 实现 Raindrop API 客户端
  - [ ] 实现全量/增量导入
  - [ ] 实现导出到 Raindrop
  - [ ] 实现本地优先冲突处理

- [ ] Task M5-4: **S3 通道**
  - [ ] 在 settings 页添加 S3 配置表单
  - [ ] 实现 S3 API 客户端
  - [ ] 实现导出备份到 S3
  - [ ] 实现从 S3 导入恢复

- [ ] Task M5-5: **WebDAV 通道**
  - [ ] 在 settings 页添加 WebDAV 配置表单
  - [ ] 实现 WebDAV 客户端
  - [ ] 实现导出备份到 WebDAV
  - [ ] 实现从 WebDAV 导入恢复

- [ ] Task M5-6: **sync_queue 同步队列**
  - [ ] 后端实现队列存储和持久化
  - [ ] 前端实现 1 分钟攒批自动推送
  - [ ] 前端展示未推送条数
  - [ ] 实现 429 退避重试

- [ ] Task M5-7: **导入梳理页**
  - [ ] 创建导入结果页面
  - [ ] 展示导入统计
  - [ ] 冲突列表展示和确认

- [ ] Task M5-8: **M5 验证**
  - [ ] 跳过通道配置仍能正常保存
  - [ ] 导入/导出各完成一次功能验证
  - [ ] 运行 pnpm typecheck、pnpm test

## M6: 快照与备份

- [ ] Task M6-1: **数据库schema升级**
  - [ ] 添加 archive 表定义
  - [ ] 添加 backup 表定义
  - [ ] 运行迁移验证

- [ ] Task M6-2: **Archive Job 引擎**
  - [ ] 后端创建 ArchiveJob 服务
  - [ ] 实现任务状态机（pending → running → succeeded/failed/cancelled）
  - [ ] 实现失败重试

- [ ] Task M6-3: **SingleFile 快照**
  - [ ] 浏览器端集成 SingleFile
  - [ ] 生成单 HTML 文件
  - [ ] 直传服务端存储
  - [ ] 无 DOM 时入队等待

- [ ] Task M6-4: **Metadata 增强**
  - [ ] 集成 metascraper
  - [ ] 提取标题/描述/图片/作者/发布时间
  - [ ] 异步执行不阻塞主流程

- [ ] Task M6-5: **三档备份**
  - [ ] 实现轻档（仅 CSV 元数据）
  - [ ] 实现中档（元数据 + 快照）
  - [ ] 实现重档（完整数据库导出）
  - [ ] 添加备份频率配置
  - [ ] 添加保留数量限制

- [ ] Task M6-6: **单条导出**
  - [ ] 实现单条书签 HTML 下载
  - [ ] 实现单条书签 Markdown 下载

- [ ] Task M6-7: **M6 验证**
  - [ ] 勾选快照生成单 HTML 文件验证
  - [ ] 备份流程验证
  - [ ] 运行 pnpm typecheck、pnpm test

## M7: 导航页

- [ ] Task M7-1: **数据库schema升级**
  - [ ] 添加 nav_rule 表定义
  - [ ] 运行迁移验证

- [ ] Task M7-2: **后端 API**
  - [ ] 实现导航规则 CRUD
  - [ ] 实现导航页数据查询
  - [ ] 鉴权守卫（必须登录）

- [ ] Task M7-3: **前端导航页**
  - [ ] 创建导航页路由 `/nav`
  - [ ] 添加导航规则配置页面
  - [ ] 实现全部/规则/自定义搜索集/隐藏组合筛选
  - [ ] 渲染书签卡片列表（基于访问记录）

- [ ] Task M7-4: **前端展示**
  - [ ] 基于访问记录倒序展示近期书签
  - [ ] 私密书签和 Inbox 默认隐藏
  - [ ] 支持分页加载

- [ ] Task M7-5: **M7 验证**
  - [ ] 登录打开导航页展示正确圈选结果
  - [ ] 未登录跳转密码页
  - [ ] 私密不展示验证
  - [ ] 运行 pnpm typecheck、pnpm test

## 收尾

- [ ] Task F-1: **更新文档**
  - [ ] 更新 README.md 进度状态
  - [ ] 更新 CHANGELOG.md

- [ ] Task F-2: **Docker 部署**
  - [ ] 创建服务端 Dockerfile（Bun）
  - [ ] 创建前端 Nginx Dockerfile
  - [ ] 创建根目录 docker-compose.yml

- [ ] Task F-3: **git 提交**
  - [ ] 分阶段提交 M5/M6/M7 代码

# Task Dependencies
- M5 depends on M4 completed
- M6 can partially parallel with M5 (schema can be done after M5 schema)
- M7 depends on M4 completed (access logging already in M2)
- M7 should be after M5/M6 complete
- F depends on M5/M6/M7 all complete
