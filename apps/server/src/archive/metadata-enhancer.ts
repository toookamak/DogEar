import type { PageMetadata } from './metadata.js'

/**
 * Track B（Bun/Docker）专用的元数据增强提取器：metascraper 规则组。
 *
 * 为什么走注入而不是静态 import：metascraper 及其规则组依赖重（re2 等原生模块、
 * 大量 Node API），静态引入会进 Workers 模块图导致打包失败/超限。与 backupRoutes
 * 同一套装配口径——Track B 入口注入，Workers 入口不注入、继续用轻量自研提取。
 *
 * 摘除步骤（用户要求可彻底清理）见 docs/modules/20260912_外部依赖登记.md：
 * 删除本文件 + index.ts 的注入行 + package.json 的 metascraper-* 依赖即可。
 */

export type MetadataEnhancer = (url: string) => Promise<Partial<PageMetadata>>

export async function extractMetadataWithMetascraper(url: string): Promise<Partial<PageMetadata>> {
  const [metascraper, title, description, image, author, date, logo] = await Promise.all([
    import('metascraper'),
    import('metascraper-title'),
    import('metascraper-description'),
    import('metascraper-image'),
    import('metascraper-author'),
    import('metascraper-date'),
    import('metascraper-logo'),
  ])

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DogEar/1.0; +https://dogear.app)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`fetch failed with HTTP ${response.status}`)
  }
  const html = await response.text()

  const rules = [
    title.default(),
    description.default(),
    image.default(),
    author.default(),
    date.default(),
    logo.default(),
  ]
  // metascraper 约定：工厂函数接收规则数组，返回的 scraper 再接收 { url, html }
  const scraper = metascraper.default(rules as never)
  const result = (await scraper({ url, html })) as Record<string, unknown>

  const metadata: PageMetadata = {}
  if (typeof result.title === 'string' && result.title) metadata.title = result.title
  if (typeof result.description === 'string' && result.description) metadata.description = result.description
  if (typeof result.image === 'string' && result.image) metadata.image = result.image
  if (typeof result.author === 'string' && result.author) metadata.author = result.author
  if (typeof result.date === 'string' && result.date) metadata.publishedAt = result.date
  if (typeof result.logo === 'string' && result.logo) metadata.favicon = result.logo
  try {
    metadata.domain = new URL(url).hostname
  } catch { /* ignore */ }
  return metadata
}
