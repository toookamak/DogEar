import { Hono } from 'hono'
import type { BookmarkRepository } from '@dogear/db'
import { channelConfigInputSchema } from '@dogear/shared'
import { ChannelConfigManager, maskConfig } from './channels/index.js'
import { RaindropClient } from './channels/raindrop.js'
import { S3ClientExtended } from './channels/s3.js'
import { randomUUID } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

function createS3Client(config: { endpoint?: string; region?: string; accessKeyId?: string; secretAccessKey?: string; bucket?: string }): S3ClientExtended {
  const endpoint = String(config.endpoint || '')
  const region = String(config.region || '')
  const accessKeyId = String(config.accessKeyId || '')
  const secretAccessKey = String(config.secretAccessKey || '')
  const bucket = String(config.bucket || '')

  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('S3 configuration is incomplete: all fields (endpoint, region, accessKeyId, secretAccessKey, bucket) are required')
  }

  return new S3ClientExtended({ endpoint, region, accessKeyId, secretAccessKey, bucket })
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

  // GET /api/channels - list all channel configs (masked)
  app.get('/', async (c) => {
    const configs = await manager.getAllChannels()
    return c.json({ items: configs.map(maskConfig) })
  })

  // POST /api/channels - save a channel config
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => undefined)
    const input = channelConfigInputSchema.safeParse(body)
    if (!input.success) {
      return invalidRequest(c, input.error.flatten())
    }

    const id = randomUUID()
    await manager.setChannelConfig(id, {
      channel: input.data.channel,
      label: input.data.label,
      config: JSON.parse(input.data.config),
      enabled: input.data.enabled ?? true,
    })

    return c.json({ ok: true, id })
  })

  // DELETE /api/channels/:id - remove a channel config
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await manager.deleteChannelConfig(id)
    return c.json({ ok: true })
  })

  // POST /api/channels/:id/import - import from channel
  app.post('/:id/import', async (c) => {
    const id = c.req.param('id')
    const config = await manager.getChannelConfig(id)
    if (!config) {
      return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    }

    if (config.channel === 'raindrop') {
      return handleRaindropImport(c, config, repository)
    }

    if (config.channel === 's3') {
      return handleS3Import(c, config, repository)
    }

    return c.json({ imported: 0, skipped: 0, errors: [`Channel type "${config.channel}" not supported for import`] })
  })

  // POST /api/channels/:id/export - export to channel
  app.post('/:id/export', async (c) => {
    const id = c.req.param('id')
    const config = await manager.getChannelConfig(id)
    if (!config) {
      return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    }

    if (config.channel === 'raindrop') {
      return handleRaindropExport(c, config, repository)
    }

    if (config.channel === 's3') {
      return handleS3Export(c, config, repository)
    }

    return c.json({ exported: 0, failed: 0, errors: [`Channel type "${config.channel}" not supported for export`] })
  })

  // POST /api/channels/:id/test - test connection
  app.post('/:id/test', async (c) => {
    const id = c.req.param('id')
    const config = await manager.getChannelConfig(id)
    if (!config) {
      return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    }

    if (config.channel === 'raindrop') {
      return handleRaindropTest(c, config)
    }

    if (config.channel === 's3') {
      return handleS3Test(c, config)
    }

    return skillError(c, 'NOT_SUPPORTED', 400, 'Test not supported for this channel type')
  })

  return app
}

// === Raindrop Handlers ===

