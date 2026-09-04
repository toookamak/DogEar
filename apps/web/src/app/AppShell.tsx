import { Sidebar } from '../components/layout/Sidebar.js'
import { StatusBar } from '../components/layout/StatusBar.js'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
        <StatusBar />
      </main>
    </div>
  )
}