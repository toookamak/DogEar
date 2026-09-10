import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'wouter'
import { channelsApi } from '../../api/channels.js'
import type { ChannelConfigItem } from '../../api/channels.js'
import { ChannelConfig } from './ChannelConfig.js'
import { S3Config } from './S3Config.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'
import { toast, errorMessage } from '../../toast.js'

const CHANNEL_LABELS: Record<string, string> = {
  raindrop: 'Raindrop.io',
  s3: 'Amazon S3',
  webdav: 'WebDAV',
}

const CHANNEL_TABS = [
  { key: 'raindrop', label: 'Raindrop.io' },
  { key: 's3', label: 'Amazon S3' },
  { key: 'webdav', label: 'WebDAV' },
] as const

type ChannelKey = typeof CHANNEL_TABS[number]['key']

/** 导出结果就地展示（导入结果另开结果页，因条目多、需要逐条看错误） */
interface ExportOutcome {
  channelId: string
  exported: number
  failed: number
  error?: string
}

/**
 * 数据通道管理：配置增删改、连通测试（在各配置表单内）、导入与导出。
 * 删除通道会移除其配置（含凭据），必须二次确认。
 */
export function ChannelManager() {
  const [, setLocation] = useLocation()
  const [channels, setChannels] = useState<ChannelConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ChannelConfigItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [channelTab, setChannelTab] = useState<ChannelKey>('raindrop')
  const [busy, setBusy] = useState<{ id: string; kind: 'import' | 'export' } | null>(null)
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<ChannelConfigItem | null>(null)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await channelsApi.list()
      setChannels(res.items ?? [])
    } catch (e) {
      toast.error(errorMessage(e, '读取通道配置失败'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadChannels() }, [loadChannels])

  const handleRemove = async (channel: ChannelConfigItem) => {
    setConfirmRemove(null)
    try {
      await channelsApi.remove(channel.id)
      setChannels((prev) => prev.filter((item) => item.id !== channel.id))
      toast.success(`已删除通道「${channel.label}」`)
    } catch (e) {
      toast.error(errorMessage(e, '删除通道失败'))
    }
  }

  const handleImport = async (id: string) => {
    setBusy({ id, kind: 'import' })
    try {
      const result = await channelsApi.import(id)
      setLocation(`/import-result?result=${encodeURIComponent(JSON.stringify(result))}`)
    } catch (e) {
      const failure = { imported: 0, skipped: 0, errors: [errorMessage(e, '导入失败')] }
      setLocation(`/import-result?result=${encodeURIComponent(JSON.stringify(failure))}`)
    }
    setBusy(null)
  }

  const handleExport = async (id: string) => {
    setBusy({ id, kind: 'export' })
    setExportOutcome(null)
    try {
      const result = await channelsApi.export(id)
      setExportOutcome({ channelId: id, exported: result.exported, failed: result.failed })
      if (result.failed > 0) toast.info(`导出完成，${result.failed} 条失败`)
      else toast.success(`已导出 ${result.exported} 条`)
    } catch (e) {
      // 导出失败此前被静默吞掉，只露出 exported/failed 两个 0，用户看不出原因
      setExportOutcome({ channelId: id, exported: 0, failed: 0, error: errorMessage(e, '导出失败') })
      toast.error(errorMessage(e, '导出失败'))
    }
    setBusy(null)
  }

  const handleSaved = () => {
    setEditing(null)
    setAdding(false)
    void loadChannels()
  }

  /** 取消不重取列表（没有改动），只退回列表态 */
  const handleCancel = () => {
    setEditing(null)
    setAdding(false)
  }

  const handleStartEdit = (channel: ChannelConfigItem) => {
    setChannelTab(channel.channel as ChannelKey)
    setEditing(channel)
  }

  if (editing || adding) {
    return (
      <div className="channel-manager">
        <nav className="tab-strip" aria-label="通道类型">
          {CHANNEL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="tab-btn"
              aria-current={channelTab === tab.key ? 'true' : undefined}
              onClick={() => setChannelTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {channelTab === 'raindrop' && (
          <ChannelConfig channel={editing} defaultChannel="raindrop" onSaved={handleSaved} onCancel={handleCancel} />
        )}
        {channelTab === 's3' && (
          <S3Config channel={editing} onSaved={handleSaved} onCancel={handleCancel} />
        )}
        {channelTab === 'webdav' && (
          <ChannelConfig channel={editing} defaultChannel="webdav" onSaved={handleSaved} onCancel={handleCancel} />
        )}
      </div>
    )
  }

  return (
    <section className="settings-section">
      <div className="manager-head">
        <h3 className="section-title" style={{ margin: 0 }}>数据通道</h3>
        <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
          添加通道
        </button>
      </div>

      <p className="muted" style={{ marginBottom: 'var(--spacing-12)' }}>
        通道是可选的数据出入口，不是登录门槛：保存书签不依赖任何通道，未配置也能正常使用。
      </p>

      {loading ? (
        <p className="empty-note">加载中…</p>
      ) : channels.length === 0 ? (
        <p className="empty-note">
          暂无配置的通道。添加 Raindrop.io 可导入已有收藏；S3 / WebDAV 可用于导出与快照存储。
        </p>
      ) : (
        <div className="list-stack">
          {channels.map((channel) => {
            const outcome = exportOutcome?.channelId === channel.id ? exportOutcome : null
            return (
              <div key={channel.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">
                    {channel.label}
                    <span className="badge" style={{ marginLeft: 'var(--spacing-8)' }}>
                      {CHANNEL_LABELS[channel.channel] ?? channel.channel}
                    </span>
                  </div>
                  <div className="list-row-meta">
                    {channel.enabled ? '已启用' : '已禁用'}
                    {channel.channel === 'raindrop' && (String(channel.config?.token || '') ? ' · 已授权' : ' · 未授权')}
                    {outcome && !outcome.error && ` · 上次导出 ${outcome.exported} 条${outcome.failed ? `，失败 ${outcome.failed} 条` : ''}`}
                    {outcome?.error && ` · ${outcome.error}`}
                  </div>
                </div>

                <div className="list-row-actions">
                  <button
                    type="button"
                    className="btn btn--pill"
                    disabled={busy?.id === channel.id}
                    onClick={() => handleImport(channel.id)}
                  >
                    {busy?.id === channel.id && busy.kind === 'import' ? '导入中…' : '导入'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--pill"
                    disabled={busy?.id === channel.id}
                    onClick={() => handleExport(channel.id)}
                  >
                    {busy?.id === channel.id && busy.kind === 'export' ? '导出中…' : '导出'}
                  </button>
                  <button type="button" className="btn btn--pill" onClick={() => handleStartEdit(channel)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn--pill"
                    style={{ color: 'var(--color-error)' }}
                    onClick={() => setConfirmRemove(channel)}
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title="删除数据通道"
        message={`将删除通道「${confirmRemove?.label ?? ''}」及其保存的凭据。已导入的书签不受影响，但该通道的同步与导出将不可用。此操作不可恢复。`}
        confirmLabel="删除"
        onConfirm={() => confirmRemove && void handleRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
      />
    </section>
  )
}
