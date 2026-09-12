import { describe, expect, it } from 'vitest'
import {
  BACKUP_TIER_HINT,
  BACKUP_TIER_LABELS,
  QUEUE_STATUS_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  formatAgo,
  formatBytes,
  formatDateTime,
  label,
} from './format.js'

describe('label', () => {
  it('映射已知取值', () => {
    expect(label(STATUS_LABELS, 'unread')).toBe('待处理')
    expect(label(STATUS_LABELS, 'saved')).toBe('已确认')
    expect(label(SOURCE_LABELS, 'agent')).toBe('Agent')
  })

  it('未知取值原样返回，便于发现契约新增枚举', () => {
    expect(label(STATUS_LABELS, 'brand_new')).toBe('brand_new')
  })

  it('空值显示占位符', () => {
    expect(label(STATUS_LABELS, null)).toBe('—')
    expect(label(STATUS_LABELS, undefined)).toBe('—')
    expect(label(STATUS_LABELS, '')).toBe('—')
  })
})

describe('formatBytes', () => {
  it('按量级选择单位', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.00 MB')
  })

  it('空值显示占位符（备份未完成时 fileSize 为 null）', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })

  it('1023 与 1024 的分界不发生单位跳变错误', () => {
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
  })
})

describe('formatDateTime', () => {
  it('接受毫秒时间戳', () => {
    const out = formatDateTime(0)
    expect(typeof out).toBe('string')
    expect(out).not.toBe('—')
  })

  it('接受 ISO 字符串（API 在 D1 上返回 ISO）', () => {
    const out = formatDateTime('2026-09-10T14:01:51.019Z')
    expect(out).not.toBe('—')
    expect(out).not.toContain('T')
  })

  it('空值显示占位符', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })

  it('无法解析的字符串原样返回，不抛错', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('formatAgo', () => {
  it('空值表示从未发生', () => {
    expect(formatAgo(null)).toBe('从未')
    expect(formatAgo(undefined)).toBe('从未')
  })

  it('按距今时长分档', () => {
    const now = Date.now()
    expect(formatAgo(now)).toBe('刚刚')
    expect(formatAgo(now - 5 * 60_000)).toBe('5 分钟前')
    expect(formatAgo(now - 3 * 3600_000)).toBe('3 小时前')
    expect(formatAgo(now - 2 * 86400_000)).toBe('2 天前')
  })

  it('未来时间回退为具体时间，不显示负数', () => {
    const future = Date.now() + 3600_000
    const out = formatAgo(future)
    expect(out).not.toContain('-')
    expect(out).not.toMatch(/分钟前|小时前|天前/)
  })
})

describe('标签映射覆盖契约枚举', () => {
  // 这些映射是展示层与 packages/shared 契约的接缝：枚举新增而映射漏配时，
  // label() 会退化成显示英文原值。此处锁定必须存在的键。
  it('状态三态齐全', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(['archived', 'saved', 'unread'])
  })

  it('来源四态齐全（v1.8 起含拉回侧 raindrop）', () => {
    expect(Object.keys(SOURCE_LABELS).sort()).toEqual(['agent', 'extension', 'page', 'raindrop'])
  })

  it('同步队列四态齐全', () => {
    expect(Object.keys(QUEUE_STATUS_LABELS).sort()).toEqual(['failed', 'pending', 'processing', 'succeeded'])
  })

  it('备份三档均有标签与说明', () => {
    for (const tier of ['light', 'medium', 'full']) {
      expect(BACKUP_TIER_LABELS[tier]).toBeTruthy()
      expect(BACKUP_TIER_HINT[tier]).toBeTruthy()
    }
  })
})
