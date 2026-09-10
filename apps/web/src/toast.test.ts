import { describe, expect, it } from 'vitest'
import { errorMessage, TOAST_TTL } from './toast.js'

describe('errorMessage', () => {
  it('取 Error 的 message', () => {
    expect(errorMessage(new Error('版本冲突'), '兜底')).toBe('版本冲突')
  })

  it('Error 但 message 为空时用兜底文案', () => {
    expect(errorMessage(new Error(''), '兜底文案')).toBe('兜底文案')
  })

  it('字符串直接使用', () => {
    expect(errorMessage('网络错误', '兜底')).toBe('网络错误')
  })

  it('空字符串、null、undefined 一律用兜底', () => {
    expect(errorMessage('', '兜底')).toBe('兜底')
    expect(errorMessage(null, '兜底')).toBe('兜底')
    expect(errorMessage(undefined, '兜底')).toBe('兜底')
  })

  it('非 Error 对象不产生 [object Object]', () => {
    expect(errorMessage({ code: 500 }, '兜底')).toBe('兜底')
    expect(errorMessage(42, '兜底')).toBe('兜底')
  })
})

describe('TOAST_TTL', () => {
  it('失败提示停留时间最长，确保错误可读', () => {
    expect(TOAST_TTL.error).toBeGreaterThan(TOAST_TTL.success)
    expect(TOAST_TTL.error).toBeGreaterThan(TOAST_TTL.info)
  })

  it('所有类型都有正的停留时长', () => {
    for (const kind of ['success', 'error', 'info'] as const) {
      expect(TOAST_TTL[kind]).toBeGreaterThan(0)
    }
  })
})
