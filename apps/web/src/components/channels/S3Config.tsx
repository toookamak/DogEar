import { useState } from 'react'
import type { ChannelConfigItem } from '../../api/channels.js'
import { channelsApi } from '../../api/channels.js'

interface S3ConfigProps {
  channel: ChannelConfigItem | null
  onSaved: () => void
  onCancel: () => void
}

function maskSecretKey(key: string): string {
  if (!key) return ''
  if (key.length <= 6) return '*'.repeat(key.length)
  return `${key.slice(0, 3)}${'*'.repeat(key.length - 6)}${key.slice(-3)}`
}

export function S3Config({ channel, onSaved, onCancel }: S3ConfigProps) {
  const isNew = !channel

  const [endpoint, setEndpoint] = useState(
    channel ? String(channel.config.endpoint || '') : ''
  )
  const [region, setRegion] = useState(
    channel ? String(channel.config.region || '') : ''
  )
  const [accessKeyId, setAccessKeyId] = useState(
    channel ? String(channel.config.accessKeyId || '') : ''
  )
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [bucket, setBucket] = useState(
    channel ? String(channel.config.bucket || '') : ''
  )
  const [label, setLabel] = useState(channel?.label || '')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleTest = async () => {
    if (!endpoint || !region || !accessKeyId || !bucket) {
      setTestResult({ ok: false, message: '请先填写所有必填字段（secretAccessKey 除外）' })
      return
    }

    if (channel) {
      setTesting(true)
      setTestResult(null)
      try {
        const res = await channelsApi.test(channel.id)
        setTestResult({ ok: res.ok, message: res.message || (res.ok ? '连接成功' : '连接失败') })
      } catch (e) {
        setTestResult({ ok: false, message: e instanceof Error ? e.message : '测试失败' })
      }
      setTesting(false)
    } else {
      // For new configs, test is available after saving
      setTestResult({ ok: true, message: '保存后可测试连接' })
    }
  }

  const handleSave = async () => {
    // Validate required fields
    if (!label.trim()) {
      setTestResult({ ok: false, message: '请输入配置名称' })
      return
    }
    if (!endpoint.trim()) {
      setTestResult({ ok: false, message: '请输入 Endpoint' })
      return
    }
    if (!region.trim()) {
      setTestResult({ ok: false, message: '请输入 Region' })
      return
    }
    if (!accessKeyId.trim()) {
      setTestResult({ ok: false, message: '请输入 Access Key ID' })
      return
    }
    if (!bucket.trim()) {
      setTestResult({ ok: false, message: '请输入 Bucket' })
      return
    }
    if (isNew && !secretAccessKey.trim()) {
      setTestResult({ ok: false, message: '请输入 Secret Access Key' })
      return
    }

    // Build config payload
    // For existing configs, if secretAccessKey is empty, keep the original
    const configPayload: Record<string, string> = {
      endpoint: endpoint.trim(),
      region: region.trim(),
      accessKeyId: accessKeyId.trim(),
      bucket: bucket.trim(),
    }
    if (secretAccessKey.trim()) {
      configPayload.secretAccessKey = secretAccessKey.trim()
    }

    setSaving(true)
    try {
      await channelsApi.save({
        channel: 's3',
        label: label.trim(),
        config: JSON.stringify(configPayload),
        enabled: true,
      }, channel?.id)
      setSaving(false)
      onSaved()
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : '保存失败' })
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: 'var(--spacing-16)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-16)' }}>
        {isNew ? '添加 S3 通道' : '编辑 S3 通道'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-12)' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            配置名称
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如: 我的 S3"
            className="input"
            style={{ width: '300px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            Endpoint <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://s3.amazonaws.com"
            className="input"
            style={{ width: '400px' }}
          />
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)', margin: 'var(--spacing-4) 0 0 0' }}>
            S3 兼容的存储服务端点 URL（支持 MinIO、Backblaze B2 等）
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-12)' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
              Region <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-east-1"
              className="input"
              style={{ width: '180px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
              Bucket <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              placeholder="my-bucket"
              className="input"
              style={{ width: '200px' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            Access Key ID <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            placeholder="AKIAIOSFODNN7EXAMPLE"
            className="input"
            style={{ width: '400px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            Secret Access Key
            {!isNew && ' (留空则保留原值)'}
            <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            type="password"
            value={isNew ? secretAccessKey : (secretAccessKey || maskSecretKey(String(channel?.config.secretAccessKey || '')))}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            placeholder={isNew ? '输入 Secret Access Key' : '输入新 Secret Access Key 或留空'}
            className="input"
            style={{ width: '400px' }}
          />
        </div>

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