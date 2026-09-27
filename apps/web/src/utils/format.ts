/**
 * 展示层格式化与标签映射（纯函数，无副作用，便于复用与测试）。
 * 状态/来源等取值以 packages/shared 的契约枚举为准，此处只做中文标签映射。
 */

export const STATUS_LABELS: Record<string, string> = {
  unread: '待处理',
  saved: '已确认',
  archived: '搁置',
}

export const SOURCE_LABELS: Record<string, string> = {
  page: '工作台',
  agent: 'Agent',
  extension: '插件',
  raindrop: 'Raindrop',
}

export const SYNC_STATUS_LABELS: Record<string, string> = {
  pending: '待推送',
  synced: '已同步',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '进行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

export const BACKUP_TIER_LABELS: Record<string, string> = {
  light: '轻档',
  medium: '中档',
  full: '重档',
}

export const BACKUP_STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '进行中',
  completed: '已完成',
  failed: '失败',
}

export const QUEUE_STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  succeeded: '已完成',
  failed: '失败',
}

/** 备份档位包含内容（对应 docs/API结构表.md 三档备份范围） */
export const BACKUP_TIER_HINT: Record<string, string> = {
  light: '书签与组织数据（CSV/JSON）',
  medium: '轻档 + 配置与设置',
  full: '中档 + 快照与归档文件',
}

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—'
  return map[key] ?? key
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatDateTime(value: number | string | null | undefined): string {
  if (value == null) return '—'
  const ms = typeof value === 'number' ? value : Date.parse(value)
  if (Number.isNaN(ms)) return String(value)
  return new Date(ms).toLocaleString('zh-CN', { hour12: false })
}

/** 相对时间：用于「上次同步」这类需要一眼看出新旧的场合 */
export function formatAgo(value: number | null | undefined): string {
  if (value == null) return '从未'
  const diff = Date.now() - value
  if (diff < 0) return formatDateTime(value)
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/** 短日期（MM-DD）：书签卡片脚注用，无效或缺失返回空串（调用方据此不渲染） */
export function formatDateShort(value: number | null | undefined): string {
  if (value == null) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
