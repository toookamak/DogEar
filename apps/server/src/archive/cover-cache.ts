import { COVER_MAX_BYTES, type CoverStore } from './cover-store.js'

export function coverBodyInit(body: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(body.byteLength)
  copy.set(body)
  return copy.buffer as ArrayBuffer
}

export type CoverLoadResult =
  | { ok: true; body: Uint8Array; contentType: string; cache: 'hit' | 'miss' | 'bypass' }
  | { ok: false; error: string }

function isImageContentType(contentType: string): boolean {
  if (!contentType) return true
  return contentType.startsWith('image/') || contentType.startsWith('application/octet-stream')
}

/**
 * 读封面：本地/R2 命中且 sourceUrl 仍是当前远端地址则直接用；
 * 否则拉远端，成功则写入存储（失败不挡这一次响应）。
 */
export async function loadCoverBytes(input: {
  bookmarkId: string
  sourceUrl: string
  store?: CoverStore
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
}): Promise<CoverLoadResult> {
  const fetchImpl = input.fetchImpl ?? ((url: string, init?: RequestInit) => fetch(url, init))
  if (input.store) {
    try {
      const cached = await input.store.get(input.bookmarkId)
      if (cached && cached.sourceUrl === input.sourceUrl && cached.body.byteLength > 0) {
        return { ok: true, body: cached.body, contentType: cached.contentType, cache: 'hit' }
      }
    } catch {
      // 缓存损坏时回源
    }
  }

  try {
    const upstream = await fetchImpl(input.sourceUrl, {
      headers: { Accept: 'image/*,*/*;q=0.8', 'User-Agent': 'Mozilla/5.0 (compatible; DogEar/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!upstream.ok || !isImageContentType(contentType)) {
      return { ok: false, error: 'Cover fetch failed' }
    }
    const body = new Uint8Array(await upstream.arrayBuffer())
    if (body.byteLength === 0) return { ok: false, error: 'Cover fetch failed' }
    const type = contentType.startsWith('image/') ? contentType : 'image/jpeg'
    if (input.store && body.byteLength <= COVER_MAX_BYTES) {
      try {
        await input.store.put(input.bookmarkId, { body, contentType: type, sourceUrl: input.sourceUrl })
      } catch {
        // 落下失败仍把这次拉到的图返回
      }
    }
    return { ok: true, body, contentType: type, cache: input.store ? 'miss' : 'bypass' }
  } catch {
    return { ok: false, error: 'Cover fetch failed' }
  }
}
