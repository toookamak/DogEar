import { useEffect, useRef, useState } from 'react'
import { settingsApi } from '../../../api/settings.js'

const CAPABILITIES = [
  { key: 'read', label: '读取', hint: '允许 Agent 搜索与读取书签' },
  { key: 'write_new', label: '新建', hint: '允许 Agent / 浏览器扩展保存新书签' },
  { key: 'update_existing', label: '修改', hint: '允许 Agent 更新已有书签' },
] as const

type CapabilityKey = typeof CAPABILITIES[number]['key']

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
 * Agent 接入：能力开关、Skill Token（明文只在生成时展示一次）、今日用量与接入信息。
 */
export function AgentTab() {
  const [caps, setCaps] = useState<Caps>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [tokenStatus, setTokenStatus] = useState<{ configured: boolean; fromEnv: boolean; fromSettings: boolean } | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState<'token' | 'origin' | null>(null)
  const tokenInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.allSettled([settingsApi.list(), settingsApi.tokenStatus()])
      .then(([settingsRes, tokenRes]) => {
        if (settingsRes.status === 'fulfilled') {
          const entry = settingsRes.value.items.find((item) => item.key === 'skill.capabilities')
          if (entry && entry.value && typeof entry.value === 'object') {
            setCaps({ ...DEFAULTS, ...(entry.value as Partial<Caps>) })
          }
        }
        if (tokenRes.status === 'fulfilled') setTokenStatus(tokenRes.value)
      })
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

  const rotate = async () => {
    if (tokenStatus?.fromSettings && !window.confirm('重新生成会使当前界面 Token 立即失效（环境变量里的 Token 仍有效）。继续？')) return
    setRotating(true)
    setNotice(null)
    try {
      const result = await settingsApi.rotateToken()
      setFreshToken(result.token)
      setTokenStatus({ configured: true, fromEnv: tokenStatus?.fromEnv ?? false, fromSettings: true })
      setNotice({ kind: 'success', text: 'Token 已生成，请立即复制。离开本页后无法再查看明文。' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '生成失败' })
    }
    setRotating(false)
  }

  const copy = async (value: string, source: 'token' | 'origin' = 'origin') => {
    let ok = false
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      const input = source === 'token' ? tokenInputRef.current : null
      if (input) {
        input.focus()
        input.select()
        ok = document.execCommand('copy')
      }
    }
    if (!ok) {
      setNotice({ kind: 'error', text: '复制失败，请手动选中输入框复制。' })
      return
    }
    setCopied(source)
    setNotice({ kind: 'success', text: source === 'token' ? 'Token 已复制，可粘贴到扩展。' : '已复制到剪贴板。' })
    window.setTimeout(() => setCopied((current) => (current === source ? null : current)), 2000)
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

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
        <p className="muted muted--gap-top">
          浏览器扩展保存需要开启「新建」。关闭后写入请求会被拒绝并计入「已拦截」用量。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="section-title">Skill Token</h3>
        <p className="muted">
          填入 Chrome 扩展或 Agent 的 Bearer Token。明文只在生成时显示一次，服务端只保存摘要。
        </p>
        <div className="list-stack">
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">当前状态</div>
              <div className="list-row-meta">
                {!loaded
                  ? '加载中…'
                  : tokenStatus?.configured
                    ? `已配置${tokenStatus.fromSettings ? '（设置页）' : ''}${tokenStatus.fromEnv ? '（环境变量）' : ''}`
                    : '尚未配置'}
              </div>
            </div>
            <div className="list-row-actions">
              <button type="button" className="btn btn--primary" disabled={rotating} onClick={() => { void rotate() }}>
                {rotating ? '生成中…' : tokenStatus?.fromSettings ? '重新生成' : '生成 Token'}
              </button>
            </div>
          </div>
          {freshToken && (
            <div className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">新 Token（只显示这一次）</div>
                <input
                  ref={tokenInputRef}
                  className="input mono"
                  readOnly
                  value={freshToken}
                  aria-label="Skill Token"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
              <div className="list-row-actions">
                <button type="button" className="btn btn--primary" onClick={() => { void copy(freshToken, 'token') }}>
                  {copied === 'token' ? '已复制' : '复制 Token'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="section-title">接入信息</h3>
        <div className="list-stack">
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">接口地址</div>
              <div className="list-row-meta mono">{origin}/api/skill/&lt;name&gt;</div>
            </div>
            <div className="list-row-actions">
              <button type="button" className="btn btn--ghost" onClick={() => { void copy(origin) }}>复制地址</button>
            </div>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">鉴权方式</div>
              <div className="list-row-meta">Authorization: Bearer &lt;Skill Token&gt;</div>
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
        <div className="chips-row">
          {SKILLS.map((name) => (
            <span key={name} className="badge mono">{name}</span>
          ))}
        </div>
      </section>
    </>
  )
}
