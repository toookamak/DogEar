import { useLocation } from 'wouter'
import { Icon } from '../ui/Icon.js'
import { SyncCapsule } from './SyncCapsule.js'

interface TopBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

/**
 * 品牌、全局搜索入口与同步胶囊；页面级标题与操作见 PageHeader。
 *
 * 2026-09-27 顶栏收窄为「只有全局状态与全局入口」：
 * - 主题切换与退出下沉到侧栏左下角的账户菜单（此前三者散在顶栏与侧栏两处）；
 * - 「添加书签」从顶栏移除——它与工作台工具栏的主操作同屏重复，且同为实底主色，
 *   两个主按钮互相抢注意力（入口由工具栏承担，带上下文，语义更准）；
 * - 同步状态从底部状态栏迁到这里成为胶囊，见 SyncCapsule。
 * 搜索与添加通过 URL 参数交给工作台页执行，避免跨层调用全局状态。
 */
export function TopBar({ sidebarOpen, onToggleSidebar }: TopBarProps) {
  const [, setLocation] = useLocation()

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
          <Icon name="menu" />
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
        onClick={() => setLocation('/bookmarks?palette=1')}
        aria-label="搜索书签"
      >
        <span aria-hidden="true"><Icon name="search" /></span>
        <span className="topbar-search-label">搜索书签…</span>
        <span className="topbar-kbd">⌘K</span>
      </button>

      <div className="topbar-actions">
        <SyncCapsule />
      </div>
    </header>
  )
}
