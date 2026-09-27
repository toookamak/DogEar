import { useState } from 'react'
import type { TagResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'
import { Icon } from '../ui/Icon.js'

interface TagManagerProps {
  tags: TagResponse[]
  onCreate: (data: { name: string }) => Promise<unknown>
  /** 改名（v1.14）：撞已有 name_key 时上层透传 409 错误文案 */
  onRename: (id: string, data: { name: string }) => Promise<unknown>
  /** 合并到目标标签（v1.14）：源标签消失、挂载转移，不可撤销 */
  onMerge: (id: string, targetId: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

/** 标签管理：数据与增删改由上层 useOrganization 提供（单一数据源）。支持改名与合并。 */
export function TagManager({ tags, onCreate, onRename, onMerge, onDelete }: TagManagerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 行内改名态：editingId 非空时该标签渲染为输入框（对齐 FolderManager 的编辑模式）
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  // 合并态：mergeId 非空时展示目标标签选择
  const [mergeId, setMergeId] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergedSummary, setMergedSummary] = useState<string | null>(null)

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

  const handleRename = async () => {
    if (!editingId || !editName.trim()) return
    setError(null)
    try {
      await onRename(editingId, { name: editName.trim() })
      setEditingId(null)
    } catch (e) {
      // 409 撞名等服务端错误留在行内展示，便于就地修正
      setError(e instanceof Error ? e.message : '改名失败')
    }
  }

  const handleMerge = async () => {
    if (!mergeId || !mergeTargetId) return
    setError(null)
    setMerging(true)
    try {
      const result = await onMerge(mergeId, mergeTargetId) as { target?: { name?: string }; moved?: number }
      setMergeId(null)
      setMergeTargetId('')
      const moved = typeof result?.moved === 'number' ? result.moved : 0
      const targetName = result?.target?.name ?? '目标标签'
      setError(null)
      // 合并不可撤销，结果如实汇报迁移了多少条挂载
      setMergedSummary(`已把挂载合并到「${targetName}」（迁移 ${moved} 条挂载），原标签已移除。`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '合并失败')
    } finally {
      setMerging(false)
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
      {mergedSummary && (
        <div className="alert alert--info" role="status">
          {mergedSummary}
          <button type="button" className="mini-btn" onClick={() => setMergedSummary(null)}>知道了</button>
        </div>
      )}

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
            {editingId === tag.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="input tag-chip-rename-input"
                  aria-label={`改名标签 ${tag.name}`}
                  autoFocus
                />
                <button type="button" className="mini-btn" onClick={() => void handleRename()}>保存</button>
                <button type="button" className="mini-btn" onClick={() => setEditingId(null)}>取消</button>
              </>
            ) : (
              <>
                {tag.name}
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => { setEditingId(tag.id); setEditName(tag.name); setError(null) }}
                  title="改名"
                  aria-label={`改名标签 ${tag.name}`}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => { setMergeId(tag.id); setMergeTargetId(''); setError(null) }}
                  title="合并到其他标签"
                  aria-label={`合并标签 ${tag.name}`}
                >
                  <Icon name="swap" />
                </button>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => setConfirmId(tag.id)}
                  title="删除标签"
                  aria-label={`删除标签 ${tag.name}`}
                >
                  <Icon name="close" />
                </button>
              </>
            )}
          </span>
        ))}
        {tags.length === 0 && <p className="empty-note">暂无标签，点击「新建标签」创建。</p>}
      </div>

      {/* 合并目标选择：仅展示其他标签；没有可选目标时给出明确出口 */}
      {mergeId !== null && (
        <div className="manager-create" role="group" aria-label="合并标签">
          <span className="merge-label">
            把「{tags.find((t) => t.id === mergeId)?.name ?? ''}」合并到
          </span>
          <select
            value={mergeTargetId}
            className="input"
            onChange={(e) => setMergeTargetId(e.target.value)}
            aria-label="选择合并目标标签"
          >
            <option value="">选择目标标签…</option>
            {tags.filter((t) => t.id !== mergeId).map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <button type="button" className="btn btn--primary" disabled={!mergeTargetId || merging} onClick={() => void handleMerge()}>
            {merging ? '合并中…' : '合并'}
          </button>
          <button type="button" className="btn btn--pill" onClick={() => setMergeId(null)}>取消</button>
          {tags.length <= 1 && <span className="empty-note">没有其他标签可作为合并目标。</span>}
        </div>
      )}

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
