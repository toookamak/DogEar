import { useEffect, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { channelsApi } from '../api/channels.js'
import { errorMessage } from '../toast.js'

const REDIRECT_PATH = '/settings/oauth/callback'

/**
 * Raindrop OAuth 回调页。
 * 授权码换 token 成功后才落库；state 承载通道 id，用于把 token 写回对应通道。
 *
 * 注意：wouter 的 useLocation() 只返回 pathname，**不含查询串**。
 * 所以这里必须用 useSearch() 读 code / state——此前用
 * `location.split('?')[1]` 取参数，永远取不到，回调固定报「缺少授权参数」，
 * 即 OAuth 登录一直不可用。
 */
export function OAuthCallbackPage() {
  const [location, setLocation] = useLocation()
  const search = useSearch()
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (location !== REDIRECT_PATH) return

    const params = new URLSearchParams(search)
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
        setMessage('缺少授权参数（code / state）。请从设置页重新发起授权。')
        return
      }
      try {
        await channelsApi.oauthExchange({ channelId: state, code, redirectUri })
        setStatus('done')
      } catch (e) {
        setStatus('error')
        setMessage(errorMessage(e, 'OAuth 授权失败'))
      }
    })()
  }, [location, search])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-brand">DogEar</h1>

        {status === 'loading' ? (
          <>
            <p className="auth-subtitle">正在完成授权…</p>
            <div className="alert alert--info">正在用授权码换取 access token，请稍候。</div>
          </>
        ) : (
          <>
            <h2 className="section-title" style={{ textAlign: 'center', margin: 0 }}>
              {status === 'done' ? 'OAuth 授权成功' : 'OAuth 授权失败'}
            </h2>
            <div className={`alert alert--${status === 'done' ? 'success' : 'error'}`} role="status">
              {status === 'done'
                ? 'Raindrop access token 已保存到该通道，可返回设置页测试连通或导入书签。'
                : message}
            </div>
            <button type="button" className="btn btn--primary" onClick={() => setLocation('/settings')}>
              返回设置
            </button>
          </>
        )}
      </div>
    </div>
  )
}
