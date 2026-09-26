import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.js'
import { SceneManager } from '../components/organization/SceneManager.js'
import { FolderManager } from '../components/organization/FolderManager.js'
import { TagManager } from '../components/organization/TagManager.js'
import { NavRuleManager } from '../components/nav/NavRuleManager.js'
import { useOrganization } from '../hooks/useOrganization.js'
import { Loading } from '../components/feedback/Loading.js'
import { ErrorMessage } from '../components/feedback/ErrorMessage.js'

const TABS = [
  { key: 'scenes', label: '场景' },
  { key: 'folders', label: '文件夹' },
  { key: 'tags', label: '标签' },
  { key: 'navrules', label: '导航规则' },
] as const

type TabKey = typeof TABS[number]['key']

export function OrganizationPage() {
  const [tab, setTab] = useState<TabKey>('scenes')
  const {
    scenes, folders, tags, loading, error,
    addScene, updateScene, deleteScene, mergeScene,
    addFolder, updateFolder, deleteFolder,
    addTag, deleteTag, renameTag, mergeTag,
  } = useOrganization()

  return (
    <div>
      <PageHeader title="组织管理" />
      <div className="org-page">
        <nav className="tab-strip" aria-label="组织维度">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="tab-btn"
              aria-current={tab === item.key ? 'true' : undefined}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="org-content">
          {loading && <Loading />}
          {error && <ErrorMessage message={error} />}

          {!loading && !error && (
            <>
              {tab === 'scenes' && (
                <SceneManager
                  scenes={scenes}
                  onCreate={addScene}
                  onUpdate={updateScene}
                  onMerge={mergeScene}
                  onDelete={deleteScene}
                />
              )}
              {tab === 'folders' && (
                <FolderManager
                  folders={folders}
                  onCreate={addFolder}
                  onUpdate={updateFolder}
                  onDelete={deleteFolder}
                />
              )}
              {tab === 'tags' && (
                <TagManager tags={tags} onCreate={addTag} onRename={renameTag} onMerge={mergeTag} onDelete={deleteTag} />
              )}
              {tab === 'navrules' && (
                <NavRuleManager scenes={scenes} folders={folders} tags={tags} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
