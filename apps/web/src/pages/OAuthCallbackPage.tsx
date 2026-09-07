import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { channelsApi } from '../api/channels.js'

const REDIRECT_PATH = '/settings/oauth/callback'

export function OAuthCallbackPage() {
  const [location, setLocation] = useLocation()
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (location !== REDIRECT_PATH && !location.startsWith(`${REDIRECT_PATH}?`)) return

    const params = new URLSearchParams(location.split('?')[1] ?? '')
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const redirectUri = `${window.location.origin}${REDIRECT_PATH}`

    ;(async () => {
      if (error) {
        setStatus('error')
        setMessage(`授权未完成：${error}`)
        return
      }
      if (!code || !state) {
        setStatus('error')
        setMessage('缺少授权参数（code / state）')
        return
      }
      try {
        await channelsApi.oauthExchange({ channelId: state, code, redirectUri })
        setStatus('done')
      } catch (e) {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'OAuth 授权失败')
      }
    })()
  }, [location])

  const handleBack = () => setLocation('/settings')

  if (status === 'loading') {
    return (
      <div style={{ padding: 'var(--spacing-32)', fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--color-text-secondary)' }}>
        正在完成授权...
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--spacing-32)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-12)', alignItems: 'flex-start' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 500, margin: 0 }}>
        {status === 'done' ? 'OAuth 授权成功' : 'OAuth 授权失败'}
      </h2>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {status === 'done' ? 'Raindrop access token 已保存到该通道，可返回设置页测试或导入。' : message}
      </p>
      <button onClick={handleBack} className="btn-primary">
        返回设置
      </button>
    </div>
  )
}