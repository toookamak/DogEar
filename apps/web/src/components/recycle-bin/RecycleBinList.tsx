import { useState, useEffect, useCallback } from 'react'
import type { BookmarkResponse } from '../../types/api.js'
import { recycleBinApi } from '../../api/recycleBin.js'
import { settingsApi } from '../../api/settings.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'
import { EmptyState } from '../feedback/EmptyState.js'
import { Skeleton } from '../feedback/Skeleton.js'
import { formatDateTime } from '../../utils/format.js'
import { toast, errorMessage } from '../../toast.js'

/**
 * 回收站列表：恢复 / 永久删除 / 清空过期项。
 * 顶部展示保留期限（取自设置项 recycle.retention_days），让「多久会被清掉」可见。
 * 「清空」默认只清过期项（服务端 onlyExpired 缺省为 true），避免误删未过期内容。
 */
export function RecycleBinList() {
  const [items, setItems] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [retentionDays, setRetentionDays] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'purge' | 'empty'; id: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [listRes, settingsRes] = await Promise.allSettled([
      recycleBinApi.list(),
      settingsApi.list(),
    ])
    if (listRes.status === 'fulfilled') setItems(listRes.value.items ?? [])
    if (settingsRes.status === 'fulfilled') {
      const entry = settingsRes.value.items.find((item) => item.key === 'recycle.retention_days')
      if (entry) setRetentionDays(String(entry.value))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleRestore = async (id: string) => {
    setConfirm(null)
    try {
      await recycleBinApi.restore(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
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

  if (loading) return <Skeleton variant="table" count={6} />

  return (
    <>
      <div className="manager-head">
        <p className="muted" style={{ margin: 0 }}>
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

      {items.length === 0 ? (
        <EmptyState message="回收站为空" />
      ) : (
        <div className="list-stack">
          {items.map((item) => (
            <div key={item.id} className="list-row">
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
                  style={{ color: 'var(--color-error)' }}
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
        title={confirm?.kind === 'restore' ? '恢复书签' : confirm?.kind === 'empty' ? '清理过期项' : '永久删除'}
        message={
          confirm?.kind === 'restore'
            ? '该书签将回到原状态。确定恢复？'
            : confirm?.kind === 'empty'
              ? '将永久删除所有已超过保留期的条目。未过期的不会受影响。此操作不可恢复。'
              : '该书签将被永久删除，其标签、场景归属、建议与访问记录一并清除，不可恢复。'
        }
        confirmLabel={confirm?.kind === 'restore' ? '恢复' : confirm?.kind === 'empty' ? '清理' : '永久删除'}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'restore') void handleRestore(confirm.id)
          else if (confirm.kind === 'purge') void handlePurge(confirm.id)
          else void handleEmpty()
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
