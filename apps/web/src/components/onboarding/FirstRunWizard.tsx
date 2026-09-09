import { useLocation } from 'wouter'

export const WIZARD_STORAGE_KEY = 'dogear.wizard.done'

export function FirstRunWizard({ onDone }: { onDone: () => void }) {
  const [, setLocation] = useLocation()

  const finish = (goToSettings: boolean) => {
    window.localStorage.setItem(WIZARD_STORAGE_KEY, '1')
    onDone()
    if (goToSettings) setLocation('/settings')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-16)',
    }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', padding: 'var(--spacing-24)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', margin: '0 0 var(--spacing-12)' }}>开始使用 DogEar</h2>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-8)' }}>
          保存链接不依赖 Raindrop、S3 或 WebDAV。登录本应用即可收藏。
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-16)' }}>
          数据通道可以以后在设置里再配，也可以跳过。
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-8)', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => finish(false)}>跳过</button>
          <button className="btn-primary" onClick={() => finish(true)}>去设置（可选）</button>
        </div>
      </div>
    </div>
  )
}
