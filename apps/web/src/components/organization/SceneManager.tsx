import { useState } from 'react'
import { organizationApi } from '../../api/organization.js'
import type { SceneResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

interface SceneManagerProps {
  scenes: SceneResponse[]
}

export function SceneManager({ scenes }: SceneManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [localScenes, setLocalScenes] = useState(scenes)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const res = await organizationApi.scenes.create({ name: newName.trim(), icon: newIcon.trim() || undefined })
      setLocalScenes(prev => [...prev, res])
      setNewName('')
      setNewIcon('')
      setShowCreate(false)
    } catch { /* ignore */ }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    try {
      const res = await organizationApi.scenes.update(id, { name: editName.trim(), icon: editIcon.trim() || undefined })
      setLocalScenes(prev => prev.map(s => s.id === id ? res : s))
      setEditingId(null)
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await organizationApi.scenes.remove(id)
      setLocalScenes(prev => prev.filter(s => s.id !== id))
    } catch { /* ignore */ }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-12)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: 0 }}>
          场景 ({localScenes.length})
        </h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + 新建场景
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 'var(--spacing-12)', marginBottom: 'var(--spacing-12)', display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="场景名称"
            className="input"
            style={{ flex: 1 }}
            autoFocus
          />
          <input
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="图标 (可选)"
            className="input"
            style={{ width: '80px' }}
          />
          <button onClick={handleCreate} className="btn-primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn-secondary-pill">取消</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
        {localScenes.map((scene) => (
          <div key={scene.id} className="card" style={{ padding: 'var(--spacing-12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {editingId === scene.id ? (
              <div style={{ display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center', flex: 1 }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" style={{ flex: 1 }} autoFocus />
                <input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} placeholder="图标" className="input" style={{ width: '60px' }} />
                <button onClick={() => handleUpdate(scene.id)} className="btn-primary">保存</button>
                <button onClick={() => setEditingId(null)} className="btn-secondary-pill">取消</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500 }}>
                  {scene.icon && <span style={{ marginRight: 'var(--spacing-4)' }}>{scene.icon}</span>}
                  {scene.name}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                  <button
                    onClick={() => { setEditingId(scene.id); setEditName(scene.name); setEditIcon(scene.icon || '') }}
                    className="btn-secondary-pill"
                  >
                    编辑
                  </button>
                  <button onClick={() => setConfirmId(scene.id)} className="btn-secondary-pill" style={{ color: 'var(--color-error)' }}>
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {localScenes.length === 0 && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-muted)', padding: 'var(--spacing-16)', textAlign: 'center' }}>
            暂无场景，点击"新建场景"创建
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="删除场景"
        message="确定删除此场景？此操作不可恢复。"
        onConfirm={() => handleDelete(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}