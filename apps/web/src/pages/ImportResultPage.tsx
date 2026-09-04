import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { TopBar } from '../components/layout/TopBar.js'
import { Loading } from '../components/feedback/Loading.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'
import type { ImportResponse } from '../api/channels.js'

export function ImportResultPage() {
  const [location] = useLocation()
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.split('?')[1] ?? '')
      const data = params.get('result')
      if (data) {
        setResult(JSON.parse(decodeURIComponent(data)))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [location])

  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error} />
  if (!result) return <ErrorMessage message="未找到导入结果" />

  return (
    <div>
      <TopBar title="导入结果" />
      <div style={{ padding: 'var(--spacing-16)', maxWidth: '600px', margin: '0 auto' }}>
        <div
          className="card"
          style={{
            padding: 'var(--spacing-16)',
            marginBottom: 'var(--spacing-16)',
            background: 'var(--color-bg-card, #e6e5e0)',
            border: '1px solid rgba(38, 37, 30, 0.1)',
            borderRadius: '8px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              letterSpacing: '-0.11px',
              margin: '0 0 var(--spacing-12)',
              color: 'var(--color-text-primary)',
            }}
          >
            导入完成
          </h3>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-16)',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
          }}>
            <div>成功: <strong>{result.imported}</strong></div>
            <div>跳过: <strong>{result.skipped}</strong></div>
            <div>错误: <strong>{result.errors.length}</strong></div>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div
            className="card"
            style={{
              padding: 'var(--spacing-16)',
              marginBottom: 'var(--spacing-16)',
              background: 'var(--color-bg-card, #e6e5e0)',
              border: '1px solid rgba(38, 37, 30, 0.1)',
              borderRadius: '8px',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: 500,
                margin: '0 0 var(--spacing-8)',
                color: 'var(--color-text-primary)',
              }}
            >
              错误详情 ({result.errors.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {result.errors.map((err, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '13px',
                    color: 'var(--color-error)',
                  }}
                >
                  {err}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => window.history.back()}
          className="btn-primary"
          style={{
            background: '#ebeae5',
            color: '#26251e',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '8px',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          返回
        </button>
      </div>
    </div>
  )
}