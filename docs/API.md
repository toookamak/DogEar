# DogEar API 接口清单

- **日期**：2026-08-21
- **版本**：v1.0

---

## 1. 概述

DogEar 的 Skill API 是暴露给 AI 平台的能力接口，自描述、可被任何支持 tool calling 的 AI 调用。

### 基础信息

| 项目 | 说明 |
|------|------|
| **Base URL** | `http://localhost:3000`（本地部署）或通过 Tailscale 内网地址访问 |
| **协议** | HTTP / HTTPS |
| **数据格式** | JSON（`Content-Type: application/json`） |
| **认证方式** | Bearer Token |
| **字符编码** | UTF-8 |

### 认证

所有 API 端点（自描述端点除外）均需通过 `Authorization` 请求头携带 Bearer Token 进行认证：

```
Authorization: Bearer <your-token>
```

Token 在 DogEar 设置页面中配置，AI 平台绑定时由用户提供。

### 请求/响应统一格式

**响应结构**：

```json
{
  "ok": true,
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "用户可读的错误信息"
  },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 请求是否成功 |
| `data` | any | 成功时返回的数据 |
| `error` | object | 失败时返回的错误信息 |
| `error.code` | string | 错误码 |
| `error.message` | string | 用户可读的错误描述 |
| `meta` | object | 分页等元信息（仅分页接口返回） |

---

## 2. 自描述机制

DogEar 通过 `/.well-known/capabilities` 端点实现自描述。AI 平台绑定时只需提供 Base URL 和 Token，通过访问该端点自动获取可用能力列表、参数说明和使用示例。

### `GET /.well-known/capabilities`

返回当前服务支持的所有 Skill 能力定义。无需认证。

**请求示例**：

```http
GET /.well-known/capabilities HTTP/1.1
Host: localhost:3000
```

**响应示例**：

```json
{
  "ok": true,
  "data": {
    "name": "DogEar Bookmark Skill",
    "version": "1.0.0",
    "description": "个人书签收藏与管理的 AI 能力接口",
    "baseUrl": "http://localhost:3000",
    "capabilities": [
      {
        "name": "save_bookmark",
        "description": "收藏一个链接，自动抓取元数据、AI 分类、打标签",
        "endpoint": {
          "method": "POST",
          "path": "/api/bookmarks"
        },
        "parameters": {
          "url": {
            "type": "string",
            "required": true,
            "description": "要收藏的 URL"
          },
          "note": {
            "type": "string",
            "required": false,
            "description": "用户备注"
          },
          "tags": {
            "type": "array",
            "items": { "type": "string" },
            "required": false,
            "description": "额外标签列表"
          },
          "folderId": {
            "type": "string",
            "required": false,
            "description": "指定文件夹 ID"
          }
        },
        "example": "收藏一个设计参考链接",
        "exampleCall": "POST /api/bookmarks { \"url\": \"https://example.com/design\", \"note\": \"设计参考\" }"
      },
      {
        "name": "list_bookmarks",
        "description": "列出书签，支持筛选和分页",
        "endpoint": {
          "method": "GET",
          "path": "/api/bookmarks"
        },
        "parameters": {
          "status": {
            "type": "string",
            "required": false,
            "description": "筛选阅读状态：unread / reading / read / organized"
          },
          "folderId": {
            "type": "string",
            "required": false,
            "description": "筛选文件夹"
          },
          "tags": {
            "type": "string",
            "required": false,
            "description": "筛选标签（逗号分隔）"
          },
          "page": {
            "type": "number",
            "required": false,
            "description": "页码，默认 1"
          },
          "limit": {
            "type": "number",
            "required": false,
            "description": "每页条数，默认 20，最大 100"
          },
          "sort": {
            "type": "string",
            "required": false,
            "description": "排序字段：createdAt / updatedAt / title，默认 createdAt"
          },
          "order": {
            "type": "string",
            "required": false,
            "description": "排序方向：desc（默认）/ asc"
          },
          "showInNav": {
            "type": "boolean",
            "required": false,
            "description": "是否在导航页显示（对应工作台设置）"
          }
        }
      },
      {
        "name": "batch_organize",
        "description": "批量整理（实验性，需用户在工作台确认，Phase 2）",
        "endpoint": {
          "method": "POST",
          "path": "/api/bookmarks/batch-organize"
        },
        "parameters": {
          "ids": {
            "type": "array",
            "items": { "type": "string" },
            "required": true,
            "description": "待整理书签 ID 列表"
          }
        },
        "experimental": true
      },
      {
        "name": "update_bookmark",
        "description": "修改单条书签的文件夹、标签、备注或状态",
        "endpoint": {
          "method": "PATCH",
          "path": "/api/bookmarks/:id"
        },
        "parameters": {
          "note": { "type": "string", "required": false, "description": "更新备注" },
          "tags": { "type": "array", "items": { "type": "string" }, "required": false, "description": "替换标签列表" },
          "folderId": { "type": "string", "required": false, "description": "移动到文件夹" },
          "status": { "type": "string", "required": false, "description": "设置阅读状态" }
        }
      },
      {
        "name": "search_bookmarks",
        "description": "搜索书签，支持自然语言和条件筛选",
        "endpoint": {
          "method": "GET",
          "path": "/api/search"
        },
        "parameters": {
          "q": { "type": "string", "required": true, "description": "搜索关键词或自然语言" },
          "tags": { "type": "string", "required": false, "description": "筛选标签（逗号分隔）" },
          "folderId": { "type": "string", "required": false, "description": "筛选文件夹" },
          "status": { "type": "string", "required": false, "description": "筛选状态" },
          "showInNav": { "type": "boolean", "required": false, "description": "筛选是否在导航页显示" },
          "limit": { "type": "number", "required": false, "description": "返回条数，默认 20" }
        }
      },
      {
        "name": "get_stats",
        "description": "获取收藏统计信息，无输入参数",
        "endpoint": {
          "method": "GET",
          "path": "/api/stats"
        },
        "parameters": {}
      }
    ],
    "rateLimits": {
      "requestsPerMinute": 60,
      "writesPerMinute": 10,
      "description": "每分钟最多 60 次请求，连续写入超 10 次/分钟触发警告"
    }
  }
}
```

---

## 3. 书签管理接口

### 3.1 收藏新链接 — `POST /api/bookmarks`

对应 Skill：`save_bookmark`

收藏一个 URL。系统会自动抓取页面元数据（标题、摘要、图标），AI 自动推荐分类和标签，默认标记为"未读"状态。

**请求头**：

```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 要收藏的 URL |
| `note` | string | 否 | 用户备注 |
| `tags` | string[] | 否 | 额外标签列表 |
| `folderId` | string | 否 | 指定文件夹 ID |

