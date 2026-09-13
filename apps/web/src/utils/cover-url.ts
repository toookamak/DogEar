/** 相对封面地址相对书签页解析，避免 og:image 打到工作台域名 404。 */
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
