import { describe, expect, it } from 'vitest'
import { bookmarkSchema } from './bookmark.js'

describe('bookmarkSchema', () => {
  it('accepts a valid bookmark and defaults status to unread', () => {
    const result = bookmarkSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      url: 'https://example.com/article',
    })

    expect(result.status).toBe('unread')
  })

  it('rejects an invalid URL', () => {
    expect(() =>
      bookmarkSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'not-a-url',
      }),
    ).toThrow()
  })
})
