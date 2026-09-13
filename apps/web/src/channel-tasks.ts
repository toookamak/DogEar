import { channelsApi } from './api/channels.js'
import type { ExportPageResponse, ImportPageResponse } from './api/channels.js'
import { toast } from './toast.js'

/**
 * 通道长任务（导入 / 导出）的全局进度状态。
 *
 * 之前导入/导出进度是 ChannelManager 的组件 state：切到别的页面组件卸载，
 * 「导入中…」直接消失，无法区分还在导还是已结束。现在分页循环放在这个模块级
 * 单例里驱动，页面切换不影响任务；设置页通过 useSyncExternalStore 订阅展示进度。
 *
 * - 导入：服务端每次导一页（50 条），按 raindropId 去重；中断后再点「导入」
 *   会从头扫页、跳过已入库条目继续。
 * - 导出：服务端每次推一页（20 条，Raindrop create 无批量端点）；失败的条目
 *   由前端带回 excludeIds 跳过，不会卡死循环；中断后再点「导出」只导未推送的。
 */

type TaskStatus = 'idle' | 'running' | 'done' | 'error'

export interface TaskState {
  status: TaskStatus
  channelId: string | null
  channelLabel: string
  /** 已完成轮数（导入=页数；导出=分页轮数） */
  rounds: number
  okCount: number
  skipped: number
  failed: number
  /** 远端总数（取第一轮回执；不可知为 0） */
  total: number
  errors: string[]
  error: string | null
}

const IDLE: TaskState = {
  status: 'idle',
  channelId: null,
  channelLabel: '',
  rounds: 0,
  okCount: 0,
  skipped: 0,
  failed: 0,
  total: 0,
  errors: [],
  error: null,
}

function createStore() {
  let state = IDLE
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(patch: Partial<TaskState>) {
      state = { ...state, ...patch }
      for (const listener of listeners) listener()
    },
  }
}

const importTask = createStore()
const exportTask = createStore()

function isStale(task: { get: () => TaskState }, channelId: string): boolean {
  const state = task.get()
  return state.status !== 'running' || state.channelId !== channelId
}

// ————— 导入（按页，前端驱动） —————

export function subscribeImportProgress(listener: () => void): () => void {
  return importTask.subscribe(listener)
}

export function getImportProgress(): TaskState {
  return importTask.get()
}

/** 全局同一时间只允许一个导入进行中；重复调用直接忽略 */
export function startChannelImport(channelId: string, channelLabel: string): void {
  if (importTask.get().status === 'running') return
  importTask.set({ status: 'running', channelId, channelLabel, rounds: 0, okCount: 0, skipped: 0, failed: 0, total: 0, errors: [], error: null })
  void runImport()
}

async function runImport(): Promise<void> {
  const channelId = importTask.get().channelId
  if (!channelId) return

  while (!isStale(importTask, channelId)) {
    let page: ImportPageResponse
    try {
      page = await channelsApi.importPage(channelId, importTask.get().rounds)
    } catch (e) {
      finishImport('error', e instanceof Error ? e.message : String(e))
      return
    }
    if (isStale(importTask, channelId)) return

    importTask.set({
      rounds: page.page + 1,
      okCount: importTask.get().okCount + page.imported,
      skipped: importTask.get().skipped + page.skipped,
      total: page.total || importTask.get().total,
      errors: [...importTask.get().errors, ...page.errors],
    })

    if (page.errors.length > 0 || !page.hasMore) {
      finishImport(page.errors.length > 0 ? 'error' : 'done', page.errors[0] ?? null)
      return
    }
  }
}

function finishImport(status: 'done' | 'error', error: string | null): void {
  const state = importTask.get()
  importTask.set({ status, error })
  const summary = {
    imported: state.okCount,
    skipped: state.skipped,
    errors: error ? [error, ...state.errors] : state.errors,
  }
  if (status === 'done') {
    toast.success(`导入完成：新增 ${state.okCount} 条，跳过 ${state.skipped} 条`)
  } else {
    toast.error(`导入中断（已入库 ${state.okCount} 条）：${error ?? '未知错误'}。再次点击「导入」会跳过已导入条目继续`)
  }
  // 设置页若正开着就跳结果页看明细；用户在别的页面时不打扰，进度回设置页仍可见
  window.dispatchEvent(new CustomEvent('dogear:import-finished', { detail: summary }))
}

// ————— 导出（按页，前端驱动；Raindrop create 无批量端点） —————

export function subscribeExportProgress(listener: () => void): () => void {
  return exportTask.subscribe(listener)
}

export function getExportProgress(): TaskState {
  return exportTask.get()
}

/** 全局同一时间只允许一个导出进行中；重复调用直接忽略 */
export function startChannelExport(channelId: string, channelLabel: string): void {
  if (exportTask.get().status === 'running') return
  exportTask.set({ status: 'running', channelId, channelLabel, rounds: 0, okCount: 0, skipped: 0, failed: 0, total: 0, errors: [], error: null })
  void runExport()
}

async function runExport(): Promise<void> {
  const channelId = exportTask.get().channelId
  if (!channelId) return

  const excludeIds: string[] = []
  // 兜底上限：每轮至少消化 1 条（导出或失败），远超它说明分页语义被破坏
  const maxRounds = 500

  while (!isStale(exportTask, channelId)) {
    if (exportTask.get().rounds >= maxRounds) {
      finishExport('error', '导出轮数异常，已停止')
      return
    }
    let page: ExportPageResponse
    try {
      page = await channelsApi.exportPage(channelId, excludeIds)
    } catch (e) {
      finishExport('error', e instanceof Error ? e.message : String(e))
      return
    }
    if (isStale(exportTask, channelId)) return

    exportTask.set({
      rounds: exportTask.get().rounds + 1,
      okCount: exportTask.get().okCount + page.exported,
      failed: exportTask.get().failed + page.failed,
      total: exportTask.get().total || page.total,
      errors: [...exportTask.get().errors, ...page.errors].slice(0, 50),
    })
    if (page.failedIds.length > 0) excludeIds.push(...page.failedIds)

    if (!page.hasMore || page.processed === 0) {
      finishExport(page.errors.length > 0 && exportTask.get().okCount === 0 ? 'error' : 'done', page.errors[0] ?? null)
      return
    }
  }
}

function finishExport(status: 'done' | 'error', error: string | null): void {
  const state = exportTask.get()
  exportTask.set({ status, error })
  if (status === 'done') {
    if (state.failed > 0) toast.info(`导出完成：${state.okCount} 条成功，${state.failed} 条失败`)
    else toast.success(`已导出 ${state.okCount} 条`)
  } else {
    toast.error(`导出中断（已推送 ${state.okCount} 条）：${error ?? '未知错误'}。再次点击「导出」只导未推送的条目`)
  }
}
