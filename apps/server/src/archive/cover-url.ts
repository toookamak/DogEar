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

/** rdl.ink/render 是网页快照入口，常返回 HTML，不能当 <img> src。 */
export function isUsableCoverUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (/rdl\.ink\/render/i.test(url)) return false
  return true
}

/**
 * 从若干候选里挑一张能当封面的图：优先像图片的 URL，丢掉 render 页。
 */
export function pickCoverUrl(
  candidates: Array<string | null | undefined>,
  pageUrl?: string | null,
): string | null {
  const resolved = candidates
    .map((value) => resolveCoverUrl(value, pageUrl))
    .filter((value): value is string => Boolean(value) && isUsableCoverUrl(value))
  const imageLike = resolved.find((value) =>
    /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(value)
    || /rd-bg\.b-cdn|a\.raindrop\.io|up\.raindrop\.io/i.test(value),
  )
  return imageLike ?? resolved[0] ?? null
}

export function coverFromRaindropExtras(extras: unknown, pageUrl?: string | null): string | null {
  if (!extras || typeof extras !== 'object') return null
  const record = extras as { cover?: unknown; media?: Array<{ link?: unknown }> }
  const mediaLinks = Array.isArray(record.media)
    ? record.media.map((item) => (typeof item?.link === 'string' ? item.link : null))
    : []
  return pickCoverUrl([
    typeof record.cover === 'string' ? record.cover : null,
    ...mediaLinks,
  ], pageUrl)
}
