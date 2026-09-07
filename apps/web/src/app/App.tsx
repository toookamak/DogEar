import { useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { AppShell } from './AppShell.js'
import { LoginPage } from '../pages/LoginPage.js'
import { WorkbenchPage } from '../pages/WorkbenchPage.js'
import { RecycleBinPage } from '../pages/RecycleBinPage.js'
import { OrganizationPage } from '../pages/OrganizationPage.js'
import { SettingsPage } from '../pages/SettingsPage.js'
import { ImportResultPage } from '../pages/ImportResultPage.js'
import { OAuthCallbackPage } from '../pages/OAuthCallbackPage.js'
import { NavPage } from '../pages/NavPage.js'
import { useSession } from '../hooks/useSession.js'

export function App() {
  const [location, setLocation] = useLocation()
  const session = useSession()

  useEffect(() => {
    if (session.loading || location === '/login' || session.authenticated) return
    setLocation(`/login?next=${encodeURIComponent(location)}`)
  }, [session.loading, session.authenticated, location, setLocation])

  if (location === '/login') {
    return <LoginPage />
  }

  if (session.loading || !session.authenticated) {
    return <div style={{ padding: 'var(--spacing-16)', fontFamily: 'var(--font-ui)' }}>加载中...</div>
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={WorkbenchPage} />
        <Route path="/bookmarks" component={WorkbenchPage} />
        <Route path="/organization" component={OrganizationPage} />
        <Route path="/recycle-bin" component={RecycleBinPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/settings/oauth/callback" component={OAuthCallbackPage} />
        <Route path="/import-result" component={ImportResultPage} />
        <Route path="/nav" component={NavPage} />
        <Route>404</Route>
      </Switch>
    </AppShell>
  )
}
