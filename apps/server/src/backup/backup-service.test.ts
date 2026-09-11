import { describe, expect, it } from 'vitest'
import { parseCsv } from './backup-service.js'

describe('parseCsv（备份恢复用的 CSV 解析）', () => {
  const header = 'id,url,title,note,status,tags,scenes,createdAt'

  it('解析基本行', () => {
    const rows = parseCsv(`${header}\nabc,https://a.example.com,标题,备注,saved,t1|t2,s1,1700000000000`)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      id: 'abc',
      url: 'https://a.example.com',
      title: '标题',
      note: '备注',
      status: 'saved',
      tags: 't1|t2',
      scenes: 's1',
      createdAt: '1700000000000',
    })
  })

  it('字段内逗号不被当作分隔（这是不能用 split(",") 的原因）', () => {
    const rows = parseCsv(`${header}\nabc,https://a.example.com,"标题, 带逗号","备注, 也有逗号",saved,,,1`)
    expect(rows[0].title).toBe('标题, 带逗号')
    expect(rows[0].note).toBe('备注, 也有逗号')
  })

  it('字段内换行被保留', () => {
    const rows = parseCsv(`${header}\nabc,https://a.example.com,"第一行\n第二行",,saved,,,1`)
    expect(rows[0].title).toBe('第一行\n第二行')
  })

  it('转义的双引号还原为单个引号', () => {
    const rows = parseCsv(`${header}\nabc,https://a.example.com,"他说""你好""",,saved,,,1`)
    expect(rows[0].title).toBe('他说"你好"')
  })

  it('去掉 UTF-8 BOM（Excel 导出的常见情况）', () => {
    const rows = parseCsv(`\uFEFF${header}\nabc,https://a.example.com,t,,saved,,,1`)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('abc')
  })

  it('兼容 CRLF 行尾', () => {
    const rows = parseCsv(`${header}\r\nabc,https://a.example.com,t,,saved,,,1\r\n`)
    expect(rows).toHaveLength(1)
    expect(rows[0].url).toBe('https://a.example.com')
  })

  it('跳过空行', () => {
    const rows = parseCsv(`${header}\n\nabc,https://a.example.com,t,,saved,,,1\n\n`)
    expect(rows).toHaveLength(1)
  })

  it('缺列时回落为空串而不是 undefined', () => {
    const rows = parseCsv(`${header}\nabc,https://a.example.com`)
    expect(rows[0].title).toBe('')
    expect(rows[0].status).toBe('')
    expect(rows[0].createdAt).toBe('')
  })

  it('表头顺序不同也能正确取值（按名字而非位置）', () => {
    const rows = parseCsv(`url,id,status\nhttps://a.example.com,abc,saved`)
    expect(rows[0].id).toBe('abc')
    expect(rows[0].url).toBe('https://a.example.com')
    expect(rows[0].status).toBe('saved')
  })

  it('只有表头时返回空数组', () => {
    expect(parseCsv(header)).toEqual([])
  })

  it('空输入返回空数组', () => {
    expect(parseCsv('')).toEqual([])
  })
})
