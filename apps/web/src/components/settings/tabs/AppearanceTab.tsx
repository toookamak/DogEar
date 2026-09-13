import { useTheme } from '../../../theme/useTheme.js'
import type { ThemePreference } from '../../../theme/theme.js'

const OPTIONS: Array<{ key: ThemePreference; label: string }> = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'system', label: '跟随系统' },
]

/**
 * 外观：主题三选一（浅色 / 深色 / 跟随系统），持久化于 localStorage。
 * 分段控件复用 app.css 的 .view-switcher / .view-btn（内衬容器 + 琥珀实底激活键）。
 */
export function AppearanceTab() {
  const { preference, resolved, setPreference } = useTheme()

  return (
    <section className="settings-section">
      <h3 className="section-title">主题</h3>
      <div className="view-switcher view-switcher--fit" role="group" aria-label="主题偏好">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className="view-btn"
            aria-pressed={preference === opt.key}
            onClick={() => setPreference(opt.key)}
          >
            <span className="view-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
      <p className="muted muted--gap-top">
        当前生效：{resolved === 'dark' ? '深色' : '浅色'}
        。选择「跟随系统」时随操作系统的深浅色自动切换；顶栏右侧的主题按钮可在浅色与深色间快速切换。
      </p>
    </section>
  )
}
