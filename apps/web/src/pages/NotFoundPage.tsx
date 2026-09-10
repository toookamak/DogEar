import { useLocation } from 'wouter'

/** 未匹配路由的兜底页。给出去处，而不是只丢一个「404」。 */
export function NotFoundPage() {
  const [location, setLocation] = useLocation()

  return (
    <div className="not-found">
      <p className="not-found-code">404</p>
      <h2 className="section-title">没有这个页面</h2>
      <p className="muted" style={{ margin: 0 }}>
        <code className="mono">{location}</code> 不对应任何页面。
      </p>
      <div className="channel-form-actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn--primary" onClick={() => setLocation('/')}>
          回 Inbox
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setLocation('/bookmarks')}>
          去看书签
        </button>
      </div>
    </div>
  )
}
