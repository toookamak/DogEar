import { useState, useEffect, useCallback } from 'react'

interface SessionState {
  authenticated: boolean
  loading: boolean
  error: string | null
}

export function useSession() {
  const [state, setState] = useState<SessionState>({ authenticated: false, loading: true, error: null })

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        setState({ authenticated: true, loading: false, error: null })
      } else {
        setState({ authenticated: false, loading: false, error: null })
      }
    } catch {
      setState({ authenticated: false, loading: false, error: '网络错误' })
    }
  }, [])

  const login = useCallback(async (password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setState({ authenticated: false, loading: false, error: '密码错误' })
        return false
      }
      setState({ authenticated: true, loading: false, error: null })
      return true
    } catch {
      setState({ authenticated: false, loading: false, error: '网络错误' })
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setState({ authenticated: false, loading: false, error: null })
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  return { ...state, login, logout, checkAuth }
}