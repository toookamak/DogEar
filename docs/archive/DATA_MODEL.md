# DogEar 数据库设计

- **日期**：2026-09-01
- **版本**：v1.2
- **关联**：PRD v0.3.8；技术方案路线 v0.3；部署方案 v1.0；同步引擎细化 v0.2

---

## 1. 概述

DogEar 采用 **服务端真源 + 端侧本地优先缓存** 的分层存储策略。Cloudflare Workers 轨以 D1 为真源，Docker 轨以 SQLite 为真源；IndexedDB（通过 Dexie.js 封装）仅保存端侧缓存与离线待提交变更，Raindrop.io 是外部同步目标与备份通道，不是 DogEar 的真源。

### 存储策略

| 存储类型 | 载体 | 用途 | 同步策略 |
|----------|------|------|----------|
| **服务端真源** | D1 / SQLite | 多设备共享的完整业务数据、配置、同步状态、操作日志与恢复元数据 | 服务端 API 事务读写；同步引擎从真源向 Raindrop 双向对账 |
| **端侧缓存** | IndexedDB (Dexie.js) | 首屏渲染、离线读取与待提交变更暂存 | 与服务端按版本/游标增量对账，不能取代服务端真源 |
| **外部同步通道** | Raindrop.io API | 外部同步目标与跨端恢复来源 | 仅由服务端同步引擎访问 |
| **备份导出** | JSON / HTML / CSV / Markdown | 本地备份与恢复 | 手动触发，按备份档位裁剪 |

服务端真源包含完整字段信息（业务数据、同步状态、操作日志、软删除标记、配置与同步游标）；UI 读取优先使用 IndexedDB 缓存，写入必须经服务端 API 持久化，成功后再更新端侧缓存并进入服务端同步队列。离线写入可暂存在端侧，联网后提交服务端，不直接写入 Raindrop。

**备份存储** 可仅保留核心业务字段（url、title、note、tags、folderId），也可按中/重备份包含配置、同步元数据、操作日志与队列；敏感配置保持加密状态。

### 技术选型

- **IndexedDB 封装**：Dexie.js — API 简洁、支持复杂查询、TypeScript 类型安全
- **ID 生成**：UUID v4（本地主键） + Raindrop 自增 ID（云端映射）
- **时间戳**：Unix 毫秒时间戳（`number` 类型）

---

## 2. 实体关系图

```
┌──────────────────────┐
│       folders        │
│──────────────────────│
│ id          (PK)     │
│ raindropId  (UNIQUE) │
│ title                │
│ parentId    (FK→self)│
│ order                │
│ createdAt            │
│ updatedAt            │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────────────────────┐
│             bookmarks                │
│──────────────────────────────────────│
│ id              (PK)                 │
│ raindropId      (UNIQUE, 可空)       │
│ url                                  │
│ title                                │
│ note              (用户备注)         │
│ excerpt           (AI 摘要)          │
│ favicon           (图标缓存)         │
│ folderId         (FK→folders)        │
│ tags              (string[])         │
│ status            (阅读状态)         │
│ showInNav        (导航页显隐)        │
│ syncStatus       (同步状态)         │
│ isDeleted        (软删除标记)        │
│ deletedAt        (软删除时间)        │
│ createdAt                            │
│ updatedAt                            │
└───────┬──────────────┬───────────────┘
        │ 1:N          │ 1:N
        ▼              ▼
┌──────────────┐  ┌──────────────────────┐
│ sync_queue   │  │   operation_log      │
│──────────────│  │──────────────────────│
│ id     (PK)  │  │ id           (PK)    │
│ bookmarkId   │  │ action               │
│ folderId     │  │ targetType           │
│ action       │  │ targetId             │
│ payload      │  │ before    (快照)     │
│ status       │  │ after     (快照)      │
│ retryCount   │  │ createdAt            │
│ createdAt    │  └──────────────────────┘
│ lastAttemptAt│
└──────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│    docker_items       │       │       settings       │
│──────────────────────│       │──────────────────────│
│ id          (PK)     │       │ key         (PK)     │
│ type                │       │ value                 │
│ targetId            │       │ encrypted             │
│ order               │       │ updatedAt             │
│ createdAt            │       └──────────────────────┘
└──────────────────────┘

┌──────────────────────┐
│      sync_meta       │
│──────────────────────│
│ key         (PK)     │
│ value                 │
│ updatedAt             │
└──────────────────────┘
```

