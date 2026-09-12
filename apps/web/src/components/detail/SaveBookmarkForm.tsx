import { useState } from 'react'

interface SaveBookmarkFormProps {
  onSave: (data: { url: string; note?: string; intent?: string; important?: boolean; private?: boolean }) => void
  onClose: () => void
}

/**
 * 保存书签表单。字段与 POST /api/bookmarks 的契约一致
 * （title 不在此处填写——它由服务端异步抓取元数据得到，见 docs/API结构表.md）。
 */
export function SaveBookmarkForm({ onSave, onClose }: SaveBookmarkFormProps) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [intent, setIntent] = useState('')
  const [important, setImportant] = useState(false)
  const [private_, setPrivate_] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    onSave({
      url: url.trim(),
      note: note || undefined,
      intent: intent || undefined,
      important,
      private: private_,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="save-form">
      <div className="manager-head manager-head--flush">
        <h3 className="section-title section-title--flush">保存书签</h3>
        <button type="button" className="icon-btn" aria-label="关闭保存表单" onClick={onClose}>×</button>
      </div>

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input"
        placeholder="输入 URL…"
        aria-label="书签 URL"
        required
        autoFocus
      />

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="input textarea textarea--short"
        placeholder="备注（可选）"
        aria-label="备注"
      />

      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        className="input"
        placeholder="保存意图（可选，例如：稍后读 / 项目参考）"
        aria-label="保存意图"
      />

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

      <p className="muted muted--flush">
        标题、摘要与图标会在保存后由服务端异步抓取。只需存下链接，整理可以以后再做。
      </p>

      <button type="submit" className="btn btn--primary">保存到 Inbox</button>
    </form>
  )
}
