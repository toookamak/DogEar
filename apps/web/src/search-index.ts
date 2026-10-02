import MiniSearch from 'minisearch'
import { bookmarksApi } from './api/bookmarks.js'
import type { SearchIndexItem } from '@dogear/shared'

/**
 * 端侧全量检索索引（2026-10-02，批次 2）。
 *
 * **为什么要有它**：⌘K 此前把 `WorkbenchPage` 当前页的 `bookmarks` 喂给 MiniSearch，
 * 于是「搜不到没被翻到过的收藏」——3000 条规模下这是**大部分收藏**。
 *
 * **口径**（用户 2026-10-02 拍板：客户端全量索引）：
 * - 后台预取一次瘦投影（id / 标题 / URL / 域名 / 备注 / 标签名 / 收藏夹名 / 日期），
 *   **不含封面与摘要**——那是 3412 条里最大的一块冗余。
 * - 索引常驻内存，查询零网络往返、离线可用。
 * - 命中结果只带 id 与展示字段，**不靠它渲染列表**：点开仍走 `bookmarksApi.get(id)` 取完整对象。
 */

/** 预取分页大小。与服务端 searchIndexQuerySchema 的 max(300) 对齐，取 200 兼顾往返与内存。 */
const PAGE_SIZE = 200
/** 预取失败后的退避基数：避免接口一挂就疯狂重试 */
const RETRY_BASE_MS = 10_000

export type SearchIndexState = 'idle' | 'loading' | 'ready' | 'error'

export interface SearchIndexSnapshot {
  state: SearchIndexState
  /** 已索引条数（用于「索引 3,412 条 · 端侧」这类状态展示） */
  indexed: number
  total: number | null
  error: string | null
}

export interface SearchHit {
  id: string
  title: string
  url: string
  domain: string | null
  note: string | null
  tagNames: string[]
  folderName: string | null
  createdAt: string
}

type Listener = (snapshot: SearchIndexSnapshot) => void

/**
 * 索引容器。抽成独立模块而不是塞进组件，是为了能直接对纯逻辑写测试——
 * 与仓库既有 `utils/*-presentation.ts`、`utils/filters.ts` 的做法一致。
 */
export class BookmarkSearchIndex {
  private miniSearch: MiniSearch<SearchIndexItem> | null = null
  private items = new Map<string, SearchIndexItem>()
  private listeners = new Set<Listener>()
  private inflight: Promise<void> | null = null
  private lastErrorAt = 0
  private snapshot: SearchIndexSnapshot = { state: 'idle', indexed: 0, total: null, error: null }

  getSnapshot = (): SearchIndexSnapshot => this.snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private emit(patch: Partial<SearchIndexSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }

  /**
   * 确保索引就绪。**幂等且并发安全**：多次调用共享同一个 in-flight Promise，
   * 不会出现「四个组件各拉一遍全量」的情况。
   */
  ensure = async (): Promise<void> => {
    if (this.snapshot.state === 'ready') return
    if (this.inflight) return this.inflight
    this.inflight = this.load().finally(() => { this.inflight = null })
    return this.inflight
  }

  private async load(): Promise<void> {
    this.emit({ state: 'loading', error: null })
    try {
      const collected: SearchIndexItem[] = []
      let cursor: string | undefined
      // 预取上限：防止接口异常导致无限翻页把内存吃光（600 条基线，6000 足够宽裕）
      const MAX_ITEMS = 6000
      do {
        const page = await bookmarksApi.searchIndex({ limit: PAGE_SIZE, cursor })
        collected.push(...page.items)
        cursor = page.nextCursor ?? undefined
        // 每页都推进一次快照，让状态栏能显示真实进度
        this.emit({ indexed: collected.length, total: page.total })
      } while (cursor && collected.length < MAX_ITEMS)

      const index = new MiniSearch<SearchIndexItem>({
        idField: 'id',
        fields: ['title', 'url', 'tagText', 'note', 'domain', 'folderName'],
        storeFields: ['title', 'url', 'domain', 'note', 'tagNames', 'folderName', 'createdAt'],
        searchOptions: { boost: { title: 3, tagText: 2, domain: 1.5 }, fuzzy: 0.2, prefix: true },
      })
      index.addAll(collected)
      this.items = new Map(collected.map((item) => [item.id, item]))
      this.miniSearch = index
      this.emit({ state: 'ready', indexed: collected.length, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.lastErrorAt = Date.now()
      this.emit({ state: 'error', error: message })
    }
  }

  /**
   * 查询。索引未就绪时返回空数组并触发预取——**不阻塞 UI**：
   * 用户在预取完成前打开 ⌘K 会看到「索引中」，而不是一个卡住的空面板。
   */
  search = (query: string, limit = 20): SearchHit[] => {
    const text = query.trim()
    if (!text || !this.miniSearch) {
      if (!text) void this.ensure()
      return []
    }
    return this.miniSearch
      .search(text)
      .slice(0, limit)
      .map((result) => this.toHit(String(result.id)))
      .filter((hit): hit is SearchHit => hit !== null)
  }

  private toHit(id: string): SearchHit | null {
    // 只认自己那份 items：索引是唯一数据源，storeFields 的还原结构不保证与入参一致
    const item = this.items.get(id)
    if (!item) return null
    return {
      id: String(item.id),
      title: String(item.title ?? ''),
      url: String(item.url ?? ''),
      domain: item.domain ?? null,
      note: item.note ?? null,
      tagNames: Array.isArray(item.tagNames) ? item.tagNames : [],
      folderName: item.folderName ?? null,
      createdAt: String(item.createdAt ?? ''),
    }
  }

  /**
   * 数据变更后作废。**策略是「标脏 + 下次查询时重建」，不做增量补丁**——
   * 增量要处理「这一条到底改了哪些字段」，复杂度远高于收益；
   * 而预取成本只有几十次请求，用户不会频繁感知。
   */
  invalidate = (): void => {
    this.miniSearch = null
    this.items.clear()
    // 刚失败过的不立刻重试，避免接口挂掉时反复打
    if (Date.now() - this.lastErrorAt < RETRY_BASE_MS) {
      this.emit({ state: 'error', indexed: 0, total: null })
      return
    }
    this.emit({ state: 'idle', indexed: 0, total: null, error: null })
  }
}

/** 全应用共用一个实例：端侧索引理应只有一份，组件各自建会白白吃掉数倍内存。 */
export const bookmarkSearchIndex = new BookmarkSearchIndex()
