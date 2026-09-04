import { useState } from 'react'
import type { TagResponse } from '../../types/api.js'

interface TagSelectorProps {
  tags: TagResponse[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function TagSelector({ tags, selectedIds, onChange }: TagSelectorProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((t) => t !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
      {tags.map((tag) => {
        const active = selectedIds.includes(tag.id)
        return (
          <button
            key={tag.id}
            onClick={() => toggle(tag.id)}
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
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}