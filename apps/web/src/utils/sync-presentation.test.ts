import { describe, expect, it } from 'vitest'
import { latestSyncAt, syncLamp } from './sync-presentation.js'

describe('syncLamp', () => {
  it('同步中优先于其他一切（包括失败与积压）', () => {
    expect(syncLamp(true, 5, 9, true)).toBe('syncing')
  })

  it('队列里有推不过去的条目即报错', () => {
    expect(syncLamp(false, 1, 0)).toBe('err')
  })

  it('上次操作失败也报错（本地无通道被 400 拦下即此态）', () => {
    expect(syncLamp(false, 0, 0, true)).toBe('err')
  })

  it('无失败但有积压报黄', () => {
    expect(syncLamp(false, 0, 3)).toBe('warn')
  })

  it('全清报绿；pendingPush 未知（null）不应误报黄', () => {
    expect(syncLamp(false, 0, 0)).toBe('ok')
    expect(syncLamp(false, 0, null)).toBe('ok')
  })
})

describe('latestSyncAt', () => {
  it('两侧都无记录 → null（渲染为「从未」）', () => {
    expect(latestSyncAt(null, null)).toBeNull()
    expect(latestSyncAt(undefined, undefined)).toBeNull()
  })

  it('只拉取过也要给出时间（回归：初版只读推送时间，点完拉取仍显示「从未」）', () => {
    expect(latestSyncAt(null, 1_780_000_000_000)).toBe(1_780_000_000_000)
  })

  it('只推送过也能给出时间', () => {
    expect(latestSyncAt(1_780_000_000_000, null)).toBe(1_780_000_000_000)
  })

  it('两侧都有取较晚的一次', () => {
    expect(latestSyncAt(100, 200)).toBe(200)
    expect(latestSyncAt(300, 200)).toBe(300)
  })
})
