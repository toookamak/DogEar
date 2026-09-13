import { describe, expect, it } from 'vitest'
import { coverBodyInit, loadCoverBytes } from './cover-cache.js'
import { createMemoryCoverStore } from './cover-store.js'

function fakeFetch(body: Uint8Array, contentType: string, status = 200) {
  return (async () => new Response(coverBodyInit(body), { status, headers: { 'content-type': contentType } })) as (input: string, init?: RequestInit) => Promise<Response>
}

describe('loadCoverBytes', () => {
  it('stores on miss and serves from store on hit without fetching again', async () => {
    const store = createMemoryCoverStore()
    const bytes = new Uint8Array([1, 2, 3, 4])
    let fetches = 0
    const fetchImpl = (async () => {
      fetches += 1
      return new Response(coverBodyInit(bytes), { status: 200, headers: { 'content-type': 'image/png' } })
    }) as (input: string, init?: RequestInit) => Promise<Response>

    const miss = await loadCoverBytes({
      bookmarkId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sourceUrl: 'https://cdn.example.com/a.png',
      store,
      fetchImpl,
    })
    expect(miss).toMatchObject({ ok: true, cache: 'miss', contentType: 'image/png' })
    expect(fetches).toBe(1)

    const hit = await loadCoverBytes({
      bookmarkId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sourceUrl: 'https://cdn.example.com/a.png',
      store,
      fetchImpl,
    })
    expect(hit).toMatchObject({ ok: true, cache: 'hit' })
    expect(fetches).toBe(1)
  })

  it('refetches when the remote cover URL changes', async () => {
    const store = createMemoryCoverStore()
    const fetchImpl = fakeFetch(new Uint8Array([9]), 'image/jpeg')
    await loadCoverBytes({
      bookmarkId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      sourceUrl: 'https://cdn.example.com/old.jpg',
      store,
      fetchImpl,
    })
    let fetches = 0
    const nextFetch = (async () => {
      fetches += 1
      return new Response(new Blob([new Uint8Array([8, 8])]), { status: 200, headers: { 'content-type': 'image/webp' } })
    }) as (input: string, init?: RequestInit) => Promise<Response>
    const result = await loadCoverBytes({
      bookmarkId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      sourceUrl: 'https://cdn.example.com/new.webp',
      store,
      fetchImpl: nextFetch,
    })
    expect(result).toMatchObject({ ok: true, cache: 'miss', contentType: 'image/webp' })
    expect(fetches).toBe(1)
  })

  it('rejects non-image responses', async () => {
    const result = await loadCoverBytes({
      bookmarkId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      sourceUrl: 'https://example.com/page',
      fetchImpl: fakeFetch(new Uint8Array([1]), 'text/html'),
    })
    expect(result).toEqual({ ok: false, error: 'Cover fetch failed' })
  })
})
