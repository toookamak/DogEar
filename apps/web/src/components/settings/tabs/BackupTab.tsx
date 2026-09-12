import { useEffect, useState } from 'react'
import { backupApi } from '../../../api/backup.js'
import { ConfirmDialog } from '../../feedback/ConfirmDialog.js'
import { formatBytes, formatDateTime, label } from '../../../utils/format.js'
import {
  BACKUP_STATUS_LABELS,
  BACKUP_TIER_HINT,
  BACKUP_TIER_LABELS,
} from '../../../utils/format.js'
import type { BackupResponse } from '../../../types/api.js'

const TIERS = ['light', 'medium', 'full'] as const

/** 导入回执的 restored 计数（容错：异常回执不给 NaN） */
function result2count(body: any): number {
  return typeof body?.restored === 'number' ? body.restored : 0
}

/**
 * 备份与恢复：三档备份创建、备份列表、下载、**从备份恢复**。
 *
 * 恢复语义按 `docs/modules/20260904_备份功能设计.md` §2.8：
 * **覆盖当前书签库（全量替换，非增量合并）**，并在恢复前由服务端自动创建
 * 一次全量备份作为回滚点。因是破坏性操作，这里走二次确认对话框，
 * 且把「会替换掉多少条当前书签」讲清楚，而不是只说「确认恢复？」。
 *
 * `full` 档（数据库文件副本）不支持在服务运行中恢复——替换正在被持有的库文件
 * 不安全，服务端会拒绝；界面据实提示替代做法，不假装能恢复。
 */
export function BackupTab() {
  const [backups, setBackups] = useState<BackupResponse[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<BackupResponse | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [importPending, setImportPending] = useState(false)

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

  // 本地导出 / 导入（备份设计 §3）：ZIP/CSV 走用户本地文件，与服务端备份记录是两条路径
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importBusy, setImportBusy] = useState(false)

  const handleExportZip = async () => {
    setNotice(null)
    try {
      const response = await fetch('/api/backup/export-zip')
      if (!response.ok) throw new Error(`导出失败（HTTP ${response.status}）`)
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'dogear_export.zip'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice({ kind: 'success', text: `已导出 ${name}。` })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '导出失败' })
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImportBusy(true)
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', importFile)
      form.append('confirm', 'true')
      const response = await fetch('/api/backup/import', { method: 'POST', body: form })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(body?.error?.message ?? `导入失败（HTTP ${response.status}）`)
      }
      const parts = [
        `已导入 ${result2count(body)} 条书签`,
        `替换掉原有 ${body?.removed ?? 0} 条`,
      ]
      if (body?.skippedSnapshots > 0) parts.push(`ZIP 中 ${body.skippedSnapshots} 个快照文件暂未导入（快照存储待接入）`)
      if (body?.rollbackBackupId) parts.push('已自动保存回滚点备份')
      setNotice({ kind: 'success', text: parts.join('，') + '。' })
      setImportFile(null)
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '导入失败' })
    }
    setImportBusy(false)
  }

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    setNotice(null)
    try {
      const result = await backupApi.restore(restoreTarget.id)
      const parts = [
        `已恢复 ${result.restored} 条书签`,
        `替换掉原有 ${result.removed} 条`,
      ]
      if (result.createdTags) parts.push(`新建标签 ${result.createdTags} 个`)
      if (result.createdScenes) parts.push(`新建场景 ${result.createdScenes} 个`)
      if (result.rollbackBackupId) parts.push('已自动保存回滚点备份')
      setNotice({ kind: 'success', text: parts.join('，') + '。' })
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '恢复失败' })
    }
    setRestoring(false)
    setRestoreTarget(null)
  }

  return (
    <>
      {notice && <div className={`alert alert--${notice.kind}`}>{notice.text}</div>}

      <section className="settings-section">
        <h3 className="section-title">创建备份</h3>
        <div className="backup-actions">
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
        <div className="list-stack backup-tier-list">
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
        <h3 className="section-title">本地导出 / 导入</h3>
        <div className="backup-actions">
          <button type="button" className="btn btn--primary" onClick={() => { void handleExportZip() }}>
            导出 ZIP（书签 CSV）
          </button>
          <label className="btn btn--ghost">
            选择要导入的 CSV / ZIP…
            <input
              type="file"
              accept=".csv,.zip"
              style={{ display: 'none' }}
              onChange={(e) => { setNotice(null); setImportFile(e.target.files?.[0] ?? null) }}
            />
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!importFile || importBusy}
            onClick={() => { setImportPending(true) }}
          >
            {importBusy ? '导入中…' : importFile ? `导入「${importFile.name}」` : '导入'}
          </button>
        </div>
        <p className="muted backup-note">
          导出为 ZIP（bookmarks.csv + meta.json）；导入支持 CSV 或该 ZIP，语义为**全量替换**当前书签表——
          导入前服务端会自动创建一次回滚点备份。上传上限 25MB；ZIP 中的快照文件暂不导入（快照存储待接入）。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="section-title">备份记录</h3>
        {backups.length === 0 ? (
          <p className="empty-note">暂无备份记录。创建备份后可在此下载或恢复。</p>
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
                    <>
                      <a className="btn btn--pill" href={backupApi.downloadUrl(backup.id)} download>
                        下载
                      </a>
                      {/* 全量库文件不支持在线恢复，按钮不出现，避免点了必然失败 */}
                      {backup.tier !== 'full' && (
                        <button
                          type="button"
                          className="btn btn--pill"
                          onClick={() => { setNotice(null); setRestoreTarget(backup) }}
                        >
                          恢复
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="badge">{label(BACKUP_STATUS_LABELS, backup.status)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted backup-note">
          恢复到备份时的状态会**替换**当前书签表（非增量合并）。恢复前服务端会自动创建一次全量备份作为回滚点。
          轻档 / 中档（CSV）可在线恢复；重档是数据库文件副本，需停服后手工替换。
        </p>
      </section>

      <ConfirmDialog
        open={importPending}
        title="确认导入本地文件？"
        message={
          importFile
            ? `将用「${importFile.name}」的书签数据**覆盖**当前书签库——这是全量替换，导入之后新增的书签会被移除。`
              + '导入前服务端会自动创建一次回滚点备份。'
            : ''
        }
        confirmLabel={importBusy ? '导入中…' : '确认导入'}
        onConfirm={() => { if (!importBusy) void handleImport() }}
        onCancel={() => { if (!importBusy) { setImportPending(false); setImportFile(null) } }}
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        title="确认恢复此备份？"
        message={
          restoreTarget
            ? `将用该备份（${label(BACKUP_TIER_LABELS, restoreTarget.tier)} · ${formatDateTime(restoreTarget.createdAt)}）`
              + '的书签数据覆盖当前书签库——这是全量替换，备份之后新增的书签会被移除。'
              + '恢复前服务端会自动创建一次全量备份作为回滚点。'
            : ''
        }
        confirmLabel={restoring ? '恢复中…' : '确认恢复'}
        onConfirm={() => { if (!restoring) void handleRestore() }}
        onCancel={() => { if (!restoring) setRestoreTarget(null) }}
      />
    </>
  )
}
