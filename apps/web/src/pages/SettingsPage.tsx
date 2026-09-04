import { TopBar } from '../components/layout/TopBar.js'
import { SettingsSection } from '../components/settings/SettingsSection.js'
import { ChannelManager } from '../components/channels/ChannelManager.js'

export function SettingsPage() {
  return (
    <div>
      <TopBar title="设置" />
      <div style={{ padding: 'var(--spacing-16)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
        <SettingsSection />
        <ChannelManager />
      </div>
    </div>
  )
}