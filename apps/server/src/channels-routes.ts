import { Hono } from 'hono'
import type { BookmarkRepository } from '@dogear/db'
import { channelConfigInputSchema } from '@dogear/shared'
import { ChannelConfigManager, isMaskedSecret, maskConfig, mergeChannelSecrets } from './channels/index.js'
import { RaindropClient } from './channels/raindrop.js'
import { importRaindropPage } from './sync/raindrop-import.js'
import { exportRaindropPage } from './sync/raindrop-export.js'
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
    const body = await c.req.json().catch(() => ({})) as { intoInbox?: boolean; page?: number }
    const intoInbox = body.intoInbox !== false

    if (config.channel === 'raindrop') return handleRaindropImport(c, config, repository, intoInbox, body.page)
    if (config.channel === 's3') return handleS3Import(c, config, repository, intoInbox)
    return skillError(c, 'NOT_SUPPORTED', 400, 'WebDAV import is not supported in this version; use test or export')
  })

  app.post('/:id/export', async (c) => {
    const config = await manager.getChannelConfig(c.req.param('id'))
    if (!config) return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    if (config.channel === 'raindrop') {
      const body = await c.req.json().catch(() => ({})) as { excludeIds?: string[]; count?: number }
      return handleRaindropExport(c, config, repository, body)
    }
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

  // OAuth code exchange (browser-only callback flow): swaps a Raindrop `code` for an access token
  // using the channel's stored client_id / client_secret, then persists the token back to the channel.
  app.post('/oauth/exchange', async (c) => {
    const body = await c.req.json().catch(() => undefined) as { channelId?: string; code?: string; redirectUri?: string; state?: string } | undefined
    if (!body?.channelId || !body.code || !body.redirectUri) {
      return invalidRequest(c, { message: 'channelId, code and redirectUri are required' })
    }
    const config = await manager.getChannelConfig(body.channelId)
    if (!config) return skillError(c, 'NOT_FOUND', 404, 'Channel not found')
    if (config.channel !== 'raindrop') return skillError(c, 'NOT_SUPPORTED', 400, 'OAuth exchange is only supported for raindrop channels')
    const clientId = String(config.config.client_id || '')
    const clientSecret = String(config.config.client_secret || '')
    if (!clientId || !clientSecret) return invalidRequest(c, { message: 'client_id / client_secret not configured' })
    try {
      const token = await RaindropClient.exchangeCode({
        clientId,
        clientSecret,
        code: body.code,
        redirectUri: body.redirectUri,
      })
      const saved = await manager.setChannelConfig(body.channelId, {
        channel: 'raindrop',
        label: config.label,
        config: { ...config.config, token },
        enabled: config.enabled,
      })
      return c.json({ ok: true, channel: maskConfig(saved) })
    } catch (e) {
      return c.json({ error: { code: 'OAUTH_FAILED', message: e instanceof Error ? e.message : 'OAuth exchange failed' } }, 400)
    }
  })

  return app
}

/**
 * Raindrop 按页导入：每次调用只处理一页（50 条），由前端逐页驱动并展示进度。
 * 全量循环不能再放进单个请求——Workers（轨 A）单次调用有 50 子请求（D1 每条
 * 查询都计入）/ 10ms CPU 的硬上限，397 条的库实测会在第一页后被杀。
 */
async function handleRaindropImport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
  intoInbox: boolean,
  page?: number,
) {
  const token = String(config.config.token || '')
  if (!token) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Raindrop token is missing' } }, 400)

  const client = new RaindropClient(token)
  try {
    const summary = await importRaindropPage(repository, client, { page, intoInbox })
    return c.json(summary)
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Import failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}

/**
 * Raindrop 按页导出：每次调用只推送一页（20 条），由前端逐轮驱动。
 * 全库循环不能放进单个请求——Raindrop create 无批量端点（每条 1 次调用是下限），
 * Workers（轨 A）Free 档单次调用 50 子请求上限内跑不完 397 条。
 */
async function handleRaindropExport(
  c: { json: (body: unknown, status?: number) => Response },
  config: { config: Record<string, unknown> },
  repository: BookmarkRepository,
  body: { excludeIds?: string[]; count?: number },
) {
  const token = String(config.config.token || '')
  if (!token) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Raindrop token is missing' } }, 400)

  const client = new RaindropClient(token)
  try {
    const summary = await exportRaindropPage(repository, client, body)
    return c.json(summary)
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Export failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
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
    // 瘦投影一条查询取全量（替代 list 的逐条关联查询，Workers 上省数千次子请求）
    const rows = await repository.listExportRows({}, 1000, 0)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${exportPrefix}bookmarks-${timestamp}.csv`
    const csvContent = stringify(bookmarkCsvRows(rows), { header: true, columns: ['url', 'title', 'note', 'status'] })
    await s3Client.uploadFile(fileName, Buffer.from(csvContent, 'utf-8'), 'text/csv')
    return c.json({ exported: rows.length, failed: 0, processed: rows.length, total: rows.length, hasMore: false, errors: [], file: fileName })
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
    // 瘦投影一条查询取全量（替代 list 的逐条关联查询）
    const rows = await repository.listExportRows({}, 1000, 0)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `dogear-export-${timestamp}.csv`
    const csvContent = stringify(bookmarkCsvRows(rows), { header: true, columns: ['url', 'title', 'note', 'status'] })
    await client.uploadFile(fileName, csvContent, 'text/csv')
    return c.json({ exported: rows.length, failed: 0, processed: rows.length, total: rows.length, hasMore: false, errors: [], file: fileName })
  } catch (e) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `WebDAV export failed: ${e instanceof Error ? e.message : String(e)}` } }, 500)
  }
}
