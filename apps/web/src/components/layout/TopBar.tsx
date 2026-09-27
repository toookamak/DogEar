import { useLocation } from 'wouter'
import { useTheme } from '../../theme/useTheme.js'
import { Icon } from '../ui/Icon.js'

interface TopBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onLogout: () => void | Promise<void>
}

/**
 * 品牌、全局搜索入口、添加书签入口与登出；页面级标题与操作见 PageHeader。
 * 搜索与添加通过 URL 参数交给工作台页执行，避免跨层调用全局状态。
 */
export function TopBar({ sidebarOpen, onToggleSidebar, onLogout }: TopBarProps) {
  const [location, setLocation] = useLocation()
  const { resolved, setPreference } = useTheme()
  const isWorkbench = location === '/' || location.startsWith('/bookmarks')

  /** 到工作台并请求打开指定面板；已在工作台时直接改参数 */
  const openOnWorkbench = (panel: 'palette' | 'save') => {
    setLocation(`/bookmarks?${panel}=1`)
  }

  /** 快捷明暗切换：写显式偏好；「跟随系统」的细分选择在设置页「外观」 */
  const toggleTheme = () => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="topbar">
      <div className="topbar-lead">
        <button
          type="button"
          className="icon-btn topbar-toggle"
          aria-label={sidebarOpen ? '收起导航' : '展开导航'}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          ☰
        </button>
        <button
          type="button"
          className="topbar-brand"
          onClick={() => setLocation('/')}
        >
          DogEar
          {/* 版本号（mono 小字，来源 apps/web/package.json，经 __APP_VERSION__ 注入） */}
          <span className="topbar-brand-version">v{__APP_VERSION__}</span>
        </button>
      </div>

      <button
        type="button"
        className="topbar-search"
        onClick={() => openOnWorkbench('palette')}
        aria-label="搜索书签"
      >
        <span aria-hidden="true"><Icon name="search" /></span>
        <span className="topbar-search-label">搜索书签…</span>
        <span className="topbar-kbd">⌘K</span>
      </button>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={resolved === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          title={resolved === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          onClick={toggleTheme}
        >
          {resolved === 'dark' ? '☀' : '☾'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => openOnWorkbench('save')}
          title={isWorkbench ? '添加书签' : '到工作台添加书签'}
        >
          添加书签
        </button>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          退出
        </button>
      </div>
    </header>
  )
}
