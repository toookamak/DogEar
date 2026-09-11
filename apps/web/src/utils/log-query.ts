/**
 * 操作日志的端侧筛选与分页（纯函数）。
 *
 * 分工（对照原型 LogSection 的类型 chips + 搜索框 + 分页）：
 * - **类型筛选走服务端**：`GET /api/operation-log?action=` 已支持，那才是真过滤，
 *   不必把无关日志全拉到端侧。见 LogTab 的加载逻辑。
 * - **关键词搜索在端侧**：服务端没有 `q` 参数，而日志有保留上限
 *   （默认 5000 条 / 30 天），端侧过滤可接受，不为此新增接口。
 * - **分页在端侧**：服务端一次性返回（`nextCursor: null`），按原型 20 条/页呈现。
 */

import type { OperationLogResponse } from '../types/api.js'
import { formatDateTime } from './format.js'

/** 每页条数，与原型 LogSection 的 PAGE 常量一致 */
export const LOG_PAGE_SIZE = 20

/**
 * 关键词过滤：匹配动作、对象类型、对象 id、详情、操作者与时间。
 * 空关键词（或仅空白）返回原列表；大小写不敏感。
 */
export function filterLogs(logs: OperationLogResponse[], query: string): OperationLogResponse[] {
  const q = query.trim().toLowerCase()
  if (!q) return logs
  return logs.filter((log) => {
    const haystack = [
      log.action,
      log.targetType,
      log.targetId,
      log.detail ?? '',
      log.actor,
      formatDateTime(log.createdAt),
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

/**
 * 分页。页码从 0 开始。
 * 页码超出范围时收敛到最后一页，避免出现空白页；空列表仍报 1 页，
 * 界面上显示「1 / 1」而非「0 / 0」。
 */
export function paginateLogs(
  logs: OperationLogResponse[],
  page: number,
  pageSize: number = LOG_PAGE_SIZE,
): { items: OperationLogResponse[]; page: number; pageCount: number } {
  const size = Math.max(1, Math.floor(pageSize) || LOG_PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(logs.length / size))
  const safePage = Math.min(Math.max(0, Math.floor(page) || 0), pageCount - 1)
  return {
    items: logs.slice(safePage * size, (safePage + 1) * size),
    page: safePage,
    pageCount,
  }
}

/** 统计各动作条数，用于在类型 chips 上显示计数 */
export function countByAction(logs: OperationLogResponse[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const log of logs) counts[log.action] = (counts[log.action] ?? 0) + 1
  return counts
}

/**
 * 由本次返回的日志推导出「有哪些动作可选」。
 * 只列出真实出现过的动作，避免界面上一排点了没结果的空 chips。
 */
export function actionsPresent(logs: OperationLogResponse[]): string[] {
  return Object.keys(countByAction(logs))
}