async function handleRaindropImport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  const token = String(config.config.token || '')
  if (!token) {
    return c.json({ error: { code: 'INVALID_CONFIG', message: 'Raindrop token is missing' } }, 400)
  }

  const client = new RaindropClient(token)
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  let page = 0
  let hasMore = true

  try {
    while (hasMore) {
      const result = await client.fetchBookmarks(page, 50)
      if (result.items.length === 0) {
        hasMore = false
        break
      }

      for (const rd of result.items) {
        try {
          const existing = await repository.get(rd._id.toString())
          if (existing) {
            skipped++
            continue
          }

          const bookmarkId = randomUUID()
          const tags = rd.tags || []
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
            raindropId: String(rd._id),
            raindropExtras: JSON.stringify({
              excerpt: rd.excerpt,
              type: rd.type,
              created: rd.created,
              lastUpdate: rd.lastUpdate,
              collectionId: rd.collection.$id,
            }),
          })

          imported++
        } catch (e) {
          errors.push(`Failed to import bookmark ${rd._id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (result.items.length < 50) {
        hasMore = false
      } else {
        page++
      }
    }

    return c.json({ imported, skipped, errors })
  } catch (e) {
    return c.json({ error: { code: 'IMPORT_FAILED', message: `Import failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

async function handleRaindropExport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  const token = String(config.config.token || '')
  if (!token) {
    return c.json({ error: { code: 'INVALID_CONFIG', message: 'Raindrop token is missing' } }, 400)
  }

  const client = new RaindropClient(token)
  let exported = 0
  let failed = 0

  const result = await repository.list({ includeDeleted: false }, 1000)

  for (const bookmark of result.items) {
    if ((bookmark as any).raindropId) {
      continue
    }

    try {
      const created = await client.createBookmark({
        url: (bookmark as any).url,
        title: (bookmark as any).title || (bookmark as any).url,
        note: (bookmark as any).note || undefined,
        tags: [],
      })

      await repository.update((bookmark as any).id, {
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

async function handleRaindropTest(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
) {
  const token = String(config.config.token || '')
  if (!token) {
    return c.json({ error: { code: 'INVALID_CONFIG', message: 'Raindrop token is missing' } }, 400)
  }

  const client = new RaindropClient(token)
  const ok = await client.testConnection()

  if (ok) {
    return c.json({ ok: true, message: 'Connection successful' })
  } else {
    return c.json({ error: { code: 'CONNECTION_FAILED', message: 'Connection failed' } }, 400)
  }
}

// === S3 Handlers ===

async function handleS3Import(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  let s3Client: S3ClientExtended
  try {
    s3Client = createS3Client(config.config as Record<string, string>)
  } catch (e) {
    return c.json({ error: { code: 'INVALID_CONFIG', message: e instanceof Error ? e.message : 'Invalid S3 configuration' } }, 400)
  }

  const prefix = String(config.config.importPrefix || 'dogear/import/')
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  try {
    const files = await s3Client.listFiles(prefix)
    const csvFiles = files.filter(f => f.endsWith('.csv'))

    if (csvFiles.length === 0) {
      return c.json({ imported: 0, skipped: 0, errors: ['No CSV files found in S3 at the configured prefix'] })
    }

    for (const file of csvFiles) {
      try {
        const content = await s3Client.downloadFile(file)
        const csvContent = content.toString('utf-8')

        const records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        })

        for (const record of records) {
          try {
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
              s3Extras: JSON.stringify({
                importedFrom: file,
              }),
            })

            imported++
          } catch (e) {
            errors.push(`Failed to import bookmark from ${file}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
      } catch (e) {
        errors.push(`Failed to process file ${file}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return c.json({ imported, skipped, errors })
  } catch (e) {
    return c.json({ error: { code: 'IMPORT_FAILED', message: `S3 import failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

async function handleS3Export(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
) {
  let s3Client: S3ClientExtended
  try {
    s3Client = createS3Client(config.config as Record<string, string>)
  } catch (e) {
    return c.json({ error: { code: 'INVALID_CONFIG', message: e instanceof Error ? e.message : 'Invalid S3 configuration' } }, 400)
  }

  const exportPrefix = String(config.config.exportPrefix || 'dogear/export/')

  try {
    const result = await repository.list({ includeDeleted: false }, 1000)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${exportPrefix}bookmarks-${timestamp}.csv`

    // Build CSV rows
    const rows = result.items.map((bookmark: any) => ({
      url: bookmark.url || '',
      title: bookmark.title || bookmark.url || '',
      note: bookmark.note || '',
      tags: (bookmark.tags || []).join(', '),
      status: bookmark.status || 'unread',
    }))

    const csvContent = stringify(rows, {
      header: true,
      columns: ['url', 'title', 'note', 'tags', 'status'],
    })

    await s3Client.uploadFile(fileName, Buffer.from(csvContent, 'utf-8'), 'text/csv')

    return c.json({ exported: rows.length, failed: 0, file: fileName })
  } catch (e) {
    return c.json({ error: { code: 'EXPORT_FAILED', message: `S3 export failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

async function handleS3Test(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
) {
  let s3Client: S3ClientExtended
  try {
    s3Client = createS3Client(config.config as Record<string, string>)
  } catch (e) {
    return c.json({ error: { code: 'INVALID_CONFIG', message: e instanceof Error ? e.message : 'Invalid S3 configuration' } }, 400)
  }

  const ok = await s3Client.testConnection()

  if (ok) {
    return c.json({ ok: true, message: 'Connection successful' })
  } else {
    return c.json({ error: { code: 'CONNECTION_FAILED', message: 'Connection failed' } }, 400)
  }
}