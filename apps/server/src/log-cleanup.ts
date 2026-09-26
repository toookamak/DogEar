import type { BookmarkRepository } from '@dogear/db'

/**
 * 操作日志保留清理（API 结构表 v1.15，§4.2.12）：
 * 读 settings（`log.retention_days` / `log.max_entries`，缺省 30 天 / 5000 条）后
 * 删除过期与超额记录。供 Workers Cron 与自托管定时器低频调用；
 * 手动触发走 `POST /api/operation-log/cleanup`（回执带生效配置）。
 */
export async function cleanupOperationLog(repository: BookmarkRepository): Promise<number> {
  const [retentionSetting, maxEntriesSetting] = await Promise.all([
    repository.settings.get('log.retention_days'),
    repository.settings.get('log.max_entries'),
  ])
  const retentionDays = Number((retentionSetting as { value?: unknown } | undefined)?.value ?? 30) || 30
  const maxEntries = Number((maxEntriesSetting as { value?: unknown } | undefined)?.value ?? 5000) || 5000
  const result = await repository.operationLog.cleanup({ retentionDays, maxEntries })
  return result.removed
}
