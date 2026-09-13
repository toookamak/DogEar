import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { useLocation } from 'wouter'
import { channelsApi } from '../../api/channels.js'
import { syncApi } from '../../api/sync.js'
import type { ChannelConfigItem } from '../../api/channels.js'
import { getExportProgress, getImportProgress, startChannelExport, startChannelImport, subscribeExportProgress, subscribeImportProgress, type TaskState } from '../../channel-tasks.js'
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

/** 任务进度在行内展示的汇总文案（running / done / error 三态；切页再回来仍可见） */
function importMeta(progress: TaskState, channelId: string): string | null {
  if (progress.channelId !== channelId) return null
  const totalText = progress.total ? ` / ${progress.total}` : ''
  if (progress.status === 'running') return ` · 导入中 ${progress.okCount}${totalText} 条（第 ${progress.rounds + 1} 页）`
  if (progress.status === 'done') return ` · 上次导入 新增 ${progress.okCount} 条，跳过 ${progress.skipped} 条`
  if (progress.status === 'error') return ` · 上次导入中断（已入库 ${progress.okCount} 条）：${progress.error ?? '发生错误'}`
  return null
}

function exportMeta(progress: TaskState, channelId: string): string | null {
  if (progress.channelId !== channelId) return null
  const totalText = progress.total ? ` / ${progress.total}` : ''
  if (progress.status === 'running') return ` · 导出中 ${progress.okCount}${totalText} 条`
  if (progress.status === 'done') return ` · 上次导出 ${progress.okCount} 条${progress.failed ? `，失败 ${progress.failed} 条` : ''}`
  if (progress.status === 'error') return ` · 上次导出中断（已推送 ${progress.okCount} 条）：${progress.error ?? '发生错误'}`
  return null
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
  const [busy, setBusy] = useState<{ id: string; kind: 'pull' } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<ChannelConfigItem | null>(null)
  const importProgress = useSyncExternalStore(subscribeImportProgress, getImportProgress)
  const exportProgress = useSyncExternalStore(subscribeExportProgress, getExportProgress)
  const importRunning = importProgress.status === 'running'
  const exportRunning = exportProgress.status === 'running'

  // 导入在设置页进行中完成 → 跳结果页看明细；用户已切走则只靠 toast，不打扰
  useEffect(() => {
    const onFinished = (event: Event) => {
      const summary = (event as CustomEvent).detail
      setLocation(`/import-result?result=${encodeURIComponent(JSON.stringify(summary))}`)
    }
    window.addEventListener('dogear:import-finished', onFinished)
    return () => window.removeEventListener('dogear:import-finished', onFinished)
  }, [setLocation])

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

  const handleImport = (channel: ChannelConfigItem) => {
    // 按页导入由全局 channel-tasks 驱动，进度与结果不随本组件卸载而丢失
    startChannelImport(channel.id, channel.label)
  }

  /** 拉取：单页低频拉回（防 Raindrop 风控）；有冲突时提示去设置页处理 */
  const handlePull = async (id: string) => {
    setBusy({ id, kind: 'pull' })
    try {
      const summary = await syncApi.pull()
      const parts = [`新增 ${summary.created} 条`]
      if (summary.conflicts > 0) parts.push(`${summary.conflicts} 条冲突待处理（见下方「同步冲突」）`)
      if (summary.hasMore) parts.push('远端还有更多，可再次拉取')
      if (summary.created > 0 || summary.conflicts > 0) toast.success(`拉取完成：${parts.join('，')}`)
      else toast.info('拉取完成：远端没有新内容')
    } catch (e) {
      toast.error(errorMessage(e, '拉取失败'))
    }
    setBusy(null)
  }

  const handleExport = (channel: ChannelConfigItem) => {
    // 按页导出由全局 channel-tasks 驱动，进度与结果不随本组件卸载而丢失
    startChannelExport(channel.id, channel.label)
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
        <h3 className="section-title section-title--flush">数据通道</h3>
        <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
          添加通道
        </button>
      </div>

      <p className="muted muted--gap-bottom">
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
            const sameChannelImporting = importRunning && importProgress.channelId === channel.id
            const sameChannelExporting = exportRunning && exportProgress.channelId === channel.id
            return (
              <div key={channel.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">
                    {channel.label}
                    <span className="badge badge--gap">
                      {CHANNEL_LABELS[channel.channel] ?? channel.channel}
                    </span>
                  </div>
                  <div className="list-row-meta">
                    {channel.enabled ? '已启用' : '已禁用'}
                    {channel.channel === 'raindrop' && (String(channel.config?.token || '') ? ' · 已授权' : ' · 未授权')}
                    {importMeta(importProgress, channel.id)}
                    {exportMeta(exportProgress, channel.id)}
                  </div>
                </div>

                <div className="list-row-actions">
                  <button
                    type="button"
                    className="btn btn--pill"
                    disabled={importRunning || sameChannelExporting || busy?.id === channel.id}
                    onClick={() => handleImport(channel)}
                  >
                    {sameChannelImporting
                      ? `导入中 ${importProgress.okCount}${importProgress.total ? ` / ${importProgress.total}` : ''}…`
                      : '导入'}
                  </button>
                  {/* 拉取 = 低频单页同步（每次 50 条，防 Raindrop 风控）；「导入」是显式全量（按页驱动） */}
                  {channel.channel === 'raindrop' && (
                    <button
                      type="button"
                      className="btn btn--pill"
                      disabled={busy?.id === channel.id || sameChannelImporting || sameChannelExporting}
                      onClick={() => handlePull(channel.id)}
                    >
                      {busy?.id === channel.id && busy.kind === 'pull' ? '拉取中…' : '拉取'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--pill"
                    disabled={exportRunning || sameChannelImporting || busy?.id === channel.id}
                    onClick={() => handleExport(channel)}
                  >
                    {sameChannelExporting
                      ? `导出中 ${exportProgress.okCount}${exportProgress.total ? ` / ${exportProgress.total}` : ''}…`
                      : '导出'}
                  </button>
                  <button type="button" className="btn btn--pill" onClick={() => handleStartEdit(channel)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn--pill btn--danger"
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
