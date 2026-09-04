import type { BookmarkRepository } from '@dogear/db'

export interface ChannelConfig {
  id: string
  channel: string
  label: string
  enabled: boolean
  config: Record<string, unknown>
}

interface SettingRecord {
  key: string
  value: unknown
  updatedAt: number
}

export class ChannelConfigManager {
  constructor(private repository: BookmarkRepository) {}

  async getChannelConfig(id: string): Promise<ChannelConfig | undefined> {
    const setting = await this.repository.settings.get(`channel.${id}`) as SettingRecord | undefined
    if (!setting) return undefined

    try {
      const parsed = JSON.parse(setting.value as string)
      return {
        id,
        channel: parsed.channel,
        label: parsed.label,
        enabled: parsed.enabled ?? true,
        config: parsed.config || {},
      }
    } catch {
      return undefined
    }
  }

  async setChannelConfig(id: string, config: Omit<ChannelConfig, 'id'>): Promise<void> {
    await this.repository.settings.set(`channel.${id}`, JSON.stringify(config))
  }

  async deleteChannelConfig(id: string): Promise<void> {
    // Note: settings table doesn't have a native delete method in the current interface
    // We store an empty value to effectively delete it
    await this.repository.settings.set(`channel.${id}`, '')
  }

  async getAllChannels(): Promise<ChannelConfig[]> {
    const allSettings = await this.repository.settings.list() as SettingRecord[]
    const result: ChannelConfig[] = []

    for (const setting of allSettings) {
      const key = setting.key
      if (!key.startsWith('channel.')) continue
      const id = key.slice('channel.'.length)
      if (!id) continue

      try {
        const parsed = JSON.parse(setting.value as string)
        if (!parsed.channel) continue
        result.push({
          id,
          channel: parsed.channel,
          label: parsed.label,
          enabled: parsed.enabled ?? true,
          config: parsed.config || {},
        })
      } catch {
        continue
      }
    }

    return result
  }

  async getByPrefix(prefix: string): Promise<SettingRecord[]> {
    const allSettings = await this.repository.settings.list() as SettingRecord[]
    return allSettings.filter(s => s.key.startsWith(prefix))
  }
}

export function maskRaindropToken(token: string): string {
  if (token.length <= 6) return '***'
  const firstThree = token.slice(0, 3)
  const lastThree = token.slice(-3)
  return `${firstThree}${'*'.repeat(token.length - 6)}${lastThree}`
}

export function maskConfig(config: ChannelConfig): ChannelConfig {
  if (config.channel === 'raindrop' && config.config.token) {
    const token = String(config.config.token)
    return {
      ...config,
      config: {
        ...config.config,
        token: maskRaindropToken(token),
      },
    }
  }
  // Mask sensitive fields for other channels
  const maskedConfig = { ...config.config }
  for (const key of Object.keys(maskedConfig)) {
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password')) {
      const value = String(maskedConfig[key])
      if (value.length > 6) {
        maskedConfig[key] = `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}`
      } else {
        maskedConfig[key] = '***'
      }
    }
  }
  return {
    ...config,
    config: maskedConfig,
  }
}