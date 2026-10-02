import type { BookmarkListParams } from '../api/bookmarks.js'

/**
 * 工作台筛选状态（v1.14 批次二）。
 * createdRange 是 UI 预设档（最近 7 天 / 30 天 / 一年），提交时换算成 createdFrom。
 * navVisible / important 用三态字符串（'' = 不过滤），与服务端 query 的枚举口径一致。
 */
export interface WorkbenchFilters {
  q: string
  /** 状态（v0.8.0 起界面隐藏，字段保留可逆；Inbox 固定 unread 不受此影响） */
  status: string
  sceneId: string
  folderId: string
  /** 具体标签 id，或 `'none'` = 未打标签（与具体 tagId 互斥，服务端按 NOT EXISTS 处理） */
  tagId: string
  source: string
  important: '' | 'true' | 'false'
  createdRange: '' | '7d' | '30d' | 'year'
  /** 「近 N 天没打开」预设档（v0.8.0）。含**从未打开过**的那些（服务端显式带 isNull 分支） */
  openedRange: '' | '7d' | '30d' | 'year'
  navVisible: '' | 'true' | 'false'
}

export const EMPTY_FILTERS: WorkbenchFilters = {
  q: '', status: '', sceneId: '', folderId: '', tagId: '', source: '',
  important: '', createdRange: '', openedRange: '', navVisible: '',
}

/** 时间预设档（工具栏筛选弹层）：提交时从当前时间回溯 */
export const CREATED_RANGES: Array<{ value: WorkbenchFilters['createdRange']; label: string; days: number | null }> = [
  { value: '', label: '全部时间', days: null },
  { value: '7d', label: '最近 7 天', days: 7 },
  { value: '30d', label: '最近 30 天', days: 30 },
  { value: 'year', label: '最近一年', days: 365 },
]

/**
 * 「最近打开」预设档（v0.8.0）。与服务端口径一致：**只传天数，不传时间戳**——
 * 调用方要表达的是「一年没碰过」这种相对语义，交前端算时间戳会因时区与时钟漂移出歧义。
 * 「全部」档不传该参数，**不是**传 0（0 会被服务端判为非法而静默忽略）。
 */
export const OPENED_RANGES: Array<{ value: WorkbenchFilters['openedRange']; label: string; days: number | null }> = [
  { value: '', label: '不限', days: null },
  { value: '7d', label: '近 7 天没打开', days: 7 },
  { value: '30d', label: '近 30 天没打开', days: 30 },
  { value: 'year', label: '一年没打开', days: 365 },
]

/** 预设档 → 天数串。未知档与空档返回 undefined */
export function openedRangeToParam(range: WorkbenchFilters['openedRange']): string | undefined {
  const preset = OPENED_RANGES.find((entry) => entry.value === range)
  if (!preset || preset.days === null) return undefined
  return String(preset.days)
}

/** 预设档 → createdFrom（ISO）。未知档位与空档返回 undefined */
export function createdRangeToParam(range: WorkbenchFilters['createdRange'], now: Date = new Date()): string | undefined {
  const preset = CREATED_RANGES.find((entry) => entry.value === range)
  if (!preset || preset.days === null) return undefined
  return new Date(now.getTime() - preset.days * 86400000).toISOString()
}

/** 筛选弹层按钮上的生效数（q 走搜索框不计入）；纯计数，供「筛选 · N」展示 */
export function activeFilterCount(filters: WorkbenchFilters): number {
  let count = 0
  if (filters.status) count += 1
  if (filters.source) count += 1
  if (filters.sceneId) count += 1
  if (filters.folderId) count += 1
  if (filters.tagId) count += 1
  if (filters.important) count += 1
  if (filters.createdRange) count += 1
  if (filters.openedRange) count += 1
  if (filters.navVisible) count += 1
  return count
}

/** 是否存在任何生效筛选（空态「清除筛选」出口判断），含搜索词 */
export function hasActiveFilters(filters: WorkbenchFilters): boolean {
  return filters.q.trim() !== '' || activeFilterCount(filters) > 0
}

/**
 * 筛选状态 → 列表请求参数（不含分页；Inbox 由服务端固定 status=unread，
 * 不传 status 与其他筛选——与既有行为一致：Inbox 是固定视图）。
 * now 仅测试注入用。
 */
export function buildListParams(filters: WorkbenchFilters, sort: string, isInbox: boolean, now: Date = new Date()): BookmarkListParams {
  const params: BookmarkListParams = { sort: sort as BookmarkListParams['sort'] }
  if (isInbox) return params
  if (filters.status) params.status = filters.status
  if (filters.sceneId) params.sceneId = filters.sceneId
  if (filters.folderId) params.folderId = filters.folderId
  if (filters.tagId) params.tagId = filters.tagId
  if (filters.source) params.source = filters.source
  if (filters.important) params.important = filters.important
  if (filters.navVisible) params.navVisible = filters.navVisible
  const createdFrom = createdRangeToParam(filters.createdRange, now)
  if (createdFrom) params.createdFrom = createdFrom
  const lastOpenedBefore = openedRangeToParam(filters.openedRange)
  if (lastOpenedBefore) params.lastOpenedBefore = lastOpenedBefore
  if (filters.q.trim()) params.q = filters.q.trim()
  return params
}
