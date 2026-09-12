import { useCallback, useEffect, useState } from 'react'
import { syncApi, type ConflictChoice, type ConflictRecord } from '../../api/sync.js'
import { toast, errorMessage } from '../../toast.js'

function snapshotTitle(raw: string | null): string {
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw) as { title?: string; url?: string }
    return parsed.title || parsed.url || '—'
  } catch {
    return '—'
  }
}

/**
 * 同步冲突面板（双向拉回侧）：冲突自动按「本地赢」记录，两端快照都在，
 * 这里逐条或批量解决（保留本地 / 用远端 / 合并=本地为基补远端非空字段）。
 */
export function ConflictsPanel() {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await syncApi.conflicts.list('pending')
      setConflicts(res.items ?? [])
      setLoaded(true)
    } catch {
      /* 冲突列表读取失败不阻塞通道管理 */
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const resolve = async (id: string, choice: ConflictChoice) => {
    setBusy(true)
    try {
      await syncApi.conflicts.resolve(id, choice)
      toast.success(choice === 'kept_local' ? '已保留本地版本' : choice === 'kept_remote' ? '已用远端覆盖本地' : '已合并（本地为基，补远端非空字段）')
      await load()
    } catch (e) {
      toast.error(errorMessage(e, '解决冲突失败'))
    }
    setBusy(false)
  }

  const resolveAll = async (choice: ConflictChoice) => {
    setBusy(true)
    try {
      const res = await syncApi.conflicts.resolveAll(choice)
      toast.success(`已批量解决 ${res.resolved} 条`)
      await load()
    } catch (e) {
      toast.error(errorMessage(e, '批量解决失败'))
    }
    setBusy(false)
  }

  if (loaded && conflicts.length === 0) return null

  return (
    <section className="settings-section">
      <h3 className="section-title">同步冲突（{conflicts.length}）</h3>
      <p className="muted muted--gap-bottom">
        拉回时发现「本地与远端都有变化」的条目会记录在这里（默认保留本地版本，两端快照都在）。
        解决方式：保留本地 / 用远端覆盖本地 / 合并（本地为基，远端非空字段补齐）。
      </p>
      <div className="list-stack">
        {conflicts.map((item) => (
          <div key={item.id} className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">本地：{snapshotTitle(item.localSnapshot)}</div>
              <div className="list-row-meta">远端：{snapshotTitle(item.remoteSnapshot)} · 发现于 {new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>
            <div className="list-row-actions">
              <button type="button" className="btn btn--pill" disabled={busy} onClick={() => { void resolve(item.id, 'kept_local') }}>保留本地</button>
              <button type="button" className="btn btn--pill" disabled={busy} onClick={() => { void resolve(item.id, 'kept_remote') }}>用远端</button>
              <button type="button" className="btn btn--pill" disabled={busy} onClick={() => { void resolve(item.id, 'merged') }}>合并</button>
            </div>
          </div>
        ))}
      </div>
      <div className="backup-actions">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => { void resolveAll('kept_local') }}>
          全部保留本地
        </button>
      </div>
    </section>
  )
}
