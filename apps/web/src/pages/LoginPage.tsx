import { useState } from 'react'
import { useLocation } from 'wouter'

export function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [, setLocation] = useLocation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('密码错误')
        return
      }
      const next = new URLSearchParams(window.location.search).get('next') || '/'
      setLocation(next.startsWith('/') && !next.startsWith('//') ? next : '/')
    } catch {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--color-bg-page)',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--color-bg-surface-400)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-comfortable)',
        padding: 'var(--spacing-32)',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-16)',
      }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '-0.11px', margin: 0, textAlign: 'center' }}>
          DogEar
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
          请输入密码
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="密码"
          autoFocus
        />
        {error && <p style={{ color: 'var(--color-error)', fontSize: '13px', margin: 0 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}