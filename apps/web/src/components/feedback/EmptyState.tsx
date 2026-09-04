export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: 'var(--spacing-64) var(--spacing-16)',
      textAlign: 'center',
      color: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-ui)',
    }}>
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  )
}