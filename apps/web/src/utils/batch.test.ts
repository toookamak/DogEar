import { describe, expect, it } from 'vitest'
import { BATCH_CHUNK_SIZE, BATCH_CONFIRM_THRESHOLD, chunkIds } from './batch.js'

describe('chunkIds（批量集合操作的分块）', () => {
  it('默认按 50 切块（与服务端 batch 上限 100 对齐、给 Workers 子请求预算留余量）', () => {
    expect(BATCH_CHUNK_SIZE).toBe(50)
  })

  it('超出阈值的批量修改必须先弹影响面确认', () => {
    expect(BATCH_CONFIRM_THRESHOLD).toBe(10)
  })

  it('整除时块数 = 长度 / size，各块长度一致', () => {
    const chunks = chunkIds(Array.from({ length: 100 }, (_, i) => String(i)))
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(50)
    expect(chunks[1][0]).toBe('50')
  })

  it('不整除时最后一块是余数', () => {
    const chunks = chunkIds(['a', 'b', 'c', 'd', 'e'], 2)
    expect(chunks).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  it('小于块大小时返回单块；空数组返回空分块列表', () => {
    expect(chunkIds(['x'])).toEqual([['x']])
    expect(chunkIds([])).toEqual([])
  })

  it('切分不丢不重（2000 条全选 CAP 场景）', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `id-${i}`)
    const chunks = chunkIds(ids)
    const merged = chunks.flat()
    expect(merged).toHaveLength(2000)
    expect(new Set(merged).size).toBe(2000)
    expect(merged[0]).toBe('id-0')
    expect(merged[1999]).toBe('id-1999')
  })

  it('非法块大小直接抛错（静默吞掉会把一次批量拆成无限次请求）', () => {
    expect(() => chunkIds(['a'], 0)).toThrow()
  })
})