**关系说明**：

| 关系 | 类型 | 说明 |
|------|------|------|
| folders → folders | 自引用 1:N | `parentId` 实现文件夹嵌套 |
| bookmarks → folders | N:1 | 一个文件夹包含多个书签 |
| bookmarks → sync_queue | 1:N | 一个书签可产生多条同步记录 |
| bookmarks → operation_log | 1:N | 一个书签的所有操作历史 |
| docker_items → bookmarks | N:1 | Docker 栏引用书签 |
| docker_items → folders | N:1 | Docker 栏可引用文件夹 |

---

## 3. 表结构定义

### 3.1 bookmarks（书签主表）

书签的核心数据表，存储所有书签的完整信息。既是 UI 操作的数据源，也是同步引擎的数据基础。

| 字段名 | 类型 | 可空 | 默认值 | 说明 | 同步到 Raindrop |
|--------|------|------|--------|------|----------------|
| `id` | `string` | 否 | UUID v4 | 本地唯一主键 | 否 |
| `raindropId` | `number` | 是 | `null` | Raindrop 侧的书签 ID，首次同步后回填 | 否（由 Raindrop 分配） |
| `url` | `string` | 否 | — | 书签 URL | 是（映射为 `link`） |
| `title` | `string` | 否 | `''` | 书签标题，可由 AI 自动填充或用户手动编辑 | 是 |
| `note` | `string` | 是 | `''` | 用户备注，手动输入的附加说明 | 是 |
| `excerpt` | `string` | 是 | `null` | AI 生成的页面内容摘要 | 否（仅本地） |
| `favicon` | `string` | 是 | `null` | 网站图标，Base64 编码或 URL 缓存地址 | 否（仅本地） |
| `folderId` | `string` | 是 | `null` | 所属文件夹 ID，关联 `folders.id` | 是（映射为 Raindrop collection） |
| `tags` | `string[]` | 否 | `[]` | 标签列表，含标签约定前缀标签和用户自定义标签 | 是 |
| `status` | `string` | 否 | `'unread'` | 阅读状态，值域见标签约定（通过 `_status:` 标签同步） | 是（通过 `_status:` 标签） |
| `showInNav` | `boolean` | 否 | `true` | 是否在导航页显示，工作台 `设置>导航页` 控制（全部/按规则-或/自定义搜索勾选/隐藏） | 否（仅本地，持久化） |
| `isPrivate` | `boolean` | 否 | `false` | 是否私密，导航页默认隐藏需解锁 | 否（仅本地） |
| `syncStatus` | `string` | 否 | `'pending'` | 同步状态：`pending` / `syncing` / `synced` / `conflict` | 否（仅本地） |
| `isDeleted` | `boolean` | 否 | `false` | 软删除标记，`true` 表示已删除但未过期 | 否（仅本地） |
| `deletedAt` | `number` | 是 | `null` | 软删除时间戳（Unix ms），7 天后自动清理 | 否（仅本地） |
| `createdAt` | `number` | 否 | 当前时间 | 创建时间戳 | 是 |
| `updatedAt` | `number` | 否 | 当前时间 | 最后更新时间戳 | 是 |

**status 值域**：

