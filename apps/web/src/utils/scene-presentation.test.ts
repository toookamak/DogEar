import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRESENTATION,
  isAerr,
  nextSortOnSceneChange,
  presentationForAerr,
  shouldApplySceneSort,
} from './scene-presentation.js'

describe('presentationForAerr', () => {
  it('四种原型各有呈现配置', () => {
    for (const aerr of ['action', 'explore', 'read', 'reference'] as const) {
      const p = presentationForAerr(aerr)
      expect(p.primaryAction).toBeTruthy()
      expect(['recent', 'title', 'domain']).toContain(p.defaultSort)
      expect(['cozy', 'compact']).toContain(p.density)
    }
  })

  it('Reference 偏检索：按标题排序且密度紧凑', () => {
    const p = presentationForAerr('reference')
    expect(p.defaultSort).toBe('title')
    expect(p.density).toBe('compact')
  })

  it('Action / Explore / Read 按最近加入、正常密度', () => {
    for (const aerr of ['action', 'explore', 'read'] as const) {
      expect(presentationForAerr(aerr).defaultSort).toBe('recent')
      expect(presentationForAerr(aerr).density).toBe('cozy')
    }
  })

  it('四个主操作文案互不相同（同一屏能看出差别）', () => {
    const actions = (['action', 'explore', 'read', 'reference'] as const).map(
      (aerr) => presentationForAerr(aerr).primaryAction,
    )
    expect(new Set(actions).size).toBe(4)
  })

  it('未知或缺失取值回退到默认呈现，不抛错', () => {
    for (const bad of [null, undefined, '', 'Action', 'unknown', 42, {}]) {
      expect(presentationForAerr(bad)).toEqual(DEFAULT_PRESENTATION)
    }
  })

  it('呈现配置不泄漏 AERR 词汇——界面不展示这四个词（PRD §2.0.3）', () => {
    for (const aerr of ['action', 'explore', 'read', 'reference'] as const) {
      const p = presentationForAerr(aerr)
      // 只检查会显示给用户的值（主操作文案、密度、排序键），
      // 不检查键名——键名 primaryAction 本身含 "action" 字样，属误报。
      const shownValues = [p.primaryAction, p.density, p.defaultSort].join(' ').toLowerCase()
      for (const word of ['action', 'explore', 'read', 'reference']) {
        expect(shownValues).not.toContain(word)
      }
    }
  })
})

describe('isAerr', () => {
  it('只接受四个小写原型值', () => {
    expect(isAerr('action')).toBe(true)
    expect(isAerr('reference')).toBe(true)
    expect(isAerr('Action')).toBe(false)
    expect(isAerr('')).toBe(false)
    expect(isAerr(null)).toBe(false)
    expect(isAerr(123)).toBe(false)
  })
})

describe('shouldApplySceneSort', () => {
  it('从无 Scene 进入某 Scene 时应应用默认排序', () => {
    expect(shouldApplySceneSort('scene-a', null)).toBe(true)
    expect(shouldApplySceneSort('scene-a', undefined)).toBe(true)
    expect(shouldApplySceneSort('scene-a', '')).toBe(true)
  })

  it('切换到另一个 Scene 时应用', () => {
    expect(shouldApplySceneSort('scene-b', 'scene-a')).toBe(true)
  })

  it('停留在同一 Scene 时不再应用——避免覆盖用户手动选的排序', () => {
    expect(shouldApplySceneSort('scene-a', 'scene-a')).toBe(false)
  })

  it('退出 Scene 视图（清空筛选）时不应用', () => {
    expect(shouldApplySceneSort(null, 'scene-a')).toBe(false)
    expect(shouldApplySceneSort('', 'scene-a')).toBe(false)
    expect(shouldApplySceneSort(null, null)).toBe(false)
  })
})

describe('nextSortOnSceneChange', () => {
  const reference = presentationForAerr('reference') // defaultSort: title
  const action = presentationForAerr('action') // defaultSort: recent

  it('进入某 Scene 时采用该 Scene 原型的默认排序', () => {
    expect(nextSortOnSceneChange('scene-ref', null, reference)).toBe('title')
    expect(nextSortOnSceneChange('scene-act', null, action)).toBe('recent')
  })

  it('切换到另一个 Scene 时采用新 Scene 的排序', () => {
    expect(nextSortOnSceneChange('scene-ref', 'scene-act', reference)).toBe('title')
  })

  it('停留在同一 Scene 时返回 null——不覆盖用户手动选的排序', () => {
    expect(nextSortOnSceneChange('scene-ref', 'scene-ref', reference)).toBeNull()
  })

  it('离开 Scene 视图时回到默认排序（否则会停在场景带来的排序上）', () => {
    expect(nextSortOnSceneChange(null, 'scene-ref', DEFAULT_PRESENTATION)).toBe(DEFAULT_PRESENTATION.defaultSort)
    expect(nextSortOnSceneChange('', 'scene-act', DEFAULT_PRESENTATION)).toBe(DEFAULT_PRESENTATION.defaultSort)
  })

  it('本来就不在 Scene 视图时不干预排序', () => {
    expect(nextSortOnSceneChange(null, null, DEFAULT_PRESENTATION)).toBeNull()
    expect(nextSortOnSceneChange('', undefined, DEFAULT_PRESENTATION)).toBeNull()
  })
})
