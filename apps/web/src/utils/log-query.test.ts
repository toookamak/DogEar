import { describe, expect, it } from 'vitest'
import { LOG_PAGE_SIZE, actionsPresent, countByAction, filterLogs, paginateLogs } from './log-query.js'
import type { OperationLogResponse } from '../types/api.js'

function log(over: Partial<OperationLogResponse> & { id: string }): OperationLogResponse {
  return {
    actor: 'user',
    action: 'update',
    targetType: 'bookmark',
    targetId: '11111111-1111-4111-8111-111111111111',
    detail: null,
    createdAt: 1760000000000,
    ...over,
  } as OperationLogResponse
}

const SAMPLE: OperationLogResponse[] = [
  log({ id: '1', action: 'create', detail: '新增一条' }),
  log({ id: '2', action: 'delete', detail: '移入回收站' }),
  log({ id: '3', action: 'update', actor: 'agent', detail: null }),
  log({
    id: '4', action: 'sync', targetType: 'sync_queue',
    targetId: '22222222-2222-4222-8222-222222222222', detail: '通道推送',
  }),
]

describe('filterLogs', () => {
  it('空关键词返回全部（含仅空白）', () => {
    expect(filterLogs(SAMPLE, '')).toHaveLength(4)
    expect(filterLogs(SAMPLE, '   ')).toHaveLength(4)
  })

  it('按动作匹配', () => {
    expect(filterLogs(SAMPLE, 'delete').map((l) => l.id)).toEqual(['2'])
  })

  it('按详情匹配（detail 为 null 不报错）', () => {
    expect(filterLogs(SAMPLE, '回收站').map((l) => l.id)).toEqual(['2'])
    expect(filterLogs(SAMPLE, '通道').map((l) => l.id)).toEqual(['4'])
  })

  it('按操作者匹配', () => {
    expect(filterLogs(SAMPLE, 'agent').map((l) => l.id)).toEqual(['3'])
  })

  it('按对象类型与 id 匹配（默认 id 三条相同、第四条不同）', () => {
    expect(filterLogs(SAMPLE, 'sync_queue').map((l) => l.id)).toEqual(['4'])
    expect(filterLogs(SAMPLE, '1111-4111').map((l) => l.id)).toEqual(['1', '2', '3'])
  })

  it('大小写不敏感', () => {
    expect(filterLogs(SAMPLE, 'AGENT').map((l) => l.id)).toEqual(['3'])
    expect(filterLogs(SAMPLE, 'Sync_Queue').map((l) => l.id)).toEqual(['4'])
  })

  it('无匹配返回空数组', () => {
    expect(filterLogs(SAMPLE, '绝无此物')).toEqual([])
  })

  it('空列表不报错', () => {
    expect(filterLogs([], 'x')).toEqual([])
  })

  it('不修改入参', () => {
    const before = SAMPLE.slice()
    filterLogs(SAMPLE, 'delete')
    expect(SAMPLE).toEqual(before)
  })
})

describe('paginateLogs', () => {
  const many = Array.from({ length: 45 }, (_, i) => log({ id: String(i + 1) }))

  it('按页大小切割', () => {
    const p = paginateLogs(many, 0, 20)
    expect(p.items).toHaveLength(20)
    expect(p.items[0].id).toBe('1')
    expect(p.pageCount).toBe(3)
  })

  it('末页只含剩余条目', () => {
    const p = paginateLogs(many, 2, 20)
    expect(p.items).toHaveLength(5)
    expect(p.items[0].id).toBe('41')
  })

  it('页码超出范围时收敛到最后一页（不出现空白页）', () => {
    const p = paginateLogs(many, 99, 20)
    expect(p.page).toBe(2)
    expect(p.items).toHaveLength(5)
  })

  it('负数页码收敛到第一页', () => {
    expect(paginateLogs(many, -3, 20).page).toBe(0)
  })

  it('空列表仍报 1 页（界面显示「1 / 1」而非「0 / 0」）', () => {
    const p = paginateLogs([], 0, 20)
    expect(p.items).toEqual([])
    expect(p.pageCount).toBe(1)
    expect(p.page).toBe(0)
  })

  it('非法页大小回退到默认值', () => {
    expect(paginateLogs(many, 0, 0).items).toHaveLength(LOG_PAGE_SIZE)
    expect(paginateLogs(many, 0, Number.NaN).items).toHaveLength(LOG_PAGE_SIZE)
  })

  it('中间页正确', () => {
    const p = paginateLogs(many, 1, 20)
    expect(p.items[0].id).toBe('21')
    expect(p.items).toHaveLength(20)
  })
})

describe('countByAction / actionsPresent', () => {
  it('按动作计数', () => {
    expect(countByAction(SAMPLE)).toEqual({ create: 1, delete: 1, update: 1, sync: 1 })
  })

  it('同类动作累加', () => {
    expect(countByAction([log({ id: 'a', action: 'update' }), log({ id: 'b', action: 'update' })]))
      .toEqual({ update: 2 })
  })

  it('空列表返回空对象与空数组', () => {
    expect(countByAction([])).toEqual({})
    expect(actionsPresent([])).toEqual([])
  })

  it('actionsPresent 只列出真实出现过的动作', () => {
    const present = actionsPresent(SAMPLE).sort()
    expect(present).toEqual(['create', 'delete', 'sync', 'update'])
    // 未出现的动作不应在列表中（避免界面上一排点了没结果的 chips）
    expect(present).not.toContain('purge')
  })
})
