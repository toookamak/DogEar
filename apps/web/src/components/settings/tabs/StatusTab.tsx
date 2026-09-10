import { useEffect, useState } from 'react'
import { syncApi } from '../../../api/sync.js'
import { jobsApi } from '../../../api/jobs.js'
import { settingsApi } from '../../../api/settings.js'
import { QUEUE_STATUS_LABELS, JOB_STATUS_LABELS, formatAgo, label } from '../../../utils/format.js'
import type { SyncQueueItemResponse, JobResponse, SkillUsageResponse } from '../../../types/api.js'

const REFRESH_MS = 30000

/**
 * 状态信息：同步队列、后台任务与 Skill 用量。
 * 每 30 秒自刷新，满足 PRD §7.3「同步可观测」的诉求。
 * 条/秒、时延、成功率、429 等速率指标后端暂无接口，故此处不展示（见外壳屏稿 §4）。
 */
export function StatusTab() {
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [queue, setQueue] = useState<SyncQueueItemResponse[]>([])
  const [jobs, setJobs] = useState<JobResponse[]>([])
  const [usage, setUsage] = useState<SkillUsageResponse | null>(null)
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [pending, queueRes, jobsRes, usageRes] = await Promise.allSettled([
        syncApi.pendingCount(),
        syncApi.listQueue(5),
        jobsApi.list(),
        settingsApi.usage(),
      ])
      if (cancelled) return

      if (pending.status === 'fulfilled') setPendingCount(pending.value.pendingCount)
      if (queueRes.status === 'fulfilled') setQueue(queueRes.value.items ?? [])
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.items ?? [])
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value)

      const failed = [pending, queueRes, jobsRes, usageRes].filter((r) => r.status === 'rejected')
      setError(failed.length === 4 ? '无法读取同步状态，请检查是否已登录' : null)
      setLastChecked(Date.now())
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const jobsByStatus = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      {error && <div className="alert alert--error">{error}</div>}

      <section className="settings-section">
        <h3 className="section-title">同步状态</h3>
        <div className="stat-grid">
          <div className="stat-item">
            <span className="stat-value">{pendingCount ?? '—'}</span>
            <span className="stat-label">待推送</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{jobs.length}</span>
            <span className="stat-label">归档任务</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatAgo(lastChecked)}</span>
            <span className="stat-label">本次刷新</span>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 'var(--spacing-12)' }}>
          状态每 30 秒自动刷新。条/秒、时延、成功率与 429 次数需后端提供速率指标接口后接入。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="section-title">同步队列（最新 5 条）</h3>
        {queue.length === 0 ? (
          <p className="empty-note">队列为空。</p>
        ) : (
          <div className="list-stack">
            {queue.map((item) => (
              <div key={item.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{item.channel} · {item.action}</div>
                  <div className="list-row-meta">
                    {item.targetType} · 重试 {item.retryCount} 次 · {formatAgo(item.createdAt)}
                    {item.error ? ` · ${item.error}` : ''}
                  </div>
                </div>
                <span className="badge">{label(QUEUE_STATUS_LABELS, item.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="settings-section">
        <h3 className="section-title">后台任务</h3>
        {jobs.length === 0 ? (
          <p className="empty-note">暂无归档任务。</p>
        ) : (
          <>
            <div className="stat-grid">
              {Object.entries(jobsByStatus).map(([status, count]) => (
                <div key={status} className="stat-item">
                  <span className="stat-value">{count}</span>
                  <span className="stat-label">{label(JOB_STATUS_LABELS, status)}</span>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 'var(--spacing-12)' }}>
              逐条查看、重试与取消在「日志」分区的任务列表内。
            </p>
          </>
        )}
      </section>

      <section className="settings-section">
        <h3 className="section-title">Skill 用量（今日）</h3>
        {usage ? (
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-value">{usage.requests}</span>
              <span className="stat-label">读请求</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{usage.writes}</span>
              <span className="stat-label">写请求</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{usage.blocked}</span>
              <span className="stat-label">已拦截</span>
            </div>
          </div>
        ) : (
          <p className="empty-note">暂无用量数据。</p>
        )}
        {usage && <p className="muted" style={{ marginTop: 'var(--spacing-12)' }}>统计日期：{usage.date}</p>}
      </section>

      <section className="settings-section">
        <h3 className="section-title">资料库数量</h3>
        <p className="empty-note">
          总数、各状态与各场景的数量需要工作台侧的统计接口。当前
          <code className="mono"> get_stats </code>
          属 Skill 接口（Bearer 鉴权）且为全量读后内存计数，工作台会话不可用；按
          <code className="mono"> docs/API结构表.md </code>
          的升级规则，新增路由需先升版本文档，故本版不展示数量。
        </p>
      </section>
    </>
  )
}
