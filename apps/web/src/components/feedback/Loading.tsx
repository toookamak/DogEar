export function Loading() {
  return (
    <div style={{
      padding: 'var(--spacing-64) var(--spacing-16)',
      textAlign: 'center',
      color: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-ui)',
    }}>
      <p style={{ margin: 0 }}>加载中...</p>
    </div>
  )
}