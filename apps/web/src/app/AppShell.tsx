import { useState } from 'react'
import { TopBar } from '../components/layout/TopBar.js'
import { Sidebar } from '../components/layout/Sidebar.js'
import { StatusBar } from '../components/layout/StatusBar.js'
import { FirstRunWizard, WIZARD_STORAGE_KEY } from '../components/onboarding/FirstRunWizard.js'

interface AppShellProps {
  children: React.ReactNode
  onLogout: () => void | Promise<void>
}

/**
 * 应用外壳：顶栏 + 正文（侧栏 + 内容区）+ 状态栏。
 * 侧栏在 ≥768px 常驻（宽度由 --spacing-sidebar 控制），窄屏转为抽屉，由顶栏 ☰ 开关。
 */
export function AppShell({ children, onLogout }: AppShellProps) {
  const [showWizard, setShowWizard] = useState(() => {
    try {
      return window.localStorage.getItem(WIZARD_STORAGE_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onLogout={onLogout}
      />

      <div className="app-body">
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="收起导航"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <main className="app-main">
          <div className="app-content">{children}</div>
        </main>
      </div>

      <StatusBar />

      {showWizard && <FirstRunWizard onDone={() => setShowWizard(false)} />}
    </div>
  )
}
