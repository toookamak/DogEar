export const COVER_MAX_BYTES = 2 * 1024 * 1024

export type CachedCover = {
  body: Uint8Array
  contentType: string
  sourceUrl: string
}

export type CoverStore = {
  get: (bookmarkId: string) => Promise<CachedCover | null>
  put: (bookmarkId: string, cover: CachedCover) => Promise<void>
}

/** 最小 R2 面，避免 cover-store 静态依赖 workers-types 拖进非 Workers 打包假设 */
export type R2CoverBucket = {
  get: (key: string) => Promise<{
    arrayBuffer: () => Promise<ArrayBuffer>
    httpMetadata?: { contentType?: string }
    customMetadata?: Record<string, string>
  } | null>
  put: (
    key: string,
    value: Uint8Array,
    options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> },
  ) => Promise<unknown>
}

function objectKey(bookmarkId: string): string {
  return `covers/${bookmarkId}`
}

export function createMemoryCoverStore(): CoverStore & { records: Map<string, CachedCover> } {
  const records = new Map<string, CachedCover>()
  return {
    records,
    async get(bookmarkId) {
      const row = records.get(bookmarkId)
      return row ? { ...row, body: row.body } : null
    },
    async put(bookmarkId, cover) {
      records.set(bookmarkId, { ...cover, body: cover.body })
    },
  }
}

export function createR2CoverStore(bucket: R2CoverBucket): CoverStore {
  return {
    async get(bookmarkId) {
      const object = await bucket.get(objectKey(bookmarkId))
      if (!object) return null
      return {
        body: new Uint8Array(await object.arrayBuffer()),
        contentType: object.httpMetadata?.contentType || 'image/jpeg',
        sourceUrl: object.customMetadata?.sourceUrl || '',
      }
    },
    async put(bookmarkId, cover) {
      await bucket.put(objectKey(bookmarkId), cover.body, {
        httpMetadata: { contentType: cover.contentType },
        customMetadata: { sourceUrl: cover.sourceUrl },
      })
    },
  }
}
