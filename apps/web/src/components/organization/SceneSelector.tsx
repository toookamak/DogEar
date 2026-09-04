import type { SceneResponse } from '../../types/api.js'

interface SceneSelectorProps {
  scenes: SceneResponse[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function SceneSelector({ scenes, selectedIds, onChange }: SceneSelectorProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
      {scenes.map((scene) => {
        const active = selectedIds.includes(scene.id)
        return (
          <button
            key={scene.id}
            onClick={() => toggle(scene.id)}
            style={{
              background: active ? 'var(--color-bg-surface-500)' : 'var(--color-bg-surface-400)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-full-pill)',
              padding: 'var(--spacing-3) var(--spacing-8)',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              color: active ? 'var(--color-text-primary)' : 'rgba(38, 37, 30, 0.6)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {scene.icon && <span style={{ marginRight: 'var(--spacing-2)' }}>{scene.icon}</span>}
            {scene.name}
          </button>
        )
      })}
    </div>
  )
}