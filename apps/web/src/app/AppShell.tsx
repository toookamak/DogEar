import { useState } from 'react'
import { Sidebar } from '../components/layout/Sidebar.js'
import { StatusBar } from '../components/layout/StatusBar.js'
import { FirstRunWizard, WIZARD_STORAGE_KEY } from '../components/onboarding/FirstRunWizard.js'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [showWizard, setShowWizard] = useState(() => {
    try {
      return window.localStorage.getItem(WIZARD_STORAGE_KEY) !== '1'
    } catch {
      return false
    }
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
        <StatusBar />
      </main>
      {showWizard && <FirstRunWizard onDone={() => setShowWizard(false)} />}
    </div>
  )
}