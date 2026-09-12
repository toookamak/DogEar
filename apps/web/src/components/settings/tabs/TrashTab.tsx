import { useEffect, useState } from 'react'
import { recycleBinApi } from '../../../api/recycleBin.js'
import { settingsApi } from '../../../api/settings.js'
import { formatDateTime, label, STATUS_LABELS } from '../../../utils/format.js'
import type { BookmarkResponse } from '../../../types/api.js'

/**
 * 回收站：保留期限设置与已删除书签的恢复 / 永久删除 / 清空。
 * 保留期限写入 recycle.retention_days（PUT /api/settings 白名单）。
 * 「清空」默认只清过期项（onlyExpired 缺省为 true），永久删除不可撤销。
 */
export function TrashTab() {
  const [retentionDays, setRetentionDays] = useState('7')
  const [savedDays, setSavedDays] = useState('7')
  const [items, setItems] = useState<BookmarkResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await recycleBinApi.list({ limit: 50 })
      setItems(res.items ?? [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => {
    settingsApi.list()
      .then((res) => {
        const entry = res.items.find((item) => item.key === 'recycle.retention_days')
        if (entry) {
          const value = String(entry.value)
          setRetentionDays(value)
          setSavedDays(value)
        }
      })
      .catch(() => { /* 读取失败保留默认值 */ })
    void load()
  }, [])

  const saveRetention = async () => {
    setNotice(null)
    try {
      await settingsApi.update({ 'recycle.retention_days': retentionDays })
      setSavedDays(retentionDays)
      setNotice({ kind: 'success', text: '保留期限已保存。' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '保存失败' })
    }
  }

  const restore = async (id: string) => {
    try {
      await recycleBinApi.restore(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setNotice({ kind: 'success', text: '已恢复。' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '恢复失败' })
    }
  }

  const purge = async (id: string) => {
    if (confirmPurge !== id) {
      setConfirmPurge(id)
      return
    }
    setConfirmPurge(null)
    try {
      await recycleBinApi.purge(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setNotice({ kind: 'success', text: '已永久删除。' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '永久删除失败' })
    }
  }

  const emptyExpired = async () => {
    try {
      const res = await recycleBinApi.empty({ onlyExpired: true })
      setNotice({ kind: 'success', text: `已清理 ${res.purged} 条过期项。` })
      await load()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '清理失败' })
    }
  }

  return (
    <>
      {notice && <div className={`alert alert--${notice.kind}`}>{notice.text}</div>}

      <section className="settings-section">
        <h3 className="section-title">保留期限</h3>
        <div className="field-row">
          <input
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="input input--narrow"
          />
          <span className="field-label">天</span>
          <button
            type="button"
            className="btn btn--primary btn--push"
            disabled={retentionDays === savedDays}
            onClick={saveRetention}
          >
            保存
          </button>
        </div>
        <p className="muted muted--gap-top">
          超过保留期限的条目会在「清理过期项」时被永久删除。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="section-title">已删除书签（{items.length}）</h3>
        {loading ? (
          <p className="empty-note">加载中…</p>
        ) : items.length === 0 ? (
          <p className="empty-note">回收站为空。</p>
        ) : (
          <div className="list-stack">
            {items.map((item) => (
              <div key={item.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{item.title || item.url}</div>
                  <div className="list-row-meta">
                    {label(STATUS_LABELS, item.status)} · 删除于 {formatDateTime(item.deletedAt)}
                  </div>
                </div>
                <div className="list-row-actions">
                  <button type="button" className="btn btn--pill" onClick={() => restore(item.id)}>
                    恢复
                  </button>
                  <button
                    type="button"
                    className="btn btn--pill"
                    onClick={() => purge(item.id)}
                  >
                    {confirmPurge === item.id ? '确认永久删除？' : '永久删除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="field-row field-row--gap-top">
          <button type="button" className="btn btn--ghost" onClick={emptyExpired}>
            清理过期项
          </button>
        </div>
      </section>
    </>
  )
}
