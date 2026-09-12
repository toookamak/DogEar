import { useState } from 'react'
import type { ChannelConfigItem } from '../../api/channels.js'
import { channelsApi } from '../../api/channels.js'
import { errorMessage } from '../../toast.js'

interface S3ConfigProps {
  channel: ChannelConfigItem | null
  onSaved: () => void
  onCancel: () => void
}

/** 已保存的密钥做遮罩展示：保留首尾各 3 位，中间打星 */
function mask(value: unknown): string {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 6) return '*'.repeat(text.length)
  return `${text.slice(0, 3)}${'*'.repeat(text.length - 6)}${text.slice(-3)}`
}

/**
 * S3（S3 兼容对象存储，含 MinIO / Backblaze B2）通道配置。
 * Secret Access Key 一律「留空表示保留原值」：输入框只承载用户新输入的内容，
 * 已保存值只出现在 placeholder 里，避免看起来像「字段里已有明文」。
 * 「测试连接」测的是**已保存**的配置（服务端行为），不是当前表单里未保存的改动。
 */
export function S3Config({ channel, onSaved, onCancel }: S3ConfigProps) {
  const isNew = !channel

  const [label, setLabel] = useState(channel?.label || '')
  const [endpoint, setEndpoint] = useState(String(channel?.config.endpoint || ''))
  const [region, setRegion] = useState(String(channel?.config.region || ''))
  const [accessKeyId, setAccessKeyId] = useState(String(channel?.config.accessKeyId || ''))
  const [bucket, setBucket] = useState(String(channel?.config.bucket || ''))
  const [secretAccessKey, setSecretAccessKey] = useState('')

  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)

  const fail = (message: string) => setNotice({ ok: false, message })
  const savedSecret = mask(channel?.config.secretAccessKey)

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

  const handleSave = async () => {
    if (!label.trim()) return fail('请输入配置名称')
    if (!endpoint.trim()) return fail('请输入 Endpoint')
    if (!region.trim()) return fail('请输入 Region')
    if (!accessKeyId.trim()) return fail('请输入 Access Key ID')
    if (!bucket.trim()) return fail('请输入 Bucket')
    if (isNew && !secretAccessKey.trim()) return fail('请输入 Secret Access Key')

    const config: Record<string, string> = {
      endpoint: endpoint.trim(),
      region: region.trim(),
      accessKeyId: accessKeyId.trim(),
      bucket: bucket.trim(),
    }
    // 留空则不提交该字段，服务端保留原值
    if (secretAccessKey.trim()) config.secretAccessKey = secretAccessKey.trim()

    setSaving(true)
    setNotice(null)
    try {
      await channelsApi.save({
        channel: 's3',
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

  return (
    <div className="channel-form">
      <h3 className="section-title section-title--flush">{isNew ? '添加 S3 通道' : '编辑 S3 通道'}</h3>

      <label className="channel-field">
        <span className="channel-field-label">配置名称</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例如：我的 S3"
          className="input"
        />
      </label>

      <label className="channel-field">
        <span className="channel-field-label">Endpoint <span className="required">*</span></span>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://s3.amazonaws.com"
          className="input"
        />
        <span className="channel-field-hint">S3 兼容的存储服务端点 URL（支持 MinIO、Backblaze B2 等）</span>
      </label>

      <div className="channel-form-grid">
        <label className="channel-field">
          <span className="channel-field-label">Region <span className="required">*</span></span>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="us-east-1"
            className="input"
          />
        </label>

        <label className="channel-field">
          <span className="channel-field-label">Bucket <span className="required">*</span></span>
          <input
            type="text"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="my-bucket"
            className="input"
          />
        </label>
      </div>

      <label className="channel-field">
        <span className="channel-field-label">Access Key ID <span className="required">*</span></span>
        <input
          type="text"
          value={accessKeyId}
          onChange={(e) => setAccessKeyId(e.target.value)}
          placeholder="AKIAIOSFODNN7EXAMPLE"
          className="input"
        />
      </label>

      <label className="channel-field">
        <span className="channel-field-label">
          Secret Access Key <span className="required">*</span>
          {!isNew && '（留空则保留原值）'}
        </span>
        <input
          type="password"
          value={secretAccessKey}
          onChange={(e) => setSecretAccessKey(e.target.value)}
          placeholder={isNew ? '输入 Secret Access Key' : `已保存 ${savedSecret}，留空则保留`}
          className="input"
        />
      </label>

      {notice && (
        <div className={`channel-test-result channel-test-result--${notice.ok ? 'ok' : 'fail'}`} role="status">
          {notice.message}
        </div>
      )}

      <div className="channel-form-actions">
        {channel && (
          <>
            <button type="button" onClick={handleTest} disabled={testing} className="btn btn--ghost">
              {testing ? '测试中…' : '测试连接'}
            </button>
            <span className="channel-field-hint">测试的是已保存的配置</span>
          </>
        )}
        <button type="button" onClick={onCancel} className="btn btn--ghost btn--push">
          取消
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="btn btn--primary">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
