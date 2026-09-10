import { PageHeader } from '../components/layout/PageHeader.js'
import { RecycleBinList } from '../components/recycle-bin/RecycleBinList.js'

export function RecycleBinPage() {
  return (
    <div>
      <PageHeader title="回收站" />
      <div style={{ padding: 'var(--spacing-16)' }}>
        <RecycleBinList />
      </div>
    </div>
  )
}