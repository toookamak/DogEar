import { useSyncExternalStore } from 'react'
import { statsApi, type StatsResponse } from './api/stats.js'
import { onOrgChanged } from './org-events.js'
import { onDataChanged } from './undo.js'

/**
 * 侧栏计数 / 统计的全局轻量 store（与 channel-tasks 同款模式）。
 * 单例拉取，侧栏订阅消费；组织维度变更（onOrgChanged）与书签数据变更
 * （onDataChanged：增删改/批量/撤销完成后广播）时自动刷新，避免每个组件各自拉取。
 * 拉取失败静默保留上次数据——计数是辅助信息，不应打断侧栏渲染。
 */
interface StatsState {
  stats: StatsResponse | null
  loading: boolean
}

let state: StatsState = { stats: null, loading: false }
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export async function refreshStats(): Promise<void> {
  const requestId = ++seq
  state = { ...state, loading: true }
  emit()
  try {
    const stats = await statsApi.get()
    if (requestId !== seq) return // 已有更新的取数，丢弃旧回执
    state = { stats, loading: false }
  } catch {
    if (requestId !== seq) return
    state = { ...state, loading: false } // 保留旧数据，不打断侧栏
  }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (state.stats === null && !state.loading) void refreshStats()
  // 组织维度与书签数据变更都影响计数；store 自行订阅，组件无须重复接线
  const offOrg = onOrgChanged(() => { void refreshStats() })
  const offData = onDataChanged(() => { void refreshStats() })
  return () => {
    listeners.delete(listener)
    offOrg()
    offData()
  }
}

function getSnapshot(): StatsState {
  return state
}

/** 侧栏等消费方使用；stats 未就绪时为 null，调用方自行降级（不显示计数） */
export function useStats(): StatsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 维度计数查询：byScene/byFolder/byTag 是数组，侧栏行按 id 取值 */
export function countForDimension(list: Array<{ id: string; count: number }> | undefined, id: string): number | null {
  if (!list) return null
  const found = list.find((entry) => entry.id === id)
  return found ? found.count : null
}