**请求示例**：

```json
POST /api/bookmarks HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "url": "https://example.com/design-guide",
  "note": "很好的设计参考文档"
}
```

**成功响应（201 Created）**：

```json
{
  "ok": true,
  "data": {
    "id": "bm_abc123",
    "url": "https://example.com/design-guide",
    "title": "Design Guide - Example",
    "excerpt": "一篇关于设计方法论的文章，涵盖了从概念到落地的完整流程...",
    "favicon": "https://example.com/favicon.ico",
    "note": "很好的设计参考文档",
    "folderId": "folder_design",
    "tags": ["design", "reference", "_status:unread"],
    "status": "unread",
    "syncStatus": "pending",
    "createdAt": 1755763200000,
    "updatedAt": 1755763200000
  }
}
```

**错误响应**：

```json
// URL 格式无效（400）
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "URL 格式无效"
  }
}

// 重复 URL（409）
{
  "ok": false,
  "data": {
    "existingBookmarkId": "bm_existing"
  },
  "error": {
    "code": "DUPLICATE_URL",
    "message": "该 URL 已收藏过"
  }
}
```

---

### 3.2 列出书签 — `GET /api/bookmarks`

对应 Skill：`list_bookmarks`

返回书签列表，支持按状态、文件夹、标签筛选，支持分页和排序。

