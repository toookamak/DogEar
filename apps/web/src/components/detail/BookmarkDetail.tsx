import { useState, useEffect } from 'react'
import type { BookmarkResponse, SceneResponse, FolderResponse, TagResponse } from '../../types/api.js'
import { bookmarksApi } from '../../api/bookmarks.js'
import { exportApi } from '../../api/export.js'
import { SnapshotButton } from '../bookmarks/SnapshotButton.js'
import { SceneSelector } from '../organization/SceneSelector.js'
import { FolderSelector } from '../organization/FolderSelector.js'
import { TagSelector } from '../organization/TagSelector.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'
import { Icon } from '../ui/Icon.js'
import { offerUndo } from '../../undo.js'
import { toast, errorMessage } from '../../toast.js'
import { SOURCE_LABELS, SYNC_STATUS_LABELS, formatDateTime, label } from '../../utils/format.js'

interface BookmarkDetailProps {
  bookmark: BookmarkResponse
  scenes: SceneResponse[]
  folders: FolderResponse[]
  tags: TagResponse[]
  onUpdate: (bookmark: BookmarkResponse) => void
  onClose: () => void
  onDeleted?: (id: string) => void
}

/**
 * 书签详情：覆盖式右侧浮层（遮罩 / Escape 均可收起，与原型 DetailPanel 一致）。
 * 结构与字段对齐原型：状态与来源徽标、标题、域名、摘要、主操作、整理维度、来源信息。
 * 写入统一走「保存」，避免逐项改动各自发请求导致版本冲突。
 */
