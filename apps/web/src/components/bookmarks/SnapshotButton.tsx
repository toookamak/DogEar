import { useState } from 'react'
import { archiveApi } from '../../api/archive.js'

interface SnapshotButtonProps {
  bookmarkId: string
  url: string
}

export function SnapshotButton({ bookmarkId, url }: SnapshotButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSnapshot = async () => {
    setStatus('loading')
    try {
      const result = await archiveApi.create(bookmarkId)
      setStatus('queued')
      setMessage('快照已加入队列，等待浏览器处理')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : '创建快照失败')
    }
  }

  return (
    <div>
      <button
        onClick={handleSnapshot}
        disabled={status === 'loading'}
        className="btn-secondary-pill snapshot-btn"
      >
        {status === 'loading' ? '处理中...' : status === 'queued' ? '已排队' : '快照'}
      </button>
      {message && (
        <div className={status === 'error' ? 'snapshot-hint snapshot-hint--error' : 'snapshot-hint'}>
          {message}
        </div>
      )}
    </div>
  )
}