import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { navItems, isActive } from '../../app/navigation.js'
import { organizationApi } from '../../api/organization.js'
import { onOrgChanged } from '../../org-events.js'
import { useStats, countForDimension } from '../../stats-store.js'
import { Icon } from '../ui/Icon.js'
import { AccountMenu } from './AccountMenu.js'
import type { SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'

interface SidebarProps {
  open: boolean
  onNavigate?: () => void
  onLogout: () => void | Promise<void>
}

/**
 * 侧栏：一级导航（扁平 + 图标）+ 三个组织维度（各一张白卡）+ 左下角账户菜单。
 *
 * 2026-09-27（方案 C）：
 * - 一级导航此前是全站唯一没有图标语言的一级导航（顶栏、工具栏早已换内联 SVG），
 *   且分组标题的字号 / 字重与条目几乎相同——现在导航补图标、行高统一到 32px 控件族；
 * - 场景 / 文件夹 / 标签三组此前只靠 16px 空白分隔、标题左缘还比条目更靠外
 *   （缩进关系反了），现在三组各自成为一张白卡坐在浅灰侧栏上，标题与条目左缘对齐；
 * - 底部「设置」扩为账户菜单，合并原顶栏的主题切换与退出，见 AccountMenu。
 * 维度列表点击后带 query 参数跳到工作台筛选；计数来自 GET /api/stats。
 */
export function Sidebar({ open, onNavigate, onLogout }: SidebarProps) {
  const [location, setLocation] = useLocation()
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [folders, setFolders] = useState<FolderResponse[]>([])
  const [tags, setTags] = useState<TagResponse[]>([])
  const [loaded, setLoaded] = useState(false)
  // v1.14：真实计数来自 GET /api/stats（store 自行处理拉取与变更刷新）
  const { stats } = useStats()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [sceneRes, folderRes, tagRes] = await Promise.allSettled([
        organizationApi.scenes.list(),
        organizationApi.folders.list(),
        organizationApi.tags.list(),
      ])
      if (cancelled) return
      if (sceneRes.status === 'fulfilled') setScenes(sceneRes.value.items ?? [])
      if (folderRes.status === 'fulfilled') setFolders(folderRes.value.items ?? [])
      if (tagRes.status === 'fulfilled') setTags(tagRes.value.items ?? [])
      setLoaded(true)
    }
    load()
    // 组织页改动后同步刷新，避免新建的场景要刷新页面才出现在侧栏
    const off = onOrgChanged(() => { void load() })
    return () => { cancelled = true; off() }
  }, [])

  const go = (path: string) => {
    setLocation(path)
    onNavigate?.()
  }

  /**
   * 顶部导航（Inbox / 书签等）表示「回到该视图的完整列表」，
   * 因此要显式下达清除筛选的意图：筛选状态在工作台页内是局部 state，
   * 若只跳同一路径（例如已按场景筛过再点「书签」）不会有参数变化，
   * 工作台无从得知该清空，场景筛选会一直黏住。
   */
  const goWorkbench = (path: string) => {
    go(`${path}?clear=1`)
  }

  /** 按组织维度筛选：交给工作台的 query 参数，避免跨层共享状态 */
  const goFiltered = (param: 'sceneId' | 'folderId' | 'tagId', id: string) => {
    go(`/bookmarks?${param}=${encodeURIComponent(id)}`)
  }

  /** 顶部导航计数：Inbox = 未读（byStatus.unread），书签 = 总数 */
  const navCount = (path: string): number | null => {
    if (!stats) return null
    if (path === '/') return stats.byStatus?.unread ?? 0
    if (path === '/bookmarks') return stats.total
    return null
  }

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      {/* 2026-10-04：导航与三个维度组整体放进滚动区，底部账户菜单留在滚动区之外。
          此前滚动发生在 .sidebar 自身，账户菜单也跟着一起滚走——侧栏内容一多
          （收藏夹 / 本地场景 / 标签条目多时必然溢出）系统级入口就被推到视口外，
          与 DESIGN.md §4「账户菜单（侧栏左下角）：侧栏贴底」不符。 */}
      <div className="sidebar-scroll">
        {/* 一级导航：扁平、无容器（白卡只留给三个维度组，层次才立得住） */}
        <nav className="sidebar-group sidebar-group--flat">
          <div className="sidebar-nav">
            {navItems.map((item) => {
              const count = navCount(item.path)
              return (
                <button
                  key={item.path}
                  type="button"
                  className="nav-item"
                  aria-current={isActive(location, item.path) ? 'page' : undefined}
                  onClick={() => (item.path === '/' || item.path === '/bookmarks' ? goWorkbench(item.path) : go(item.path))}
                >
                  <Icon name={item.icon} />
                  <span className="nav-item-label">{item.label}</span>
                  {count !== null && <span className="nav-item-count">{count}</span>}
                </button>
              )
            })}
          </div>
        </nav>

        <div className="sidebar-group">
          {/* v1.14 起各维度行显示「该维度下有多少书签」，来自 GET /api/stats 聚合；
              此前的近似口径（取已加载列表 / 仅维度条目数）已移除。
              v0.8.0：文件夹改称「收藏夹」，与 Raindrop 侧用词一致（决策二：Folder + Tag 为主维度）。 */}
          <h3 className="sidebar-group-title">
            <Icon name="folder" />
            <span className="sidebar-group-label">收藏夹</span>
            <span className="group-count">{folders.length}</span>
          </h3>
          {folders.length === 0 ? (
            <p className="sidebar-empty">
              {loaded ? <>还没有文件夹 · <a className="sidebar-empty-link" href="/organization" onClick={(e) => { e.preventDefault(); go('/organization') }}>去创建</a></> : '加载中…'}
            </p>
          ) : (
            <div className="sidebar-nav">
              {folders.map((folder) => {
                const count = countForDimension(stats?.byFolder, folder.id)
                return (
                  <button
                    key={folder.id}
                    type="button"
                    className="nav-item"
                    onClick={() => goFiltered('folderId', folder.id)}
                  >
                    <span className="nav-item-label">{folder.name}</span>
                    {count !== null && <span className="nav-item-count">{count}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="sidebar-group">
          {/* v0.8.0：场景从第一位降到**最末**（决策四：Folder + Tag 为主维度，Scene 降级为
              本地维度）。标「不回写」是因为它只存在于本地，不参与 Raindrop 回写——
              不写清楚的话，用户会以为挂上去的分类会跟着回推。 */}
          <h3 className="sidebar-group-title">
            <Icon name="sparkle" />
            <span className="sidebar-group-label">本地场景</span>
            <span className="sidebar-group-note">不回写</span>
            <span className="group-count">{scenes.length}</span>
          </h3>
          {scenes.length === 0 ? (
            <p className="sidebar-empty">
              {loaded ? <>还没有场景 · <a className="sidebar-empty-link" href="/organization" onClick={(e) => { e.preventDefault(); go('/organization') }}>去创建</a></> : '加载中…'}
            </p>
          ) : (
            <div className="sidebar-nav">
              {/* 停用场景保留入口：停用只是从挑选器消失，已挂上的书签仍要能按它筛到
                  （docs/modules/20260904_数据库设计.md）。故弱化显示而非隐藏。 */}
              {scenes.map((scene) => {
                const count = countForDimension(stats?.byScene, scene.id)
                return (
                  <button
                    key={scene.id}
                    type="button"
                    className={`nav-item${scene.enabled === false ? ' nav-item--muted' : ''}`}
                    title={scene.enabled === false ? '该场景已停用；仍可筛出已挂在它下面的书签' : '本地维度：不随整理结果回写到 Raindrop'}
                    onClick={() => goFiltered('sceneId', scene.id)}
                  >
                    <span className="nav-item-label">{scene.name}</span>
                    {count !== null && <span className="nav-item-count">{count}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="sidebar-group">
          <h3 className="sidebar-group-title">
            <Icon name="tags" />
            <span className="sidebar-group-label">标签</span>
            <span className="group-count">{tags.length}</span>
            {/* 改名 / 合并的完整管理面在组织管理页（v1.14）；侧栏只给入口 */}
            <a
              className="sidebar-empty-link group-manage-link"
              href="/organization"
              onClick={(e) => { e.preventDefault(); go('/organization') }}
            >
              管理
            </a>
          </h3>
          {tags.length === 0 ? (
            <p className="sidebar-empty">
              {loaded ? <>还没有标签 · <a className="sidebar-empty-link" href="/organization" onClick={(e) => { e.preventDefault(); go('/organization') }}>去创建</a></> : '加载中…'}
            </p>
          ) : (
            <div className="sidebar-nav">
              {tags.map((tag) => {
                const count = countForDimension(stats?.byTag, tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className="nav-item"
                    onClick={() => goFiltered('tagId', tag.id)}
                  >
                    <span className="nav-item-label">
                      <span className="nav-item-tag-hash" aria-hidden="true">#</span>{tag.name}
                    </span>
                    {count !== null && <span className="nav-item-count">{count}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <AccountMenu onLogout={onLogout} onNavigate={onNavigate} />
      </div>
    </aside>
  )
}
