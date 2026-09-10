import { useEffect, useState } from 'react'
import { backupApi } from '../../../api/backup.js'
import {
  BACKUP_STATUS_LABELS,
  BACKUP_TIER_HINT,
  BACKUP_TIER_LABELS,
  formatBytes,
  formatDateTime,
  label,
} from '../../../utils/format.js'
import type { BackupResponse } from '../../../types/api.js'

const TIERS = ['light', 'medium', 'full'] as const

/**
 * 备份与恢复：三档备份创建、备份列表与下载。
 * 备份文件下载走 GET /api/backup/:id/download（由服务端校验文件存在后返回）。
 * 恢复（导入备份、ZIP 还原）在 docs/TODO.md 中列为后续项，本版不做，故不提供入口。
 */
export function BackupTab() {
  const [backups, setBackups] = useState<BackupResponse[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    try {
      const res = await backupApi.list()
      setBackups(res.items ?? [])
    } catch {
      /* 列表读取失败不阻塞创建操作 */
    }
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async (tier: typeof TIERS[number]) => {
    setCreating(tier)
    setNotice(null)
    try {
      await backupApi.create(tier)
      setNotice({ kind: 'success', text: `${BACKUP_TIER_LABELS[tier]}备份已创建。` })
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '备份创建失败' })
    }
    setCreating(null)
  }

  return (
    <>
      {notice && <div className={`alert alert--${notice.kind}`}>{notice.text}</div>}

      <section className="settings-section">
        <h3 className="section-title">创建备份</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-8)', flexWrap: 'wrap' }}>
          {TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              className="btn btn--primary"
              disabled={creating !== null}
              onClick={() => handleCreate(tier)}
            >
              {creating === tier ? '创建中…' : `${BACKUP_TIER_LABELS[tier]}备份`}
            </button>
          ))}
        </div>
        <div className="list-stack" style={{ marginTop: 'var(--spacing-12)' }}>
          {TIERS.map((tier) => (
            <div key={tier} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">{BACKUP_TIER_LABELS[tier]}</div>
                <div className="list-row-meta">{BACKUP_TIER_HINT[tier]}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="section-title">备份记录</h3>
        {backups.length === 0 ? (
          <p className="empty-note">暂无备份记录。</p>
        ) : (
          <div className="list-stack">
            {backups.map((backup) => (
              <div key={backup.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">
                    {label(BACKUP_TIER_LABELS, backup.tier)} · {formatBytes(backup.fileSize)}
                  </div>
                  <div className="list-row-meta">
                    {label(BACKUP_STATUS_LABELS, backup.status)} · {formatDateTime(backup.createdAt)}
                    {backup.target ? ` · ${backup.target}` : ''}
                    {backup.error ? ` · ${backup.error}` : ''}
                  </div>
                </div>
                <div className="list-row-actions">
                  {backup.status === 'completed' ? (
                    <a className="btn btn--pill" href={backupApi.downloadUrl(backup.id)} download>
                      下载
                    </a>
                  ) : (
                    <span className="badge">{label(BACKUP_STATUS_LABELS, backup.status)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: 'var(--spacing-12)' }}>
          恢复（从备份还原、ZIP 导入）尚未实现，见 <code className="mono">docs/TODO.md</code> 的 L5 条目。
        </p>
      </section>
    </>
  )
}