**请求头**：

```
Authorization: Bearer <token>
```

**请求参数（Query String）**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `status` | string | 否 | — | 阅读状态：`unread` / `reading` / `read` / `organized` |
| `folderId` | string | 否 | — | 筛选文件夹 ID |
| `tags` | string | 否 | — | 筛选标签（逗号分隔，如 `design,reference`） |
| `page` | number | 否 | `1` | 页码 |
| `limit` | number | 否 | `20` | 每页条数，最大 `100` |
| `sort` | string | 否 | `createdAt` | 排序字段：`createdAt` / `updatedAt` / `title` |
| `order` | string | 否 | `desc` | 排序方向：`asc` / `desc` |
| `includeDeleted` | boolean | 否 | `false` | 是否包含已软删除的书签 |
| `showInNav` | boolean | 否 | — | 是否在导航页显示（对应工作台按规则/自定义） |

**请求示例**：

```http
GET /api/bookmarks?status=unread&limit=10&page=1 HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": [
    {
      "id": "bm_abc123",
      "url": "https://example.com/design-guide",
      "title": "Design Guide - Example",
      "excerpt": "一篇关于设计方法论的文章...",
      "note": "很好的设计参考文档",
      "folderId": "folder_design",
      "tags": ["design", "reference", "_status:unread"],
      "status": "unread",
      "createdAt": 1755763200000,
      "updatedAt": 1755763200000
    },
    {
      "id": "bm_def456",
      "url": "https://example.com/api-tutorial",
      "title": "API Tutorial",
      "excerpt": "RESTful API 设计最佳实践...",
      "note": "",
      "folderId": "folder_dev",
      "tags": ["api", "tutorial", "_status:unread"],
      "status": "unread",
      "createdAt": 1755676800000,
      "updatedAt": 1755676800000
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10
  }
}
```

---

### 3.3 获取单条书签 — `GET /api/bookmarks/:id`

根据 ID 获取单条书签的详细信息。

**请求头**：

```
Authorization: Bearer <token>
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 书签 ID |

**请求示例**：

```http
GET /api/bookmarks/bm_abc123 HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "id": "bm_abc123",
    "url": "https://example.com/design-guide",
    "title": "Design Guide - Example",
    "excerpt": "一篇关于设计方法论的文章，涵盖了从概念到落地的完整流程...",
    "favicon": "https://example.com/favicon.ico",
    "note": "很好的设计参考文档",
    "folderId": "folder_design",
    "folderName": "设计参考",
    "tags": ["design", "reference", "_status:unread"],
    "status": "unread",
    "syncStatus": "synced",
    "raindropId": 123456,
    "createdAt": 1755763200000,
    "updatedAt": 1755763200000
  }
}
```

**错误响应**：

```json
// 书签不存在（404）
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "书签不存在"
  }
}
```

---

### 3.4 修改书签 — `PATCH /api/bookmarks/:id`

对应 Skill：`update_bookmark`

修改单条书签的文件夹、标签、备注或状态。支持部分更新，只传需要修改的字段。

**请求头**：

```
Authorization: Bearer <token>
Content-Type: application/json
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 书签 ID |

**请求体**（所有字段可选，只传需要修改的部分）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `note` | string | 更新备注 |
| `tags` | string[] | 替换标签列表（全量替换） |
| `folderId` | string | 移动到指定文件夹 |
| `status` | string | 设置阅读状态 |

**请求示例**：

