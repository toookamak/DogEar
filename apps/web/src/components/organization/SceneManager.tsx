import { useState } from 'react'
import type { SceneResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

interface SceneManagerProps {
  scenes: SceneResponse[]
  onCreate: (data: { name: string; icon?: string }) => Promise<unknown>
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

/**
 * 场景管理：数据与增删改一律由上层 useOrganization 提供（单一数据源），
 * 本组件只保留输入态与展开/编辑态，不再自持一份列表副本。
 */
export function SceneManager({ scenes, onCreate, onUpdate, onDelete }: SceneManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await onCreate({ name: newName.trim(), icon: newIcon.trim() || undefined })
      setNewName('')
      setNewIcon('')
      setShowCreate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setError(null)
    try {
      await onUpdate(id, { name: editName.trim(), icon: editIcon.trim() || null })
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
        <h3 className="section-title">场景（{scenes.length}）</h3>
        <button onClick={() => setShowCreate(true)} className="btn btn--primary">
          + 新建场景
        </button>
      </div>

      {showCreate && (
        <div className="manager-create">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="场景名称"
            className="input manager-create-name"
            autoFocus
          />
          <input
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="图标 (可选)"
            className="input manager-create-icon"
          />
          <button onClick={handleCreate} className="btn btn--primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn btn--pill">取消</button>
        </div>
      )}

      <div className="list-stack">
        {scenes.map((scene) => (
          <div key={scene.id} className="list-row">
            {editingId === scene.id ? (
              <>
                <div className="manager-edit">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input manager-create-name" aria-label="场景名称" autoFocus />
                  <input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} placeholder="图标" className="input manager-create-icon" aria-label="场景图标" />
                </div>
                <div className="list-row-actions">
                  <button onClick={() => handleUpdate(scene.id)} className="btn btn--primary">保存</button>
                  <button onClick={() => setEditingId(null)} className="btn btn--pill">取消</button>
                </div>
              </>
            ) : (
              <>
                <div className="list-row-main">
                  <div className="list-row-title">
                    {scene.icon && <span className="manager-icon">{scene.icon}</span>}
                    {scene.name}
                  </div>
                  {!scene.enabled && <div className="list-row-meta">已停用</div>}
                </div>
                <div className="list-row-actions">
                  <button
                    onClick={() => { setEditingId(scene.id); setEditName(scene.name); setEditIcon(scene.icon || '') }}
                    className="btn btn--pill"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setConfirmId(scene.id)}
                    className="btn btn--pill"
                    style={{ color: 'var(--color-error)' }}
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {scenes.length === 0 && <p className="empty-note">暂无场景，点击「新建场景」创建。</p>}
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
