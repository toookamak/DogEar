interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  open: boolean
  confirmLabel?: string
}

/**
 * 确认弹窗：用于删除等不可恢复操作。
 * 带 role="dialog" / aria-modal，遮罩可点击取消（此前缺 role，屏幕阅读器无法识别为对话框）。
 */
export function ConfirmDialog({ title, message, onConfirm, onCancel, open, confirmLabel = '确认' }: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="modal-scrim" aria-label="取消" onClick={onCancel} />
      <div className="modal">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn--pill" onClick={onCancel}>取消</button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
