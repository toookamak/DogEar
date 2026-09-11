import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { navItems, settingsNavItem, isActive } from '../../app/navigation.js'
import { organizationApi } from '../../api/organization.js'
import { onOrgChanged } from '../../org-events.js'
import type { SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'

interface SidebarProps {
  open: boolean
  onNavigate?: () => void
}

/**
 * 侧栏：主区固定导航 + 三个组织维度（Scene / 文件夹 / 标签）+ 底部设置。
 * 维度列表点击后带 query 参数跳到工作台筛选；本轮不显示各维度计数
 * （无对应接口，见 docs/modules/20260910_工作台外壳屏稿.md §4）。
 */
export function Sidebar({ open, onNavigate }: SidebarProps) {
  const [location, setLocation] = useLocation()
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [folders, setFolders] = useState<FolderResponse[]>([])
  const [tags, setTags] = useState<TagResponse[]>([])
  const [loaded, setLoaded] = useState(false)

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

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <nav className="sidebar-group">
        <div className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className="nav-item"
              aria-current={isActive(location, item.path) ? 'page' : undefined}
              onClick={() => (item.path === '/' || item.path === '/bookmarks' ? goWorkbench(item.path) : go(item.path))}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar-group">
        <h3 className="sidebar-group-title">场景</h3>
        {scenes.length === 0 ? (
          <p className="sidebar-empty">
            {loaded ? <>还没有场景 · <a className="sidebar-empty-link" href="/organization" onClick={(e) => { e.preventDefault(); go('/organization') }}>去创建</a></> : '加载中…'}
          </p>
        ) : (
          <div className="sidebar-nav">
            {/* 停用场景保留入口：停用只是从挑选器消失，已挂上的书签仍要能按它筛到
                （docs/modules/20260904_数据库设计.md）。故弱化显示而非隐藏。 */}
            {scenes.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className={`nav-item${scene.enabled === false ? ' nav-item--muted' : ''}`}
                title={scene.enabled === false ? '该场景已停用；仍可筛出已挂在它下面的书签' : undefined}
                onClick={() => goFiltered('sceneId', scene.id)}
              >
                {scene.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-group">
        <h3 className="sidebar-group-title">文件夹</h3>
        {folders.length === 0 ? (
          <p className="sidebar-empty">
            {loaded ? <>还没有文件夹 · <a className="sidebar-empty-link" href="/organization" onClick={(e) => { e.preventDefault(); go('/organization') }}>去创建</a></> : '加载中…'}
          </p>
        ) : (
          <div className="sidebar-nav">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className="nav-item"
                onClick={() => goFiltered('folderId', folder.id)}
              >
                {folder.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-group">
        <h3 className="sidebar-group-title">标签</h3>
        {tags.length === 0 ? (
          <p className="sidebar-empty">
            {loaded ? <>还没有标签 · <a className="sidebar-empty-link" href="/organization" onClick={(e) => { e.preventDefault(); go('/organization') }}>去创建</a></> : '加载中…'}
          </p>
        ) : (
          <div className="sidebar-nav">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="nav-item"
                onClick={() => goFiltered('tagId', tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-item"
          aria-current={isActive(location, settingsNavItem.path) ? 'page' : undefined}
          onClick={() => go(settingsNavItem.path)}
        >
          {settingsNavItem.label}
        </button>
      </div>
    </aside>
  )
}
