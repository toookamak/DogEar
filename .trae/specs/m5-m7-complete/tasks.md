# Tasks

## M5: 通道与同步

- [x] Task M5-1: **数据库schema升级** — 新增 sync_queue、channel_config 表
- [x] Task M5-2: **Dexie 端侧镜像缓存** — 5 表 Dexie 数据库 + sync-cache 服务
- [x] Task M5-3: **Raindrop 通道** — API 客户端 + 配置 UI + 导入/导出
- [x] Task M5-4: **S3 通道** — S3 客户端 + 配置 UI + 导入/导出
- [x] Task M5-5: **WebDAV 通道** — WebDAV 客户端 + 配置 UI + 导出
- [x] Task M5-6: **sync_queue 同步队列** — 队列存储 + 自动处理 + 前端展示
- [x] Task M5-7: **导入梳理页** — 导入结果展示 + 错误详情

## M6: 快照与备份

- [x] Task M6-1: **数据库schema升级** — 新增 archives、backups 表
- [x] Task M6-2: **Archive Job 引擎** — 服务 + API 路由 + 状态机
- [x] Task M6-3: **SingleFile 快照** — 前端按钮组件 + 归档 API 集成
- [x] Task M6-4: **Metadata 增强** — 元数据提取服务 + 集成到保存流程
- [x] Task M6-5: **三档备份** — 轻/中/重备份 + API + 前端 UI
- [x] Task M6-6: **单条导出** — HTML/Markdown 下载 + 详情页按钮

## M7: 导航页

- [x] Task M7-1: **数据库schema升级** — 新增 nav_rules 表
- [x] Task M7-2: **后端导航页 API** — 规则 CRUD + 书签查询 + 最近访问
- [x] Task M7-3: **前端导航页** — NavPage 页面 + 路由 + 侧边栏入口
- [x] Task M7-4: **访问记录展示** — 最近访问书签列表（NavPage 中集成）

## 收尾

- [x] Task F-1: **Docker 部署 + 文档更新** — Dockerfile + docker-compose + README 更新

# Task Dependencies
- M5 depends on M4 completed
- M6 can partially parallel with M5 (schema can be done after M5 schema)
- M7 depends on M4 completed (access logging already in M2)
- M7 should be after M5/M6 complete
- F depends on M5/M6/M7 all complete