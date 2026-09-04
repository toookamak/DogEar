export function StatusBar() {
  return (
    <footer style={{
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--spacing-12)',
      borderTop: '1px solid var(--border-primary)',
      background: 'var(--color-bg-page)',
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      color: 'var(--color-text-muted)',
    }}>
      <span>DogEar v0.4</span>
    </footer>
  )
}