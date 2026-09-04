// Local view state types

export type ViewMode = 'list' | 'grid'

export interface BookmarkFilters {
  status?: string
  sceneId?: string
  folderId?: string | 'none'
  tagId?: string
  important?: boolean
  source?: string
  q?: string
}

export interface AppState {
  sidebarCollapsed: boolean
  viewMode: ViewMode
}