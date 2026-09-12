import { useEffect, useState } from 'react'
import { navApi, type NavRule } from '../../api/nav.js'
import { notifyOrgChanged } from '../../org-events.js'
import { toast, errorMessage } from '../../toast.js'
import type { SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'

interface NavRuleManagerProps {
  scenes: SceneResponse[]
  folders: FolderResponse[]
  tags: TagResponse[]
}

type Mode = 'all' | 'rule' | 'search' | 'hide'

const MODE_OPTIONS: Array<{ value: Mode; label: string; hint: string }> = [
  { value: 'all', label: '全部书签', hint: '集合重置为全部候选（非私密、不含 Inbox）' },
  { value: 'rule', label: '按条件加入', hint: '满足任一条件的书签加入展示（条件之间是「或」）' },
  { value: 'search', label: '按搜索加入', hint: '搜索命中的书签加入展示' },
  { value: 'hide', label: '隐藏命中项', hint: '满足条件的书签从当前展示中移出' },
]

const STATUS_OPTIONS = [
  { value: '', label: '不限状态' },
  { value: 'unread', label: '待处理' },
  { value: 'saved', label: '已确认' },
  { value: 'archived', label: '搁置' },
]

interface FormState {
  name: string
  mode: Mode
  sceneIds: string[]
  folderIds: string[]
  tagIds: string[]
  status: string
  searchQuery: string
  sortOrder: number
}

const EMPTY_FORM: FormState = {
  name: '',
  mode: 'rule',
  sceneIds: [],
  folderIds: [],
  tagIds: [],
  status: '',
  searchQuery: '',
  sortOrder: 0,
}

/** 规则的 rule JSON（仅 rule/hide 模式携带条件） */
function buildRulePayload(form: FormState): string | undefined {
  if (form.mode !== 'rule' && form.mode !== 'hide') return undefined
  const payload: Record<string, unknown> = {}
  if (form.sceneIds.length) payload.sceneIds = form.sceneIds
  if (form.folderIds.length) payload.folderIds = form.folderIds
  if (form.tagIds.length) payload.tagIds = form.tagIds
  if (form.status) payload.status = form.status
  if (Object.keys(payload).length === 0) return undefined
  return JSON.stringify(payload)
}

function describeRule(rule: NavRule, names: { scenes: SceneResponse[]; folders: FolderResponse[]; tags: TagResponse[] }): string {
  const payload = (() => {
    if (!rule.rule) return {}
    try {
      return JSON.parse(rule.rule) as Record<string, unknown>
    } catch {
      return {}
    }
  })()
  const nameOf = (list: Array<{ id: string; name: string }>, id: string) => list.find((x) => x.id === id)?.name ?? id.slice(0, 8)
  const parts: string[] = []
  for (const sid of (payload.sceneIds as string[] | undefined) ?? []) parts.push(`场景「${nameOf(names.scenes, sid)}」`)
  for (const fid of (payload.folderIds as string[] | undefined) ?? []) parts.push(`文件夹「${nameOf(names.folders, fid)}」`)
  for (const tid of (payload.tagIds as string[] | undefined) ?? []) parts.push(`标签「${nameOf(names.tags, tid)}」`)
  if (typeof payload.status === 'string' && payload.status) {
    parts.push(`状态 ${STATUS_OPTIONS.find((s) => s.value === payload.status)?.label ?? payload.status}`)
  }
  switch (rule.mode) {
    case 'all': return '展示全部候选书签'
    case 'search': return `搜索「${rule.searchQuery ?? ''}」的命中加入展示`
    case 'rule': return parts.length ? `命中（${parts.join(' / ')}）加入展示` : '未配置条件（不加入任何条目）'
    case 'hide': return parts.length ? `命中（${parts.join(' / ')}）移出展示` : '未配置条件（不移除任何条目）'
    default: return rule.mode
  }
}

/**
 * 导航展示规则管理（L4，API 结构表 v1.6）。
 * 规则按排序逐条圈定导航展示集合，语义见 apps/server/src/nav/evaluator.ts；
 * 保存后 notifyOrgChanged 驱动导航页与侧栏同步刷新。
 */
export function NavRuleManager({ scenes, folders, tags }: NavRuleManagerProps) {
  const [rules, setRules] = useState<NavRule[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await navApi.rules.list()
      setRules(res.items ?? [])
      setLoaded(true)
    } catch (e) {
      setError(errorMessage(e, '读取规则失败'))
    }
  }

  useEffect(() => { void load() }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (rule: NavRule) => {
    const payload = (() => {
      if (!rule.rule) return {}
      try { return JSON.parse(rule.rule) as Record<string, unknown> } catch { return {} }
    })()
    setForm({
      name: rule.name,
      mode: rule.mode,
      sceneIds: Array.isArray(payload.sceneIds) ? payload.sceneIds as string[] : [],
      folderIds: Array.isArray(payload.folderIds) ? payload.folderIds as string[] : [],
      tagIds: Array.isArray(payload.tagIds) ? payload.tagIds as string[] : [],
      status: typeof payload.status === 'string' ? payload.status : '',
      searchQuery: rule.searchQuery ?? '',
      sortOrder: rule.sortOrder,
    })
    setEditingId(rule.id)
    setShowForm(true)
  }

  const toggleIn = (key: 'sceneIds' | 'folderIds' | 'tagIds', id: string) => {
    setForm((prev) => {
      const current = prev[key]
      return { ...prev, [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] }
    })
  }

  const save = async () => {
    if (!form.name.trim()) {
      setError('规则名称不能为空')
      return
    }
    if ((form.mode === 'rule' || form.mode === 'hide') && !buildRulePayload(form)) {
      setError('请至少勾选一个条件（场景 / 文件夹 / 标签 / 状态）')
      return
    }
    if (form.mode === 'search' && !form.searchQuery.trim()) {
      setError('请填写搜索词')
      return
    }
    setError(null)
    const body = {
      name: form.name.trim(),
      mode: form.mode,
      rule: buildRulePayload(form),
      searchQuery: form.mode === 'search' ? form.searchQuery.trim() : undefined,
      sortOrder: form.sortOrder,
    }
    try {
      if (editingId) await navApi.rules.update(editingId, { ...body, updatedAt: new Date().toISOString() })
      else await navApi.rules.create(body)
      setShowForm(false)
      setEditingId(null)
      await load()
      notifyOrgChanged()
      toast.success(editingId ? '规则已更新，导航页已刷新' : '规则已创建，导航页已刷新')
    } catch (e) {
      setError(errorMessage(e, '保存失败'))
    }
  }

  const remove = async (id: string) => {
    try {
      await navApi.rules.remove(id)
      setConfirmId(null)
      await load()
      notifyOrgChanged()
      toast.success('规则已删除，导航页已刷新')
    } catch (e) {
      setError(errorMessage(e, '删除失败'))
      setConfirmId(null)
    }
  }

  const toggleEnabled = async (rule: NavRule) => {
    try {
      await navApi.rules.update(rule.id, { enabled: !rule.enabled })
      await load()
      notifyOrgChanged()
    } catch (e) {
      setError(errorMessage(e, '操作失败'))
    }
  }

  const checkboxGroup = (
    label: string,
    options: Array<{ id: string; name: string }>,
    key: 'sceneIds' | 'folderIds' | 'tagIds',
  ) => (
    <div className="channel-field">
      <span className="channel-field-label">{label}</span>
      <div className="chips-row">
        {options.length === 0 && <span className="channel-field-hint">还没有可选项，先去组织管理创建</span>}
        {options.map((o) => (
          <label key={o.id} className="save-form-check">
            <input
              type="checkbox"
              checked={form[key].includes(o.id)}
              onChange={() => toggleIn(key, o.id)}
            />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  )

  const modeHint = MODE_OPTIONS.find((m) => m.value === form.mode)?.hint

  return (
    <div>
      {error && <div className="alert alert--error">{error}</div>}

      <div className="manager-head">
        <h3 className="section-title">导航展示规则（{rules.length}）</h3>
        <button type="button" className="btn btn--primary" onClick={openCreate}>+ 新建规则</button>
      </div>

      <p className="muted muted--gap-bottom">
        规则按顺序逐条圈定导航页的展示范围：可「加入」（按条件 / 按搜索）也可「隐藏」。私密与 Inbox
        永不展示；没有任何规则时导航展示全部候选（与旧行为一致）。
      </p>

      {showForm && (
        <div className="channel-form">
          <div className="channel-form-grid">
            <div className="channel-field">
              <span className="channel-field-label">规则名称</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：工作研究进导航"
                autoFocus
              />
            </div>
            <div className="channel-field">
              <span className="channel-field-label">动作</span>
              <select
                className="input"
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as Mode })}
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {modeHint && <span className="channel-field-hint">{modeHint}</span>}
            </div>
          </div>

          {(form.mode === 'rule' || form.mode === 'hide') && (
            <>
              {checkboxGroup('场景（任一命中）', scenes, 'sceneIds')}
              {checkboxGroup('文件夹（任一命中）', folders, 'folderIds')}
              {checkboxGroup('标签（任一命中）', tags, 'tagIds')}
              <div className="channel-field">
                <span className="channel-field-label">状态</span>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {form.mode === 'search' && (
            <div className="channel-field">
              <span className="channel-field-label">搜索词（命中标题 / URL / 标签 / 备注）</span>
              <input
                className="input"
                value={form.searchQuery}
                onChange={(e) => setForm({ ...form, searchQuery: e.target.value })}
                placeholder="例如：workers"
              />
            </div>
          )}

          <div className="channel-form-actions">
            <button type="button" className="btn btn--primary" onClick={() => { void save() }}>
              {editingId ? '保存规则' : '创建规则'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { setShowForm(false); setEditingId(null); setError(null) }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="list-stack">
        {rules.map((rule, index) => (
          <div key={rule.id} className={`list-row${rule.enabled ? '' : ' list-row--muted'}`}>
            <div className="list-row-main">
              <div className="list-row-title">
                <span className="badge badge--gap">{index + 1}</span>
                {rule.name}
                {!rule.enabled && <span className="badge badge--gap">已停用</span>}
              </div>
              <div className="list-row-meta">{describeRule(rule, { scenes, folders, tags })}</div>
            </div>
            <div className="list-row-actions">
              <button type="button" className="btn btn--pill" onClick={() => openEdit(rule)}>编辑</button>
              <button type="button" className="btn btn--pill" onClick={() => { void toggleEnabled(rule) }}>
                {rule.enabled ? '停用' : '启用'}
              </button>
              <button type="button" className="btn btn--pill btn--danger" onClick={() => setConfirmId(rule.id)}>删除</button>
            </div>
          </div>
        ))}
        {loaded && rules.length === 0 && (
          <p className="empty-note">
            还没有规则：导航页当前展示全部候选（非私密、不含 Inbox）。建一条规则即可开始圈定展示范围。
          </p>
        )}
      </div>

      {confirmId && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button type="button" className="modal-scrim" aria-label="取消" onClick={() => setConfirmId(null)} />
          <div className="modal">
            <h3 className="modal-title">删除规则</h3>
            <p className="modal-message">删除后导航页会立即按剩余规则重新求值。确定删除？</p>
            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmId(null)}>取消</button>
              <button type="button" className="btn btn--danger" onClick={() => { void remove(confirmId) }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
