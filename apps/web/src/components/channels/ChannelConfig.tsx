import { useState } from 'react'
import type { ChannelConfigItem } from '../../api/channels.js'
import { channelsApi } from '../../api/channels.js'

interface ChannelConfigProps {
  channel: ChannelConfigItem | null
  defaultChannel?: 'raindrop' | 's3' | 'webdav'
  onSaved: () => void
  onCancel: () => void
}

const channelNames: Record<string, string> = {
  raindrop: 'Raindrop.io',
  s3: 'Amazon S3',
  webdav: 'WebDAV',
}

export function ChannelConfig({ channel, defaultChannel = 'raindrop', onSaved, onCancel }: ChannelConfigProps) {
  const isNew = !channel
  const [channelType, setChannelType] = useState<'raindrop' | 's3' | 'webdav'>(
    (channel?.channel as 'raindrop' | 's3' | 'webdav' | undefined) || defaultChannel
  )
  const [label, setLabel] = useState(channel?.label || '')
  // Raindrop fields
  const [token, setToken] = useState('')
  // WebDAV fields
  const [webdavUrl, setWebdavUrl] = useState('')
  const [webdavUsername, setWebdavUsername] = useState('')
  const [webdavPassword, setWebdavPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleTest = async () => {
    if (channelType === 'raindrop' && !token.trim() && !isNew) {
      setTestResult({ ok: false, message: '请输入 API Token' })
      return
    }

    if (channelType === 'webdav') {
      if (!webdavUrl.trim() && !isNew) {
        setTestResult({ ok: false, message: '请输入 WebDAV 地址' })
        return
      }
    }

    setTesting(true)
    setTestResult(null)

    try {
      if (channel) {
        const res = await channelsApi.test(channel.id)
        setTestResult({ ok: res.ok, message: res.message || (res.ok ? '连接成功' : '连接失败') })
      } else {
        setTestResult({ ok: true, message: '保存后可测试连接' })
      }
      setTesting(false)
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : '测试失败' })
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!label.trim()) {
      setTestResult({ ok: false, message: '请输入配置名称' })
      return
    }

    let configJson: string
    if (channelType === 'raindrop') {
      if (!token.trim() && isNew) {
        setTestResult({ ok: false, message: '请输入 Raindrop API Token' })
        return
      }
      configJson = JSON.stringify(token.trim() ? { token: token.trim() } : {})
    } else if (channelType === 'webdav') {
      if (!webdavUrl.trim() && isNew) {
        setTestResult({ ok: false, message: '请输入 WebDAV 地址' })
        return
      }
      if (!webdavUsername.trim() && isNew) {
        setTestResult({ ok: false, message: '请输入 WebDAV 用户名' })
        return
      }
      if (!webdavPassword.trim() && isNew) {
        setTestResult({ ok: false, message: '请输入 WebDAV 密码' })
        return
      }
      configJson = JSON.stringify({
        url: webdavUrl || channel?.config.url || '',
        username: webdavUsername || channel?.config.username || '',
        ...(webdavPassword.trim() ? { password: webdavPassword.trim() } : {}),
      })
    } else {
      configJson = JSON.stringify({})
    }

    setSaving(true)
    try {
      await channelsApi.save({
        channel: channelType,
        label: label.trim(),
        config: configJson,
        enabled: true,
      }, channel?.id)
      setSaving(false)
      onSaved()
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : '保存失败' })
      setSaving(false)
    }
  }

  const displayToken = (configToken: unknown) => {
    const t = String(configToken || '')
    if (!t) return ''
    if (t.length <= 6) return '*'.repeat(t.length)
    return `${t.slice(0, 3)}${'*'.repeat(t.length - 6)}${t.slice(-3)}`
  }

  const displayMasked = (value: unknown) => {
    const t = String(value || '')
    if (!t) return ''
    if (t.length <= 6) return '*'.repeat(t.length)
    return `${t.slice(0, 3)}${'*'.repeat(t.length - 6)}${t.slice(-3)}`
  }

  return (
    <div className="card" style={{ padding: 'var(--spacing-16)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-16)' }}>
        {isNew ? '添加通道' : '编辑通道'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-12)' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            通道类型
          </label>
          <select
            value={channelType}
            onChange={(e) => setChannelType(e.target.value as any)}
            disabled={!isNew}
            className="input"
            style={{ width: '200px' }}
          >
            <option value="raindrop">Raindrop.io</option>
            <option value="s3">Amazon S3 (待实现)</option>
            <option value="webdav">WebDAV</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            配置名称
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如: 我的 WebDAV"
            className="input"
            style={{ width: '300px' }}
          />
        </div>

        {channelType === 'raindrop' && (
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
              API Token
              {!isNew && ' (已遮罩)'}
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={isNew ? '输入你的 Raindrop API Token' : `已保存 ${displayToken(channel?.config.token)}，留空则保留`}
              className="input"
              style={{ width: '400px' }}
            />
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)', margin: 'var(--spacing-4) 0 0 0' }}>
              在 Raindrop 设置 → 集成 → 创建新的 API Token
            </p>
          </div>
        )}

        {channelType === 'webdav' && (
          <>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
                WebDAV 地址
                {!isNew && ' (已保存)'}
              </label>
              <input
                type="text"
                value={isNew ? webdavUrl : (channel?.config.url as string || '')}
                onChange={(e) => setWebdavUrl(e.target.value)}
                placeholder="https://example.com/remote.php/dav/files/username/"
                className="input"
                style={{ width: '400px' }}
              />
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)', margin: 'var(--spacing-4) 0 0 0' }}>
                服务器地址，例如 NextCloud / ownCloud 的 WebDAV 端点
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
                用户名
                {!isNew && ' (已保存)'}
              </label>
              <input
                type="text"
                value={isNew ? webdavUsername : (channel?.config.username as string || '')}
                onChange={(e) => setWebdavUsername(e.target.value)}
                placeholder="WebDAV 用户名"
                className="input"
                style={{ width: '300px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
                密码
                {!isNew && ' (已遮罩，留空则保留原密码)'}
              </label>
              <input
                type="password"
                value={webdavPassword}
                onChange={(e) => setWebdavPassword(e.target.value)}
                placeholder={isNew ? 'WebDAV 密码' : `已保存 ${displayMasked(channel?.config.password)}，留空则保留`}
                className="input"
                style={{ width: '300px' }}
              />
            </div>
          </>
        )}

        {testResult && (
          <div style={{
            padding: 'var(--spacing-8) var(--spacing-12)',
            borderRadius: '4px',
            backgroundColor: testResult.ok ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
            color: testResult.ok ? 'var(--color-success-text)' : 'var(--color-error-text)',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
          }}>
            {testResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--spacing-8)', marginTop: 'var(--spacing-8)' }}>
          {channel && (
            <button onClick={handleTest} disabled={testing} className="btn-secondary">
              {testing ? '测试中...' : '测试连接'}
            </button>
          )}
          <div style={{ marginLeft: 'auto' }} />
          <button onClick={onCancel} className="btn-secondary">
            取消
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}