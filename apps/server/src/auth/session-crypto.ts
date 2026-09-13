/**
 * Web Crypto 会话签名（Workers / Bun / Node 18+ 通用，避免 node:crypto 进 Worker 图）。
 * Cookie 形态与旧版一致：`${unixMs}.${hmacSha256Base64Url}`，线上会话可继续用。
 */
const enc = new TextEncoder()

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacSha256(password: string, payload: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', key, enc.encode(payload))
}

export async function signSession(timestamp: number, password: string): Promise<string> {
  const payload = `${timestamp}`
  const signature = bytesToBase64Url(await hmacSha256(password, payload))
  return `${payload}.${signature}`
}

export async function hasValidSession(
  value: string | undefined,
  password: string,
  now: () => number,
  ttl: number,
  revoked: Set<string>,
): Promise<boolean> {
  if (!value || revoked.has(value)) return false
  const [timestampValue, signature] = value.split('.')
  const timestamp = Number(timestampValue)
  if (!Number.isSafeInteger(timestamp) || !signature || now() - timestamp < 0 || now() - timestamp > ttl * 1000) {
    return false
  }
  const expected = new Uint8Array(await hmacSha256(password, timestampValue))
  const actual = base64UrlToBytes(signature)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}

export function newId(): string {
  return crypto.randomUUID()
}
