import { useEffect, useMemo, useState } from 'react'
import { settingsApi } from '../../../api/settings.js'
import { jobsApi } from '../../../api/jobs.js'
import { formatDateTime, JOB_STATUS_LABELS, label } from '../../../utils/format.js'
import { LOG_PAGE_SIZE, filterLogs, paginateLogs } from '../../../utils/log-query.js'
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
 * 日志：操作日志（可筛选、可搜索、分页，可撤销）与归档任务（可重试 / 取消）。
 *
 * 分工：**类型筛选走服务端**（`?action=` 已支持，是真过滤，不拉无关日志）；
 * 关键词搜索与分页在端侧（服务端无 `q` 参数且一次返回全部，日志有保留上限）。
 * 搜索与分页的纯逻辑见 `utils/log-query.ts`。
 */
export function LogTab() {
  const [logs, setLogs] = useState<OperationLogResponse[]>([])
  const [jobs, setJobs] = useState<JobResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  // 类型筛选走服务端：把它做进请求，而不是先拉全部再在端侧筛
  const load = async (action = actionFilter) => {
    setLoading(true)
    const [logsRes, jobsRes] = await Promise.allSettled([
      settingsApi.operationLog(action ? { action } : undefined),
      jobsApi.list(),
    ])
    if (logsRes.status === 'fulfilled') setLogs(logsRes.value.items ?? [])
    if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.items ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [actionFilter])

  // 关键词过滤 + 分页（纯函数，已单测）。logs 或 query 变化时页码回到第一页。
  const filtered = useMemo(() => filterLogs(logs, query), [logs, query])
  const paged = useMemo(() => paginateLogs(filtered, page), [filtered, page])

  // 筛选/搜索改变后页码可能越界，用分页函数收敛后的页码回写，避免停在空白页
  useEffect(() => {
    if (paged.page !== page) setPage(paged.page)
  }, [paged.page, page])

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
        <h3 className="section-title">操作日志{!loading && ` ${filtered.length} 条`}</h3>

        {/* 类型筛选：走服务端 action 参数。选项只列真实出现过的动作，
            避免界面上一排点了没结果的空 chips（原型是固定全列）。 */}
        <div className="log-filters">
          <select
            className="input log-filter-select"
            aria-label="按操作类型筛选"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0) }}
          >
            <option value="">全部类型</option>
            {Object.entries(ACTION_LABELS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <input
            type="search"
            className="input log-filter-search"
            placeholder="搜索操作 / 对象 / 来源"
            aria-label="搜索操作日志"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
          />
        </div>

        {loading ? (
          <p className="empty-note">加载中…</p>
        ) : logs.length === 0 ? (
          <p className="empty-note">
            {actionFilter ? '该类型下暂无日志。' : '暂无操作日志。'}
          </p>
        ) : filtered.length === 0 ? (
          <p className="empty-note">没有匹配「{query}」的日志。</p>
        ) : (
          <>
            <div className="list-stack">
              {paged.items.map((entry) => (
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

            {/* 分页：仅在多于 1 页时显示，避免只有几条时出现无意义的翻页控件 */}
            {paged.pageCount > 1 && (
              <div className="log-pager">
                <button
                  type="button"
                  className="btn btn--pill"
                  disabled={paged.page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  上一页
                </button>
                <span className="log-pager-count">
                  {paged.page + 1} / {paged.pageCount}
                  <span className="log-pager-total">（共 {filtered.length} 条，每页 {LOG_PAGE_SIZE}）</span>
                </span>
                <button
                  type="button"
                  className="btn btn--pill"
                  disabled={paged.page >= paged.pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </button>
              </div>
            )}
          </>
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
                      className="btn btn--pill btn--danger"
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