```json
PATCH /api/bookmarks/bm_abc123 HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "tags": ["design", "reference", "ui", "_status:reading"],
  "note": "已阅读，很有价值",
  "status": "reading"
}
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "id": "bm_abc123",
    "url": "https://example.com/design-guide",
    "title": "Design Guide - Example",
    "note": "已阅读，很有价值",
    "tags": ["design", "reference", "ui", "_status:reading"],
    "folderId": "folder_design",
    "status": "reading",
    "updatedAt": 1755849600000
  }
}
```

**错误响应**：

```json
// 书签不存在（404）
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "书签不存在"
  }
}

// 参数校验失败（400）
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "status 值无效，允许的值：unread, reading, read, organized"
  }
}
```

---

### 3.5 软删除书签 — `DELETE /api/bookmarks/:id`

将书签标记为已删除（软删除），不物理删除数据。软删除后保留 7 天，期间可恢复。

**请求头**：

```
Authorization: Bearer <token>
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 书签 ID |

**请求示例**：

```http
DELETE /api/bookmarks/bm_abc123 HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "id": "bm_abc123",
    "deletedAt": 1755849600000,
    "restoreBefore": 1756454400000
  }
}
```

| 响应字段 | 说明 |
|----------|------|
| `deletedAt` | 删除时间戳 |
| `restoreBefore` | 可恢复截止时间（7 天后） |

**错误响应**：

```json
// AI 调用时被安全策略拦截（403）
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "AI 操作不允许执行删除"
  }
}
```

> **安全策略说明**：AI 平台通过 Skill API 调用删除操作时，系统会返回 403 拒绝执行。仅工作台界面（人类操作）可以执行软删除。

---

### 3.6 恢复已删除书签 — `POST /api/bookmarks/:id/restore`

恢复一条已软删除的书签。

**请求头**：

```
Authorization: Bearer <token>
Content-Type: application/json
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 书签 ID |

**请求示例**：

```http
POST /api/bookmarks/bm_abc123/restore HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "id": "bm_abc123",
    "isDeleted": false,
    "deletedAt": null,
    "restoredAt": 1755936000000
  }
}
```

**错误响应**：

```json
// 恢复期限已过（410 Gone）
{
  "ok": false,
  "error": {
    "code": "RESTORE_EXPIRED",
    "message": "恢复期限已过（超过 7 天），书签已被永久删除"
  }
}

// 书签未被删除（400）
{
  "ok": false,
  "error": {
    "code": "NOT_DELETED",
    "message": "该书签未处于删除状态"
  }
}
```

---

## 4. 搜索接口

### `GET /api/search`

对应 Skill：`search_bookmarks`

搜索书签，支持关键词搜索和多维度条件筛选。关键词搜索同时匹配标题、URL、备注和标签。

**请求头**：

```
Authorization: Bearer <token>
```

**请求参数（Query String）**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索关键词，支持自然语言 |
| `tags` | string | 否 | 筛选标签（逗号分隔） |
| `folderId` | string | 否 | 筛选文件夹 |
| `status` | string | 否 | 筛选阅读状态 |
| `domain` | string | 否 | 筛选域名（如 `github.com`） |
| `createdAfter` | string | 否 | 收藏时间起始（ISO 8601 格式） |
| `createdBefore` | string | 否 | 收藏时间截止（ISO 8601 格式） |
| `limit` | number | 否 | 返回条数，默认 `20`，最大 `50` |
| `showInNav` | boolean | 否 | — | 筛选是否在导航页显示 |

**请求示例**：

