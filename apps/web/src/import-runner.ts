import { channelsApi } from './api/channels.js'
import { toast } from './toast.js'

/**
 * 通道「导入」的全局进度状态。
 *
 * 之前导入进度是 ChannelManager 的组件 state：切到别的页面组件卸载，「导入中…」
 * 直接消失，无法区分还在导还是已结束。现在按页循环放在这个模块级单例里驱动，
 * 页面切换不影响导入；设置页通过 useSyncExternalStore 订阅展示实时进度。
 *
 * 中断续传：服务端按 raindropId 去重，失败后再点「导入」会从头扫页、跳过已
 * 入库条目继续。
 */
export interface ImportProgress {
  status: 'idle' | 'running' | 'done' | 'error'
  channelId: string | null
  channelLabel: string
  /** 已完成导入的页数（从 0 计的下一页页号） */
  page: number
  imported: number
  skipped: number
  errors: string[]
  /** Raindrop 侧书签总数；不可知为 0 */
  total: number
  error: string | null
}

const IDLE: ImportProgress = {
  status: 'idle',
  channelId: null,
  channelLabel: '',
  page: 0,
  imported: 0,
  skipped: 0,
  errors: [],
  total: 0,
  error: null,
}

let state: ImportProgress = IDLE
const listeners = new Set<() => void>()

function update(patch: Partial<ImportProgress>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function subscribeImportProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getImportProgress(): ImportProgress {
  return state
}

/** 全局同一时间只允许一个导入进行中；重复调用直接忽略 */
export function startChannelImport(channelId: string, channelLabel: string): void {
  if (state.status === 'running') return
  update({ status: 'running', channelId, channelLabel, page: 0, imported: 0, skipped: 0, errors: [], total: 0, error: null })
  void run()
}

async function run(): Promise<void> {
  const channelId = state.channelId
  if (!channelId) return

  while (state.status === 'running' && state.channelId === channelId) {
    let page
    try {
      page = await channelsApi.importPage(channelId, state.page)
    } catch (e) {
      finish('error', e instanceof Error ? e.message : String(e))
      return
    }
    if (state.status !== 'running' || state.channelId !== channelId) return

    update({
      page: page.page + 1,
      imported: state.imported + page.imported,
      skipped: state.skipped + page.skipped,
      errors: [...state.errors, ...page.errors],
      total: page.total || state.total,
    })

    if (page.errors.length > 0 || !page.hasMore) {
      finish(page.errors.length > 0 ? 'error' : 'done', page.errors[0] ?? null)
      return
    }
  }
}

function finish(status: 'done' | 'error', error: string | null): void {
  update({ status, error })
  const summary = {
    imported: state.imported,
    skipped: state.skipped,
    errors: error ? [error, ...state.errors] : state.errors,
  }
  if (status === 'done') {
    toast.success(`导入完成：新增 ${state.imported} 条，跳过 ${state.skipped} 条`)
  } else {
    toast.error(`导入中断（已入库 ${state.imported} 条）：${error ?? '未知错误'}。再次点击「导入」会跳过已导入条目继续`)
  }
  // 设置页若正开着就跳结果页看明细；用户在别的页面时不打扰，进度回设置页仍可见
  window.dispatchEvent(new CustomEvent('dogear:import-finished', { detail: summary }))
}
