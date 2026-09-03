import { StrictMode, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import type { Bookmark } from '@dogear/shared'
import './styles.css'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

type AuthState = 'checking' | 'signed-out' | 'signed-in'

type ApiError = Error & { status?: number }

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include' })
  if (!response.ok) {
    const error = new Error(response.status === 401 ? '登录状态已失效，请重新登录' : '请求失败') as ApiError
    error.status = response.status
    throw error
  }
  return response
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      onLogin()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <p className="eyebrow">DOGEAR WORKBENCH</p>
      <h1>欢迎回来</h1>
      <p className="muted">登录后继续收集和整理你的书签。</p>
      <form onSubmit={submit} className="stack-form">
        <label htmlFor="password">访问密码</label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        <button type="submit" disabled={loading}>{loading ? '登录中…' : '登录工作台'}</button>
      </form>
      {error && <p role="alert" className="error-message">{error}</p>}
    </section>
  </main>
}

function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')

  useEffect(() => {
    request('/api/auth/me')
      .then(() => setAuthState('signed-in'))
      .catch(() => setAuthState('signed-out'))
  }, [])

  if (authState === 'checking') return <main className="center-state"><p className="muted">正在检查登录状态…</p></main>
  if (authState === 'signed-out') return <LoginPage onLogin={() => setAuthState('signed-in')} />
  return <Workbench onLogout={() => setAuthState('signed-out')} />
}

function Workbench({ onLogout }: { onLogout: () => void }) {
  const [url, setUrl] = useState('')
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [inboxResponse, pendingResponse] = await Promise.all([
        request('/api/inbox'),
        request('/api/sync/pending-count'),
      ])
      const inbox = await inboxResponse.json() as { bookmarks: Bookmark[] }
      const pending = await pendingResponse.json() as { pendingCount: number }
      setBookmarks(inbox.bookmarks)
      setPendingCount(pending.pendingCount)
    } catch (cause) {
      const apiError = cause as ApiError
      if (apiError.status === 401) {
        onLogout()
        return
      }
      setError(cause instanceof Error ? cause.message : '加载 Inbox 失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function saveBookmark(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      await request('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      setUrl('')
      await loadData()
      setFeedback('已保存到 Inbox')
    } catch (cause) {
      const apiError = cause as ApiError
      if (apiError.status === 401) {
        onLogout()
        return
      }
      setError(cause instanceof Error ? cause.message : '保存书签失败')
    } finally {
      setSaving(false)
    }
  }

  async function openBookmark(event: React.MouseEvent<HTMLAnchorElement>, bookmark: Bookmark) {
    event.preventDefault()
    setFeedback('')
    try {
      await request(`/api/bookmarks/${bookmark.id}/access-records`, { method: 'POST' })
    } catch (cause) {
      const apiError = cause as ApiError
      if (apiError.status === 401) {
        onLogout()
        return
      }
      setFeedback('访问记录暂时写入失败，仍将打开原链接')
    } finally {
      window.location.assign(bookmark.url)
    }
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' })
    } finally {
      onLogout()
    }
  }

  return <main className="workbench-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">DOGEAR</p>
        <h1>工作台</h1>
      </div>
      <button type="button" className="secondary-button" onClick={logout}>退出登录</button>
    </header>
    <section className="status-bar" aria-label="同步状态">
      <span className="status-dot" />
      <span>未推送 <strong>{pendingCount}</strong> 条</span>
    </section>
    <section className="capture-panel">
      <div>
        <p className="eyebrow">CAPTURE</p>
        <h2>保存一个链接</h2>
      </div>
      <form onSubmit={saveBookmark} className="capture-form">
        <input aria-label="书签 URL" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="粘贴 URL" required />
        <button type="submit" disabled={saving}>{saving ? '保存中…' : '保存'}</button>
      </form>
    </section>
    {error && <p role="alert" className="error-message">{error}</p>}
    {feedback && <p role="status" className="feedback-message">{feedback}</p>}
    <section className="inbox-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">INBOX</p>
          <h2>待处理链接</h2>
        </div>
        <button type="button" className="text-button" onClick={loadData} disabled={loading}>刷新</button>
      </div>
      {loading ? <p className="state-message">正在加载 Inbox…</p> : bookmarks.length === 0 ? <p className="state-message">Inbox 还是空的，先保存一个链接吧。</p> : <ul className="bookmark-list">
        {bookmarks.map((bookmark) => <li key={bookmark.id}>
          <a href={bookmark.url} onClick={(event) => openBookmark(event, bookmark)}>{bookmark.url}</a>
          <span>待处理</span>
        </li>)}
      </ul>}
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