```http
GET /api/search?q=React+hooks&status=unread&limit=10 HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": [
    {
      "id": "bm_ghi789",
      "url": "https://react.dev/learn/hooks-overview",
      "title": "React Hooks Overview",
      "excerpt": "Hooks 让你可以在不编写 class 的情况下使用 state 和其他 React 特性...",
      "note": "React 官方文档，Hooks 入门",
      "folderId": "folder_dev",
      "tags": ["react", "hooks", "javascript", "_status:unread"],
      "status": "unread",
      "createdAt": 1755590400000,
      "_score": 0.95
    },
    {
      "id": "bm_jkl012",
      "url": "https://example.com/react-hooks-deep-dive",
      "title": "React Hooks 深入理解",
      "excerpt": "深入分析 useEffect、useCallback、useMemo 的底层实现...",
      "note": "",
      "folderId": "folder_dev",
      "tags": ["react", "hooks", "_status:unread"],
      "status": "unread",
      "createdAt": 1755504000000,
      "_score": 0.82
    }
  ],
  "meta": {
    "total": 2,
    "query": "React hooks"
  }
}
```

> **搜索说明**：搜索结果按相关度排序（`_score` 字段），关键词同时匹配标题、URL、备注和标签。支持自然语言查询，如"最近收藏的设计参考"会自动解析时间范围和标签维度。

---

## 5. 同步接口

同步接口用于管理 DogEar 本地数据与 Raindrop.io 之间的数据同步。

### 5.1 推送本地变更 — `POST /api/sync/push`

将本地待同步的变更推送到 Raindrop。

**请求头**：

```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `maxItems` | number | 否 | 本次最多推送条数，默认 `5`，最大 `10` |

**请求示例**：

```json
POST /api/sync/push HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "maxItems": 5
}
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "pushed": 3,
    "failed": 0,
    "skipped": 1,
    "results": [
      {
        "localId": "bm_abc123",
        "operation": "create",
        "status": "synced",
        "raindropId": 789012
      },
      {
        "localId": "bm_def456",
        "operation": "update",
        "status": "synced",
        "raindropId": 789013
      },
      {
        "localId": "bm_ghi789",
        "operation": "create",
        "status": "synced",
        "raindropId": 789014
      }
    ]
  }
}
```

**错误响应**：

```json
// Raindrop Token 过期（401）
{
  "ok": false,
  "error": {
    "code": "RAINDROP_AUTH_EXPIRED",
    "message": "Raindrop Token 已过期，请在设置中重新授权"
  }
}

// Raindrop API 限频（429）
{
  "ok": false,
  "error": {
    "code": "RAINDROP_RATE_LIMITED",
    "message": "Raindrop API 请求过于频繁",
    "retryAfter": 30
  }
}
```

---

### 5.2 从 Raindrop 拉取增量 — `POST /api/sync/pull`

从 Raindrop 拉取增量数据，合并到本地。基于上次同步时间（`lastSyncAt`）拉取新增和变更的数据。

**请求头**：

```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `force` | boolean | 否 | 是否忽略增量，全量拉取，默认 `false` |

**请求示例**：

```json
POST /api/sync/pull HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "force": false
}
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "created": 5,
    "updated": 2,
    "deleted": 0,
    "conflicts": 1,
    "syncedAt": 1755849600000,
    "conflictDetails": [
      {
        "localId": "bm_xyz999",
        "raindropId": 789020,
        "conflictFields": ["title", "tags"],
        "localVersion": {
          "title": "Local Title",
          "tags": ["local-tag"]
        },
        "remoteVersion": {
          "title": "Remote Title",
          "tags": ["remote-tag"]
        }
      }
    ]
  }
}
```

**冲突处理说明**：

- 两端数据均保留，返回冲突详情供用户在工作台中手动选择处理方式
- 工作台冲突视图中可选择"用本地的""用 Raindrop 的"或"手动合并"

---

### 5.3 查看同步状态 — `GET /api/sync/status`

获取当前同步状态和统计数据。

**请求头**：

```
Authorization: Bearer <token>
```

**请求示例**：

```http
GET /api/sync/status HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "connected": true,
    "lastPushAt": 1755849600000,
    "lastPullAt": 1755846000000,
    "syncInterval": 300,
    "pendingPushCount": 1,
    "pendingPullCount": 0,
    "failedCount": 0,
    "totalSynced": 1523,
    "conflicts": 0
  }
}
```

