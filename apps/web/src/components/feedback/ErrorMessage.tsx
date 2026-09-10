interface ErrorMessageProps {
  message: string
  /** 可选的重试动作，便于把「加载失败」变成可恢复 */
  onRetry?: () => void
}

/** 错误提示：用语义色 token，不再硬编码颜色值 */
export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="alert alert--error error-message" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  )
}
