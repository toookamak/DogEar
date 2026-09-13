import { useSyncExternalStore } from 'react'
import {
  applyTheme,
  getThemePreference,
  setThemePreference,
  watchSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme.js'

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
}

const listeners = new Set<() => void>()

// 模块加载即应用一次（幂等）：兜底 index.html 内联脚本缺失或 localStorage 拒访的场景
let state: ThemeState = { preference: getThemePreference(), resolved: applyTheme(getThemePreference()) }

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  watchSystemTheme(emit)
  return () => listeners.delete(listener)
}

function getSnapshot(): ThemeState {
  return state
}

/**
 * 当前主题偏好与解析结果。resolved 表示实际生效的主题
 * （偏好为 system 时由操作系统决定，随系统切换即时更新）。
 */
export function useTheme(): {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    preference: snapshot.preference,
    resolved: snapshot.resolved,
    setPreference: (pref) => {
      state = { preference: pref, resolved: setThemePreference(pref) }
      emit()
    },
  }
}
