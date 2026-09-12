import type { BookmarkRepository } from '@dogear/db'

/**
 * 导航规则求值器（L4，API 结构表 v1.6 开放）。
 *
 * 语义（docs/modules/20260904_同步功能设计.md 同源的规则模型，见数据库 schema 注释）：
 * 规则按 `sort_order` 顺序应用，集合语义为「逐步圈定」：
 * - `all`    集合重置为全部候选（非私密、未软删、排除 Inbox/unread——PRD：导航不含 Inbox 与私密）
 * - `rule`   匹配条件（OR：场景任一 / 文件夹任一 / 标签任一 / 状态相等）的候选**加入**集合
 * - `search` 按 `searchQuery` 搜索命中（复用列表的 q 过滤）的候选**加入**集合
 * - `hide`   匹配条件的候选**移出**集合
 *
 * 未配置任何规则时回落旧行为（= 全部候选），避免新部署导航页空白。
 *
 * 性能口径：600 条基线内内存求值（一次 list 带关系读出后过滤）；
 * 超基线再考虑物化展示集合（API 结构表 v1.6 记录）。
 */

export interface NavRulePayload {
  sceneIds?: string[]
  folderIds?: string[]
  tagIds?: string[]
  status?: string
}

export interface NavRuleShape {
  id: string
  name: string
  mode: string
  rule: string | null
  searchQuery: string | null
  sortOrder: number
  enabled: boolean
}

type RecordBag = Record<string, unknown>

export function parseRulePayload(json: string | null): NavRulePayload {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as NavRulePayload : {}
  } catch {
    return {}
  }
}

function asRecord(row: unknown): RecordBag {
  if (!row || typeof row !== 'object') return {}
  const record = row as RecordBag
  if (record.bookmarks && typeof record.bookmarks === 'object') return record.bookmarks as RecordBag
  return record
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : []
}

function relationIds(record: RecordBag, key: 'scenes' | 'tags'): string[] {
  const list = record[key]
  return Array.isArray(list) ? list.map((item) => String((item as RecordBag)?.id ?? '')) : []
}

function matchesPayload(record: RecordBag, payload: NavRulePayload): boolean {
  const sceneIds = idList(payload.sceneIds)
  if (sceneIds.length && relationIds(record, 'scenes').some((id) => sceneIds.includes(id))) return true
  const folderIds = idList(payload.folderIds)
  if (folderIds.length && folderIds.includes(String(record.folderId ?? ''))) return true
  const tagIds = idList(payload.tagIds)
  if (tagIds.length && relationIds(record, 'tags').some((id) => tagIds.includes(id))) return true
  if (payload.status && String(record.status ?? '') === payload.status) return true
  return false
}

/** 候选全集：非私密、未软删、排除 Inbox（unread）。无论规则如何，这一口径不放宽 */
async function loadCandidates(repository: BookmarkRepository): Promise<Map<string, RecordBag>> {
  const result = await repository.list({ private: false, excludeStatus: 'unread' }, 1000)
  const map = new Map<string, RecordBag>()
  for (const row of result.items ?? []) {
    const record = asRecord(row)
    const id = String(record.id ?? '')
    if (id) map.set(id, record)
  }
  return map
}

/** 求值展示集合：返回书签记录（按 createdAt 倒序），由路由层做导航投影与分页 */
export async function evaluateNavFeed(
  repository: BookmarkRepository,
): Promise<Array<RecordBag>> {
  const rules = ((await repository.navRules.list()) as unknown as NavRuleShape[]).filter((r) => r.enabled)

  if (rules.length === 0) {
    // 无规则回落旧行为：全部候选（与已废弃的 /api/nav/bookmarks 投影一致）
    const candidates = await loadCandidates(repository)
    return sortByCreatedDesc([...candidates.values()])
  }

  let feed = new Map<string, RecordBag>()
  for (const rule of rules) {
    const payload = parseRulePayload(rule.rule)
    if (rule.mode === 'all') {
      feed = await loadCandidates(repository)
      continue
    }
    if (rule.mode === 'rule') {
      const candidates = await loadCandidates(repository)
      for (const [id, record] of candidates) {
        if (matchesPayload(record, payload) && !feed.has(id)) feed.set(id, record)
      }
      continue
    }
    if (rule.mode === 'search') {
      const query = (rule.searchQuery ?? '').trim()
      if (!query) continue
      const result = await repository.list({ private: false, q: query }, 1000)
      for (const row of result.items ?? []) {
        const record = asRecord(row)
        const id = String(record.id ?? '')
        if (id && !feed.has(id)) feed.set(id, record)
      }
      continue
    }
    if (rule.mode === 'hide') {
      const candidates = await loadCandidates(repository)
      for (const [id, record] of candidates) {
        if (matchesPayload(record, payload)) feed.delete(id)
      }
      continue
    }
    // 未知 mode 忽略（与呈现映射的容错口径一致）
  }

  return sortByCreatedDesc([...feed.values()])
}

function sortByCreatedDesc(records: RecordBag[]): RecordBag[] {
  return [...records].sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
}
