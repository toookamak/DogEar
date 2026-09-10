import { useLocation } from 'wouter'

interface TopBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onLogout: () => void | Promise<void>
}

/**
 * 应用级顶栏（外壳的一部分，所有页面共用）。
 * 品牌、全局搜索入口、保存入口与登出；页面级标题与操作见 PageHeader。
 * 搜索与保存通过 URL 参数交给工作台页执行，避免跨层调用全局状态。
 */
export function TopBar({ sidebarOpen, onToggleSidebar, onLogout }: TopBarProps) {
  const [location, setLocation] = useLocation()
  const isWorkbench = location === '/' || location.startsWith('/bookmarks')

  /** 到工作台并请求打开指定面板；已在工作台时直接改参数 */
  const openOnWorkbench = (panel: 'palette' | 'save') => {
    setLocation(`/bookmarks?${panel}=1`)
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
        </button>
      </div>

      <button
        type="button"
        className="topbar-search"
        onClick={() => openOnWorkbench('palette')}
        aria-label="搜索书签"
      >
        <span aria-hidden="true">⌕</span>
        <span className="topbar-search-label">搜索书签…</span>
        <span className="topbar-kbd">⌘K</span>
      </button>

      <div className="topbar-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => openOnWorkbench('save')}
          title={isWorkbench ? '保存书签' : '到工作台保存书签'}
        >
          + 保存
        </button>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          退出
        </button>
      </div>
    </header>
  )
}