| 值 | 含义 | 对应标签 | 说明 |
|----|------|----------|------|
| `unread` | 未读 | `_status:unread` | 默认状态，进入待处理队列 |
| `reading` | 在读 | `_status:reading` | 用户已打开原文链接 |
| `read` | 已读 | `_status:read` | 阅读完毕 |
| `organized` | 已整理 | `_status:organized` | 完成分类收纳，退出待处理队列 |

**syncStatus 值域**：

| 值 | 含义 | 说明 |
|----|------|------|
| `pending` | 待同步 | 本地有变更，尚未同步 |
| `syncing` | 同步中 | 正在推送到 Raindrop |
| `synced` | 已同步 | 与 Raindrop 一致 |
| `conflict` | 冲突 | 本地与 Raindrop 均有变更，需处理 |

---

### 3.2 folders（文件夹表）

存储书签的文件夹结构，与 Raindrop 的 Collection 一一对应。

| 字段名 | 类型 | 可空 | 默认值 | 说明 | 同步到 Raindrop |
|--------|------|------|--------|------|----------------|
| `id` | `string` | 否 | UUID v4 | 本地唯一主键 | 否 |
| `raindropId` | `number` | 是 | `null` | Raindrop 侧的 Collection ID | 否（由 Raindrop 分配） |
| `title` | `string` | 否 | — | 文件夹名称 | 是 |
| `parentId` | `string` | 是 | `null` | 父文件夹 ID，关联 `folders.id`，实现嵌套 | 是 |
| `order` | `number` | 否 | `0` | 排序权重，数值越小越靠前 | 是（映射为 Raindrop 排序） |
| `createdAt` | `number` | 否 | 当前时间 | 创建时间戳 | 是 |
| `updatedAt` | `number` | 否 | 当前时间 | 最后更新时间戳 | 是 |

---

### 3.3 sync_queue（同步队列）

记录本地变更，供同步引擎按序推送到 Raindrop。每条变更独立一条记录，支持失败重试。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `string` | 否 | UUID v4 | 队列项唯一主键 |
| `bookmarkId` | `string` | 是 | `null` | 关联的书签 ID，关联 `bookmarks.id` |
| `folderId` | `string` | 是 | `null` | 关联的文件夹 ID，关联 `folders.id`（文件夹变更时使用） |
| `action` | `string` | 否 | — | 操作类型：`create` / `update` / `delete` |
| `payload` | `object` | 是 | `null` | 变更数据快照（完整的实体数据或变更 diff） |
| `status` | `string` | 否 | `'pending'` | 队列项状态：`pending` / `syncing` / `synced` / `failed` |
| `retryCount` | `number` | 否 | `0` | 已重试次数，超过 3 次标记为需人工干预 |
| `createdAt` | `number` | 否 | 当前时间 | 入队时间戳 |
| `lastAttemptAt` | `number` | 是 | `null` | 上次尝试同步的时间戳 |

**status 值域**：

| 值 | 含义 | 说明 |
|----|------|------|
| `pending` | 待同步 | 等待同步引擎处理 |
| `syncing` | 同步中 | 正在调用 Raindrop API |
| `synced` | 已同步 | 同步成功，等待清理 |
| `failed` | 同步失败 | 超过最大重试次数，需人工干预 |

---

### 3.4 operation_log（操作日志）

记录所有写操作的变更历史，支持审计、回滚和撤销功能。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `string` | 否 | UUID v4 | 日志项唯一主键 |
| `action` | `string` | 否 | — | 操作类型：`create` / `update` / `delete` / `restore` / `move` / `tag` |
| `targetType` | `string` | 否 | — | 操作对象类型：`bookmark` / `folder` |
| `targetId` | `string` | 否 | — | 操作对象 ID |
| `before` | `object` | 是 | `null` | 变更前的实体快照（用于回滚），`create` 时为 `null` |
| `after` | `object` | 是 | `null` | 变更后的实体快照（用于审计），`delete` 时为 `null` |
| `createdAt` | `number` | 否 | 当前时间 | 操作时间戳 |

