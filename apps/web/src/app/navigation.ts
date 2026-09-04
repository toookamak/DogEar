export interface NavItem {
  path: string
  label: string
  icon?: string
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Inbox' },
  { path: '/bookmarks', label: '书签' },
  { path: '/organization', label: '组织管理' },
  { path: '/recycle-bin', label: '回收站' },
  { path: '/settings', label: '设置' },
]

export const isActive = (currentPath: string, itemPath: string) => {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}
