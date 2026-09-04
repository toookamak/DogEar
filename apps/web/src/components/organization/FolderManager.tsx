import { useState } from 'react'
import { organizationApi } from '../../api/organization.js'
import type { FolderResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

interface FolderManagerProps {
  folders: FolderResponse[]
}

export function FolderManager({ folders }: FolderManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [localFolders, setLocalFolders] = useState(folders)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const res = await organizationApi.folders.create({ name: newName.trim(), parentId: newParentId || undefined })
      setLocalFolders(prev => [...prev, res])
      setNewName('')
      setNewParentId('')
      setShowCreate(false)
    } catch { /* ignore */ }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    try {
      const res = await organizationApi.folders.update(id, { name: editName.trim(), parentId: editParentId || null })
      setLocalFolders(prev => prev.map(f => f.id === id ? res : f))
      setEditingId(null)
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await organizationApi.folders.remove(id)
      setLocalFolders(prev => prev.filter(f => f.id !== id))
    } catch { /* ignore */ }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-12)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: 0 }}>
          文件夹 ({localFolders.length})
        </h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + 新建文件夹
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 'var(--spacing-12)', marginBottom: 'var(--spacing-12)', display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="文件夹名称"
            className="input"
            style={{ flex: 1 }}
            autoFocus
          />
          <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)} className="input" style={{ width: '160px' }}>
            <option value="">无父级</option>
            {localFolders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button onClick={handleCreate} className="btn-primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn-secondary-pill">取消</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
        {localFolders.map((folder) => {
          const parent = folder.parentId ? localFolders.find(f => f.id === folder.parentId) : null
          return (
            <div key={folder.id} className="card" style={{ padding: 'var(--spacing-12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {editingId === folder.id ? (
                <div style={{ display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center', flex: 1 }}>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" style={{ flex: 1 }} autoFocus />
                  <select value={editParentId} onChange={(e) => setEditParentId(e.target.value)} className="input" style={{ width: '160px' }}>
                    <option value="">无父级</option>
                    {localFolders.filter(f => f.id !== folder.id).map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button onClick={() => handleUpdate(folder.id)} className="btn-primary">保存</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary-pill">取消</button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500 }}>{folder.name}</div>
                    {parent && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        父级: {parent.name}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                    <button
                      onClick={() => { setEditingId(folder.id); setEditName(folder.name); setEditParentId(folder.parentId || '') }}
                      className="btn-secondary-pill"
                    >
                      编辑
                    </button>
                    <button onClick={() => setConfirmId(folder.id)} className="btn-secondary-pill" style={{ color: 'var(--color-error)' }}>
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
        {localFolders.length === 0 && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-muted)', padding: 'var(--spacing-16)', textAlign: 'center' }}>
            暂无文件夹，点击"新建文件夹"创建
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="删除文件夹"
        message="确定删除此文件夹？此操作不可恢复。"
        onConfirm={() => handleDelete(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}