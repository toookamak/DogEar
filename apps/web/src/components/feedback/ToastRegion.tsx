import { useEffect, useState } from 'react'
import { onToast, TOAST_TTL, type Toast } from '../../toast.js'

/**
 * 提示区：固定在右下角，堆叠显示。
 * aria-live="polite" 让屏幕阅读器在空闲时播报，不打断当前操作。
 */
export function ToastRegion() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => onToast((incoming) => {
    setToasts((prev) => [...prev, incoming])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== incoming.id))
    }, TOAST_TTL[incoming.kind])
  }), [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((item) => item.id !== id))

  if (toasts.length === 0) return null

  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast--${item.kind}`} role="status">
          <span className="toast-msg">{item.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="关闭提示"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
