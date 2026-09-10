export interface NavItem {
  path: string
  label: string
  icon?: string
}

/** 侧栏主区固定导航（设置项下沉到侧栏底部，见 settingsNavItem） */
export const navItems: NavItem[] = [
  { path: '/', label: 'Inbox' },
  { path: '/bookmarks', label: '书签' },
  { path: '/nav', label: '导航页' },
  { path: '/organization', label: '组织管理' },
  { path: '/recycle-bin', label: '回收站' },
]

export const settingsNavItem: NavItem = { path: '/settings', label: '设置' }

export const isActive = (currentPath: string, itemPath: string) => {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}
