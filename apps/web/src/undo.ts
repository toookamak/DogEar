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
