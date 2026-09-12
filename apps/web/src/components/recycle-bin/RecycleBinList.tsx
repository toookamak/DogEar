import { useState, useEffect, useCallback } from 'react'
import type { BookmarkResponse } from '../../types/api.js'
import { recycleBinApi } from '../../api/recycleBin.js'
import { settingsApi } from '../../api/settings.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'
import { EmptyState } from '../feedback/EmptyState.js'
import { Skeleton } from '../feedback/Skeleton.js'
import { formatDateTime } from '../../utils/format.js'
import { toast, errorMessage } from '../../toast.js'

type ConfirmKind = 'restore' | 'purge' | 'empty' | 'bulk-restore' | 'bulk-purge'

/**
 * 回收站列表：单条/批量恢复、永久删除、清理过期项。
 * 顶部展示保留期限（取自设置项 recycle.retention_days），让「多久会被清掉」可见。
 * 「清理过期项」用 onlyExpired（服务端缺省为 true），不会连未过期的一起删。
 *
 * 批量操作没有专用端点（API 结构表本版不新增路由），故对既有单条端点做客户端扇出，
 * 并**如实上报成功/失败条数**——不能因为「大部分成功」就宣称全部成功。
 */
export function RecycleBinList() {
  const [items, setItems] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [retentionDays, setRetentionDays] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; id: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [listRes, settingsRes] = await Promise.allSettled([
      recycleBinApi.list(),
      settingsApi.list(),
    ])
    if (listRes.status === 'fulfilled') {
      const list = listRes.value.items ?? []
      setItems(list)
      // 清掉已不存在的选中项，避免残留选中导致批量操作打空
      setSelected((prev) => new Set([...prev].filter((id) => list.some((item) => item.id === id))))
    }
    if (settingsRes.status === 'fulfilled') {
      const entry = settingsRes.value.items.find((item) => item.key === 'recycle.retention_days')
      if (entry) setRetentionDays(String(entry.value))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && selected.size === items.length
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))
  }

  const handleRestore = async (id: string) => {
    setConfirm(null)
    try {
      await recycleBinApi.restore(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
      toast.success('已恢复')
    } catch (e) {
      toast.error(errorMessage(e, '恢复失败'))
    }
  }

  const handlePurge = async (id: string) => {
    setConfirm(null)
    try {
      await recycleBinApi.purge(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
      toast.success('已永久删除')
    } catch (e) {
      toast.error(errorMessage(e, '永久删除失败'))
    }
  }

  const handleEmpty = async () => {
    setConfirm(null)
    try {
      const res = await recycleBinApi.empty({ onlyExpired: true })
      toast.success(res.purged > 0 ? `已清理 ${res.purged} 条过期项` : '没有过期项需要清理')
      await load()
    } catch (e) {
      toast.error(errorMessage(e, '清理失败'))
    }
  }

  /** 批量：对选中项扇出单条端点，逐条记结果 */
  const runBulk = async (kind: 'restore' | 'purge') => {
    const ids = [...selected]
    setConfirm(null)
    if (ids.length === 0) return
    setBusy(true)
    const call = kind === 'restore' ? recycleBinApi.restore : recycleBinApi.purge
    const results = await Promise.allSettled(ids.map((id) => call(id)))
    const okIds = ids.filter((_, i) => results[i].status === 'fulfilled')
    const failCount = ids.length - okIds.length
    setBusy(false)
    await load()
    const verb = kind === 'restore' ? '恢复' : '永久删除'
    if (failCount === 0) {
      toast.success(`已${verb} ${okIds.length} 条`)
    } else if (okIds.length === 0) {
      toast.error(`${verb}失败（${failCount} 条全部未成功）`)
    } else {
      // 部分成功必须说清，不能让用户以为全成了
      toast.info(`已${verb} ${okIds.length} 条，${failCount} 条失败`)
    }
  }

  if (loading) return <Skeleton variant="table" count={6} />

  return (
    <>
      <div className="manager-head">
        <p className="muted muted--flush">
          {retentionDays
            ? `删除的书签保留 ${retentionDays} 天，超期后可清理；期间可随时恢复。`
            : '删除的书签可在保留期内恢复。'}
        </p>
        <div className="list-row-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm({ kind: 'empty', id: '' })}>
            清理过期项
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="selection-bar">
          <span className="selection-bar-count">已选 {selected.size}</span>
          <button
            type="button"
            className="btn btn--pill"
            disabled={busy}
            onClick={() => setConfirm({ kind: 'bulk-restore', id: '' })}
          >
            批量恢复
          </button>
          <button
            type="button"
            className="btn btn--pill"
            disabled={busy}
            onClick={() => setConfirm({ kind: 'bulk-purge', id: '' })}
          >
            批量永久删除
          </button>
          <button type="button" className="btn btn--pill" onClick={() => setSelected(new Set())}>
            取消选择
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState message="回收站为空" />
      ) : (
        <div className="list-stack">
          <div className="list-row list-row--head">
            <label className="save-form-check">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="全选" />
              全选
            </label>
          </div>
          {items.map((item) => (
            <div key={item.id} className="list-row">
              <label className="save-form-check" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  aria-label={`选择 ${item.title || item.url}`}
                />
              </label>
              <div className="list-row-main">
                <div className="list-row-title">{item.title || item.url}</div>
                <div className="list-row-meta">
                  {item.domain ?? ''} · 删除于 {formatDateTime(item.deletedAt)}
                </div>
              </div>
              <div className="list-row-actions">
                <button type="button" className="btn btn--pill" onClick={() => setConfirm({ kind: 'restore', id: item.id })}>
                  恢复
                </button>
                <button
                  type="button"
                  className="btn btn--pill"
                  onClick={() => setConfirm({ kind: 'purge', id: item.id })}
                >
                  永久删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'restore' ? '恢复书签'
            : confirm?.kind === 'bulk-restore' ? `批量恢复 ${selected.size} 条`
              : confirm?.kind === 'empty' ? '清理过期项'
                : confirm?.kind === 'bulk-purge' ? `批量永久删除 ${selected.size} 条`
                  : '永久删除'
        }
        message={
          confirm?.kind === 'restore'
            ? '该书签将回到原状态。确定恢复？'
            : confirm?.kind === 'bulk-restore'
              ? `将恢复选中的 ${selected.size} 条书签。确定继续？`
              : confirm?.kind === 'empty'
                ? '将永久删除所有已超过保留期的条目。未过期的不会受影响。此操作不可恢复。'
                : confirm?.kind === 'bulk-purge'
                  ? `将永久删除选中的 ${selected.size} 条书签，其标签、场景归属、建议与访问记录一并清除，不可恢复。`
                  : '该书签将被永久删除，其标签、场景归属、建议与访问记录一并清除，不可恢复。'
        }
        confirmLabel={
          confirm?.kind === 'restore' || confirm?.kind === 'bulk-restore' ? '恢复'
            : confirm?.kind === 'empty' ? '清理' : '永久删除'
        }
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'restore') void handleRestore(confirm.id)
          else if (confirm.kind === 'purge') void handlePurge(confirm.id)
          else if (confirm.kind === 'empty') void handleEmpty()
          else if (confirm.kind === 'bulk-restore') void runBulk('restore')
          else void runBulk('purge')
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
