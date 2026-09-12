import { PageHeader } from '../components/layout/PageHeader.js'
import { RecycleBinList } from '../components/recycle-bin/RecycleBinList.js'

export function RecycleBinPage() {
  return (
    <div>
      <PageHeader title="回收站" />
      <div className="org-content org-content--padded">
        <RecycleBinList />
      </div>
    </div>
  )
}
