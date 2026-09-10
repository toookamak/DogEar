import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.js'
import { SceneManager } from '../components/organization/SceneManager.js'
import { FolderManager } from '../components/organization/FolderManager.js'
import { TagManager } from '../components/organization/TagManager.js'
import { useOrganization } from '../hooks/useOrganization.js'
import { Loading } from '../components/feedback/Loading.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'

export function OrganizationPage() {
  const [tab, setTab] = useState<'scenes' | 'folders' | 'tags'>('scenes')
  const { scenes, folders, tags, loading, error } = useOrganization()

  return (
    <div>
      <PageHeader title="组织管理" />
      <div style={{ padding: 'var(--spacing-16)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-8)', marginBottom: 'var(--spacing-16)', borderBottom: '1px solid var(--border-primary)' }}>
          {(['scenes', 'folders', 'tags'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                padding: 'var(--spacing-8) var(--spacing-12)',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: tab === t ? 600 : 400,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              {t === 'scenes' ? '场景' : t === 'folders' ? '文件夹' : '标签'}
            </button>
          ))}
        </div>

        {loading && <Loading />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && (
          <>
            {tab === 'scenes' && <SceneManager scenes={scenes} />}
            {tab === 'folders' && <FolderManager folders={folders} />}
            {tab === 'tags' && <TagManager tags={tags} />}
          </>
        )}
      </div>
    </div>
  )
}
