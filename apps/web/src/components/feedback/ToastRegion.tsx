import { useEffect, useState } from 'react'
import { onToast, TOAST_TTL, type Toast } from '../../toast.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { notifyDataChanged } from '../../undo.js'
import { toast, errorMessage } from '../../toast.js'
import { Icon } from '../ui/Icon.js'

/**
 * 提示区：固定在右下角，堆叠显示。
 * aria-live="polite" 让屏幕阅读器在空闲时播报，不打断当前操作。
 *
 * 带 undoId 的提示渲染「撤销」按钮：与状态栏撤销共用同一 revert 通道
 * （用户 2026-09-12 拍板双入口），撤销成功后走 notifyDataChanged 局部刷新。
 * 可撤销提示的停留时间放大到 8s，给足反应窗口。
 */
export function ToastRegion() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => onToast((incoming) => {
    setToasts((prev) => [...prev, incoming])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== incoming.id))
    }, incoming.undoId ? Math.max(TOAST_TTL[incoming.kind], 8000) : TOAST_TTL[incoming.kind])
  }), [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((item) => item.id !== id))

  const handleUndo = async (item: Toast) => {
    if (!item.undoId) return
    try {
      await bookmarksApi.revert(item.undoId)
      dismiss(item.id)
      notifyDataChanged()
    } catch (error) {
      toast.error(errorMessage(error, '撤销失败，可在状态栏重试'))
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast--${item.kind}`} role="status">
          <span className="toast-msg">{item.message}</span>
          {item.undoId && (
            <button
              type="button"
              className="toast-action"
              onClick={() => { void handleUndo(item) }}
            >
              撤销
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label="关闭提示"
            onClick={() => dismiss(item.id)}
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  )
}
