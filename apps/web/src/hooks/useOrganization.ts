import { useState, useEffect, useCallback } from 'react'
import type { SceneResponse, FolderResponse, TagResponse } from '../types/api.js'
import { organizationApi } from '../api/organization.js'
import { notifyOrgChanged } from '../org-events.js'

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

  const addScene = useCallback(async (data: { name: string; icon?: string; aerr?: string }) => {
    const res = await organizationApi.scenes.create(data)
    setScenes(prev => [...prev, res])
    notifyOrgChanged()
    return res
  }, [])

  const updateScene = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await organizationApi.scenes.update(id, data)
    setScenes(prev => prev.map(s => s.id === id ? res : s))
    notifyOrgChanged()
    return res
  }, [])

  const deleteScene = useCallback(async (id: string) => {
    await organizationApi.scenes.remove(id)
    setScenes(prev => prev.filter(s => s.id !== id))
    notifyOrgChanged()
  }, [])

  /** 合并到目标场景（v1.15）：源场景消失、挂载转移，成功后从本地列表移除并广播 */
  const mergeScene = useCallback(async (id: string, targetId: string) => {
    const res = await organizationApi.scenes.merge(id, targetId)
    setScenes(prev => prev.filter(s => s.id !== id))
    notifyOrgChanged()
    return res
  }, [])

  const addFolder = useCallback(async (data: { name: string; parentId?: string }) => {
    const res = await organizationApi.folders.create(data)
    setFolders(prev => [...prev, res])
    notifyOrgChanged()
    return res
  }, [])

  const updateFolder = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await organizationApi.folders.update(id, data)
    setFolders(prev => prev.map(s => s.id === id ? res : s))
    notifyOrgChanged()
    return res
  }, [])

  const deleteFolder = useCallback(async (id: string) => {
    await organizationApi.folders.remove(id)
    setFolders(prev => prev.filter(s => s.id !== id))
    notifyOrgChanged()
  }, [])

  const addTag = useCallback(async (data: { name: string }) => {
    const res = await organizationApi.tags.create(data)
    setTags(prev => [...prev, res])
    notifyOrgChanged()
    return res
  }, [])

  const deleteTag = useCallback(async (id: string) => {
    await organizationApi.tags.remove(id)
    setTags(prev => prev.filter(t => t.id !== id))
    notifyOrgChanged()
  }, [])

  /** 改名（v1.14）：撞已有 name_key 服务端 409，错误透传给调用方展示 */
  const renameTag = useCallback(async (id: string, data: { name: string }) => {
    const res = await organizationApi.tags.rename(id, data)
    setTags(prev => prev.map(t => t.id === id ? res : t))
    notifyOrgChanged()
    return res
  }, [])

  /** 合并到目标标签（v1.14）：源标签消失、挂载转移，成功后从本地列表移除并广播 */
  const mergeTag = useCallback(async (id: string, targetId: string) => {
    const res = await organizationApi.tags.merge(id, targetId)
    setTags(prev => prev.filter(t => t.id !== id))
    notifyOrgChanged()
    return res
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return {
    scenes, folders, tags,
    loading, error,
    addScene, updateScene, deleteScene, mergeScene,
    addFolder, updateFolder, deleteFolder,
    addTag, deleteTag, renameTag, mergeTag,
  }
}