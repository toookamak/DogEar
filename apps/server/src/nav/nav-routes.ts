import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import type { BookmarkRepository } from '@dogear/db'
import { evaluateNavFeed } from './evaluator.js'

const NAV_MODES = new Set(['all', 'rule', 'search', 'hide'])
const RULE_STATUSES = new Set(['unread', 'saved', 'archived'])

/**
 * 归一并校验规则条件（POST/PATCH 共用）：
 * - rule 接受对象或 JSON 字符串，统一存为 JSON 字符串（此前 PATCH 传对象会直接落库报错）；
 * - 字段形状收紧：sceneIds/folderIds/tagIds 必须是字符串数组，status 必须是三态枚举。
 */
function parseRuleBody(rule: unknown): { error?: string; json?: string } {
  if (rule === undefined || rule === null) return {}
  let obj: unknown = rule
  if (typeof rule === 'string') {
    try {
      obj = JSON.parse(rule)
    } catch {
      return { error: 'rule must be valid JSON' }
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { error: 'rule must be a JSON object' }
  }
  const payload = obj as Record<string, unknown>
  for (const key of ['sceneIds', 'folderIds', 'tagIds'] as const) {
    const value = payload[key]
    if (value !== undefined && (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))) {
      return { error: `${key} must be an array of strings` }
    }
  }
  if (payload.status !== undefined && !RULE_STATUSES.has(String(payload.status))) {
    return { error: 'status must be unread/saved/archived' }
  }
  return { json: JSON.stringify(payload) }
}

function toNavItem(bookmark: Record<string, unknown>) {
  return {
    id: bookmark.id,
    title: bookmark.title ?? null,
    favicon: bookmark.favicon ?? null,
    url: bookmark.url,
    domain: bookmark.domain ?? null,
  }
}

function asRecord(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {}
  const record = row as Record<string, unknown>
  if (record.bookmarks && typeof record.bookmarks === 'object') return record.bookmarks as Record<string, unknown>
  return record
}

export function createNavRoutes(repository: BookmarkRepository) {
  const app = new Hono()

  app.get('/rules', async (c) => {
    const rules = await repository.navRules.list()
    return c.json({ items: rules })
  })

  app.post('/rules', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
    if (!body.name || typeof body.name !== 'string') {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name required' } }, 400)
    }
    const mode = typeof body.mode === 'string' ? body.mode : 'all'
    if (!NAV_MODES.has(mode)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `mode must be one of ${[...NAV_MODES].join('/')}` } }, 400)
    }
    const parsedRule = parseRuleBody(body.rule)
    if (parsedRule.error) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsedRule.error } }, 400)
    }
    const now = new Date()
    const rule = await repository.navRules.create({
      id: randomUUID(),
      name: body.name,
      mode,
      rule: parsedRule.json,
      searchQuery: typeof body.searchQuery === 'string' ? body.searchQuery : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    })
    return c.json(rule, 201)
  })

  app.patch('/rules/:id', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
    const data: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name must be a non-empty string' } }, 400)
      }
      data.name = body.name
    }
    if (body.mode !== undefined) {
      if (typeof body.mode !== 'string' || !NAV_MODES.has(body.mode)) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: `mode must be one of ${[...NAV_MODES].join('/')}` } }, 400)
      }
      data.mode = body.mode
    }
    if (body.rule !== undefined) {
      const parsedRule = parseRuleBody(body.rule)
      if (parsedRule.error) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: parsedRule.error } }, 400)
      }
      data.rule = parsedRule.json ?? null
    }
    if (body.searchQuery !== undefined) {
      data.searchQuery = typeof body.searchQuery === 'string' ? body.searchQuery : null
    }
    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== 'number') {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'sortOrder must be a number' } }, 400)
      }
      data.sortOrder = body.sortOrder
    }
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)
    const rule = await repository.navRules.update(c.req.param('id'), data)
    if (!rule) return c.json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }, 404)
    return c.json(rule)
  })

  app.delete('/rules/:id', async (c) => {
    await repository.navRules.remove(c.req.param('id'))
    return c.json({ ok: true })
  })

  /**
   * @deprecated v1.6 起被 `GET /api/nav/feed`（按规则求值）取代。
   * 保留仅为兼容（用户拍板：过时端点标注保留、不粗暴清理）——不做规则求值，
   * 固定投影「非私密且非 unread」；**勿新增依赖**，新代码一律走 /feed。
   */
  app.get('/bookmarks', async (c) => {
    const limit = Number(c.req.query('limit') ?? 50)
    const cursor = c.req.query('cursor') || undefined
    const result = await repository.list({ private: false, excludeStatus: 'unread' }, Number.isFinite(limit) ? limit : 50, cursor)
    return c.json({
      items: (result.items || []).map((row) => toNavItem(asRecord(row))),
      nextCursor: result.nextCursor,
    })
  })

  /**
   * v1.6：按 nav_rules 求值后的导航展示集合（逐步圈定语义见 evaluator.ts）。
   * 投影字段与旧 /bookmarks 一致（id/title/favicon/url/domain，不外带 note）。
   * 分页用 offset 游标（集合在内存中，keyset 无从谈起，基线 600 条内无压力）。
   */
  app.get('/feed', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200)
    const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)
    const records = await evaluateNavFeed(repository)
    const page = records.slice(offset, offset + limit)
    const nextCursor = offset + limit < records.length ? String(offset + limit) : null
    return c.json({
      items: page.map((row) => toNavItem(row)),
      nextCursor,
    })
  })

  app.get('/recent', async (c) => {
    const limit = Number(c.req.query('limit') ?? 20)
    const items = await repository.listRecentOpened(Number.isFinite(limit) ? limit : 20)
    return c.json({ items: items.map((row) => toNavItem(asRecord(row))) })
  })

  return app
}
