import { TopBar } from '../components/layout/TopBar.js'
import { RecycleBinList } from '../components/recycle-bin/RecycleBinList.js'

export function RecycleBinPage() {
  return (
    <div>
      <TopBar title="回收站" />
      <div style={{ padding: 'var(--spacing-16)' }}>
        <RecycleBinList />
      </div>
    </div>
  )
}