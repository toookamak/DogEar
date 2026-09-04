export function ErrorMessage({ message }: { message: string }) {
  return (
    <div style={{
      padding: 'var(--spacing-16)',
      color: 'var(--color-error)',
      fontFamily: 'var(--font-ui)',
      borderRadius: 'var(--radius-standard)',
      background: 'oklab(0.86 0.12 0.28 / 0.1)',
    }}>
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  )
}