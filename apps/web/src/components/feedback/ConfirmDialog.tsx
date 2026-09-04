import { useState } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  open: boolean
}

export function ConfirmDialog({ title, message, onConfirm, onCancel, open }: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-bg-surface-400)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-comfortable)',
        padding: 'var(--spacing-16)',
        width: 'min(400px, 90vw)',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          letterSpacing: '-0.11px',
          margin: '0 0 var(--spacing-8)',
        }}>{title}</h3>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '16px',
          color: 'var(--color-text-secondary)',
          margin: '0 0 var(--spacing-16)',
        }}>{message}</p>
        <div style={{ display: 'flex', gap: 'var(--spacing-8)', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn-secondary-pill" style={{
            background: 'var(--color-bg-surface-400)',
            color: 'var(--color-text-primary)',
            border: 'none',
            padding: 'var(--spacing-8) var(--spacing-12)',
            borderRadius: 'var(--radius-comfortable)',
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            fontWeight: '400',
            cursor: 'pointer',
          }}>
            取消
          </button>
          <button onClick={onConfirm} className="btn-primary" style={{
            background: 'var(--color-bg-surface-300)',
            color: 'var(--color-text-primary)',
            border: 'none',
            padding: 'var(--spacing-8) var(--spacing-12)',
            borderRadius: 'var(--radius-comfortable)',
            fontFamily: 'var(--font-display)',
            fontSize: '14px',
            fontWeight: '400',
            cursor: 'pointer',
          }}>
            确认
          </button>
        </div>
      </div>
    </div>
  )
}