import type { ApiError } from '../types/api.js'

const BASE = ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  })
  if (res.status === 401) {
    const next = window.location.pathname + window.location.search
    window.location.href = next && next !== '/login' ? `/login?next=${encodeURIComponent(next)}` : '/login'
    throw new Error('Unauthorized')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body as ApiError
    throw new Error(err?.error?.message ?? `Request failed: ${res.status}`)
  }
  return body as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | undefined>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]).toString() : ''
    return request<T>(path + qs)
  },
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}