**action 值域**：

| 值 | 含义 | before | after |
|----|------|--------|-------|
| `create` | 创建 | `null` | 完整实体 |
| `update` | 更新 | 变更前实体 | 变更后实体 |
| `delete` | 软删除 | 完整实体 | `null` |
| `restore` | 恢复 | `null` | 完整实体 |
| `move` | 移动文件夹 | `{ folderId: '旧值' }` | `{ folderId: '新值' }` |
| `tag` | 标签变更 | `{ tags: ['旧标签'] }` | `{ tags: ['新标签'] }` |

---

### 3.5 docker_items（导航页 Dock 栏配置）

存储导航页底部 Dock 常驻栏的项目配置。此表属于本地配置，不参与同步，不写入 Raindrop；导航页开关关闭时保留，重新开启后恢复。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `string` | 否 | UUID v4 | 配置项唯一主键 |
| `type` | `string` | 否 | — | 项目类型：`bookmark` / `folder` |
| `targetId` | `string` | 否 | — | 引用目标 ID；由 `type` 决定关联 `bookmarks.id` 或 `folders.id` |
| `order` | `number` | 否 | `0` | 排序权重，数值越小越靠前 |
| `createdAt` | `number` | 否 | 当前时间 | 加入 Dock 的时间戳 |

### 3.6 page_tabs（导航页页面标签）

存储导航页按内容维度分组的页面标签，支持横/竖排、拖拽排序、重命名。完全本地配置。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `string` | 否 | UUID v4 | 本地唯一主键 |
| `name` | `string` | 否 | — | 标签名称（常用/开发等） |
| `layout` | `string` | 否 | `'horizontal'` | 布局：`horizontal` / `vertical` |
| `filter` | `object` | 是 | `null` | 筛选规则（文件夹/标签/自定义） |
| `order` | `number` | 否 | `0` | 排序权重 |
| `createdAt` | `number` | 否 | 当前时间 | 创建时间 |

### 3.7 ai_memory（AI 记忆，服务端）

AI 记忆存储在服务端，用于持久化用户的偏好信号，不参与端侧 IndexedDB 与 Raindrop 书签数据同步。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | `string` | 否 | UUID v4 | 记录ID |
| `signals` | `object` | 否 | — | 偏好信号：分类/标签/阅读习惯/搜索模式等 |
| `scope` | `string` | 否 | `'general'` | 是否含隐私（可标记不入记忆） |
| `updatedAt` | `number` | 否 | 当前时间 | 更新时间 |

---

### 3.8 settings（运行时配置）

存储初始化向导与设置页写入的应用配置。配置属于服务端真源；敏感值（如 Raindrop token）以 AES-GCM 加密后保存，端侧只缓存脱敏结果或短期使用所需的数据。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `key` | `string` | 否 | — | 配置键，主键 |
| `value` | `object/string` | 否 | — | 配置值；敏感值保存密文 |
| `encrypted` | `boolean` | 否 | `false` | `true` 表示 `value` 为加密内容 |
| `updatedAt` | `number` | 否 | 当前时间 | 最后更新时间戳 |

### 3.9 sync_meta（同步元数据）

存储服务端同步引擎的游标、时间戳与运行状态。此表属于服务端真源，不写入端侧业务缓存，也不参与 Raindrop 书签数据同步。

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `key` | `string` | 否 | — | 元数据键，主键，如 `lastPullAt`、`lastUpdateByCollection` |
| `value` | `object/string` | 否 | — | 游标、时间戳或状态值 |
| `updatedAt` | `number` | 否 | 当前时间 | 最后更新时间戳 |

---

## 4. 标签约定

DogEar 使用 Raindrop 的标签系统实现多维度数据组织。通过 **前缀约定** 区分系统标签与用户自定义标签，所有系统标签前缀统一使用下划线 `_`，确保与用户标签不冲突。

### 前缀约定格式

