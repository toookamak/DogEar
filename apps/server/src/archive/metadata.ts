export interface PageMetadata {
  title?: string
  description?: string
  image?: string
  author?: string
  publishedAt?: string
  favicon?: string
  domain?: string
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** property/name 与 content 谁先谁后都能匹配（不少站点 content 写在前面）。 */
function metaContent(html: string, attr: 'property' | 'name', key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `<meta\\s+[^>]*(?:${attr}=["']${escaped}["'][^>]*content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*${attr}=["']${escaped}["'])[^>]*>`,
    'i',
  )
  const match = html.match(re)
  const value = (match?.[1] || match?.[2] || '').trim()
  return value ? decodeHtmlEntities(value) : undefined
}

export function parseHtmlMetadata(html: string, url: string): PageMetadata {
  const metadata: PageMetadata = {}
  try {
    metadata.domain = new URL(url).hostname
  } catch { /* ignore */ }

  const ogTitle = metaContent(html, 'property', 'og:title')
  const titleTag = html.match(/<title>([^<]*)<\/title>/i)
  if (ogTitle) metadata.title = ogTitle
  else if (titleTag) metadata.title = decodeHtmlEntities(titleTag[1]).trim()

  const ogDesc = metaContent(html, 'property', 'og:description')
  const metaDesc = metaContent(html, 'name', 'description')
  if (ogDesc) metadata.description = ogDesc
  else if (metaDesc) metadata.description = metaDesc

  const ogImage = metaContent(html, 'property', 'og:image')
  if (ogImage) {
    try { metadata.image = new URL(ogImage, url).href } catch { metadata.image = ogImage }
  }

  const ogAuthor = metaContent(html, 'property', 'article:author')
  const metaAuthor = metaContent(html, 'name', 'author')
  if (ogAuthor) metadata.author = ogAuthor
  else if (metaAuthor) metadata.author = metaAuthor

  const ogDate = metaContent(html, 'property', 'article:published_time')
  if (ogDate) metadata.publishedAt = ogDate

  const favicon = html.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["'][^>]*>/i)
    || html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i)
  if (favicon) {
    try { metadata.favicon = new URL(favicon[1], url).href } catch { metadata.favicon = favicon[1] }
  }

  return metadata
}

export async function extractMetadata(url: string): Promise<PageMetadata> {
  const metadata: PageMetadata = {}
  try {
    metadata.domain = new URL(url).hostname
  } catch { /* ignore */ }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return metadata
    const html = (await response.text()).slice(0, 512_000)
    return { ...metadata, ...parseHtmlMetadata(html, url) }
  } catch {
    return metadata
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}
