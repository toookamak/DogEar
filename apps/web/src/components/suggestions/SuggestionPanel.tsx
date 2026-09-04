import { useState, useEffect } from 'react'
import type { SuggestionResponse } from '../../types/api.js'
import { suggestionsApi } from '../../api/suggestions.js'

interface SuggestionPanelProps {
  bookmarkId: string
  onUpdate: () => void
}

export function SuggestionPanel({ bookmarkId, onUpdate }: SuggestionPanelProps) {
  const [suggestions, setSuggestions] = useState<SuggestionResponse[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!bookmarkId) return
    setLoading(true)
    suggestionsApi.list(bookmarkId, 'pending')
      .then((res) => setSuggestions(res.items))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false))
  }, [bookmarkId])

  if (loading) {
    return <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-muted)' }}>加载建议...</p>
  }

  if (suggestions.length === 0) {
    return (
      <div style={{
        background: 'var(--color-bg-surface-400)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-comfortable)',
        padding: 'var(--spacing-12)',
      }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-8)' }}>
          AI 建议
        </h4>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
          暂无建议。确认后才会写入场景或标签。
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--color-bg-surface-400)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-comfortable)',
      padding: 'var(--spacing-12)',
    }}>
      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, margin: '0 0 var(--spacing-8)' }}>
        AI 建议
      </h4>
      {suggestions.map((s) => (
        <div key={s.id} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--spacing-6) 0',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
              {s.kind === 'scene' ? '场景' : s.kind === 'folder' ? '文件夹' : '标签'}: {s.targetLabel || s.targetId}
            </span>
            {s.confidence && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'var(--spacing-4)' }}>
                ({Math.round(s.confidence * 100)}%)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <button onClick={async () => { await suggestionsApi.accept(s.id); onUpdate() }} className="btn-secondary-pill" style={{ fontSize: '12px', padding: 'var(--spacing-2) var(--spacing-6)' }}>
              接受
            </button>
            <button onClick={async () => { await suggestionsApi.defer(s.id); onUpdate() }} className="btn-secondary-pill" style={{ fontSize: '12px', padding: 'var(--spacing-2) var(--spacing-6)' }}>
              延后
            </button>
            <button onClick={async () => { await suggestionsApi.dismiss(s.id); onUpdate() }} className="btn-secondary-pill" style={{ fontSize: '12px', padding: 'var(--spacing-2) var(--spacing-6)' }}>
              忽略
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}