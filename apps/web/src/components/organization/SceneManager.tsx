import { useState } from 'react'
import type { SceneResponse } from '../../types/api.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'

/**
 * 场景「用途」选项（AERR 原型的用户侧文案，2026-09-12 定稿）。
 * PRD 规定 AERR 四个词是系统内部概念、不展示给用户——界面上只出现
 * 行为描述；取值即 scene-presentation.ts 映射表的 key，改挂即时生效。
 */
const PURPOSE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'reference', label: '参考资料 · 紧凑检索，按标题定位' },
  { value: 'action', label: '近期要办 · 按最近加入' },
  { value: 'explore', label: '发散浏览 · 找灵感' },
  { value: 'read', label: '待读清单 · 准备读掉' },
]

function purposeLabel(value: string | null | undefined): string {
  return PURPOSE_OPTIONS.find((o) => o.value === value)?.label ?? PURPOSE_OPTIONS[0].label
}

interface SceneManagerProps {
  scenes: SceneResponse[]
  onCreate: (data: { name: string; icon?: string; aerr?: string }) => Promise<unknown>
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
  const [newAerr, setNewAerr] = useState('reference')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editAerr, setEditAerr] = useState('reference')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await onCreate({ name: newName.trim(), icon: newIcon.trim() || undefined, aerr: newAerr })
      setNewName('')
      setNewIcon('')
      setNewAerr('reference')
      setShowCreate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setError(null)
    try {
      await onUpdate(id, { name: editName.trim(), icon: editIcon.trim() || null, aerr: editAerr })
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
      const raw = e instanceof Error ? e.message : '删除失败'
      // 服务端对「仍有书签的场景」返回 409 SCENE_IN_USE。这不是故障，
      // 而是要求改用停用（停用不删历史挂载）——给出可执行的下一步而不是抛原始错误。
      setError(
        /SCENE_IN_USE|in use/i.test(raw)
          ? '该场景下仍有书签，无法删除。可改为「停用」：停用后挑选器里不再出现，但已挂上的书签仍能按它筛到。'
          : raw,
      )
    }
    setConfirmId(null)
  }

  /** 停用 / 启用：停用不删历史挂载（docs/modules/20260904_数据库设计.md） */
  const handleToggleEnabled = async (scene: SceneResponse) => {
    setError(null)
    try {
      await onUpdate(scene.id, { enabled: !scene.enabled })
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
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
          {/* 用途即 AERR 原型的用户侧文案（不出现 AERR 四词），决定默认排序/密度/主操作 */}
          <select
            value={newAerr}
            onChange={(e) => setNewAerr(e.target.value)}
            className="input manager-create-parent"
            aria-label="场景用途"
          >
            {PURPOSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={handleCreate} className="btn btn--primary">创建</button>
          <button onClick={() => setShowCreate(false)} className="btn btn--pill">取消</button>
        </div>
      )}

      <div className="list-stack">
        {scenes.map((scene) => (
          <div key={scene.id} className={`list-row${scene.enabled ? '' : ' list-row--muted'}`}>
            {editingId === scene.id ? (
              <>
                <div className="manager-edit">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input manager-create-name" aria-label="场景名称" autoFocus />
                  <input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} placeholder="图标" className="input manager-create-icon" aria-label="场景图标" />
                  <select
                    value={editAerr}
                    onChange={(e) => setEditAerr(e.target.value)}
                    className="input manager-create-parent"
                    aria-label="场景用途"
                  >
                    {PURPOSE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
                    {!scene.enabled && <span className="badge badge--gap">已停用</span>}
                  </div>
                  {/* 当前用途（行为描述，不出现 AERR 术语）；停用行优先展示停用说明 */}
                  {!scene.enabled ? (
                    <div className="list-row-meta">
                      挑选器里不再出现；已挂上的书签仍能按它筛到
                    </div>
                  ) : (
                    <div className="list-row-meta">{purposeLabel(scene.aerr)}</div>
                  )}
                </div>
                <div className="list-row-actions">
                  <button
                    onClick={() => { setEditingId(scene.id); setEditName(scene.name); setEditIcon(scene.icon || ''); setEditAerr(scene.aerr || 'reference') }}
                    className="btn btn--pill"
                  >
                    编辑
                  </button>
                  <button onClick={() => handleToggleEnabled(scene)} className="btn btn--pill">
                    {scene.enabled ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => setConfirmId(scene.id)}
                    className="btn btn--pill btn--danger"
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
        message="确定删除此场景？此操作不可恢复。若该场景下仍有书签，删除会被拒绝——请改用「停用」，停用不会移除已有的挂载。"
        confirmLabel="删除"
        onConfirm={() => handleDelete(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
