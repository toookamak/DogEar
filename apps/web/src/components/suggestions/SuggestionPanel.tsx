import { useState, useEffect, useCallback } from 'react'
import type { SuggestionResponse } from '../../types/api.js'
import { suggestionsApi } from '../../api/suggestions.js'
import { toast, errorMessage } from '../../toast.js'

interface SuggestionPanelProps {
  bookmarkId: string
  onUpdate: () => void
}

const KIND_LABELS: Record<string, string> = {
  scene: '场景',
  folder: '文件夹',
  tag: '标签',
}

/**
 * AI 整理建议（PRD：建议先行，写入前必须用户确认）。
 * 只列出待处理建议；接受后服务端会把归属写入书签，故不再提供「撤销接受」
 * （API 无该能力，做了也会与真实状态不符）——需要改动请到详情里直接编辑。
 */
export function SuggestionPanel({ bookmarkId, onUpdate }: SuggestionPanelProps) {
  const [suggestions, setSuggestions] = useState<SuggestionResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bookmarkId) return
    setLoading(true)
    try {
      const res = await suggestionsApi.list(bookmarkId, 'pending')
      setSuggestions(res.items ?? [])
    } catch {
      setSuggestions([])
    }
    setLoading(false)
  }, [bookmarkId])

  useEffect(() => { void load() }, [load])

  const act = async (id: string, kind: 'accept' | 'defer' | 'dismiss') => {
    setBusyId(id)
    try {
      await suggestionsApi[kind](id)
      setSuggestions((prev) => prev.filter((item) => item.id !== id))
      onUpdate()
      toast.success(kind === 'accept' ? '已采纳建议' : kind === 'defer' ? '已标记稍后处理' : '已忽略该建议')
    } catch (e) {
      toast.error(errorMessage(e, '操作失败'))
    }
    setBusyId(null)
  }

  return (
    <section className="suggestion-panel">
      <h3 className="section-title section-title--sm">AI 整理建议</h3>

      {loading ? (
        <p className="empty-note">加载中…</p>
      ) : suggestions.length === 0 ? (
        <p className="empty-note">
          暂无待处理建议。系统只做异步理解与建议，写入前都需要你确认（PRD §2.0.2）。
        </p>
      ) : (
        <div className="suggestion-list">
          {suggestions.map((item) => (
            <article key={item.id} className="suggestion-item">
              <div className="suggestion-head">
                <span className="suggestion-kind">{KIND_LABELS[item.kind] ?? item.kind}</span>
                <span className="suggestion-target">{item.targetLabel || item.targetId || '—'}</span>
                {item.confidence != null && (
                  <span className="badge">置信度 {Math.round(item.confidence * 100)}%</span>
                )}
              </div>

              {item.rationale && <p className="suggestion-rationale">{item.rationale}</p>}

              <div className="suggestion-actions">
                <button
                  type="button"
                  className="btn btn--pill"
                  disabled={busyId === item.id}
                  onClick={() => act(item.id, 'accept')}
                >
                  接受
                </button>
                <button
                  type="button"
                  className="btn btn--pill"
                  disabled={busyId === item.id}
                  onClick={() => act(item.id, 'defer')}
                >
                  稍后
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busyId === item.id}
                  onClick={() => act(item.id, 'dismiss')}
                >
                  忽略
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
