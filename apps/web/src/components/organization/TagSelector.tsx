import { useState } from 'react'
import type { TagResponse } from '../../types/api.js'
import { organizationApi } from '../../api/organization.js'
import { notifyOrgChanged } from '../../org-events.js'
import { errorMessage } from '../../toast.js'

interface TagSelectorProps {
  tags: TagResponse[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/**
 * 标签挑选器，支持**就地新建**。
 *
 * 设计取舍：
 * - 标签是库级资源，新建即刻落库（POST /api/tags），并广播 org 变更让侧栏同步；
 *   挂到当前书签仍属于「未保存的改动」，随详情页的「保存」一起提交——与其它维度一致。
 * - 服务端对重复 name_key 会返回**已有标签**而非报错（见 docs/API结构表.md），
 *   因此重复输入不会失败，直接复用并选中即可。
 * - 新建的标签先并入本地列表，否则 chip 不会立即出现（props 里的列表要等下次加载）。
 */
export function TagSelector({ tags, selectedIds, onChange }: TagSelectorProps) {
  const [created, setCreated] = useState<TagResponse[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 合并外部列表与本次新建的（按 id 去重，外部列表较新时优先）
  const merged = (() => {
    const seen = new Set(tags.map((t) => t.id))
    return [...tags, ...created.filter((t) => !seen.has(t.id))]
  })()

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((t) => t !== id) : [...selectedIds, id])
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const tag = await organizationApi.tags.create({ name: trimmed }) as TagResponse
      setCreated((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]))
      if (!selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id])
      setName('')
      notifyOrgChanged()
    } catch (e) {
      setError(errorMessage(e, '新建标签失败'))
    }
    setBusy(false)
  }

  return (
    <div className="tag-selector">
      <div className="chip-group">
        {merged.length === 0 && <p className="empty-note">还没有标签，可在下方直接新建。</p>}
        {merged.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className="chip"
            aria-pressed={selectedIds.includes(tag.id)}
            onClick={() => toggle(tag.id)}
          >
            {tag.name}
          </button>
        ))}
      </div>

      <div className="tag-create">
        <input
          type="text"
          className="input tag-create-input"
          value={name}
          placeholder="新建标签…"
          aria-label="新建标签名称"
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // 回车提交，避免与表单默认行为冲突
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleCreate()
            }
          }}
        />
        <button
          type="button"
          className="btn btn--pill"
          disabled={busy || !name.trim()}
          onClick={() => { void handleCreate() }}
        >
          {busy ? '新建中…' : '新建并选中'}
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
    </div>
  )
}
