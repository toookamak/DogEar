import { useState } from 'react'
import { archiveApi } from '../../api/archive.js'

interface SnapshotButtonProps {
  bookmarkId: string
  url: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function SnapshotButton({ bookmarkId }: SnapshotButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)

  const handleSnapshot = async () => {
    setStatus('loading')
    setMessage('正在抓取页面…')
    try {
      const result = await archiveApi.create(bookmarkId)
      const id = result.jobId
      setJobId(id)
      try {
        await archiveApi.process()
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : '快照执行器不可用')
      }
      let job: { status?: string; error?: string | null } | null = null
      for (let i = 0; i < 20; i += 1) {
        job = await archiveApi.get(id)
        if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') break
        await sleep(400)
      }
      if (job?.status === 'succeeded') {
        setStatus('ready')
        setMessage('快照已完成')
        return
      }
      setStatus('error')
      setMessage(job?.error || (job?.status === 'pending' || job?.status === 'running' ? '仍在队列中，请稍后在状态页查看' : '快照失败'))
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
        {status === 'loading' ? '处理中...' : status === 'ready' ? '已完成' : '快照'}
      </button>
      {status === 'ready' && jobId && (
        <a className="snapshot-hint" href={`/api/archive/${jobId}/content`} target="_blank" rel="noopener noreferrer">
          查看快照
        </a>
      )}
      {message && (
        <div className={status === 'error' ? 'snapshot-hint snapshot-hint--error' : 'snapshot-hint'}>
          {message}
        </div>
      )}
    </div>
  )
}
