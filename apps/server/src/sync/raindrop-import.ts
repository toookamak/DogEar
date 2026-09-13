import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'

/**
 * Raindrop 按页导入（通道「导入」的服务端核心）。
 *
 * 背景：全量导入曾在一次 HTTP 请求里循环翻页，Workers（轨 A）上受单次调用
 * 硬限制——Free 档 50 个子请求（D1 每条查询都计入）与 10ms CPU——库一大必然
 * 中途被杀，表现为只导入一页 50 条。改为**每次调用只导入一页**，由前端逐页
 * 驱动并展示进度；按 raindropId 去重，中断后重导会跳过已有条目，天然可续传。
 *
 * 单页 D1 开销为常数：1 次批量查重 + 分片批量插入，远低于 Free 档子请求上限。
 */

export const IMPORT_PAGE_SIZE = 50

export interface RaindropImportClient {
  fetchBookmarks(page?: number, perPage?: number): Promise<{ items: RaindropBookmark[]; total: number }>
}

export interface ImportPageOptions {
  /** 从 0 计的页号；默认第 0 页 */
  page?: number
  intoInbox?: boolean
}

export interface ImportPageSummary {
  page: number
  imported: number
  skipped: number
  errors: string[]
  /** Raindrop 侧书签总数（fetch 响应的 count）；不可知为 0 */
  total: number
  /** 本页拉满 50 条时为 true，调用方应继续导下一页 */
  hasMore: boolean
}

export async function importRaindropPage(
  repository: BookmarkRepository,
  client: RaindropImportClient,
  options: ImportPageOptions = {},
): Promise<ImportPageSummary> {
  const page = Math.max(0, Math.floor(options.page ?? 0))
  const intoInbox = options.intoInbox !== false
  const summary: ImportPageSummary = { page, imported: 0, skipped: 0, errors: [], total: 0, hasMore: false }

  const result = await client.fetchBookmarks(page, IMPORT_PAGE_SIZE)
  summary.total = result.total || 0
  summary.hasMore = result.items.length >= IMPORT_PAGE_SIZE
  if (result.items.length === 0) return summary

  const existing = new Set(
    (await repository.findByRaindropIds(result.items.map((rd) => String(rd._id))))
      .map((row) => String((row as { raindropId?: string | null }).raindropId ?? ''))
      .filter(Boolean),
  )
  const fresh = result.items.filter((rd) => !existing.has(String(rd._id)))
  summary.skipped = result.items.length - fresh.length
  if (fresh.length === 0) return summary

  try {
    const records = await repository.createMany(fresh.map((rd) => ({
      id: randomUUID(),
      ...mapRaindropBookmark(rd),
      status: intoInbox ? 'unread' as const : 'saved' as const,
      source: 'page' as const,
      private: false,
      syncStatus: 'synced' as const,
    })))
    summary.imported = records.length
  } catch (e) {
    // 整页批量写入失败：报错并停止，前端让用户重试。已落库的行靠 raindropId 去重自愈
    summary.errors.push(`批量写入失败：${e instanceof Error ? e.message : String(e)}`)
  }
  return summary
}
