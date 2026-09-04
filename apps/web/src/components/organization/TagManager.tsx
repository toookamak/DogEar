import { useState } from 'react'
import { organizationApi } from '../../api/organization.js'
import type { TagResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

interface TagManagerProps {
  tags: TagResponse[]
}

export function TagManager({ tags }: TagManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [localTags, setLocalTags] = useState(tags)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const res = await organizationApi.tags.create({ name: newName.trim() })
      setLocalTags(prev => [...prev, res])
      setNewName('')
      setShowCreate(false)
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await organizationApi.tags.remove(id)
      setLocalTags(prev => prev.filter(t => t.id !== id))
    } catch { /* ignore */ }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-12)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: 0 }}>
          标签 ({localTags.length})
        </h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + 新建标签
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 'var(--spacing-12)', marginBottom: 'var(--spacing-12)', display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="标签名称"
            className="input"
            style={{ flex: 1 }}
            autoFocus
          />
          <button onClick={handleCreate} className="btn-primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn-secondary-pill">取消</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-8)' }}>
        {localTags.map((tag) => (
          <div key={tag.id} style={{
            background: 'var(--color-bg-surface-400)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-full-pill)',
            padding: 'var(--spacing-6) var(--spacing-12)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-6)',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}>{tag.name}</span>
            <button
              onClick={() => setConfirmId(tag.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
                lineHeight: 1,
              }}
              title="删除标签"
            >
              x
            </button>
          </div>
        ))}
        {localTags.length === 0 && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-muted)', padding: 'var(--spacing-16)', textAlign: 'center', width: '100%' }}>
            暂无标签，点击"新建标签"创建
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="删除标签"
        message="确定删除此标签？此操作不可恢复。"
        onConfirm={() => handleDelete(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}