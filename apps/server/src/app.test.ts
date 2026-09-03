import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

function repository() {
  const records: Array<{ id: string; url: string; status: 'unread' }> = []
  return {
    records,
    create: async (record: { id: string; url: string; status: 'unread' }) => {
      records.push(record)
      return record
    },
    list: async () => records,
  }
}

describe('bookmark API', () => {
  it('creates a bookmark and lists it', async () => {
    const repo = repository()
    const app = createApp(repo)
    const response = await app.request('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/article' }),
    })

    expect(response.status).toBe(201)
    const created = await response.json()
    expect(created.url).toBe('https://example.com/article')
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect((await (await app.request('/api/bookmarks')).json())).toHaveLength(1)
  })
})
