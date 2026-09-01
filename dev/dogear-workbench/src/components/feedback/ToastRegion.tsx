import type { ToastMsg, UndoAction } from "@/types";

interface Props {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
  onUndo: (undo: UndoAction) => void;
}

export default function ToastRegion({ toasts, onDismiss, onUndo }: Props) {
  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span className="toast-msg">{t.message}</span>
          {t.undo && (
            <button
              type="button"
              className="toast-action"
              onClick={() => onUndo(t.undo!)}
            >
              {t.actionLabel ?? "撤销"}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="关闭"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}