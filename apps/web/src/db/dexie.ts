import Dexie, { type Table } from 'dexie'

export interface DexieBookmark {
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
  folderId: string | null
  domain: string | null
  broken: boolean
  raindropId: string | null
  syncStatus: 'pending' | 'synced'
  version: number
  deletedAt: number | null
  lastOpenedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface DexieScene {
  id: string
  name: string
  description?: string
  icon?: string
  sortOrder: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface DexieFolder {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface DexieTag {
  id: string
  name: string
  nameKey: string
  createdAt: number
}

export class DogEarCache extends Dexie {
  bookmarks!: Table<DexieBookmark, string>
  scenes!: Table<DexieScene, string>
  folders!: Table<DexieFolder, string>
  tags!: Table<DexieTag, string>
  settings!: Table<{ key: string; value: string; updatedAt: number }, string>

  constructor() {
    super('DogEarCache')
    this.version(1).stores({
      bookmarks: 'id, status, createdAt, folderId, domain, [status+createdAt]',
      scenes: 'id, sortOrder',
      folders: 'id, parentId, sortOrder',
      tags: 'id, nameKey',
      settings: 'key',
    })
  }
}

export const cache = new DogEarCache()
