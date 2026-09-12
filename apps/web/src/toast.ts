/**
 * 轻量提示（toast）通道。
 *
 * 设计取舍：不引入状态库——沿用仓库既有约定（undo.ts / org-events.ts 的 CustomEvent），
 * 由 AppShell 挂一个 ToastRegion 订阅，任何位置的代码都能 `showToast(...)`。
 * 撤销入口（2026-09-12 用户拍板）：Toast 与状态栏**双入口、共用同一撤销逻辑**——
 * 可撤销操作在弹提示时带上 undoId，Toast 直接给「撤销」按钮（动作后最想撤销的
 * 时刻就是当下）；状态栏撤销保留作兜底。
 */

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  /** 存在时渲染「撤销」按钮（ToastRegion 内调 revert + notifyDataChanged） */
  undoId?: string
}

const EVENT = 'dogear:toast'

let nextId = 1

/** 弹出一条提示。失败类提示停留更久，便于阅读错误详情。 */
export function showToast(kind: ToastKind, message: string, opts?: { undoId?: string }) {
  const detail: Toast = { id: nextId++, kind, message, undoId: opts?.undoId }
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail }))
  return detail.id
}

/** 便捷方法：成功 / 失败 / 普通信息 / 可撤销的成功提示 */
export const toast = {
  success: (message: string) => showToast('success', message),
  error: (message: string) => showToast('error', message),
  info: (message: string) => showToast('info', message),
  undoable: (message: string, undoId: string) => showToast('success', message, { undoId }),
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
