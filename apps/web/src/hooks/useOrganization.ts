import { useState, useEffect, useCallback } from 'react'
import type { SceneResponse, FolderResponse, TagResponse } from '../types/api.js'
import { organizationApi } from '../api/organization.js'

export function useOrganization() {
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [folders, setFolders] = useState<FolderResponse[]>([])
  const [tags, setTags] = useState<TagResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [scenesRes, foldersRes, tagsRes] = await Promise.all([
        organizationApi.scenes.list(),
        organizationApi.folders.list(),
        organizationApi.tags.list(),
      ])
      setScenes(scenesRes.items)
      setFolders(foldersRes.items)
      setTags(tagsRes.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const addScene = useCallback(async (data: { name: string; icon?: string }) => {
    const res = await organizationApi.scenes.create(data)
    setScenes(prev => [...prev, res])
    return res
  }, [])

  const updateScene = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await organizationApi.scenes.update(id, data)
    setScenes(prev => prev.map(s => s.id === id ? res : s))
    return res
  }, [])

  const deleteScene = useCallback(async (id: string) => {
    await organizationApi.scenes.remove(id)
    setScenes(prev => prev.filter(s => s.id !== id))
  }, [])

  const addFolder = useCallback(async (data: { name: string; parentId?: string }) => {
    const res = await organizationApi.folders.create(data)
    setFolders(prev => [...prev, res])
    return res
  }, [])

  const updateFolder = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await organizationApi.folders.update(id, data)
    setFolders(prev => prev.map(s => s.id === id ? res : s))
    return res
  }, [])

  const deleteFolder = useCallback(async (id: string) => {
    await organizationApi.folders.remove(id)
    setFolders(prev => prev.filter(s => s.id !== id))
  }, [])

  const addTag = useCallback(async (data: { name: string }) => {
    const res = await organizationApi.tags.create(data)
    setTags(prev => [...prev, res])
    return res
  }, [])

  const deleteTag = useCallback(async (id: string) => {
    await organizationApi.tags.remove(id)
    setTags(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    load()
  }, [])

  return {
    scenes, folders, tags,
    loading, error,
    addScene, updateScene, deleteScene,
    addFolder, updateFolder, deleteFolder,
    addTag, deleteTag,
  }
}