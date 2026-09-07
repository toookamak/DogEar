import type { BookmarkRepository } from '@dogear/db'

export interface ChannelConfig {
  id: string
  channel: string
  label: string
  enabled: boolean
  config: Record<string, unknown>
}

const SECRET_KEYS: Record<string, string[]> = {
  raindrop: ['token', 'client_secret'],
  s3: ['secretAccessKey'],
  webdav: ['password'],
}

export function isMaskedSecret(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value === '***') return true
  return /^\S{0,3}\*+\S{0,3}$/.test(value)
}

export function mergeChannelSecrets(
  channel: string,
  incoming: Record<string, unknown>,
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming }
  for (const key of SECRET_KEYS[channel] ?? []) {
    const value = merged[key]
    if (value == null || value === '' || isMaskedSecret(value)) {
      if (existing?.[key]) merged[key] = existing[key]
      else delete merged[key]
    }
  }
  return merged
}

function parseStoredConfig(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function toChannelConfig(row: Record<string, unknown>): ChannelConfig {
  return {
    id: String(row.id),
    channel: String(row.channel),
    label: String(row.label),
    enabled: Boolean(row.enabled),
    config: parseStoredConfig(row.config),
  }
}

export class ChannelConfigManager {
  constructor(private repository: BookmarkRepository) {}

  async getChannelConfig(id: string): Promise<ChannelConfig | undefined> {
    const row = await this.repository.channelConfig.get(id) as Record<string, unknown> | undefined
    if (!row) return undefined
    return toChannelConfig(row)
  }

  async setChannelConfig(id: string, input: Omit<ChannelConfig, 'id'>): Promise<ChannelConfig> {
    const existing = await this.getChannelConfig(id)
    const config = mergeChannelSecrets(input.channel, input.config, existing?.config)
    const payload = {
      label: input.label,
      config: JSON.stringify(config),
      enabled: input.enabled ?? true,
    }
    if (existing) {
      await this.repository.channelConfig.update(id, payload)
    } else {
      await this.repository.channelConfig.create({
        id,
        channel: input.channel,
        ...payload,
      })
    }
    const saved = await this.getChannelConfig(id)
    if (!saved) throw new Error('Failed to save channel config')
    return saved
  }

  async deleteChannelConfig(id: string): Promise<void> {
    await this.repository.channelConfig.remove(id)
  }

  async getAllChannels(): Promise<ChannelConfig[]> {
    const rows = await this.repository.channelConfig.list() as Record<string, unknown>[]
    return rows.map(toChannelConfig)
  }
}

export function maskRaindropToken(token: string): string {
  if (token.length <= 6) return '***'
  return `${token.slice(0, 3)}${'*'.repeat(token.length - 6)}${token.slice(-3)}`
}

export function maskConfig(config: ChannelConfig): ChannelConfig {
  const maskedConfig = { ...config.config }
  const keys = new Set([
    ...(SECRET_KEYS[config.channel] ?? []),
    ...Object.keys(maskedConfig).filter((key) => {
      const lower = key.toLowerCase()
      return lower.includes('token') || lower.includes('secret') || lower.includes('password')
    }),
  ])
  for (const key of keys) {
    if (maskedConfig[key] == null) continue
    const value = String(maskedConfig[key])
    maskedConfig[key] = value.length > 6
      ? `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}`
      : '***'
  }
  return { ...config, config: maskedConfig }
}
