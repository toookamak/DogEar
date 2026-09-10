interface EmptyStateProps {
  message: string
  /** 可选主操作，例如「清除筛选」或「去保存第一条」 */
  action?: { label: string; onClick: () => void }
}

/** 空状态：居中说明 + 可选操作 */
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-text">{message}</p>
      {action && (
        <button type="button" className="btn btn--pill" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
