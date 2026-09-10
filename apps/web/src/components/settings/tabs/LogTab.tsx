import { useEffect, useState } from 'react'
import { settingsApi } from '../../../api/settings.js'
import { jobsApi } from '../../../api/jobs.js'
import { formatDateTime, JOB_STATUS_LABELS, label } from '../../../utils/format.js'
import type { JobResponse, OperationLogResponse } from '../../../types/api.js'

const ACTION_LABELS: Record<string, string> = {
  create: '新建',
  update: '更新',
  delete: '删除',
  restore: '恢复',
  batch_update: '批量更新',
  purge: '永久删除',
  revert: '撤销',
  sync: '同步',
  import: '导入',
  export: '导出',
}

/**
 * 日志：操作日志（可撤销）与归档任务（可重试 / 取消）。
 * 撤销走 POST /api/operation-log/:id/revert；服务端只在存在 revertToken 时接受，
 * 否则返回 409 Nothing to undo，此处按提示处理而非报错。
 */
export function LogTab() {
  const [logs, setLogs] = useState<OperationLogResponse[]>([])
  const [jobs, setJobs] = useState<JobResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const [logsRes, jobsRes] = await Promise.allSettled([
      settingsApi.operationLog(),
      jobsApi.list(),
    ])
    if (logsRes.status === 'fulfilled') setLogs(logsRes.value.items ?? [])
    if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.items ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const revert = async (id: string) => {
    setNotice(null)
    try {
      await settingsApi.revertOperation(id)
      setNotice({ kind: 'success', text: '已撤销。' })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : '撤销失败'
      setNotice({
        kind: 'error',
        text: /Nothing to undo|CONFLICT/i.test(message) ? '该操作已不可撤销（可能已过期或已被撤销）。' : message,
      })
    }
  }

  const retryJob = async (id: string) => {
    setNotice(null)
    try {
      await jobsApi.retry(id)
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '重试失败' })
    }
  }

  const cancelJob = async (id: string) => {
    setNotice(null)
    try {
      await jobsApi.cancel(id)
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '取消失败' })
    }
  }

  return (
    <>
      {notice && <div className={`alert alert--${notice.kind}`}>{notice.text}</div>}

      <section className="settings-section">
        <h3 className="section-title">操作日志</h3>
        {loading ? (
          <p className="empty-note">加载中…</p>
        ) : logs.length === 0 ? (
          <p className="empty-note">暂无操作日志。</p>
        ) : (
          <div className="list-stack">
            {logs.map((entry) => (
              <div key={entry.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">
                    {label(ACTION_LABELS, entry.action)} · {entry.targetType}
                  </div>
                  <div className="list-row-meta">
                    {entry.actor} · {formatDateTime(entry.createdAt)}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </div>
                </div>
                <div className="list-row-actions">
                  <button type="button" className="btn btn--pill" onClick={() => revert(entry.id)}>
                    撤销
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="settings-section">
        <h3 className="section-title">归档任务</h3>
        {loading ? (
          <p className="empty-note">加载中…</p>
        ) : jobs.length === 0 ? (
          <p className="empty-note">暂无归档任务。</p>
        ) : (
          <div className="list-stack">
            {jobs.map((job) => (
              <div key={job.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{job.type === 'snapshot' ? '快照' : '正文归档'}</div>
                  <div className="list-row-meta">
                    {label(JOB_STATUS_LABELS, job.status)} · 重试 {job.retryCount} 次 · {formatDateTime(job.createdAt)}
                    {job.error ? ` · ${job.error}` : ''}
                  </div>
                </div>
                <div className="list-row-actions">
                  {job.status === 'failed' && (
                    <button type="button" className="btn btn--pill" onClick={() => retryJob(job.id)}>
                      重试
                    </button>
                  )}
                  {(job.status === 'pending' || job.status === 'running') && (
                    <button
                      type="button"
                      className="btn btn--pill"
                      style={{ color: 'var(--color-error)' }}
                      onClick={() => cancelJob(job.id)}
                    >
                      取消
                    </button>
                  )}
                  {job.status === 'succeeded' && <span className="badge">已完成</span>}
                  {job.status === 'cancelled' && <span className="badge">已取消</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
