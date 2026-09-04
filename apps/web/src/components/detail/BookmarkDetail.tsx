import { useState, useEffect } from 'react'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { exportApi } from '../../api/export.js'
import { SnapshotButton } from '../bookmarks/SnapshotButton.js'

interface BookmarkDetailProps {
  bookmark: BookmarkResponse
  scenes: SceneResponse[]
  folders: FolderResponse[]
  tags: TagResponse[]
  onUpdate: (bookmark: BookmarkResponse) => void
  onClose: () => void
}

export function BookmarkDetail({ bookmark, scenes, folders, tags, onUpdate, onClose }: BookmarkDetailProps) {
  const [note, setNote] = useState(bookmark.note || '')
  const [status, setStatus] = useState(bookmark.status)
  const [important, setImportant] = useState(bookmark.important)
  const [private_, setPrivate_] = useState(bookmark.private)
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await bookmarksApi.update(bookmark.id, { note, status, important, private: private_ })
      onUpdate(updated)
    } catch (e) {
      console.error('Failed to update bookmark', e)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenUrl = async () => {
    setViewing(true)
    try {
      await bookmarksApi.createAccessRecord(bookmark.id)
    } catch { /* ignore */ }
    window.open(bookmark.url, '_blank', 'noopener')
    setTimeout(() => setViewing(false), 500)
  }

  return (
    <div style={{
      background: 'var(--color-bg-surface-400)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-comfortable)',
      padding: 'var(--spacing-16)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-12)' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          letterSpacing: '-0.11px',
          margin: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {bookmark.title || bookmark.url}
        </h3>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: '20px', color: 'var(--color-text-secondary)',
          padding: 'var(--spacing-4)',
        }}>x</button>
      </div>

      {bookmark.domain && (
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 var(--spacing-8)' }}>
          {bookmark.url}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-8)', marginBottom: 'var(--spacing-12)' }}>
        <button onClick={handleOpenUrl} disabled={viewing} className="btn-primary" style={{ fontSize: '12px', padding: 'var(--spacing-6) var(--spacing-10)' }}>
          {viewing ? '打开中...' : '打开原文'}
        </button>
        <button onClick={() => exportApi.downloadHtml(bookmark.id, bookmark.title || bookmark.url)} className="btn-secondary" style={{ fontSize: '12px', padding: 'var(--spacing-6) var(--spacing-10)' }}>
          下载 HTML
        </button>
        <button onClick={() => exportApi.downloadMarkdown(bookmark.id, bookmark.title || bookmark.url)} className="btn-secondary" style={{ fontSize: '12px', padding: 'var(--spacing-6) var(--spacing-10)' }}>
          下载 Markdown
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-12)' }}>
        <div>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-4)' }}>备注</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
          />
        </div>

        <SnapshotButton bookmarkId={bookmark.id} url={bookmark.url} />

        <div>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-4)' }}>状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input" style={{ width: '100%' }}>
            <option value="unread">未读</option>
            <option value="saved">已保存</option>
            <option value="archived">已归档</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-16)' }}>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', cursor: 'pointer' }}>
            <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
            重要
          </label>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', cursor: 'pointer' }}>
            <input type="checkbox" checked={private_} onChange={(e) => setPrivate_(e.target.checked)} />
            私密
          </label>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%' }}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}