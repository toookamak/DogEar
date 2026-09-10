export type UndoNotice = { undoId: string; message: string }

const EVENT = 'dogear:undo'

export function offerUndo(notice: UndoNotice) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: notice }))
}

export function onUndoOffered(handler: (notice: UndoNotice) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<UndoNotice>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

const DATA_CHANGED_EVENT = 'dogear:data-changed'

/**
 * 通知页面「真源已被外壳改动，请重新拉取」。
 * 用于撤销成功后刷新列表，替代此前的 window.location.reload() 整页刷新。
 */
export function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT))
}

export function onDataChanged(handler: () => void) {
  const listener = () => handler()
  window.addEventListener(DATA_CHANGED_EVENT, listener)
  return () => window.removeEventListener(DATA_CHANGED_EVENT, listener)
}
