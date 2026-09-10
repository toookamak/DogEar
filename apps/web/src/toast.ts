/**
 * 轻量提示（toast）通道。
 *
 * 设计取舍：不引入状态库——沿用仓库既有约定（undo.ts / org-events.ts 的 CustomEvent），
 * 由 AppShell 挂一个 ToastRegion 订阅，任何位置的代码都能 `showToast(...)`。
 * 提示只承担「结果告知」，撤销仍由状态栏统一承载（避免同一撤销入口出现两处）。
 */

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const EVENT = 'dogear:toast'

let nextId = 1

/** 弹出一条提示。失败类提示停留更久，便于阅读错误详情。 */
export function showToast(kind: ToastKind, message: string) {
  const detail: Toast = { id: nextId++, kind, message }
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail }))
  return detail.id
}

/** 便捷方法：成功 / 失败 / 普通信息 */
export const toast = {
  success: (message: string) => showToast('success', message),
  error: (message: string) => showToast('error', message),
  info: (message: string) => showToast('info', message),
}

export function onToast(handler: (t: Toast) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<Toast>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/** 各类提示的停留时长（毫秒） */
export const TOAST_TTL: Record<ToastKind, number> = {
  success: 3000,
  info: 3500,
  error: 6000,
}

/** 把未知异常转成可读文案，避免直接抛 [object Object] */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
