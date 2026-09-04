import { useState, useEffect } from 'react'
import { settingsApi } from '../../api/settings.js'
import { jobsApi } from '../../api/jobs.js'
import { backupApi } from '../../api/backup.js'
import type { SettingResponse, SkillUsageResponse, JobResponse, BackupResponse } from '../../types/api.js'

function OperationLogList() {
  const [items, setItems] = useState<Array<{ id: string; actor: string; action: string; targetType: string; targetId: string; createdAt: number | string | Date }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    settingsApi.operationLog()
      .then((res) => setItems(res.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>加载中...</p>
  if (items.length === 0) return <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>暂无操作日志</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
      {items.map((item) => (
        <div key={item.id} className="card" style={{ padding: 'var(--spacing-12)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
            {item.actor} · {item.action} · {item.targetType}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {item.targetId} · {typeof item.createdAt === 'number' ? new Date(item.createdAt).toLocaleString() : String(item.createdAt)}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SettingsSection() {
  const [settings, setSettings] = useState<SettingResponse[]>([])
  const [usage, setUsage] = useState<SkillUsageResponse | null>(null)
  const [jobs, setJobs] = useState<JobResponse[]>([])
  const [backups, setBackups] = useState<BackupResponse[]>([])
  const [retentionDays, setRetentionDays] = useState('7')
  const [saving, setSaving] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [tab, setTab] = useState<'settings' | 'logs' | 'jobs' | 'backup'>('settings')

  useEffect(() => {
    settingsApi.list().then((res) => {
      setSettings(res.items)
      const retention = res.items.find((s) => s.key === 'recycle.retention_days')
      if (retention) setRetentionDays(String(retention.value))
    }).catch(() => {})
    settingsApi.usage().then(setUsage).catch(() => {})
    jobsApi.list().then((res) => setJobs(res.items)).catch(() => {})
    loadBackups()
  }, [])

  const loadBackups = () => {
    backupApi.list().then((res) => setBackups(res.items)).catch(() => {})
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await settingsApi.update({ 'recycle.retention_days': retentionDays })
      setSaving(false)
    } catch { setSaving(false) }
  }

  const handleRetry = async (id: string) => {
    try { await jobsApi.retry(id); setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: 'pending' as const } : j)) } catch { /* ignore */ }
  }

  const handleCancel = async (id: string) => {
    try { await jobsApi.cancel(id); setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: 'cancelled' as const } : j)) } catch { /* ignore */ }
  }

  const handleCreateBackup = async (tier: 'light' | 'medium' | 'full') => {
    setCreatingBackup(true)
    try {
      await backupApi.create(tier)
      // Refresh the backup list after a short delay to include the new entry
      setTimeout(loadBackups, 1000)
    } catch { /* ignore */ }
    setCreatingBackup(false)
  }

  const tierLabels: Record<string, string> = { light: '轻档', medium: '中档', full: '重档' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--spacing-8)', marginBottom: 'var(--spacing-16)', borderBottom: '1px solid var(--border-primary)' }}>
        {(['settings', 'logs', 'jobs', 'backup'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              padding: 'var(--spacing-8) var(--spacing-12)',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              fontWeight: tab === t ? 600 : 400,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {t === 'settings' ? '设置' : t === 'logs' ? '操作日志' : t === 'jobs' ? '任务' : '备份'}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
          <div className="card" style={{ padding: 'var(--spacing-16)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-12)' }}>回收站保留天数</h3>
            <div style={{ display: 'flex', gap: 'var(--spacing-8)', alignItems: 'center' }}>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="input"
                style={{ width: '80px' }}
                min={1}
                max={365}
              />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>天</span>
              <button onClick={handleSaveSettings} disabled={saving} className="btn-primary" style={{ marginLeft: 'auto' }}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>

          {usage && (
            <div className="card" style={{ padding: 'var(--spacing-16)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-12)' }}>今日用量</h3>
              <div style={{ display: 'flex', gap: 'var(--spacing-16)', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
                <div>请求: {usage.requests}</div>
                <div>写入: {usage.writes}</div>
                <div>阻止: {usage.blocked}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && <OperationLogList />}

      {tab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
          {jobs.length === 0 && <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>暂无任务</p>}
          {jobs.map((job) => (
            <div key={job.id} className="card" style={{ padding: 'var(--spacing-12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500 }}>{job.type}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)' }}>状态: {job.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                {job.status === 'failed' && <button onClick={() => handleRetry(job.id)} className="btn-secondary-pill" style={{ fontSize: '12px' }}>重试</button>}
                {['pending', 'running'].includes(job.status) && <button onClick={() => handleCancel(job.id)} className="btn-secondary-pill" style={{ fontSize: '12px', color: 'var(--color-error)' }}>取消</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
          <div className="card" style={{ padding: 'var(--spacing-16)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-12)' }}>创建备份</h3>
            <div style={{ display: 'flex', gap: 'var(--spacing-8)' }}>
              {(['light', 'medium', 'full'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleCreateBackup(tier)}
                  disabled={creatingBackup}
                  className="btn-primary"
                  style={{ flex: 1, fontSize: '14px' }}
                >
                  {tierLabels[tier]}备份
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--spacing-16)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-12)' }}>最近备份</h3>
            {backups.length === 0 && (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>暂无备份记录</p>
            )}
            {backups.map((backup: any) => (
              <div key={backup.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-8) 0', borderBottom: '1px solid var(--border-primary)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500 }}>
                    {tierLabels[backup.tier] ?? backup.tier}备份
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    状态: {backup.status === 'pending' ? '等待中' : backup.status === 'running' ? '进行中' : backup.status === 'completed' ? '已完成' : '失败'}
                    {backup.status === 'completed' && backup.fileSize != null && ` · ${(backup.fileSize / 1024).toFixed(1)} KB`}
                    {backup.error && ` · ${backup.error}`}
                  </div>
                </div>
                {backup.status === 'completed' && (
                  <a href={backupApi.downloadUrl(backup.id)} className="btn-secondary-pill" style={{ fontSize: '12px' }}>
                    下载
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}