export function BookmarkDetail({
  bookmark,
  scenes,
  folders,
  tags,
  onUpdate,
  onClose,
  onDeleted,
}: BookmarkDetailProps) {
  const [note, setNote] = useState(bookmark.note || '')
  const [status, setStatus] = useState(bookmark.status)
  const [important, setImportant] = useState(bookmark.important)
  const [private_, setPrivate_] = useState(bookmark.private)
  const [sceneIds, setSceneIds] = useState<string[]>((bookmark.scenes || []).map((scene) => scene.id))
  const [tagIds, setTagIds] = useState<string[]>((bookmark.tags || []).map((tag) => tag.id))
  const [folderId, setFolderId] = useState<string | null>(bookmark.folder?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setNote(bookmark.note || '')
    setStatus(bookmark.status)
    setImportant(bookmark.important)
    setPrivate_(bookmark.private)
    setSceneIds((bookmark.scenes || []).map((scene) => scene.id))
    setTagIds((bookmark.tags || []).map((tag) => tag.id))
    setFolderId(bookmark.folder?.id ?? null)
  }, [bookmark])

  // Escape 收起详情（与遮罩点击等价）
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      toast.success('已保存')
    } catch (e) {
      // 版本冲突可识别，给出可行动提示而不是笼统失败
      const message = errorMessage(e, '保存失败')
      toast.error(/CONFLICT|Version conflict/i.test(message) ? '保存失败：该书签已被他处修改，请关闭详情后重新打开' : message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    try {
      const result = await bookmarksApi.delete(bookmark.id)
      // 双入口撤销：Toast 直带撤销按钮（状态栏保留兜底），状态栏通知保留供既有监听
      if (result.undoId) {
        offerUndo({ undoId: result.undoId, message: '删除' })
        toast.undoable('已移入回收站', result.undoId)
      } else {
        toast.success('已移入回收站')
      }
      onDeleted?.(bookmark.id)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e, '删除失败'))
    }
  }

  const handleOpenUrl = async () => {
    try {
      await bookmarksApi.createAccessRecord(bookmark.id)
    } catch { /* 访问记录失败不阻塞打开原文 */ }
    window.open(bookmark.url, '_blank', 'noopener')
  }

  return (
    <>
      <div className="detail-aside-head">
        <span className="detail-aside-label">书签详情</span>
        <button type="button" className="icon-btn" aria-label="关闭详情" onClick={onClose}><Icon name="close" /></button>
      </div>

      <div className="detail-badges">
        {/* v0.8.0：状态徽标已隐藏（计划决策二：Status 界面隐藏）。字段与接口保留，可随时放回。 */}
        <span className="pill">{label(SOURCE_LABELS, bookmark.source)}</span>
        {bookmark.important && <span className="pill pill--important">重要</span>}
        {bookmark.private && <span className="pill">私密</span>}
        {bookmark.syncStatus === 'pending' && (
          <span className="pill pill--pending">{label(SYNC_STATUS_LABELS, bookmark.syncStatus)}</span>
        )}
      </div>

      <h2 className="detail-title">{bookmark.title || bookmark.url}</h2>
      {bookmark.domain && <p className="detail-domain">{bookmark.url}</p>}
      {bookmark.excerpt && <p className="detail-excerpt">{bookmark.excerpt}</p>}

      <div className="detail-actions-row">
        <button type="button" className="btn btn--primary" onClick={handleOpenUrl}>
          打开原文 <Icon name="external" />
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => exportApi.downloadHtml(bookmark.id, bookmark.title || bookmark.url)}
        >
          下载 HTML
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => exportApi.downloadMarkdown(bookmark.id, bookmark.title || bookmark.url)}
        >
          下载 Markdown
        </button>
      </div>

      <div className="detail-section">
        <label className="detail-field">
          <span className="detail-field-label">备注</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input textarea"
          />
        </label>

        {/* v0.8.0：状态选择器已隐藏（同上）。保存时仍原样回传当前 status，
            不让「隐藏入口」变成「静默改值」——被移进回收站或已确认的书签
            在详情里改备注，不该顺带把状态重置成 unread。 */}

        <div className="detail-field">
          <span className="detail-field-label">本地场景</span>
          {/* 停用场景的取舍由 SceneSelector 内部经 scenesForPicker 处理：
              隐藏停用项，但保留本页书签已挂的停用场景（否则摘不掉） */}
          <SceneSelector
            scenes={scenes}
            selectedIds={sceneIds}
            onChange={setSceneIds}
          />
        </div>

        <div className="detail-field">
          <span className="detail-field-label">文件夹</span>
          <FolderSelector folders={folders} selectedId={folderId} onChange={setFolderId} />
        </div>

        <div className="detail-field">
          <span className="detail-field-label">标签</span>
          <TagSelector tags={tags} selectedIds={tagIds} onChange={setTagIds} />
        </div>

        <div className="detail-actions-row">
          <label className="save-form-check">
            <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
            重要
          </label>
          <label className="save-form-check">
            <input type="checkbox" checked={private_} onChange={(e) => setPrivate_(e.target.checked)} />
            私密
          </label>
        </div>
      </div>

      <div className="detail-section">
        <SnapshotButton bookmarkId={bookmark.id} url={bookmark.url} />
        <button type="button" className="btn btn--primary" disabled={saving} onClick={handleSave}>
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setConfirmDelete(true)}
        >
          移入回收站
        </button>
      </div>

      <div className="detail-section detail-facts">
        <h3 className="section-title section-title--sm">来源信息</h3>
        <div className="detail-fact-row"><span>收集方式</span><strong>{label(SOURCE_LABELS, bookmark.source)}</strong></div>
        <div className="detail-fact-row">
          <span>场景</span>
          <strong>{(bookmark.scenes || []).length > 0 ? bookmark.scenes.map((s) => s.name).join('、') : '未挂载'}</strong>
        </div>
        <div className="detail-fact-row">
          <span>文件夹</span>
          <strong>{bookmark.folder?.name ?? '未设置'}</strong>
        </div>
        <div className="detail-fact-row"><span>加入时间</span><strong>{formatDateTime(bookmark.createdAt)}</strong></div>
        <div className="detail-fact-row">
          <span>同步状态</span>
          <strong>{label(SYNC_STATUS_LABELS, bookmark.syncStatus)}</strong>
        </div>
        <div className="detail-fact-row"><span>版本</span><strong>v{bookmark.version}</strong></div>
        {bookmark.raindropId && (
          <div className="detail-fact-row"><span>Raindrop ID</span><strong>{bookmark.raindropId}</strong></div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="移入回收站"
        message="该书签将移入回收站，可在保留期内恢复。确定继续？"
        confirmLabel="移入回收站"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