```
_{维度}:{值}
```

### 完整标签约定表

| 前缀 | 维度 | 说明 | 值域 | 示例 |
|------|------|------|------|------|
| `_status:` | 阅读状态 | 书签的阅读进度 | `unread` / `reading` / `read` / `organized` | `_status:unread` |
| `_priority:` | 优先级 | 书签的重要程度 | `high` / `medium` / `low` | `_priority:high` |
| `_scene:` | 情景/用途 | 书签的使用场景 | `learning` / `work` / `inspiration` / `entertainment` | `_scene:learning` |
| `_temporal:` | 时效性 | 书签的保存期限 | `permanent` / `temporary` | `_temporal:permanent` |
| `_project:` | 项目关联 | 书签所属的项目 | 自由值（项目标识） | `_project:dogear` |

### 标签约定规则

1. **前缀固定**：所有系统标签以 `_` 开头，与用户标签在视觉上区分
2. **维度隔离**：每个前缀代表一个独立维度，同一书签同一维度只能有一个标签
3. **值用英文**：标签值统一使用英文小写，便于国际化和 API 处理
4. **兼容 Raindrop**：标签约定完全基于 Raindrop 的标签字段，无需 Raindrop 侧做任何修改
5. **UI 映射**：前端读取时过滤前缀标签，映射为可读的中文名称展示

### UI 映射示例

| 系统标签 | UI 显示 | 展示位置 |
|----------|---------|----------|
| `_status:unread` | 未读 | 状态徽章 |
| `_status:reading` | 在读 | 状态徽章 |
| `_priority:high` | 高优先级 | 标签颜色（红色） |
| `_scene:learning` | 学习材料 | 标签颜色（蓝色） |
| `_project:dogear` | DogEar | 标签颜色（紫色） |

---

## 5. 索引设计

### 5.1 bookmarks 索引

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+id` | `id` | 是 | 主键索引（Dexie.js 自动创建） |
| `++raindropId` | `raindropId` | 是 | Raindrop ID 映射，同步时快速查找 |
| `+folderId` | `folderId` | 否 | 按文件夹筛选书签 |
| `+status` | `status` | 否 | 按阅读状态筛选（待处理队列查询） |
| `+isDeleted` | `isDeleted` | 否 | 软删除过滤（UI 查询排除已删除） |
| `+showInNav` | `showInNav` | 否 | 导航页显隐过滤（工作台按规则/自定义） |
| `+syncStatus` | `syncStatus` | 否 | 同步引擎查询待同步项 |
| `+createdAt` | `createdAt` | 否 | 时间排序（最近收藏视图） |
| `+updatedAt` | `updatedAt` | 否 | 时间排序（最近修改视图） |

**复合索引建议**：

| 索引组合 | 用途 |
|----------|------|
| `[isDeleted+status]` | 查询未删除的待处理书签（整理模式核心查询） |
| `[isDeleted+folderId]` | 查询未删除的文件夹书签（文件夹视图） |
| `[syncStatus+updatedAt]` | 同步引擎查询待同步且最近修改的书签 |

### 5.2 folders 索引

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+id` | `id` | 是 | 主键索引 |
| `++raindropId` | `raindropId` | 是 | Raindrop Collection ID 映射 |
| `+parentId` | `parentId` | 否 | 查询子文件夹（文件夹树构建） |

### 5.3 sync_queue 索引

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+id` | `id` | 是 | 主键索引 |
| `+bookmarkId` | `bookmarkId` | 否 | 按书签查找同步记录 |
| `+folderId` | `folderId` | 否 | 按文件夹查找同步记录 |
| `+status` | `status` | 否 | 同步引擎查询待处理项（`pending` / `syncing`） |
| `+createdAt` | `createdAt` | 否 | 同步顺序（FIFO） |

### 5.4 operation_log 索引

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+id` | `id` | 是 | 主键索引 |
| `+targetId` | `targetId` | 否 | 按实体查询操作历史 |
| `+targetType` | `targetType` | 否 | 按类型筛选日志 |
| `+createdAt` | `createdAt` | 否 | 时间排序（日志列表） |

