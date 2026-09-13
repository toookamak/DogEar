import { lazy, Suspense, useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { AppShell } from './AppShell.js'
import { LoginPage } from '../pages/LoginPage.js'
import { useSession } from '../hooks/useSession.js'

const WorkbenchPage = lazy(() => import('../pages/WorkbenchPage.js').then((m) => ({ default: m.WorkbenchPage })))
const RecycleBinPage = lazy(() => import('../pages/RecycleBinPage.js').then((m) => ({ default: m.RecycleBinPage })))
const OrganizationPage = lazy(() => import('../pages/OrganizationPage.js').then((m) => ({ default: m.OrganizationPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })))
const ImportResultPage = lazy(() => import('../pages/ImportResultPage.js').then((m) => ({ default: m.ImportResultPage })))
const OAuthCallbackPage = lazy(() => import('../pages/OAuthCallbackPage.js').then((m) => ({ default: m.OAuthCallbackPage })))
const NavPage = lazy(() => import('../pages/NavPage.js').then((m) => ({ default: m.NavPage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })))

export function App() {
  const [location, setLocation] = useLocation()
  const session = useSession()

  useEffect(() => {
    if (session.loading || location === '/login' || session.authenticated) return
    setLocation(`/login?next=${encodeURIComponent(location)}`)
  }, [session.loading, session.authenticated, location, setLocation])

  if (location === '/login') {
    return (
      <LoginPage
        onSuccess={async (next) => {
          await session.checkAuth()
          setLocation(next)
        }}
      />
    )
  }

  if (session.loading || !session.authenticated) {
    return <div className="loading">加载中...</div>
  }

  return (
    <AppShell onLogout={session.logout}>
      <Suspense fallback={<div className="loading">加载中...</div>}>
        <Switch>
          <Route path="/" component={WorkbenchPage} />
          <Route path="/bookmarks" component={WorkbenchPage} />
          <Route path="/organization" component={OrganizationPage} />
          <Route path="/recycle-bin" component={RecycleBinPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/settings/oauth/callback" component={OAuthCallbackPage} />
          <Route path="/import-result" component={ImportResultPage} />
          <Route path="/nav" component={NavPage} />
          <Route component={NotFoundPage} />
        </Switch>
      </Suspense>
    </AppShell>
  )
}
