import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CachedCover, CoverStore } from './cover-store.js'

/**
 * Track B 封面落盘。不进 Workers 模块图（仅 index.ts 注入）。
 */
export function createFileCoverStore(dir: string): CoverStore {
  mkdirSync(dir, { recursive: true })

  const safeId = (bookmarkId: string) => {
    if (!/^[-0-9a-fA-F]{36}$/.test(bookmarkId)) throw new Error('invalid cover id')
    return bookmarkId
  }

  return {
    async get(bookmarkId) {
      const id = safeId(bookmarkId)
      const binPath = join(dir, id)
      const metaPath = join(dir, `${id}.json`)
      if (!existsSync(binPath) || !existsSync(metaPath)) return null
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { contentType?: string; sourceUrl?: string }
        return {
          body: new Uint8Array(readFileSync(binPath)),
          contentType: meta.contentType || 'image/jpeg',
          sourceUrl: meta.sourceUrl || '',
        }
      } catch {
        return null
      }
    },
    async put(bookmarkId, cover: CachedCover) {
      const id = safeId(bookmarkId)
      writeFileSync(join(dir, id), cover.body)
      writeFileSync(join(dir, `${id}.json`), JSON.stringify({
        contentType: cover.contentType,
        sourceUrl: cover.sourceUrl,
      }))
    },
  }
}