### 5.5 docker_items 索引（导航页 Dock 栏配置）

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+id` | `id` | 是 | 主键索引 |
| `+targetId` | `targetId` | 否 | 按引用目标查找 Dock 配置 |
| `+order` | `order` | 否 | 排序渲染（Dock 栏顺序） |

### 5.6 page_tabs 索引（导航页页面标签）

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+id` | `id` | 是 | 主键索引 |
| `+order` | `order` | 否 | 按页面标签顺序渲染 |

### 5.7 settings 索引（运行时配置）

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+key` | `key` | 是 | 按配置键读取运行时配置 |
| `+updatedAt` | `updatedAt` | 否 | 查询最近更新的配置 |

### 5.8 sync_meta 索引（同步元数据）

| 索引名 | 字段 | 唯一 | 说明 |
|--------|------|------|------|
| `+key` | `key` | 是 | 按元数据键读取游标与状态 |
| `+updatedAt` | `updatedAt` | 否 | 查询最近更新的同步元数据 |

---

## 6. 同步策略

DogEar 采用 **服务端真源 + 端侧本地优先缓存 + 异步外部同步** 的策略。在线 UI 写操作经服务端 API 事务写入 D1/SQLite，成功后更新 IndexedDB 缓存并进入服务端同步队列；离线写操作暂存在端侧，联网后提交服务端。变更由服务端同步引擎异步推送到 Raindrop。

### 6.1 写入流（端侧 → 服务端 → Raindrop）

```
用户操作 / AI Agent 操作
        │
        ▼
┌──────────────────────────────────────────┐
│  1. 服务端 API 事务写入 D1/SQLite          │
│     - bookmarks 表更新                    │
│     - operation_log 记录变更              │
│     - docker_items 联动更新（如适用）       │
└──────────────┬───────────────────────────┘
               │ 成功后更新端侧 IndexedDB 缓存
               ▼
┌──────────────────────────────────────────┐
│  2. 写入 sync_queue                       │
│     - action: create / update / delete    │
│     - payload: 变更数据快照                │
│     - status: pending                     │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  3. 同步引擎定时轮询（每 30 秒）           │
│     - 读取 sync_queue 中 status=pending   │
│     - 限制每次最多 5 条                    │
│     - 按 Raindrop API 限速逐条推送        │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  4. 同步成功                              │
│     - sync_queue: status → synced         │
│     - bookmarks: syncStatus → synced      │
│     - bookmarks: raindropId 回填          │
│     - 清理已同步的 sync_queue 记录         │
│                                          │
│  同步失败（≤ 3 次重试）                    │
│     - sync_queue: retryCount + 1          │
│     - sync_queue: lastAttemptAt 更新      │
│     - 等待下次轮询重试                     │
│                                          │
│  同步失败（> 3 次重试）                    │
│     - sync_queue: status → failed         │
│     - 标记需人工干预                       │
│     - UI 展示同步失败提醒                  │
└──────────────────────────────────────────┘
```

### 6.2 读取流（Raindrop → 服务端 → 端侧）

```
服务端定时拉取（每 5 分钟）或 手动刷新
        │
        ▼
