import { useState, useEffect } from 'react'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { exportApi } from '../../api/export.js'
import { SnapshotButton } from '../bookmarks/SnapshotButton.js'
import { SceneSelector } from '../organization/SceneSelector.js'
import { FolderSelector } from '../organization/FolderSelector.js'
import { TagSelector } from '../organization/TagSelector.js'
import { offerUndo } from '../../undo.js'

interface BookmarkDetailProps {
  bookmark: BookmarkResponse
  scenes: SceneResponse[]
  folders: FolderResponse[]
  tags: TagResponse[]
  onUpdate: (bookmark: BookmarkResponse) => void
  onClose: () => void
  onDeleted?: (id: string) => void
}

export function BookmarkDetail({ bookmark, scenes, folders, tags, onUpdate, onClose, onDeleted }: BookmarkDetailProps) {
  const [note, setNote] = useState(bookmark.note || '')
  const [status, setStatus] = useState(bookmark.status)
  const [important, setImportant] = useState(bookmark.important)
  const [private_, setPrivate_] = useState(bookmark.private)
  const [sceneIds, setSceneIds] = useState<string[]>((bookmark.scenes || []).map((scene) => scene.id))
  const [tagIds, setTagIds] = useState<string[]>((bookmark.tags || []).map((tag) => tag.id))
  const [folderId, setFolderId] = useState<string | null>(bookmark.folder?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    setNote(bookmark.note || '')
    setStatus(bookmark.status)
    setImportant(bookmark.important)
    setPrivate_(bookmark.private)
    setSceneIds((bookmark.scenes || []).map((scene) => scene.id))
    setTagIds((bookmark.tags || []).map((tag) => tag.id))
    setFolderId(bookmark.folder?.id ?? null)
  }, [bookmark])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await bookmarksApi.update(bookmark.id, {
        note,
        status,
        important,
        private: private_,
        folderId,
        sceneIds,
        tagIds,
      })
      onUpdate(updated)
    } catch (e) {
      console.error('Failed to update bookmark', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('移入回收站？')) return
    try {
      const result = await bookmarksApi.delete(bookmark.id)
      if (result.undoId) offerUndo({ undoId: result.undoId, message: '删除' })
      onDeleted?.(bookmark.id)
      onClose()
    } catch (e) {
      console.error('Failed to delete bookmark', e)
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
            <option value="unread">待处理</option>
            <option value="saved">已确认</option>
            <option value="archived">搁置</option>
          </select>
        </div>

        <div>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-4)' }}>场景</label>
          <SceneSelector
            scenes={scenes.filter((scene) => scene.enabled !== false || sceneIds.includes(scene.id))}
            selectedIds={sceneIds}
            onChange={setSceneIds}
          />
        </div>

        <div>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-4)' }}>文件夹</label>
          <FolderSelector folders={folders} selectedId={folderId} onChange={setFolderId} />
        </div>

        <div>
          <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--spacing-4)' }}>标签</label>
          <TagSelector tags={tags} selectedIds={tagIds} onChange={setTagIds} />
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
        <button onClick={handleDelete} className="btn-secondary" style={{ width: '100%', color: 'var(--color-error)' }}>
          移入回收站
        </button>
      </div>
    </div>
  )
}