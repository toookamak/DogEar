/**
 * 批量集合操作的前端口径（P1b，2026-10-03）。
 *
 * 「全选匹配项」选中一个大集合后，应用批量不能再一次发几百个 id：
 * - 服务端 `PATCH /api/bookmarks/batch` 的 schema 上限就是 100 条；
 * - 更硬的闸是 Workers Free 档单次调用 50 子请求——批量路由逐条查+改，
 *   一分块太大在轨 A 上会整体失败。
 * 因此按 BLOCK 大小在前端分块顺序调用，逐块聚合结果。
 */

/** 单次批量请求的 id 上限（与服务端 schema 上限 100 对齐，取更保守的 50） */
export const BATCH_CHUNK_SIZE = 50

/** 超过这个条数的批量修改先弹影响面预览——防「选了整库、顺手点错」 */
export const BATCH_CONFIRM_THRESHOLD = 10

/** 把 id 集合切成 ≤size 的分块；顺序保持不变（空数组返回空分块列表） */
export function chunkIds(ids: string[], size = BATCH_CHUNK_SIZE): string[][] {
  if (size <= 0) throw new Error('chunk size must be positive')
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}
