import { useState } from 'react'
import type { FolderResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

interface FolderManagerProps {
  folders: FolderResponse[]
  onCreate: (data: { name: string; parentId?: string }) => Promise<unknown>
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

/**
 * 文件夹管理：数据与增删改由上层 useOrganization 提供（单一数据源）。
 * 父级选择会排除自身，避免形成环（服务端亦会校验）。
 */
export function FolderManager({ folders, onCreate, onUpdate, onDelete }: FolderManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await onCreate({ name: newName.trim(), parentId: newParentId || undefined })
      setNewName('')
      setNewParentId('')
      setShowCreate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setError(null)
    try {
      await onUpdate(id, { name: editName.trim(), parentId: editParentId || null })
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await onDelete(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
    setConfirmId(null)
  }

  return (
    <div>
      {error && <div className="alert alert--error">{error}</div>}

      <div className="manager-head">
        <h3 className="section-title">文件夹（{folders.length}）</h3>
        <button onClick={() => setShowCreate(true)} className="btn btn--primary">
          + 新建文件夹
        </button>
      </div>

      {showCreate && (
        <div className="manager-create">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="文件夹名称"
            className="input manager-create-name"
            autoFocus
          />
          <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)} className="input manager-create-parent">
            <option value="">无父级</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={handleCreate} className="btn btn--primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn btn--pill">取消</button>
        </div>
      )}

      <div className="list-stack">
        {folders.map((folder) => {
          const parent = folder.parentId ? folders.find((f) => f.id === folder.parentId) : null
          return (
            <div key={folder.id} className="list-row">
              {editingId === folder.id ? (
                <>
                  <div className="manager-edit">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input manager-create-name" aria-label="文件夹名称" autoFocus />
                    <select value={editParentId} onChange={(e) => setEditParentId(e.target.value)} className="input manager-create-parent" aria-label="父级文件夹">
                      <option value="">无父级</option>
                      {folders.filter((f) => f.id !== folder.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="list-row-actions">
                    <button onClick={() => handleUpdate(folder.id)} className="btn btn--primary">保存</button>
                    <button onClick={() => setEditingId(null)} className="btn btn--pill">取消</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="list-row-main">
                    <div className="list-row-title">{folder.name}</div>
                    {parent && <div className="list-row-meta">父级：{parent.name}</div>}
                  </div>
                  <div className="list-row-actions">
                    <button
                      onClick={() => { setEditingId(folder.id); setEditName(folder.name); setEditParentId(folder.parentId || '') }}
                      className="btn btn--pill"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setConfirmId(folder.id)}
                      className="btn btn--pill"
                      style={{ color: 'var(--color-error)' }}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
        {folders.length === 0 && <p className="empty-note">暂无文件夹，点击「新建文件夹」创建。</p>}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="删除文件夹"
        message="确定删除此文件夹？其中书签的文件夹归属将置空，操作不可恢复。"
        onConfirm={() => handleDelete(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