┌──────────────────────────────────────────┐
│  1. 增量拉取                               │
│     - 从 sync_meta 读取 lastSyncAt 游标     │
│     - 服务端调用 Raindrop API 获取变更      │
│     - 拉取 Collections（文件夹）变更        │
│     - 拉取 Bookmarks（书签）变更            │
│     - 更新服务端真源与 sync_meta             │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  2. 数据对比与合并                         │
│     - Raindrop 侧新增 → 写入本地           │
│     - Raindrop 侧修改 → 冲突检测           │
│     - Raindrop 侧删除 → 标记本地软删除     │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  3. 冲突处理（两端保留，用户选择）          │
│                                          │
│  无冲突（仅本地有变更）                     │
│     - 跳过，无需处理                       │
│                                          │
│  无冲突（仅 Raindrop 有变更）               │
│     - 直接合并到本地                       │
│                                          │
│  有冲突（双方均有变更）                     │
│     - 两端数据保留，等待用户选择             │
│     - 记录冲突到 operation_log             │
│     - UI 提供冲突视图：                     │
│       · 用本地的                           │
│       · 用 Raindrop 的                     │
│       · 手动合并                           │
└──────────────────────────────────────────┘
```

### 6.3 限频策略

| 参数 | 值 | 说明 |
|------|-----|------|
| 写入轮询间隔 | 30 秒 | 同步引擎每 30 秒检查一次 sync_queue |
| 单次推送上限 | 5 条 | 每次轮询最多推送 5 条变更 |
| Raindrop API 限速响应 | 429 | 收到 429 后按 `Retry-After` 头退避等待 |
| 最大重试次数 | 3 次 | 超过 3 次标记为 failed |
| 读取拉取间隔 | 5 分钟（可配置） | 可设为 5 分钟 / 15 分钟 / 手动 |

### 6.4 数据映射（DogEar ↔ Raindrop）

| DogEar 字段 | Raindrop 字段 | 映射说明 |
|-------------|--------------|----------|
| `id` | `id` | Raindrop 自动分配，写入后回填到 `raindropId` |
| `url` | `link` | 直接映射 |
| `title` | `title` | 直接映射 |
| `note` | `note` | 直接映射 |
| `tags` | `tags` | 直接映射（含标签约定标签） |
| `folderId` | `collection.id` | 映射到 Raindrop Collection |
| `excerpt` | — | 不同步，仅本地 |
| `favicon` | — | 不同步，仅本地 |
| `status` | — | 通过 `_status:` 标签约定间接同步 |
| `syncStatus` | — | 不同步，仅本地 |
| `isDeleted` | — | 不同步，仅本地 |

---

## 7. 软删除与恢复

DogEar 采用软删除机制保护数据安全。删除操作不会立即移除数据，而是标记为已删除并保留一定周期，支持一键恢复。

### 7.1 软删除流程

```
用户/AI 触发删除
        │
        ▼
┌──────────────────────────────────────────┐
│  1. 标记软删除                             │
│     bookmarks.isDeleted = true            │
│     bookmarks.deletedAt = 当前时间戳       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  2. 写入操作日志                           │
│     operation_log.action = 'delete'       │
│     operation_log.before = 完整实体快照     │
│     operation_log.after = null            │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  3. 加入同步队列                           │
│     sync_queue.action = 'delete'          │
│     推送到 Raindrop 执行真实删除           │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  4. UI 立即响应                            │
│     - 书签从当前视图中移除                  │
│     - 底部显示撤销提示条（5 秒内可撤销）     │
│     - 待处理计数更新                        │
└──────────────────────────────────────────┘
```

### 7.2 恢复流程

```
用户点击撤销 / 从回收站恢复
        │
        ▼
