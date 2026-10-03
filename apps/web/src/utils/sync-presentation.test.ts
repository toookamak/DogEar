import { describe, expect, it } from 'vitest'
import { aheadBreakdownText, aheadLabel, behindLabel, capsuleFolded, latestSyncAt, syncLamp } from './sync-presentation.js'

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

describe('双向差异呈现（aheadLabel / behindLabel / capsuleFolded / aheadBreakdownText）', () => {
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

  it('折叠态：失败压过一切（红色失败数是唯一显示，界面稿 v0.3）', () => {
    const folded = capsuleFolded(2, 5, { ahead: 5, behind: 8, behindIsExact: true })
    expect(folded).toEqual({ parts: [{ text: '失败 2', kind: 'failed' }], synced: false })
  })

  it('折叠态：两侧都有 → 双计数并排；只有一侧 → 只显示那一侧', () => {
    expect(capsuleFolded(0, 3, { ahead: 3, behind: 8, behindIsExact: true })).toEqual({
      parts: [
        { text: '↑3', kind: 'ahead' },
        { text: '↓8', kind: 'behind' },
      ],
      synced: false,
    })
    expect(capsuleFolded(0, 0, { ahead: 2, behind: 0, behindIsExact: true }).parts).toEqual([{ text: '↑2', kind: 'ahead' }])
    expect(capsuleFolded(0, 0, { ahead: 0, behind: 8, behindIsExact: false }).parts).toEqual([{ text: '↓8+', kind: 'behind' }])
  })

  it('折叠态：两侧皆 0 → 已同步（没事不占视觉）', () => {
    expect(capsuleFolded(0, 0, { ahead: 0, behind: 0, behindIsExact: true })).toEqual({ parts: [], synced: true })
  })

  it('折叠态：探测失败时显示「未知」而不是已同步——不知道就不能宣布一致', () => {
    expect(capsuleFolded(0, 0, { ahead: 0, behind: 0, behindIsExact: false, probeError: '超时' })).toEqual({
      parts: [{ text: '未知', kind: 'unknown' }],
      synced: false,
    })
  })

  it('领先明细：只列非零类目，空/未取回返回 null', () => {
    expect(aheadBreakdownText(undefined)).toBe(null)
    expect(aheadBreakdownText({ tags: 0, folder: 0, title: 0, note: 0, other: 0 })).toBe(null)
    expect(aheadBreakdownText({ tags: 8, folder: 4, title: 0, note: 2, other: 0 })).toBe('8 条改标签 · 4 条改收藏夹 · 2 条改备注')
    expect(aheadBreakdownText({ tags: 0, folder: 1, title: 0, note: 0, other: 3 })).toBe('1 条改收藏夹 · 3 条其它')
  })
})
