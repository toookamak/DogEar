import { useState, useEffect, useCallback } from 'react'
import type { BookmarkResponse } from '../../types/api.js'
import { recycleBinApi } from '../../api/recycleBin.js'
import { ConfirmDialog } from '../feedback/ConfirmDialog.js'
import { EmptyState } from '../feedback/EmptyState.js'
import { Loading } from '../feedback/Loading.js'

export function RecycleBinList() {
  const [items, setItems] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmType, setConfirmType] = useState<'restore' | 'purge' | 'empty'>('purge')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await recycleBinApi.list()
      setItems(result.items)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRestore = async (id: string) => {
    try {
      await recycleBinApi.restore(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch { /* ignore */ }
    setConfirmId(null)
  }

  const handlePurge = async (id: string) => {
    try {
      await recycleBinApi.purge(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch { /* ignore */ }
    setConfirmId(null)
  }

  const handleEmpty = async () => {
    try {
      await recycleBinApi.empty({ onlyExpired: false })
      setItems([])
    } catch { /* ignore */ }
    setConfirmId(null)
  }

  if (loading) return <Loading />

  if (items.length === 0) return <EmptyState message="回收站为空" />

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-12)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setConfirmType('empty'); setConfirmId('__all__') }}
          className="btn-primary"
          style={{ fontSize: '13px' }}
        >
          清空回收站
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-8)' }}>
        {items.map((item) => (
          <div key={item.id} style={{
            background: 'var(--color-bg-surface-400)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-comfortable)',
            padding: 'var(--spacing-12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500 }}>{item.title || item.url}</div>
              {item.domain && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{item.domain}</div>}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
              <button onClick={() => { setConfirmType('restore'); setConfirmId(item.id) }} className="btn-secondary-pill" style={{ fontSize: '12px' }}>
                恢复
              </button>
              <button onClick={() => { setConfirmType('purge'); setConfirmId(item.id) }} className="btn-secondary-pill" style={{ fontSize: '12px', color: 'var(--color-error)' }}>
                永久删除
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title={confirmType === 'restore' ? '恢复书签' : confirmType === 'empty' ? '清空回收站' : '永久删除'}
        message={confirmType === 'restore' ? '确定恢复此书签？' : confirmType === 'empty' ? '确定清空回收站？此操作不可恢复。' : '确定永久删除此书签？此操作不可恢复。'}
        onConfirm={confirmId === '__all__' ? handleEmpty : confirmType === 'restore' ? () => handleRestore(confirmId!) : () => handlePurge(confirmId!)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}