| 响应字段 | 类型 | 说明 |
|----------|------|------|
| `connected` | boolean | Raindrop 连接是否正常 |
| `lastPushAt` | number | 上次推送时间戳 |
| `lastPullAt` | number | 上次拉取时间戳 |
| `syncInterval` | number | 同步间隔（秒） |
| `pendingPushCount` | number | 待推送变更数 |
| `pendingPullCount` | number | 待拉取变更数 |
| `failedCount` | number | 同步失败数 |
| `totalSynced` | number | 累计已同步数 |
| `conflicts` | number | 待处理冲突数 |

---

## 6. 统计接口

### `GET /api/stats`

对应 Skill：`get_stats`

获取书签收藏的统计数据，无输入参数。

**请求头**：

```
Authorization: Bearer <token>
```

**请求示例**：

```http
GET /api/stats HTTP/1.1
Authorization: Bearer dogear_xxxxxxxxxxxxxxxx
```

**成功响应（200 OK）**：

```json
{
  "ok": true,
  "data": {
    "totalBookmarks": 1523,
    "statusBreakdown": {
      "unread": 87,
      "reading": 12,
      "read": 456,
      "organized": 968
    },
    "folderCount": 24,
    "tagCount": 156,
    "recentActivity": {
      "thisWeek": 23,
      "thisMonth": 67
    },
    "topDomains": [
      { "domain": "github.com", "count": 189 },
      { "domain": "medium.com", "count": 134 },
      { "domain": "dev.to", "count": 78 },
      { "domain": "figma.com", "count": 45 },
      { "domain": "youtube.com", "count": 42 }
    ],
    "syncStats": {
      "totalSynced": 1523,
      "lastSyncAt": 1755849600000
    }
  }
}
```

| 响应字段 | 说明 |
|----------|------|
| `totalBookmarks` | 收藏总数（不含已软删除） |
| `statusBreakdown` | 各阅读状态的数量分布 |
| `folderCount` | 文件夹总数 |
| `tagCount` | 标签总数 |
| `recentActivity.thisWeek` | 本周新增收藏数 |
| `recentActivity.thisMonth` | 本月新增收藏数 |
| `topDomains` | 收藏最多的域名 Top 5 |
| `syncStats` | 同步统计信息 |

---

## 7. 错误响应格式

### 统一错误结构

