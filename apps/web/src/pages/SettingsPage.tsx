import { PageHeader } from '../components/layout/PageHeader.js'
import { SettingsSection } from '../components/settings/SettingsSection.js'
import { ChannelManager } from '../components/channels/ChannelManager.js'

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="设置" />
      <div style={{ padding: 'var(--spacing-16)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
        <SettingsSection />
        <ChannelManager />
      </div>
    </div>
  )
}