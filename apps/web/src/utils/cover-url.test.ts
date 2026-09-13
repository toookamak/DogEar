import { describe, expect, it } from 'vitest'
import { resolveCoverUrl } from './cover-url.js'

describe('resolveCoverUrl', () => {
  it('resolves relative og:image against the page URL', () => {
    expect(resolveCoverUrl('/img/og.png', 'https://example.com/post')).toBe('https://example.com/img/og.png')
  })
  it('keeps absolute https', () => {
    expect(resolveCoverUrl('https://cdn.example/a.jpg', 'https://example.com')).toBe('https://cdn.example/a.jpg')
  })
  it('returns null for empty', () => {
    expect(resolveCoverUrl('  ', 'https://example.com')).toBeNull()
  })
})
