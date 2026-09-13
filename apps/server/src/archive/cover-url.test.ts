import { describe, expect, it } from 'vitest'
import { coverFromRaindropExtras, pickCoverUrl } from './cover-url.js'

describe('pickCoverUrl', () => {
  it('skips rdl.ink/render and prefers a real image from media', () => {
    expect(pickCoverUrl([
      'https://rdl.ink/render/https://example.com',
      'https://rd-bg.b-cdn.net/cover.jpg',
    ], 'https://example.com/post')).toBe('https://rd-bg.b-cdn.net/cover.jpg')
  })
})

describe('coverFromRaindropExtras', () => {
  it('uses media when cover is a render page', () => {
    expect(coverFromRaindropExtras({
      cover: 'https://rdl.ink/render/https://example.com',
      media: [{ link: 'https://up.raindrop.io/photo.png' }],
    }, 'https://example.com')).toBe('https://up.raindrop.io/photo.png')
  })
})
