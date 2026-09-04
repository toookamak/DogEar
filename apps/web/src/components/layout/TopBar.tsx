import { useEffect, useState } from 'react'
import { syncApi } from '../../api/sync.js'

export function TopBar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const { pendingCount: count } = await syncApi.pendingCount()
        if (!cancelled) setPendingCount(count)
      } catch {
        // Ignore fetch errors
      }
    }
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <header style={{
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--spacing-16)',
      borderBottom: '1px solid var(--border-primary)',
      background: 'var(--color-bg-page)',
    }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.11px', margin: 0 }}>{title}</h2>
      <div style={{ display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center' }}>
        {pendingCount > 0 && (
          <span
            title={`${pendingCount} 个待同步操作`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-warning, #b8860b)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-standard, 6px)',
              background: 'var(--color-bg-warning-subtle, #fff8e1)',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-text-warning, #b8860b)', display: 'inline-block' }} />
            {pendingCount}
          </span>
        )}
        {actions}
      </div>
    </header>
  )
}