┌──────────────────────────────────────────┐
│  1. 清除软删除标记                         │
│     bookmarks.isDeleted = false           │
│     bookmarks.deletedAt = null            │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  2. 写入操作日志                           │
│     operation_log.action = 'restore'      │
│     operation_log.after = 恢复后的实体      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  3. 加入同步队列                           │
│     sync_queue.action = 'create'          │
│     重新推送到 Raindrop                    │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  4. UI 恢复                               │
│     - 书签重新出现在原位置                   │
│     - 撤销提示条消失                        │
└──────────────────────────────────────────┘
```

### 7.3 自动清理策略

| 参数 | 值 | 说明 |
|------|-----|------|
| 软删除保留周期 | 7 天 | `deletedAt` 超过 7 天后自动清理 |
| 清理时机 | 应用启动时 | 每次启动时扫描并清理过期数据 |
| 清理范围 | `isDeleted = true` 且 `deletedAt < 当前时间 - 7天` | 仅清理满足条件的记录 |
| 清理内容 | 服务端真源中过期记录及各端缓存副本 | Raindrop 侧已在删除时同步移除 |

### 7.4 AI 操作的安全边界

| 操作 | AI 是否可执行 | 说明 |
|------|-------------|------|
| 创建书签 | ✅ 允许 | 核心功能 |
| 搜索书签 | ✅ 允许 | 查询操作 |
| 更新书签 | ✅ 允许 | 单条修改 |
| 列出书签 | ✅ 允许 | 查询操作 |
| 获取统计 | ✅ 允许 | 查询操作 |
| 删除书签 | ❌ 禁止 | AI 不可直接删除，返回 403 |
| 批量操作 | ❌ 禁止（默认） | 需用户手动确认 |

---

## 8. 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.2 | 2026-09-01 | 对齐服务端真源架构，补充 docker_items、settings、sync_meta 的字段、关系、索引与快速参考 | DogEar Team |
| v1.0 | 2026-08-21 | 初始版本：完成核心表的完整字段定义、实体关系图、索引设计、同步策略、软删除机制 | DogEar Team |

---

## 快速参考卡

### 表清单

| 表名 | 用途 | 记录量级（预估） | 同步到 Raindrop |
|------|------|----------------|----------------|
| `bookmarks` | 书签主数据 | 100-5000 条 | ✅ 核心字段 |
| `folders` | 文件夹结构 | 10-100 个 | ✅ 核心字段 |
| `sync_queue` | 同步变更队列 | 0-50 条（正常运转时） | — (队列本身不同步) |
| `operation_log` | 操作日志 | 持续增长 | ❌ 服务端真源，不同步 |
| `docker_items` | Dock 栏配置 | 0-16 条 | ❌ 端侧本地，不同步 |
| `page_tabs` | 页面标签配置 | 0-32 条 | ❌ 端侧本地，不同步 |
| `ai_memory` | AI 记忆 | 0-100 条 | ❌ 服务端真源，不同步 |
| `settings` | 运行时配置 | 10-50 项 | ❌ 服务端真源，不同步 |
| `sync_meta` | 同步游标与状态 | 10-100 项 | ❌ 服务端真源，不同步 |

### ID 命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `bm_` | 书签 | `bm_a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `fl_` | 文件夹 | `fl_b2c3d4e5-f6a7-8901-bcde-f12345678901` |
| `sq_` | 同步队列 | `sq_c3d4e5f6-a7b8-9012-cdef-123456789012` |
| `ol_` | 操作日志 | `ol_d4e5f6a7-b8c9-0123-def0-234567890123` |
| `dk_` | Docker 配置 | `dk_e5f6a7b8-c9d0-1234-ef01-345678901234` |

### 关键查询速查

| 场景 | 查询条件 | 使用索引 |
|------|----------|----------|
| 待处理队列 | `isDeleted=false, status='unread'` | `[isDeleted+status]` |
| 文件夹书签 | `isDeleted=false, folderId=?` | `[isDeleted+folderId]` |
| 待同步项 | `status='pending' OR status='syncing'` | `+status` |
| 最近收藏 | `isDeleted=false, createdAt DESC` | `+createdAt` |
| Raindrop 查找 | `raindropId=?` | `++raindropId` |
| 操作历史 | `targetId=?` | `+targetId` |
| `Dock 渲染` | `order ASC` | `+order` |
| `运行时配置` | `key=?` | `+key` |
| `同步游标` | `key=?` | `+key` |
| `过期软删除` | `isDeleted=true, deletedAt < 7天前` | `+isDeleted` |
