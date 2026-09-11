import type { SceneResponse } from '../../types/api.js'
import { isDisabled, scenesForPicker } from '../../utils/scene-filtering.js'

interface SceneSelectorProps {
  scenes: SceneResponse[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/**
 * 场景挑选器：给书签挂场景。
 * 用 scenesForPicker 取用——停用场景不出现，但**该书签已挂的停用场景会保留**，
 * 否则看不到也摘不掉（见 utils/scene-filtering.ts）。
 */
export function SceneSelector({ scenes, selectedIds, onChange }: SceneSelectorProps) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id])
  }

  const options = scenesForPicker(scenes, selectedIds)

  if (options.length === 0) {
    return <p className="empty-note">没有可用场景。可在「组织管理」里新建或启用场景。</p>
  }

  return (
    <div className="chip-group">
      {options.map((scene) => {
        const active = selectedIds.includes(scene.id)
        const disabled = isDisabled(scene)
        return (
          <button
            key={scene.id}
            type="button"
            className="chip"
            aria-pressed={active}
            title={disabled ? '该场景已停用；摘掉后不会再出现在这里' : undefined}
            onClick={() => toggle(scene.id)}
          >
            {scene.icon && <span aria-hidden="true">{scene.icon}</span>}
            {scene.name}
            {disabled && <span className="chip-note">已停用</span>}
          </button>
        )
      })}
    </div>
  )
}
