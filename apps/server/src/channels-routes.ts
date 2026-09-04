import { Hono } from 'hono'
import type { BookmarkRepository } from '@dogear/db'
import { channelConfigInputSchema } from '@dogear/shared'
import { ChannelConfigManager, isMaskedSecret, maskConfig, mergeChannelSecrets } from './channels/index.js'
import { RaindropClient } from './channels/raindrop.js'
import { S3ClientExtended } from './channels/s3.js'
import { WebDAVClient } from './channels/webdav.js'
import { randomUUID } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

function parseConfigPayload(raw: string | Record<string, unknown>): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    throw new Error('config must be a JSON object')
  }
  throw new Error('config must be a JSON object')
}

function createS3Client(config: Record<string, unknown>): S3ClientExtended {
  const endpoint = String(config.endpoint || '')
  const region = String(config.region || '')
  const accessKeyId = String(config.accessKeyId || '')
  const secretAccessKey = String(config.secretAccessKey || '')
  const bucket = String(config.bucket || '')

  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('S3 configuration is incomplete: endpoint, region, accessKeyId, secretAccessKey, bucket are required')
  }
  if (isMaskedSecret(secretAccessKey)) {
    throw new Error('S3 secretAccessKey is masked; save a real secret first')
  }

  return new S3ClientExtended({ endpoint, region, accessKeyId, secretAccessKey, bucket })
}

function createWebDavClient(config: Record<string, unknown>): WebDAVClient {
  const url = String(config.url || '')
  const username = String(config.username || '')
  const password = String(config.password || '')
  if (!url || !username || !password) {
    throw new Error('WebDAV configuration is incomplete: url, username, password are required')
  }
  if (isMaskedSecret(password)) {
    throw new Error('WebDAV password is masked; save a real password first')
  }
  return new WebDAVClient({ url, username, password })
}

export function createChannelRoutes(repository: BookmarkRepository) {
  const app = new Hono()
  const manager = new ChannelConfigManager(repository)

  function invalidRequest(c: { json: (body: unknown, status: 400) => Response }, details?: unknown) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', ...(details ? { details } : {}) } }, 400)
  }

  function skillError(c: { json: (body: unknown, status: number) => Response }, code: string, status: number, message: string) {
    return c.json({ error: { code, message } }, status)
  }

  app.get('/', async (c) => {
    const configs = await manager.getAllChannels()
    return c.json({ items: configs.map(maskConfig) })
  })

  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => undefined)
    const input = channelConfigInputSchema.safeParse(body)
    if (!input.success) return invalidRequest(c, input.error.flatten())

    let config: Record<string, unknown>
    try {
      config = parseConfigPayload(input.data.config)
    } catch (e) {
      return invalidRequest(c, { config: e instanceof Error ? e.message : 'Invalid config' })
    }

    const id = randomUUID()
    const saved = await manager.setChannelConfig(id, {
      channel: input.data.channel,
      label: input.data.label,
      config,
      enabled: input.data.enabled ?? true,
    })
    return c.json({ ok: true, id: saved.id }, 201)
  })

  app.patch('/:id', async (c) => {
    const existing = await manager.getChannelConfig(c.req.param('id'))
    if (!existing) return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined
    if (!body) return invalidRequest(c)

    let config = existing.config
    if (body.config !== undefined) {
      try {
        config = mergeChannelSecrets(existing.channel, parseConfigPayload(body.config as string | Record<string, unknown>), existing.config)
      } catch (e) {
        return invalidRequest(c, { config: e instanceof Error ? e.message : 'Invalid config' })
      }
    }

    const saved = await manager.setChannelConfig(existing.id, {
      channel: existing.channel,
      label: typeof body.label === 'string' ? body.label : existing.label,
      config,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : existing.enabled,
    })
    return c.json(maskConfig(saved))
  })

  app.delete('/:id', async (c) => {
    await manager.deleteChannelConfig(c.req.param('id'))
    return c.json({ ok: true })
  })

  app.post('/:id/import', async (c) => {
    const config = await manager.getChannelConfig(c.req.param('id'))
    if (!config) return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    const body = await c.req.json().catch(() => ({})) as { intoInbox?: boolean }
    const intoInbox = body.intoInbox !== false

    if (config.channel === 'raindrop') return handleRaindropImport(c, config, repository, intoInbox)
    if (config.channel === 's3') return handleS3Import(c, config, repository, intoInbox)
    return skillError(c, 'NOT_SUPPORTED', 400, 'WebDAV import is not supported in this version; use test or export')
  })

  app.post('/:id/export', async (c) => {
    const config = await manager.getChannelConfig(c.req.param('id'))
    if (!config) return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    if (config.channel === 'raindrop') return handleRaindropExport(c, config, repository)
    if (config.channel === 's3') return handleS3Export(c, config, repository)
    if (config.channel === 'webdav') return handleWebDavExport(c, config, repository)
    return skillError(c, 'NOT_SUPPORTED', 400, `Channel type "${config.channel}" not supported for export`)
  })

  app.post('/:id/test', async (c) => {
    const config = await manager.getChannelConfig(c.req.param('id'))
    if (!config) return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    try {
      if (config.channel === 'raindrop') {
        const token = String(config.config.token || '')
        if (!token) return invalidRequest(c, { token: 'Raindrop token is missing' })
        await new RaindropClient(token).testConnection()
      } else if (config.channel === 's3') {
        await createS3Client(config.config).testConnection()
      } else if (config.channel === 'webdav') {
        await createWebDavClient(config.config).testConnection()
      } else {
        return skillError(c, 'NOT_SUPPORTED', 400, 'Test not supported for this channel type')
      }
      return c.json({ ok: true, message: 'Connection successful' })
    } catch (e) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: e instanceof Error ? e.message : 'Connection failed' } }, 400)
    }
  })

  return app
}

