import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { channelsApi } from '../../api/channels.js'
import type { ChannelConfigItem, ImportResponse, ExportResponse } from '../../api/channels.js'
import { ChannelConfig } from './ChannelConfig.js'
import { S3Config } from './S3Config.js'

const channelLabels: Record<string, string> = {
  raindrop: 'Raindrop.io',
  s3: 'Amazon S3',
  webdav: 'WebDAV',
}

export function ChannelManager() {
  const [, setLocation] = useLocation()
  const [channels, setChannels] = useState<ChannelConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ChannelConfigItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [channelTab, setChannelTab] = useState<'raindrop' | 's3' | 'webdav'>('raindrop')
  const [importing, setImporting] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ id: string; result: ImportResponse | ExportResponse } | null>(null)

  const loadChannels = async () => {
    setLoading(true)
    try {
      const res = await channelsApi.list()
      setChannels(res.items)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    loadChannels()
  }, [])

  const handleRemove = async (id: string) => {
    try {
      await channelsApi.remove(id)
      setChannels((prev) => prev.filter((c) => c.id !== id))
    } catch { /* ignore */ }
  }

  const handleImport = async (id: string) => {
    setImporting(id)
    setImportResult(null)
    try {
      const result = await channelsApi.import(id)
      const encoded = encodeURIComponent(JSON.stringify(result))
      setLocation(`/import-result?result=${encoded}`)
    } catch (e) {
      const errorResult = { imported: 0, skipped: 0, errors: [e instanceof Error ? e.message : '导入失败'] }
      const encoded = encodeURIComponent(JSON.stringify(errorResult))
      setLocation(`/import-result?result=${encoded}`)
    }
    setImporting(null)
  }

  const handleExport = async (id: string) => {
    setExporting(id)
    setImportResult(null)
    try {
      const result = await channelsApi.export(id)
      setImportResult({ id, result })
    } catch (e) {
      setImportResult({ id, result: { exported: 0, failed: 0, errors: [e instanceof Error ? e.message : '导出失败'] } })
    }
    setExporting(null)
  }

  const handleSaved = () => {
    setEditing(null)
    setAdding(false)
    loadChannels()
  }

  const handleStartAdd = () => {
    setChannelTab('raindrop')
    setAdding(true)
  }

  const handleStartEdit = (ch: ChannelConfigItem) => {
    setChannelTab(ch.channel as 'raindrop' | 's3' | 'webdav')
    setEditing(ch)
  }

  const handleCancel = () => {
    setEditing(null)
    setAdding(false)
  }

  const tabStyle: React.CSSProperties = {
    padding: 'var(--spacing-8) var(--spacing-16)',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-secondary)',
    marginBottom: '-1px',
  }

  const activeTabStyle: React.CSSProperties = {
    borderBottom: '2px solid var(--color-primary)',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  }

  if (editing || adding) {
    return (
      <div>
        <div style={{
          display: 'flex',
          gap: '2px',
          marginBottom: 'var(--spacing-12)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <button
            onClick={() => setChannelTab('raindrop')}
            style={{ ...tabStyle, ...(channelTab === 'raindrop' ? activeTabStyle : {}) }}
          >
            Raindrop.io
          </button>
          <button
            onClick={() => setChannelTab('s3')}
            style={{ ...tabStyle, ...(channelTab === 's3' ? activeTabStyle : {}) }}
          >
            Amazon S3
          </button>
          <button
            onClick={() => setChannelTab('webdav')}
            style={{ ...tabStyle, ...(channelTab === 'webdav' ? activeTabStyle : {}) }}
          >
            WebDAV
          </button>
        </div>

        {channelTab === 'raindrop' && (
          <ChannelConfig
            channel={editing}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}

        {channelTab === 's3' && (
          <S3Config
            channel={editing}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}

        {channelTab === 'webdav' && (
          <div className="card" style={{ padding: 'var(--spacing-16)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-12)' }}>
              {adding ? '添加 WebDAV 通道' : '编辑 WebDAV 通道'}
            </h3>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              WebDAV 通道即将推出，敬请期待。
            </p>
            <button onClick={handleCancel} className="btn-secondary" style={{ marginTop: 'var(--spacing-12)' }}>
              返回
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 'var(--spacing-16)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-12)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: 0 }}>
          数据通道
        </h3>
        <button onClick={handleStartAdd} className="btn-primary" style={{ fontSize: '13px' }}>
          添加通道
        </button>
      </div>

      {loading && (
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          加载中...
        </p>
      )}

      {!loading && channels.length === 0 && (
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          暂无配置的数据通道。添加 Raindrop.io 通道可从 Raindrop 导入/导出书签。
        </p>
      )}

      {!loading && channels.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="card"
              style={{
                padding: 'var(--spacing-12)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500 }}>
                  {ch.label}
                  <span style={{
                    display: 'inline-block',
                    marginLeft: 'var(--spacing-8)',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    backgroundColor: 'var(--color-tag-bg)',
                    color: 'var(--color-text-muted)',
                    fontSize: '11px',
                    fontWeight: 400,
                  }}>
                    {channelLabels[ch.channel] || ch.channel}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {ch.enabled ? '已启用' : '已禁用'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-4)', alignItems: 'center' }}>
                <button
                  onClick={() => handleImport(ch.id)}
                  disabled={importing === ch.id}
                  className="btn-secondary-pill"
                  style={{ fontSize: '12px' }}
                >
                  {importing === ch.id ? '导入中...' : '导入'}
                </button>
                <button
                  onClick={() => handleExport(ch.id)}
                  disabled={exporting === ch.id}
                  className="btn-secondary-pill"
                  style={{ fontSize: '12px' }}
                >
                  {exporting === ch.id ? '导出中...' : '导出'}
                </button>
                <button
                  onClick={() => handleStartEdit(ch)}
                  className="btn-secondary-pill"
                  style={{ fontSize: '12px' }}
                >
                  编辑
                </button>
                <button
                  onClick={() => handleRemove(ch.id)}
                  className="btn-secondary-pill"
                  style={{ fontSize: '12px', color: 'var(--color-error)' }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importResult && (
        <div style={{
          marginTop: 'var(--spacing-12)',
          padding: 'var(--spacing-8) var(--spacing-12)',
          borderRadius: '4px',
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
        }}>
          {'imported' in importResult.result && (
            <div>
              <p>导入完成: 已导入 {importResult.result.imported}, 跳过 {importResult.result.skipped}</p>
              {'errors' in importResult.result && importResult.result.errors.length > 0 && (
                <div style={{ color: 'var(--color-error)', fontSize: '12px' }}>
                  {importResult.result.errors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              )}
            </div>
          )}
          {'exported' in importResult.result && !('imported' in importResult.result) && (
            <div>
              <p>导出完成: 已导出 {importResult.result.exported}, 失败 {importResult.result.failed}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}