所有错误响应遵循统一格式：

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户可读的错误描述信息"
  }
}
```

### 错误码列表

| 错误码 | HTTP 状态 | 含义 | 说明 |
|--------|-----------|------|------|
| `VALIDATION_ERROR` | 400 | 参数校验失败 | 请求参数不合法（如 URL 格式无效、缺少必填字段） |
| `NOT_DELETED` | 400 | 书签未处于删除状态 | 恢复操作时，书签本身未被软删除 |
| `UNAUTHORIZED` | 401 | 未认证 | 缺少 Token 或 Token 无效 |
| `AUTH_EXPIRED` | 401 | Token 过期 | Bearer Token 已失效 |
| `RAINDROP_AUTH_EXPIRED` | 401 | Raindrop Token 过期 | Raindrop 授权 Token 已失效 |
| `FORBIDDEN` | 403 | 无权限执行该操作 | AI 操作被安全策略拦截（如删除） |
| `NOT_FOUND` | 404 | 资源不存在 | 书签 ID 无效 |
| `DUPLICATE_URL` | 409 | 重复 URL | 该 URL 已被收藏 |
| `SYNC_CONFLICT` | 409 | 同步冲突 | 本地与 Raindrop 数据冲突 |
| `RESTORE_EXPIRED` | 410 | 恢复期限已过 | 软删除超过 7 天，不可恢复 |
| `RATE_LIMITED` | 429 | 请求过于频繁 | 超过速率限制（每分钟 60 次） |
| `RAINDROP_RATE_LIMITED` | 429 | Raindrop API 限频 | Raindrop 侧返回 429 |
| `NETWORK_ERROR` | 503 | 网络不可用 | 无法连接到 Raindrop API |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI 服务不可用 | AI 分类服务暂时不可用 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 未预期的错误 |

---

## 8. 安全策略

DogEar 的 Skill API 在 AI 操作边界上设置了明确的安全策略，防止 AI 误操作导致数据损坏。

### AI 操作边界

| 类别 | 策略 | 说明 |
|------|------|------|
| **禁止执行** | 删除书签 | AI 调用 `DELETE /api/bookmarks/:id` 返回 403 |
| **禁止执行** | 修改文件夹结构 | AI 无法创建/删除/重命名文件夹 |
| **禁止执行** | 批量操作（默认） | AI 无法一次操作多条书签 |
| **允许执行** | 收藏新链接 | `POST /api/bookmarks` |
| **允许执行** | 搜索和列出 | `GET /api/search` / `GET /api/bookmarks` |
| **允许执行** | 修改单条书签 | `PATCH /api/bookmarks/:id`（仅修改标签、备注、状态） |
| **允许执行** | 获取统计信息 | `GET /api/stats` |
| **允许执行** | 恢复已删除书签 | `POST /api/bookmarks/:id/restore` |
| **限速** | 每分钟最多 60 次请求 | 超限返回 429 |
| **限速** | 连续写入超 10 次/分钟 | 触发警告，不阻断 |

### 兜底机制

| 机制 | 说明 |
|------|------|
| **软删除** | 标记删除后保留 7 天，可一键恢复 |
| **操作日志** | 所有写操作记录到 `operation_log`，支持查看和回滚 |
| **撤销机制** | 工作台界面底部常驻撤销提示条 |
| **冲突处理** | 本地与 Raindrop 冲突时保留两端数据，提供手动合并选项 |

---

## 快速参考卡

| 方法 | 路径 | Skill 名称 | 说明 |
|------|------|-----------|------|
| `GET` | `/.well-known/capabilities` | — | 自描述端点，返回能力清单 |
| `POST` | `/api/bookmarks` | `save_bookmark` | 收藏新链接 |
| `GET` | `/api/bookmarks` | `list_bookmarks` | 列出书签（支持筛选和分页） |
| `GET` | `/api/bookmarks/:id` | — | 获取单条书签详情 |
| `PATCH` | `/api/bookmarks/:id` | `update_bookmark` | 修改书签（标签/备注/文件夹/状态） |
| `DELETE` | `/api/bookmarks/:id` | — | 软删除书签（AI 禁止调用） |
| `POST` | `/api/bookmarks/:id/restore` | — | 恢复已删除书签 |
| `GET` | `/api/search` | `search_bookmarks` | 搜索书签 |
| `GET` | `/api/stats` | `get_stats` | 获取统计信息 |
| `POST` | `/api/sync/push` | — | 推送本地变更到 Raindrop |
| `POST` | `/api/sync/pull` | — | 从 Raindrop 拉取增量 |
| `GET` | `/api/sync/status` | — | 查看同步状态 |

### 书签状态流转

```
收藏 → 未读(unread) → 在读(reading) → 已读(read) → 已整理(organized)
                    ↑                    │              │
                    └────────────────────┘              │
                          （可回退）                      │
                    └──────────────────────────────────┘
```

### 标签约定前缀

| 前缀 | 用途 | 示例 |
|------|------|------|
| `_status:` | 阅读状态 | `_status:unread`、`_status:reading` |
| `_scene:` | 情景/用途 | `_scene:learning`、`_scene:work` |
| `_priority:` | 优先级 | `_priority:high`、`_priority:low` |
| `_temporal:` | 时效性 | `_temporal:permanent`、`_temporal:temporary` |
| `_project:` | 项目关联 | `_project:dogear` |
