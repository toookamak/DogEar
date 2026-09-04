import type { FolderResponse } from '../../types/api.js'

interface FolderSelectorProps {
  folders: FolderResponse[]
  selectedId: string | null
  onChange: (id: string | null) => void
}

export function FolderSelector({ folders, selectedId, onChange }: FolderSelectorProps) {
  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="input"
      style={{ width: '100%' }}
    >
      <option value="">无文件夹</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>{folder.name}</option>
      ))}
    </select>
  )
}