import type { BookmarkRepository } from '@dogear/db'

/**
 * Raindrop 按页导出（通道「导出」的服务端核心，API 结构表 v1.10）。
 *
 * 背景：导出曾在一次请求里循环全库（每条 1 次 Raindrop create + 1 次 D1 写回，
 * 外加逐条关联查询的列表），Workers（轨 A）Free 档 50 子请求上限内跑不完 397 条。
 * 改为**每次调用只导出一页**（默认 20 条），由前端逐轮驱动：
 * - 候选集用瘦投影一条查询取回（listExportRows，只含推送所需列）；
 * - Raindrop create 无批量端点，逐条调用是下限，页大小即子请求开销的主要来源；
 * - 成功者一次批量写回 raindropId（updateRaindropIds，D1 上 1 次子请求）；
 * - **候选集选用「排除清单」而非 offset**：成功的行写回后即离开候选集（排序位
 *   前移，offset 会跳行），失败的行留在队首（offset 会永远重试）。前端每轮把
 *   上一轮失败的 id 传回 excludeIds，服务端多取 len(excludeIds) 行、在 JS 里
 *   剔除后取前 count 条——一条查询、无 NOT-IN 参数，毒条目天然不会卡死循环。
 */

export const EXPORT_PAGE_SIZE = 20

export interface RaindropExportClient {
  createBookmark(data: { url: string; title?: string; note?: string; tags?: string[] }): Promise<unknown>
}

export interface ExportPageOptions {
  /** 上一轮导出失败的 id，本轮跳过（失败不重试，累计上报） */
  excludeIds?: string[]
  count?: number
}

export interface ExportPageSummary {
  exported: number
  failed: number
  /** 本轮实际尝试的条数；为 0 表示候选集已耗尽，调用方停止 */
  processed: number
  /** 仍未推送 Raindrop 的书签数（本轮写回后统计） */
  total: number
  hasMore: boolean
  errors: string[]
  /** 本轮失败的本地书签 id：调用方下一轮原样传回 excludeIds */
  failedIds: string[]
}

export async function exportRaindropPage(
  repository: BookmarkRepository,
  client: RaindropExportClient,
  options: ExportPageOptions = {},
): Promise<ExportPageSummary> {
  const count = Math.min(Math.max(1, Math.floor(options.count ?? EXPORT_PAGE_SIZE)), EXPORT_PAGE_SIZE)
  const excludeIds = (options.excludeIds ?? []).filter(Boolean)
  const summary: ExportPageSummary = { exported: 0, failed: 0, processed: 0, total: 0, hasMore: false, errors: [], failedIds: [] }

  // 多取 len(excludeIds) 行再在内存里剔除：一条查询，无 NOT-IN 绑定参数。
  // 取不满说明候选集已被取尽，本轮结束后无需再跑
  const limit = count + excludeIds.length
  const raw = await repository.listExportRows({ onlyWithoutRaindropId: true }, limit, 0)
  const excludeSet = new Set(excludeIds)
  const candidates = raw
    .filter((row) => !excludeSet.has(String((row as { id: string }).id)))
    .slice(0, count)
  summary.processed = candidates.length
  summary.hasMore = raw.length >= limit
  if (candidates.length === 0) {
    summary.total = await repository.countWithoutRaindropId()
    return summary
  }

  const written: Array<{ id: string; raindropId: string }> = []
  for (const row of candidates as Array<Record<string, any>>) {
    try {
      const created = await client.createBookmark({
        url: row.url,
        title: row.title || row.url,
        note: row.note || undefined,
        tags: [],
      })
      const remoteId = String((created as { _id?: unknown })._id ?? '')
      if (!remoteId) throw new Error('Raindrop 未返回 _id')
      written.push({ id: String(row.id), raindropId: remoteId })
    } catch (error) {
      summary.failed += 1
      summary.failedIds.push(String(row.id))
      summary.errors.push(`导出 ${row.url} 失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (written.length > 0) await repository.updateRaindropIds(written)
  summary.exported = written.length

  summary.total = await repository.countWithoutRaindropId()
  return summary
}
