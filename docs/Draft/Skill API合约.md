# DogEar · Skill API 合约（草案 v0.1 暂定）

> 方向性合约，后续随技术可调，带版本。对应 PRD v0.3.4 + 技术方案路线 v0.2。

## 0. 总览
- **Base URL**：`https://your-dogear.example`（本地或服务端）
- **鉴权**：`Authorization: Bearer <Token>`，支持吊销/轮换，日志可审计
- **自描述**：`GET /.well-known/capabilities` 返回全量 Skill 清单，AI 仅需 Base URL + Token 即可发现
- **版本**：`version: 0.3`，后续可调，AI 重新发现即生效
- **限速**：方向性 60/min，超限 429 + Retry-After，计入同步速率监测

## 1. GET /.well-known/capabilities
```json
{
  "version": "0.3",
  "skills": [
    {"name":"save_bookmark","desc":"收藏链接","params":{"url":"string*","note":"string?"}},
    {"name":"search_bookmarks","desc":"搜索","params":{"query":"string*","filters":"object?"}},
    {"name":"update_bookmark","desc":"单条修改","params":{"id":"string*","folder":"string?","tags":"string[]?","note":"string?","status":"enum?"}},
    {"name":"list_bookmarks","desc":"列表","params":{"status":"enum?","folder":"string?","tag":"string?","showInNav":"bool?","limit":20,"offset":0}},
    {"name":"get_stats","desc":"统计","params":{}},
    {"name":"batch_organize","desc":"批量整理（实验性）","params":{"ids":"string[]*"},"experimental": true}
  ]
}
```
> 3 个暂定决策：`list/search` 支持 `showInNav`；`save` 回显建议；`batch_organize` 标 experimental。

## 2. 核心 Skill

### save_bookmark  POST /skill/save
- **入**：`{url*, note?}`
- **出**：`{id, title, url, folder, tags:[], status:"unread", showInNav:true, aiSuggestion:{folder, tags}}`（回显便于 AI 告知用户）
- **行为**：抓 title/favicon/excerpt → AI 建议 folder/tags → 写本地 → 进 sync_queue → 可被 search 召回；600 条下即时

### search_bookmarks  POST /skill/search
- **入**：`{query*, filters?:{folder, tag, status, showInNav, dateRange}}`
- **出**：`{items:[{id,title,url,folder,tags,updatedAt,showInNav}], total}`
- **能力**：标题/url/tags/备注模糊 + 自然语言（“那个 xx 技术贴”走 AI 记忆），默认本地索引，不做全文，分页

### update_bookmark  POST /skill/update
- **入**：`{id*, folder?, tags?, note?, status?}`
- **出**：`{id, updatedAt, syncStatus:"pending"}`
- **约束**：禁删、禁批量改文件夹结构，需用户确认；写进 operation_log

### list_bookmarks  POST /skill/list
- **入**：`{status?, folder?, tag?, showInNav?, limit?=20, offset?=0}`
- **出**：`{items, total, hasMore}`

### get_stats  POST /skill/stats
- **出**：`{total, byStatus:{unread,reading,read}, byFolder:{}, recentWeek}`

### batch_organize（实验性，Phase 2）
- **入**：`{ids[]}`
- **出**：`{suggestions:[{id, folder, tags}]}`
- **约束**：仅建议态，需用户在工作台确认后才生效，不直接写库

## 3. 通用
- **错误**：`{error:{code, message}}`，code 如 `RATE_LIMITED/INVALID_URL/NOT_FOUND`
- **限速**：429 时 AI 重试，不丢数据
- **日志**：所有写进 operation_log，工作台可查看与回滚
- **同步监测**：调用次数/时延/成功率计入 05.2 监测

## 4. 风险与体感（暂定说明）
- **showInNav**：有则 AI 能答“导航页上的设计收藏”，无则混入非导航内容；风险低
- **save 回显**：有则 AI 可告知“已放到 设计/参考资料”，无则用户需自查；响应稍大但体验好
- **batch experimental**：标实验性则 AI 默认不调，即使调也需确认才生效；不标则后续需重连发现

> 后续可调，改 version 即可。
