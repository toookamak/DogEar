import { useState } from 'react'
import type { TagResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

interface TagManagerProps {
  tags: TagResponse[]
  onCreate: (data: { name: string }) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

/** 标签管理：数据与增删改由上层 useOrganization 提供（单一数据源）。标签不可改名。 */
export function TagManager({ tags, onCreate, onDelete }: TagManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await onCreate({ name: newName.trim() })
      setNewName('')
      setShowCreate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
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
        <h3 className="section-title">标签（{tags.length}）</h3>
        <button onClick={() => setShowCreate(true)} className="btn btn--primary">
          + 新建标签
        </button>
      </div>

      {showCreate && (
        <div className="manager-create">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="标签名称"
            className="input manager-create-name"
            autoFocus
          />
          <button onClick={handleCreate} className="btn btn--primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn btn--pill">取消</button>
        </div>
      )}

      <div className="tag-cloud">
        {tags.map((tag) => (
          <span key={tag.id} className="tag-chip">
            {tag.name}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={() => setConfirmId(tag.id)}
              title="删除标签"
              aria-label={`删除标签 ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {tags.length === 0 && <p className="empty-note">暂无标签，点击「新建标签」创建。</p>}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="删除标签"
        message="确定删除此标签？该书签上的该标签归属会一并移除，操作不可恢复。"
        onConfirm={() => handleDelete(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
