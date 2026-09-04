export interface PageMetadata {
  title?: string
  description?: string
  image?: string
  author?: string
  publishedAt?: string // ISO date
  favicon?: string
  domain?: string
}

export async function extractMetadata(url: string): Promise<PageMetadata> {
  const metadata: PageMetadata = {}

  try {
    // Extract domain
    try {
      const urlObj = new URL(url)
      metadata.domain = urlObj.hostname
    } catch { /* ignore */ }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DogEar/1.0; +https://dogear.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) return metadata

    const html = await response.text()

    // Extract Open Graph title
    const ogTitle = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
    if (ogTitle) metadata.title = decodeHtmlEntities(ogTitle[1])

    // Extract regular title (fallback)
    if (!metadata.title) {
      const titleTag = html.match(/<title>([^<]*)<\/title>/i)
      if (titleTag) metadata.title = decodeHtmlEntities(titleTag[1]).trim()
    }

    // Extract description (OG first, then meta)
    const ogDesc = html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
    if (ogDesc) metadata.description = decodeHtmlEntities(ogDesc[1])
    if (!metadata.description) {
      const metaDesc = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
      if (metaDesc) metadata.description = decodeHtmlEntities(metaDesc[1])
    }

    // Extract image
    const ogImage = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
    if (ogImage) metadata.image = ogImage[1]

    // Extract author
    const ogAuthor = html.match(/<meta\s+[^>]*property=["']article:author["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
    if (ogAuthor) metadata.author = decodeHtmlEntities(ogAuthor[1])
    if (!metadata.author) {
      const metaAuthor = html.match(/<meta\s+[^>]*name=["']author["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
      if (metaAuthor) metadata.author = decodeHtmlEntities(metaAuthor[1])
    }

    // Extract published date
    const ogDate = html.match(/<meta\s+[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i)
    if (ogDate) metadata.publishedAt = ogDate[1]

    // Extract favicon
    const favicon = html.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["'][^>]*\/?>/i)
    if (favicon) {
      try {
        metadata.favicon = new URL(favicon[1], url).href
      } catch {
        metadata.favicon = favicon[1]
      }
    }

  } catch {
    // Timeout or fetch error - return partial metadata
  }

  return metadata
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