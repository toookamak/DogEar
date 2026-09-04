import { useLocation } from 'wouter'
import { navItems, isActive } from '../../app/navigation.js'

export function Sidebar() {
  const [location, setLocation] = useLocation()
  return (
    <aside style={{
      width: 'var(--spacing-sidebar, 240px)',
      minWidth: 'var(--spacing-sidebar, 240px)',
      height: '100vh',
      background: 'var(--color-bg-surface-200)',
      borderRight: '1px solid var(--border-primary)',
      display: 'flex',
      flexDirection: 'column',
      padding: 'var(--spacing-16) 0',
    }}>
      <div style={{ padding: 'var(--spacing-8) var(--spacing-16)', marginBottom: 'var(--spacing-16)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '-0.11px', margin: 0, color: 'var(--color-text-primary)' }}>
          DogEar
        </h1>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            style={{
              background: isActive(location, item.path) ? 'var(--color-bg-surface-400)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-standard)',
              padding: 'var(--spacing-8) var(--spacing-16)',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              fontWeight: isActive(location, item.path) ? 600 : 400,
              color: 'var(--color-text-primary)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}