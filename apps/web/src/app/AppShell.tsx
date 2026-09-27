import { useEffect, useState } from 'react'
import { TopBar } from '../components/layout/TopBar.js'
import { Sidebar } from '../components/layout/Sidebar.js'
import { StatusBar } from '../components/layout/StatusBar.js'
import { ToastRegion } from '../components/feedback/ToastRegion.js'
import { FirstRunWizard, WIZARD_STORAGE_KEY } from '../components/onboarding/FirstRunWizard.js'
import { installSyncScheduler } from '../sync-scheduler.js'

interface AppShellProps {
  children: React.ReactNode
  onLogout: () => void | Promise<void>
}

/**
 * 应用外壳：顶栏 + 正文（侧栏 + 内容区）+ 状态栏。
 * 侧栏在 ≥768px 常驻（宽度由 --sidebar-w 控制），窄屏转为抽屉，由顶栏 ☰ 开关。
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

  // 通道同步攒批（L2）：外壳挂载即安装（幂等），页面隐藏/卸载时 flush，轮询清积压
  useEffect(() => {
    installSyncScheduler()
  }, [])

  return (
    <div className="app-shell">
      {/* 顶栏只留全局状态与全局入口；主题切换与退出在侧栏左下角的账户菜单（需 onLogout） */}
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />

      <div className="app-body">
        <Sidebar
          open={sidebarOpen}
          onNavigate={() => setSidebarOpen(false)}
          onLogout={onLogout}
        />
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

      {/* 提示区挂在外壳，任何页面都能用 showToast / toast.* 弹提示 */}
      <ToastRegion />

      {showWizard && <FirstRunWizard onDone={() => setShowWizard(false)} />}
    </div>
  )
}
