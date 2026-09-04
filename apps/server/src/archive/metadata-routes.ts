import { Hono } from 'hono'
import { extractMetadata } from './metadata.js'

export function createMetadataRoutes() {
  const app = new Hono()

  // POST /api/metadata/extract - extract metadata from a URL
  app.post('/extract', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const url = body.url
    if (!url) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'url required' } }, 400)

    const metadata = await extractMetadata(url)
    return c.json({ metadata })
  })

  return app
}