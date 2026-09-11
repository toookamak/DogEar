import { describe, expect, it } from 'vitest'
import { isDisabled, scenesForPicker } from './scene-filtering.js'
import type { SceneResponse } from '../types/api.js'

/** 造一个最小 SceneResponse，只填本模块用到的字段 */
function scene(over: Partial<SceneResponse> & { id: string; name: string }): SceneResponse {
  return {
    sortOrder: 0,
    enabled: true,
    aerr: 'reference',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as SceneResponse
}

const ALL = [
  scene({ id: 's1', name: '工作研究', aerr: 'action' }),
  scene({ id: 's2', name: '灵感收集', aerr: 'explore' }),
  scene({ id: 's3', name: '旧场景', enabled: false }),
  scene({ id: 's4', name: '另一个停用', enabled: false }),
]

describe('scenesForPicker —— 挑选器：停用隐藏，已挂保留', () => {
  it('隐藏停用场景', () => {
    const ids = scenesForPicker(ALL).map((s) => s.id)
    expect(ids).toEqual(['s1', 's2'])
  })

  it('保留「该书签已挂」的停用场景——否则看不到也摘不掉', () => {
    const ids = scenesForPicker(ALL, ['s3']).map((s) => s.id)
    expect(ids).toContain('s3')
    expect(ids).toContain('s1')
    expect(ids).not.toContain('s4') // 未挂的停用项仍隐藏
  })

  it('已挂的启用场景不受影响', () => {
    const ids = scenesForPicker(ALL, ['s1']).map((s) => s.id)
    expect(ids).toEqual(['s1', 's2'])
  })

  it('attachedIds 为空或未传时等价', () => {
    expect(scenesForPicker(ALL, []).map((s) => s.id)).toEqual(scenesForPicker(ALL).map((s) => s.id))
  })

  it('标记 attached，便于界面区分', () => {
    const picked = scenesForPicker(ALL, ['s3'])
    expect(picked.find((s) => s.id === 's3')?.attached).toBe(true)
    expect(picked.find((s) => s.id === 's1')?.attached).toBe(false)
  })

  it('enabled 缺省视为启用（契约里 enabled 必填，但历史数据可能缺）', () => {
    const legacy = [scene({ id: 'x', name: '缺字段' })]
    delete (legacy[0] as { enabled?: boolean }).enabled
    expect(scenesForPicker(legacy).map((s) => s.id)).toEqual(['x'])
  })

  it('空列表不报错', () => {
    expect(scenesForPicker([])).toEqual([])
  })
})

describe('isDisabled', () => {
  it('仅 enabled === false 视为停用', () => {
    expect(isDisabled({ enabled: false })).toBe(true)
    expect(isDisabled({ enabled: true })).toBe(false)
    expect(isDisabled({ enabled: undefined })).toBe(false)
  })
})
