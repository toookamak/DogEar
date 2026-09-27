import type { IconName } from '../components/ui/Icon.js'

export interface NavItem {
  path: string
  label: string
  /** 侧栏一级导航一律带图标（方案 C：全站唯一此前没有图标语言的一级导航） */
  icon: IconName
}

/** 侧栏主区固定导航（设置项下沉到侧栏底部的账户菜单，见 settingsNavItem） */
export const navItems: NavItem[] = [
  { path: '/', label: 'Inbox', icon: 'inbox' },
  { path: '/bookmarks', label: '书签', icon: 'bookmark' },
  { path: '/nav', label: '导航页', icon: 'compass' },
  { path: '/organization', label: '组织管理', icon: 'layers' },
  { path: '/recycle-bin', label: '回收站', icon: 'trash' },
]

export const settingsNavItem: NavItem = { path: '/settings', label: '设置', icon: 'settings' }

export const isActive = (currentPath: string, itemPath: string) => {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}
