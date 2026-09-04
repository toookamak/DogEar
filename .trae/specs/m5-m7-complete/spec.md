# M5-M7 完整实现 Spec

## Why
M4 正式工作台前端已完成。需要持续推进到 M7 终点，完成通道与同步、快照与备份、导航页三个本期核心里程碑，使 DogEar 成为能整理、能通道、能保全、能当首页的完整工具。

## What Changes
- M5: 通道与同步（Raindrop 导入导出 + S3 + WebDAV + sync_queue + Dexie 镜像）
- M6: 快照与备份（Archive Job 引擎 + SingleFile 整页快照 + 三档备份 + 元数据增强）
- M7: 导航页（独立导航页路由 + 圈选规则 + 访问记录展示 + 鉴权集成）
- 各阶段收尾时更新 README.md 进度状态和 Docker 部署

## Impact
- Affected specs: M5 通道与同步、M6 快照与备份、M7 导航页
- Affected code: `apps/server/`、`apps/web/`、`packages/db/`、`packages/shared/`
- 新增数据通道、异步任务引擎、导航页路由
- 不修改现有 M4 核心功能

## ADDED Requirements

### M5: 通道与同步

#### Requirement: Raindrop 导入导出
- 用户可配置 Raindrop API Token（输入框，显示首尾 3 位中间 `*` 隐藏）
- 支持从 Raindrop 导入书签（全量/增量），映射到本地 Bookmark 结构
- 支持导出本地书签到 Raindrop（Scene/Status 不回写 Raindrop）
- 冲突时本地优先

#### Requirement: S3 通道
- 支持 S3 兼容对象存储配置（endpoint/region/accessKey/secretKey/bucket）
- 书签数据可导出到 S3（CSV 格式）
- 可从 S3 导入书签数据

#### Requirement: WebDAV 通道
- 支持 WebDAV 协议配置（URL/用户名/密码）
- 书签数据可导出到 WebDAV
- 可从 WebDAV 导入书签数据

#### Requirement: sync_queue
- 客户端 1 分钟攒批，将待同步数据批量推送
- 同步队列持久化，应用重启不丢失
- 队列状态可观测：未推送条数在界面常驻可见
- 429 退避策略

#### Requirement: Dexie 镜像缓存
- 端侧 IndexedDB 通过 Dexie 建立镜像缓存
- 只做镜像，不升级为第二真源
- 离线时仍可浏览已缓存的书签数据

### M6: 快照与备份

#### Requirement: Archive Job 引擎
- 异步快照任务调度系统
- 任务状态：pending → running → succeeded/failed/cancelled
- 失败重试机制，不回滚已保存的书签
- 任务队列可观测（Job 列表展示）

#### Requirement: SingleFile 整页快照
- 有 DOM 时使用 SingleFile 产出内联资源的单 HTML 文件
- 文件签名直传存储（Track A 浏览器直传，Track B 服务端存储）
- 无 DOM 时入队等待浏览器处理
- Track B 可用 monolith 作为备选方案

#### Requirement: Metadata 增强
- 使用 metascraper 提取页面元数据（标题/描述/图片/作者/发布时间等）
- 保存时异步执行，不阻塞主流程

#### Requirement: 三档备份
- 轻档：仅书签元数据（CSV）
- 中档：书签元数据 + 快照文件
- 重档：完整数据库导出
- 每档可独立配置频率和目标（S3/WebDAV/本地）
- 备份保留上限可配置

### M7: 导航页

#### Requirement: 独立导航页
- 独立路由 `/nav`，可作为浏览器首页
- 默认登录：未登录进密码页，登录后展示圈定条目
- 私密书签与 Inbox 内容默认不展示

#### Requirement: 圈选规则
- 全部模式：展示所有可见书签
- 规则模式（或关系）：按 Scene/Folder/Tag/Status 组合圈选
- 自定义搜索集：基于搜索关键词的自定义集合
- 隐藏规则：排除特定来源/场景的书签

#### Requirement: 访问记录展示
- 导航页展示近期访问过的书签
- 基于 M2 已落库的访问记录数据
- 按时间倒序排列，支持分页

## MODIFIED Requirements
### Requirement: 数据库结构
- M5: 新增 sync_queue 表、channel_config 表
- M6: 新增 archive 表、backup 表
- M7: 新增 nav_rule 表

### Requirement: API 升级
- M5: 新增通道配置/导入/导出/同步队列 API
- M6: 新增 Archive Job 控制/快照/备份 API
- M7: 新增导航规则 CRUD/导航页数据 API

## REMOVED Requirements
无