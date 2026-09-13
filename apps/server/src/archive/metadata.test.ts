import { describe, expect, it } from 'vitest'
import { parseHtmlMetadata } from './metadata.js'

describe('parseHtmlMetadata', () => {
  it('reads og tags when content comes before property', () => {
    const html = `
      <html><head>
        <meta content="倒序标题" property="og:title">
        <meta content="倒序简介" property="og:description">
        <meta content="https://cdn.example.com/cover.jpg" property="og:image">
        <title>标签标题</title>
      </head></html>
    `
    const meta = parseHtmlMetadata(html, 'https://example.com/post')
    expect(meta).toMatchObject({
      title: '倒序标题',
      description: '倒序简介',
      image: 'https://cdn.example.com/cover.jpg',
      domain: 'example.com',
    })
  })

  it('falls back to title and name=description', () => {
    const html = `<html><head><title>  仅标题  </title><meta name="description" content="普通简介"></head></html>`
    expect(parseHtmlMetadata(html, 'https://news.example.org/a')).toMatchObject({
      title: '仅标题',
      description: '普通简介',
      domain: 'news.example.org',
    })
  })
})
