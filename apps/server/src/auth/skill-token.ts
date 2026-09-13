import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** 工作台生成的 Skill Token 前缀，便于和别的密钥区分 */
export const SKILL_TOKEN_PREFIX = 'de_'

export function hashSkillToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateSkillToken(): string {
  return `${SKILL_TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`
}

/** 长度不同时 timingSafeEqual 会抛；先把两边打成同样长的摘要再比 */
export function tokensEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const left = createHash('sha256').update(a, 'utf8').digest()
  const right = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(left, right)
}

/** settings.get 回的是 { key, value }；种子值可能是 JSON 的空字符串 `""` */
export function readStoredHash(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  const value = (row as { value?: unknown }).value
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed === '""') return ''
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === 'string') return parsed.trim()
  } catch {
    /* 按原始 hex 存 */
  }
  return trimmed
}
