import { Route, Switch, useLocation } from 'wouter'
import { AppShell } from './AppShell.js'
import { LoginPage } from '../pages/LoginPage.js'
import { WorkbenchPage } from '../pages/WorkbenchPage.js'
import { RecycleBinPage } from '../pages/RecycleBinPage.js'
import { OrganizationPage } from '../pages/OrganizationPage.js'
import { SettingsPage } from '../pages/SettingsPage.js'
import { ImportResultPage } from '../pages/ImportResultPage.js'

export function App() {
  const [location] = useLocation()

  // If on login page, render without shell
  if (location === '/login') {
    return <LoginPage />
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={WorkbenchPage} />
        <Route path="/bookmarks" component={WorkbenchPage} />
        <Route path="/organization" component={OrganizationPage} />
        <Route path="/recycle-bin" component={RecycleBinPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/import-result" component={ImportResultPage} />
        <Route>404</Route>
      </Switch>
    </AppShell>
  )
}