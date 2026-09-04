import { useState } from 'react'

interface SaveBookmarkFormProps {
  onSave: (data: { url: string; note?: string; intent?: string; important?: boolean; private?: boolean }) => void
  onClose: () => void
}

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
    <form onSubmit={handleSubmit} style={{
      background: 'var(--color-bg-surface-400)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-comfortable)',
      padding: 'var(--spacing-16)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-12)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '-0.11px', margin: 0 }}>保存书签</h3>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-secondary)' }}>x</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-12)' }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="input"
          placeholder="输入 URL..."
          required
          autoFocus
        />

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
          placeholder="备注（可选）"
          style={{ width: '100%', minHeight: '50px', resize: 'vertical' }}
        />

        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="input"
          placeholder="保存意图（可选）"
        />

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

        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
          保存
        </button>
      </div>
    </form>
  )
}