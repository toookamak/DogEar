import { useState } from 'react'
import { useLocation } from 'wouter'

/**
 * 登录页：单口令进入（工作台为个人工具，不设多用户，见技术总纲）。
 * 登录成功后先刷新会话再跳转，避免「已登录但页面仍要求登录」的闪回。
 */
export function LoginPage({ onSuccess }: { onSuccess?: (next: string) => Promise<void> | void }) {
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
        setError(res.status === 401 ? '密码错误' : `登录失败（HTTP ${res.status}）`)
        return
      }
      const next = new URLSearchParams(window.location.search).get('next') || '/'
      // 只接受站内相对路径，挡掉 //evil.com 这类协议相对跳转
      const target = next.startsWith('/') && !next.startsWith('//') ? next : '/'
      if (onSuccess) await onSuccess(target)
      else setLocation(target)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1 className="auth-brand">DogEar</h1>
        <p className="auth-subtitle">折耳书签 · 个人书签增强工具</p>

        <label className="channel-field">
          <span className="channel-field-label">访问口令</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="请输入口令"
            aria-label="访问口令"
            autoFocus
          />
        </label>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? '登录中…' : '进入工作台'}
        </button>
      </form>
    </div>
  )
}
