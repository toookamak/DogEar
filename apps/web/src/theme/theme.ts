/**
 * 主题偏好管理（浅色 / 深色 / 跟随系统）。
 * 持久化在 localStorage（dogear.theme），实际色板由 tokens.css 的
 * [data-theme='dark'] 块提供，挂载点为 <html data-theme="light|dark">。
 * 首帧防闪烁见 index.html 的内联脚本：键名与 theme-color 值两处共用，改动需同步。
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'dogear.theme'

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#191919',
}

const systemDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemDarkQuery().matches ? 'dark' : 'light'
  return pref
}

export function getThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    return 'system'
  }
}

/** 把解析结果写到 <html data-theme> 并同步移动端地址栏的 theme-color */
export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref)
  document.documentElement.dataset.theme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolved])
  return resolved
}

/** 写入偏好并立即应用；返回解析后的实际主题 */
export function setThemePreference(pref: ThemePreference): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    /* 隐私模式等场景不可写：偏好仅本次会话生效 */
  }
  return applyTheme(pref)
}

let systemWatched = false
let onSystemChange: (() => void) | null = null

/**
 * 订阅系统深浅色变化（幂等）。「跟随系统」时 OS 切换要即时反映；
 * onChange 供 React 侧触发重渲染，非必传。
 */
export function watchSystemTheme(onChange?: () => void): void {
  if (onChange) onSystemChange = onChange
  if (systemWatched) return
  systemWatched = true
  systemDarkQuery().addEventListener('change', () => {
    if (getThemePreference() === 'system') {
      applyTheme('system')
      onSystemChange?.()
    }
  })
}
