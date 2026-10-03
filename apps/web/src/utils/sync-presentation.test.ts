import { describe, expect, it } from 'vitest'
import { aheadLabel, behindLabel, capsuleCount, latestSyncAt, syncLamp } from './sync-presentation.js'

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

describe('双向差异呈现（aheadLabel / behindLabel / capsuleCount）', () => {
  it('落后为 0 时不渲染 ↓', () => {
    expect(behindLabel({ ahead: 0, behind: 0, behindIsExact: true })).toBe(null)
  })

  it('落后非精确值时显示「至少 N」语义（↓N+），不谎称总数', () => {
    expect(behindLabel({ ahead: 0, behind: 5, behindIsExact: false })).toBe('↓5+')
    expect(behindLabel({ ahead: 0, behind: 5, behindIsExact: true })).toBe('↓5')
  })

  it('探测失败时不渲染 ↓——显示 ↓0 会被读成「远端没有新东西」', () => {
    expect(behindLabel({ ahead: 0, behind: 0, behindIsExact: false, probeError: '未配 Token' })).toBe(null)
    expect(behindLabel(null)).toBe(null)
  })

  it('领先只在 >0 时渲染 ↑N', () => {
    expect(aheadLabel({ ahead: 3, behind: 0, behindIsExact: true })).toBe('↑3')
    expect(aheadLabel({ ahead: 0, behind: 0, behindIsExact: true })).toBe(null)
    expect(aheadLabel(null)).toBe(null)
  })

  it('折叠态计数：待推送优先，其次落后，两侧干净显示待推送数本身', () => {
    expect(capsuleCount(4, { ahead: 2, behind: 8, behindIsExact: true })).toEqual({ text: '4', behind: false })
    expect(capsuleCount(0, { ahead: 2, behind: 8, behindIsExact: true })).toEqual({ text: '↓8', behind: true })
    expect(capsuleCount(0, { ahead: 0, behind: 0, behindIsExact: true })).toEqual({ text: '0', behind: false })
    expect(capsuleCount(null, null)).toEqual({ text: '—', behind: false })
  })

  it('折叠态计数：探测失败时不落入落后分支', () => {
    expect(capsuleCount(0, { ahead: 0, behind: 0, behindIsExact: false, probeError: 'x' })).toEqual({ text: '0', behind: false })
  })
})
