// API response types derived from packages/shared contract schemas

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface PageResult<T> {
  items: T[]
  nextCursor: string | null
}

export interface InboxResult<T> {
  bookmarks: T[]
  nextCursor: string | null
}

export interface BookmarkResponse {
  id: string
  url: string
  title: string | null
  excerpt: string | null
  cover: string | null
  type: 'link' | 'article' | 'video' | 'image'
  author: string | null
  favicon: string | null
  publishedAt: number | null
  note: string | null
  intent: string | null
  important: boolean
  status: 'unread' | 'saved' | 'archived'
  source: 'page' | 'agent' | 'extension'
  private: boolean
  folder: { id: string; name: string } | null
  domain: string | null
  broken: boolean
  raindropId: string | null
  syncStatus: 'pending' | 'synced'
  version: number
  deletedAt: number | null
  lastOpenedAt: number | null
  createdAt: number
  updatedAt: number
  scenes: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  pendingSuggestionCount: number
}

export interface SceneResponse {
  id: string
  name: string
  description?: string
  icon?: string
  sortOrder: number
  enabled: boolean
  aerr: string
  createdAt: number
  updatedAt: number
}

export interface FolderResponse {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  raindropId?: string
  createdAt: number
  updatedAt: number
}

export interface TagResponse {
  id: string
  name: string
  nameKey: string
  createdAt: number
}

export interface SuggestionResponse {
  id: string
  bookmarkId: string
  kind: 'scene' | 'folder' | 'tag'
  targetId: string | null
  targetLabel: string | null
  confidence: number | null
  rationale: string | null
  status: 'pending' | 'accepted' | 'deferred' | 'dismissed'
  createdAt: number
  resolvedAt: number | null
}

export interface JobResponse {
  id: string
  bookmarkId: string
  type: 'snapshot' | 'reader'
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  retryCount: number
  error: string | null
  createdAt: number
  updatedAt: number
}

export interface SettingResponse {
  key: string
  value: unknown
  updatedAt: number
}

export interface SkillUsageResponse {
  date: string
  requests: number
  writes: number
  blocked: number
}

export interface SettingsWhitelist {
  'recycle.retention_days'?: string | number
  'skill.capabilities'?: {
    read: boolean
    write_new: boolean
    update_existing: boolean
  }
}

export interface OperationLogResponse {
  id: string
  actor: string
  action: string
  targetType: string
  targetId: string
  detail: string | null
  createdAt: number
}

export interface BatchUpdateResponse {
  updated: BookmarkResponse[]
  skipped: { id: string; reason: 'not_found' | 'deleted' }[]
}

export interface AccessRecordResponse {
  id: string
  bookmarkId: string
  openedAt: number
  source: 'original' | 'snapshot'
}

export interface SyncQueueItemResponse {
  id: string
  action: 'create' | 'update' | 'delete'
  targetType: string
  targetId: string
  channel: string
  payload: string | null
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  retryCount: number
  error: string | null
  createdAt: number
  updatedAt: number
}

export interface BackupResponse {
  id: string
  tier: 'light' | 'medium' | 'full'
  target: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  filePath: string | null
  fileSize: number | null
  includes: string
  error: string | null
  createdAt: number
  completedAt: number | null
}