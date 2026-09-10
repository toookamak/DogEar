import { useEffect, useState } from 'react'
import { settingsApi } from '../../../api/settings.js'

const CAPABILITIES = [
  { key: 'read', label: '读取', hint: '允许 Agent 搜索与读取书签' },
  { key: 'write_new', label: '新建', hint: '允许 Agent 保存新书签' },
  { key: 'update_existing', label: '修改', hint: '允许 Agent 更新已有书签' },
] as const

type CapabilityKey = typeof CAPABILITIES[number]['key']

/** Skill 名称以 docs/API结构表.md 第 6 章为准，七个名字不得改 */
const SKILLS = [
  'save_bookmark',
  'search_bookmarks',
  'update_bookmark',
  'list_bookmarks',
  'get_stats',
  'trigger_archive',
  'suggest_scene',
]

interface Caps {
  read: boolean
  write_new: boolean
  update_existing: boolean
}

const DEFAULTS: Caps = { read: true, write_new: false, update_existing: false }

/**
 * Agent 接入：能力开关（读 / 新建 / 修改）、今日用量与接入信息。
 * 开关经 PUT /api/settings 的 skill.capabilities 白名单写入。
 * Skill Token 属敏感设置，服务端按 key 过滤不返回，故此处不展示、不提供查看入口。
 */
export function AgentTab() {
  const [caps, setCaps] = useState<Caps>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    settingsApi.list()
      .then((res) => {
        const entry = res.items.find((item) => item.key === 'skill.capabilities')
        if (entry && entry.value && typeof entry.value === 'object') {
          setCaps({ ...DEFAULTS, ...(entry.value as Partial<Caps>) })
        }
      })
      .catch(() => { /* 读取失败保留默认值 */ })
      .finally(() => setLoaded(true))
  }, [])

  const toggle = async (key: CapabilityKey) => {
    const next = { ...caps, [key]: !caps[key] }
    setCaps(next)
    setSaving(true)
    setNotice(null)
    try {
      await settingsApi.update({ 'skill.capabilities': next })
      setNotice({ kind: 'success', text: '能力开关已保存。' })
    } catch (e) {
      setCaps(caps)
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '保存失败' })
    }
    setSaving(false)
  }

  return (
    <>
      {notice && <div className={`alert alert--${notice.kind}`}>{notice.text}</div>}

      <section className="settings-section">
        <h3 className="section-title">能力开关</h3>
        {!loaded ? (
          <p className="empty-note">加载中…</p>
        ) : (
          <div className="list-stack">
            {CAPABILITIES.map((cap) => (
              <div key={cap.key} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{cap.label}</div>
                  <div className="list-row-meta">{cap.hint}</div>
                </div>
                <div className="list-row-actions">
                  <button
                    type="button"
                    className={caps[cap.key] ? 'btn btn--primary' : 'btn btn--ghost'}
                    aria-pressed={caps[cap.key]}
                    disabled={saving}
                    onClick={() => toggle(cap.key)}
                  >
                    {caps[cap.key] ? '已开启' : '已关闭'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: 'var(--spacing-12)' }}>
          关闭「新建」或「修改」后，Agent 的写入请求会被拒绝并计入「已拦截」用量。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="section-title">接入信息</h3>
        <div className="list-stack">
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">接口地址</div>
              <div className="list-row-meta mono">{window.location.origin}/api/skill/&lt;name&gt;</div>
            </div>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">鉴权方式</div>
              <div className="list-row-meta">Bearer Token（服务端环境变量配置，不在界面展示）</div>
            </div>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">能力清单</div>
              <div className="list-row-meta mono">GET /.well-known/capabilities</div>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="section-title">可用 Skill（7 个）</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-6)' }}>
          {SKILLS.map((name) => (
            <span key={name} className="badge mono">{name}</span>
          ))}
        </div>
      </section>
    </>
  )
}
