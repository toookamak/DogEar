import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useTheme } from '../../theme/useTheme.js'
import { Icon } from '../ui/Icon.js'
import { settingsNavItem } from '../../app/navigation.js'

interface AccountMenuProps {
  onLogout: () => void | Promise<void>
  /** 窄屏抽屉里点完要收起侧栏 */
  onNavigate?: () => void
}

/**
 * 侧栏左下角的账户菜单（2026-09-27）。
 *
 * 合并此前散在两处的三个系统级动作：左下角的「设置」、右上角的「主题切换」与「退出」。
 * 侧栏贴底，所以弹层只能朝上展开。界面上不再保留第二个主题入口——
 * 顶栏那个快捷切换已删除；「跟随系统」的完整三态仍在设置页「外观」，
 * 这里的浅 / 深两态写的是显式偏好，与删除前 TopBar 按钮的行为一致（不是新语义）。
 */
export function AccountMenu({ onLogout, onNavigate }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [, setLocation] = useLocation()
  const { resolved, preference, setPreference } = useTheme()

  // 点外部 / Esc 收起
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const goSettings = () => {
    setOpen(false)
    setLocation(settingsNavItem.path)
    onNavigate?.()
  }

  const handleLogout = () => {
    setOpen(false)
    void onLogout()
  }

  return (
    <div className={`account${open ? ' is-open' : ''}`} ref={rootRef}>
      <div className="account-menu" role="menu" aria-label="账户">
        <div className="account-id">
          <span className="account-avatar account-avatar--lg" aria-hidden="true">D</span>
          <span className="account-who">
            <b>DogEar 本地实例</b>
            <i>自托管 · 单口令登录</i>
          </span>
        </div>
        <div className="account-sep" />

        <button type="button" className="account-item" role="menuitem" onClick={goSettings}>
          <Icon name={settingsNavItem.icon} />
          {settingsNavItem.label}
        </button>

        <div
          className="account-row"
          title={
            preference === 'system'
              ? '当前跟随系统；这里选择会写入显式偏好。三态在设置 › 外观'
              : '浅 / 深两态；「跟随系统」在设置 › 外观'
          }
        >
          <Icon name={resolved === 'dark' ? 'moon' : 'sun'} />
          主题
          <span className="account-seg">
            <button
              type="button"
              className={resolved === 'light' ? 'on' : undefined}
              aria-pressed={resolved === 'light'}
              onClick={() => setPreference('light')}
            >
              浅色
            </button>
            <button
              type="button"
              className={resolved === 'dark' ? 'on' : undefined}
              aria-pressed={resolved === 'dark'}
              onClick={() => setPreference('dark')}
            >
              深色
            </button>
          </span>
        </div>

        <div className="account-sep" />
        <button
          type="button"
          className="account-item account-item--danger"
          role="menuitem"
          onClick={handleLogout}
        >
          <Icon name="logout" />
          退出
        </button>
      </div>

      <button
        type="button"
        className="account-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        title="设置 · 主题 · 退出"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-avatar" aria-hidden="true">D</span>
        <span className="account-trigger-label">{settingsNavItem.label}</span>
        <span className="account-caret" aria-hidden="true"><Icon name="chevron" /></span>
      </button>
    </div>
  )
}
