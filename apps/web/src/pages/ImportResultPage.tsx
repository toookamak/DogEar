import { useEffect, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { PageHeader } from '../components/layout/PageHeader.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import type { ImportResponse } from '../api/channels.js'

/**
 * 导入结果页：条目多、错误需要逐条看，故独立成页而非弹窗。
 * 数据经 URL 查询串传递（导入方跳转时序列化结果）。
 *
 * 注意：wouter 的 useLocation() 只返回 pathname，不含查询串，
 * 必须用 useSearch() 读参数——此前用 `location.split('?')[1]` 永远取不到。
 */
export function ImportResultPage() {
  const [, setLocation] = useLocation()
  const search = useSearch()
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = new URLSearchParams(search).get('result')
      if (!raw) {
        setParseError('未收到导入结果数据，请回到设置页重新导入')
        return
      }
      const parsed = JSON.parse(decodeURIComponent(raw)) as ImportResponse
      setResult({
        imported: Number(parsed.imported ?? 0),
        skipped: Number(parsed.skipped ?? 0),
        errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      })
      setParseError(null)
    } catch {
      setParseError('导入结果无法解析，请回到设置页重新导入')
    }
  }, [search])

  if (parseError) {
    return (
      <div>
        <PageHeader title="导入结果" />
        <div className="org-content" style={{ padding: 'var(--spacing-16)' }}>
          <ErrorMessage message={parseError} />
          <button type="button" className="btn btn--primary" onClick={() => setLocation('/settings')}>
            返回设置
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const failed = result.errors.length > 0

  return (
    <div>
      <PageHeader title="导入结果" />
      <div className="org-content import-result">
        <section className="settings-section">
          <h3 className="section-title">{failed ? '导入完成（含错误）' : '导入完成'}</h3>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-value">{result.imported}</span>
              <span className="stat-label">已导入</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{result.skipped}</span>
              <span className="stat-label">已跳过</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{result.errors.length}</span>
              <span className="stat-label">错误</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 'var(--spacing-12)' }}>
            跳过通常是同一条书签已存在（按 Raindrop ID 去重），不需要处理。
          </p>
        </section>

        {failed && (
          <section className="settings-section">
            <h3 className="section-title">错误详情（{result.errors.length}）</h3>
            <div className="list-stack">
              {result.errors.map((err, index) => (
                <div key={index} className="list-row">
                  <div className="list-row-main">
                    <div className="list-row-meta" style={{ color: 'var(--color-error-text)' }}>{err}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="channel-form-actions">
          <button type="button" className="btn btn--primary" onClick={() => setLocation('/bookmarks')}>
            去看书签
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setLocation('/settings')}>
            返回设置
          </button>
        </div>
      </div>
    </div>
  )
}