async function handleRaindropImport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
  intoInbox: boolean,
) {
  const token = String(config.config.token || '')
  if (!token) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Raindrop token is missing' } }, 400)

  const client = new RaindropClient(token)
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  let page = 0
  let hasMore = true

  try {
    while (hasMore) {
      const result = await client.fetchBookmarks(page, 50)
      if (result.items.length === 0) break

      for (const rd of result.items) {
        try {
          const raindropId = String(rd._id)
          const existing = await repository.findByRaindropId(raindropId)
          if (existing) {
            skipped++
            continue
          }

          const bookmarkId = randomUUID()
          await repository.create({
            id: bookmarkId,
            url: rd.link,
            note: rd.note || null,
            status: 'unread',
            source: 'page',
            private: false,
            syncStatus: 'synced',
          })
          await repository.update(bookmarkId, {
            title: rd.title || rd.link,
            status: intoInbox ? 'unread' : 'saved',
            raindropId,
            raindropExtras: JSON.stringify({
              excerpt: rd.excerpt,
              type: rd.type,
              created: rd.created,
              lastUpdate: rd.lastUpdate,
              collectionId: rd.collection?.$id,
            }),
          })
          imported++
        } catch (e) {
          errors.push(`Failed to import bookmark ${rd._id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (result.items.length < 50) hasMore = false
      else page++
    }

    return c.json({ imported, skipped, errors })
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Import failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

async function handleRaindropExport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  const token = String(config.config.token || '')
  if (!token) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Raindrop token is missing' } }, 400)

  const client = new RaindropClient(token)
  let exported = 0
  let failed = 0
  const result = await repository.list({ includeDeleted: false }, 1000)

  for (const bookmark of result.items as any[]) {
    if (bookmark.raindropId || bookmark.deletedAt) continue
    try {
      const created = await client.createBookmark({
        url: bookmark.url,
        title: bookmark.title || bookmark.url,
        note: bookmark.note || undefined,
        tags: [],
      })
      await repository.update(bookmark.id, {
        raindropId: String(created._id),
        syncStatus: 'synced',
      })
      exported++
    } catch {
      failed++
    }
  }

  return c.json({ exported, failed })
}

function bookmarkCsvRows(items: unknown[]) {
  return (items as any[]).map((bookmark) => ({
    url: bookmark.url || '',
    title: bookmark.title || bookmark.url || '',
    note: bookmark.note || '',
    status: bookmark.status || 'unread',
  }))
}

async function handleS3Import(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
  intoInbox: boolean,
) {
  let s3Client: S3ClientExtended
  try {
    s3Client = createS3Client(config.config)
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: e instanceof Error ? e.message : 'Invalid S3 configuration' } }, 400)
  }

  const prefix = String(config.config.importPrefix || 'dogear/import/')
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  try {
    const files = (await s3Client.listFiles(prefix)).filter((file) => file.endsWith('.csv'))
    if (files.length === 0) {
      return c.json({ imported: 0, skipped: 0, errors: ['No CSV files found in S3 at the configured prefix'] })
    }

    for (const file of files) {
      try {
        const records = parse((await s3Client.downloadFile(file)).toString('utf-8'), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        })
        for (const record of records as Record<string, string>[]) {
          const url = record.url || record.link
          if (!url) {
            skipped++
            continue
          }
          const bookmarkId = randomUUID()
          await repository.create({
            id: bookmarkId,
            url,
            note: record.note || null,
            status: 'unread',
            source: 'page',
            private: false,
            syncStatus: 'synced',
          })
          await repository.update(bookmarkId, {
            title: record.title || url,
            status: intoInbox ? 'unread' : 'saved',
          })
          imported++
        }
      } catch (e) {
        errors.push(`Failed to process file ${file}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return c.json({ imported, skipped, errors })
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `S3 import failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

async function handleS3Export(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  let s3Client: S3ClientExtended
  try {
    s3Client = createS3Client(config.config)
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: e instanceof Error ? e.message : 'Invalid S3 configuration' } }, 400)
  }

  const exportPrefix = String(config.config.exportPrefix || 'dogear/export/')
  try {
    const result = await repository.list({ includeDeleted: false }, 1000)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${exportPrefix}bookmarks-${timestamp}.csv`
    const rows = bookmarkCsvRows(result.items)
    const csvContent = stringify(rows, { header: true, columns: ['url', 'title', 'note', 'status'] })
    await s3Client.uploadFile(fileName, Buffer.from(csvContent, 'utf-8'), 'text/csv')
    return c.json({ exported: rows.length, failed: 0, file: fileName })
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `S3 export failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

async function handleWebDavExport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  let client: WebDAVClient
  try {
    client = createWebDavClient(config.config)
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: e instanceof Error ? e.message : 'Invalid WebDAV configuration' } }, 400)
  }

  try {
    const result = await repository.list({ includeDeleted: false }, 1000)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `dogear-export-${timestamp}.csv`
    const rows = bookmarkCsvRows(result.items)
    const csvContent = stringify(rows, { header: true, columns: ['url', 'title', 'note', 'status'] })
    await client.uploadFile(fileName, csvContent, 'text/csv')
    return c.json({ exported: rows.length, failed: 0, file: fileName })
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `WebDAV export failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}
