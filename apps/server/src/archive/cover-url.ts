/** 把封面地址收成可请求的绝对 URL；相对路径相对书签页解析。 */
export function resolveCoverUrl(raw: string | null | undefined, pageUrl?: string | null): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  try {
    if (pageUrl) return new URL(value, pageUrl).href
    return new URL(value).href
  } catch {
    if (value.startsWith('//')) return `https:${value}`
    return null
  }
}

export function coverFromRaindropExtras(extras: unknown, pageUrl?: string | null): string | null {
  if (!extras || typeof extras !== 'object') return null
  const record = extras as { cover?: unknown; media?: Array<{ link?: unknown }> }
  if (typeof record.cover === 'string' && record.cover.trim()) {
    return resolveCoverUrl(record.cover, pageUrl)
  }
  const link = record.media?.[0]?.link
  if (typeof link === 'string' && link.trim()) return resolveCoverUrl(link, pageUrl)
  return null
}
