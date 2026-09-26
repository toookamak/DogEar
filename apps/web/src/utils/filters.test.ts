import { describe, expect, it } from 'vitest'
import {
  buildListParams, createdRangeToParam, activeFilterCount, hasActiveFilters,
  CREATED_RANGES, EMPTY_FILTERS, type WorkbenchFilters,
} from './filters.js'

describe('createdRangeToParam', () => {
  const now = new Date('2026-09-26T08:00:00.000Z')

  it('maps presets to createdFrom instants', () => {
    expect(createdRangeToParam('7d', now)).toBe('2026-09-19T08:00:00.000Z')
    expect(createdRangeToParam('30d', now)).toBe('2026-08-27T08:00:00.000Z')
    expect(createdRangeToParam('year', now)).toBe('2025-09-26T08:00:00.000Z')
  })

  it('returns undefined for the empty preset and unknown values', () => {
    expect(createdRangeToParam('', now)).toBeUndefined()
    expect(createdRangeToParam('bogus' as WorkbenchFilters['createdRange'], now)).toBeUndefined()
  })
})

describe('activeFilterCount / hasActiveFilters', () => {
  it('counts only set dimensions (search term excluded from the count)', () => {
    const filters: WorkbenchFilters = { ...EMPTY_FILTERS, status: 'saved', important: 'true', q: '关键词' }
    expect(activeFilterCount(filters)).toBe(2)
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('empty filters have no active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('search term alone counts as an active filter for the clear-exit path', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: ' ' })).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'vite' })).toBe(true)
  })
})

describe('buildListParams', () => {
  it('keeps inbox requests minimal regardless of filters', () => {
    const params = buildListParams({ ...EMPTY_FILTERS, status: 'saved', tagId: 't1', q: 'x' }, 'important', true)
    expect(params).toEqual({ sort: 'important' })
  })

  it('passes dimensions, presets and sort through', () => {
    const now = new Date('2026-09-26T08:00:00.000Z')
    const filters: WorkbenchFilters = {
      q: 'vite', status: 'saved', sceneId: 's1', folderId: 'f1', tagId: 't1', source: 'page',
      important: 'true', createdRange: '30d', navVisible: 'false',
    }
    const params = buildListParams(filters, 'important', false, now)
    expect(params).toMatchObject({
      sort: 'important', status: 'saved', sceneId: 's1', folderId: 'f1', tagId: 't1',
      source: 'page', important: 'true', navVisible: 'false', q: 'vite',
    })
    expect(typeof params.createdFrom).toBe('string')
    expect(params.createdFrom).toBe(createdRangeToParam('30d', now))
  })

  it('omits unset dimensions entirely (no undefined-string leakage)', () => {
    const params = buildListParams(EMPTY_FILTERS, 'recent', false)
    expect(params).toEqual({ sort: 'recent' })
    expect('important' in params).toBe(false)
    expect('navVisible' in params).toBe(false)
    expect('createdFrom' in params).toBe(false)
  })

  it('trims the search term', () => {
    const params = buildListParams({ ...EMPTY_FILTERS, q: '  react  ' }, 'recent', false)
    expect(params.q).toBe('react')
  })

  it('exposes the four time presets used by the filter popup', () => {
    expect(CREATED_RANGES.map((entry) => entry.value)).toEqual(['', '7d', '30d', 'year'])
  })
})
