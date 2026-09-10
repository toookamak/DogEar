import { useState } from 'react'
import type { ChannelConfigItem } from '../../api/channels.js'
import { channelsApi } from '../../api/channels.js'
import { errorMessage } from '../../toast.js'

interface ChannelConfigProps {
  channel: ChannelConfigItem | null
  defaultChannel?: 'raindrop' | 'webdav'
  onSaved: () => void
  onCancel: () => void
}

/** 只提供本组件真正处理的类型；S3 有独立表单（S3Config），不在此下拉里选 */
const SELECTABLE: { value: 'raindrop' | 'webdav'; label: string }[] = [
  { value: 'raindrop', label: 'Raindrop.io' },
  { value: 'webdav', label: 'WebDAV' },
]

/** 已保存的密钥做遮罩展示：保留首尾各 3 位，中间打星 */
function mask(value: unknown): string {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 6) return '*'.repeat(text.length)
  return `${text.slice(0, 3)}${'*'.repeat(text.length - 6)}${text.slice(-3)}`
}

/**
 * Raindrop / WebDAV 通道配置表单。
 * 密钥字段一律「留空表示保留原值」——服务端会掩码返回，前端不持有明文。
 */
export function ChannelConfig({ channel, defaultChannel = 'raindrop', onSaved, onCancel }: ChannelConfigProps) {
  const isNew = !channel
  const [channelType, setChannelType] = useState<'raindrop' | 'webdav'>(
    (channel?.channel as 'raindrop' | 'webdav' | undefined) || defaultChannel,
  )
  const [label, setLabel] = useState(channel?.label || '')
  // 密钥类：新建时为空；编辑时留空代表保留
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState(String(channel?.config.client_id || ''))
  const [clientSecret, setClientSecret] = useState('')
  const [webdavPassword, setWebdavPassword] = useState('')
  // 非密钥类：编辑时用已保存值初始化，且受控于本地 state
  // （此前编辑态直接把 channel.config 当 value 用，输入不会回显，等于改不动）
  const [webdavUrl, setWebdavUrl] = useState(String(channel?.config.url || ''))
  const [webdavUsername, setWebdavUsername] = useState(String(channel?.config.username || ''))

  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)

  const fail = (message: string) => setNotice({ ok: false, message })

  const handleTest = async () => {
    if (!channel) {
      setNotice({ ok: true, message: '保存后即可测试连接。' })
      return
    }
    setTesting(true)
    setNotice(null)
    try {
      const res = await channelsApi.test(channel.id)
      setNotice({ ok: res.ok, message: res.message || (res.ok ? '连接成功' : '连接失败') })
    } catch (e) {
      setNotice({ ok: false, message: errorMessage(e, '测试失败') })
    }
    setTesting(false)
  }

  const handleOAuth = () => {
    if (channelType !== 'raindrop') return
    const id = clientId.trim() || String(channel?.config.client_id || '')
    if (!id) {
      fail('请先填写 Client ID')
      return
    }
    const redirectUri = `${window.location.origin}/settings/oauth/callback`
    const state = channel?.id ?? ''
    window.location.href =
      `https://raindrop.io/oauth/authorize?client_id=${encodeURIComponent(id)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(state)}`
  }

  const handleSave = async () => {
    if (!label.trim()) {
      fail('请输入配置名称')
      return
    }

    let config: Record<string, string>
    if (channelType === 'raindrop') {
      const hasOAuthCreds = Boolean(clientId.trim() || clientSecret.trim())
      if (!token.trim() && isNew && !hasOAuthCreds) {
        fail('请输入 Raindrop API Token，或填写 OAuth Client ID / Secret')
        return
      }
      config = {}
      if (token.trim()) config.token = token.trim()
      const resolvedClientId = clientId.trim() || String(channel?.config.client_id || '')
      if (resolvedClientId) config.client_id = resolvedClientId
      if (clientSecret.trim()) config.client_secret = clientSecret.trim()
    } else {
      if (!webdavUrl.trim()) {
        fail('请输入 WebDAV 地址')
        return
      }
      if (!webdavUsername.trim()) {
        fail('请输入 WebDAV 用户名')
        return
      }
      if (!webdavPassword.trim() && isNew) {
        fail('请输入 WebDAV 密码')
        return
      }
      config = { url: webdavUrl.trim(), username: webdavUsername.trim() }
      if (webdavPassword.trim()) config.password = webdavPassword.trim()
    }

    setSaving(true)
    setNotice(null)
    try {
      await channelsApi.save({
        channel: channelType,
        label: label.trim(),
        config: JSON.stringify(config),
        enabled: true,
      }, channel?.id)
      setSaving(false)
      onSaved()
    } catch (e) {
      fail(errorMessage(e, '保存失败'))
      setSaving(false)
    }
  }

  const redirectUri = `${window.location.origin}/settings/oauth/callback`

  return (
    <div className="channel-form">
      <h3 className="section-title" style={{ margin: 0 }}>{isNew ? '添加通道' : '编辑通道'}</h3>

      <div className="channel-form-grid">
        <label className="channel-field">
          <span className="channel-field-label">通道类型</span>
          <select
            value={channelType}
            onChange={(e) => setChannelType(e.target.value as 'raindrop' | 'webdav')}
            disabled={!isNew}
            className="input"
          >
            {SELECTABLE.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {!isNew && <span className="channel-field-hint">类型创建后不可更改</span>}
        </label>

        <label className="channel-field">
          <span className="channel-field-label">配置名称</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：我的 Raindrop"
            className="input"
          />
        </label>
      </div>

      {channelType === 'raindrop' && (
        <>
          <label className="channel-field">
            <span className="channel-field-label">API Token{!isNew && '（已遮罩）'}</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={isNew ? '输入你的 Raindrop API Token' : `已保存 ${mask(channel?.config.token)}，留空则保留`}
              className="input"
            />
            <span className="channel-field-hint">
              手动 Token（Test Token 24 小时过期）。也可用下方 OAuth 授权获取长期 access token。
            </span>
          </label>

          <div className="detail-section">
            <h4 className="section-title" style={{ fontSize: '14px' }}>OAuth 授权（官方）</h4>
            <p className="muted" style={{ margin: 0 }}>
              到 Raindrop「设置 → 集成 → 创建 App」，Redirect URI 填 <code className="mono">{redirectUri}</code>，
              拿到 Client ID / Secret 后填入。
            </p>

            <div className="channel-form-grid">
              <label className="channel-field">
                <span className="channel-field-label">Client ID</span>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Raindrop App Client ID"
                  className="input"
                />
              </label>

              <label className="channel-field">
                <span className="channel-field-label">
                  Client Secret{!isNew && String(channel?.config.client_secret || '') ? '（已保存，留空则保留）' : ''}
                </span>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={isNew ? 'Raindrop App Client Secret' : `已保存 ${mask(channel?.config.client_secret)}，留空则保留`}
                  className="input"
                />
              </label>
            </div>

            <div className="channel-form-actions">
              <button type="button" onClick={handleOAuth} className="btn btn--ghost">
                通过 OAuth 授权
              </button>
            </div>
          </div>
        </>
      )}

      {channelType === 'webdav' && (
        <>
          <label className="channel-field">
            <span className="channel-field-label">WebDAV 地址</span>
            <input
              type="text"
              value={webdavUrl}
              onChange={(e) => setWebdavUrl(e.target.value)}
              placeholder="https://example.com/remote.php/dav/files/username/"
              className="input"
            />
            <span className="channel-field-hint">服务器地址，例如 NextCloud / ownCloud 的 WebDAV 端点</span>
          </label>

          <div className="channel-form-grid">
            <label className="channel-field">
              <span className="channel-field-label">用户名</span>
              <input
                type="text"
                value={webdavUsername}
                onChange={(e) => setWebdavUsername(e.target.value)}
                placeholder="WebDAV 用户名"
                className="input"
              />
            </label>

            <label className="channel-field">
              <span className="channel-field-label">密码{!isNew && '（已遮罩，留空则保留）'}</span>
              <input
                type="password"
                value={webdavPassword}
                onChange={(e) => setWebdavPassword(e.target.value)}
                placeholder={isNew ? 'WebDAV 密码' : `已保存 ${mask(channel?.config.password)}，留空则保留`}
                className="input"
              />
            </label>
          </div>
        </>
      )}

      {notice && (
        <div className={`channel-test-result channel-test-result--${notice.ok ? 'ok' : 'fail'}`} role="status">
          {notice.message}
        </div>
      )}

      <div className="channel-form-actions">
        {channel && (
          <button type="button" onClick={handleTest} disabled={testing} className="btn btn--ghost">
            {testing ? '测试中…' : '测试连接'}
          </button>
        )}
        <button type="button" onClick={onCancel} className="btn btn--ghost" style={{ marginLeft: 'auto' }}>
          取消
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="btn btn--primary">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
