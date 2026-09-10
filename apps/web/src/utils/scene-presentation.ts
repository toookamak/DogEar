/**
 * Scene 的 AERR 行为原型 → 工作台呈现（PRD §2.0.3、技术总纲 §5.2.2）。
 *
 * 需求要点：
 * - AERR（Action / Explore / Read / Reference）是**系统内部**原型，**不展示给用户**——
 *   界面上不出现这四个词，只体现为默认排序、信息密度与主按钮文案的差异。
 * - 工作台只有一套，不按 Scene 拆多套页面；第一版共用列表，至少换主操作文案。
 * - 同一书签在不同 Scene 下跟随**当前视图**的原型呈现。
 *
 * 说明：技术总纲 §5.2.2 明确「具体映射规则、算子与阈值属于细部，后续单独模块讨论」，
 * 故此处映射为**当前口径**（与原型 dev/dogear-workbench 的 SCENES 一致），
 * 待 Scene 细部定稿后只需改这一张表。
 */

export type Aerr = 'action' | 'explore' | 'read' | 'reference'
export type Density = 'cozy' | 'compact'
export type SceneSort = 'recent' | 'title' | 'domain'

export interface ScenePresentation {
  /** 进入该 Scene 时的默认排序（用户手动改过后不再覆盖） */
  defaultSort: SceneSort
  /** 信息密度：Reference 类偏检索，用紧凑密度看更多条目 */
  density: Density
  /** 内容头主按钮文案 */
  primaryAction: string
}

const PRESENTATION: Record<Aerr, ScenePresentation> = {
  // 近期要拿它办事：按最近加入，正常密度，主操作偏「去做」
  action: { defaultSort: 'recent', density: 'cozy', primaryAction: '开始行动' },
  // 浏览、发散、找灵感
  explore: { defaultSort: 'recent', density: 'cozy', primaryAction: '浏览灵感' },
  // 准备消费掉
  read: { defaultSort: 'recent', density: 'cozy', primaryAction: '开始阅读' },
  // 以后反复查：按标题便于定位，紧凑密度容纳更多
  reference: { defaultSort: 'title', density: 'compact', primaryAction: '检索资料' },
}

/** 兜底呈现：用户自建 Scene 或 aerr 取值未知时使用（等同 Reference 的检索取向偏保守，故取 cozy+recent） */
export const DEFAULT_PRESENTATION: ScenePresentation = {
  defaultSort: 'recent',
  density: 'cozy',
  primaryAction: '整理书签',
}

const AERR_VALUES = new Set<string>(['action', 'explore', 'read', 'reference'])

export function isAerr(value: unknown): value is Aerr {
  return typeof value === 'string' && AERR_VALUES.has(value)
}

/**
 * 由 Scene 的 aerr 得到呈现配置。
 * 未知取值不抛错、不猜测，一律回退到默认呈现。
 */
export function presentationForAerr(aerr: unknown): ScenePresentation {
  return isAerr(aerr) ? PRESENTATION[aerr] : DEFAULT_PRESENTATION
}

/**
 * 是否需要为「进入某 Scene」重设排序。
 * 仅在 Scene 切换时应用一次默认排序：用户随后手动选择排序，不应被再次覆盖。
 * 返回 true 表示应当应用该 Scene 的默认排序。
 */
export function shouldApplySceneSort(
  nextSceneId: string | null | undefined,
  previousSceneId: string | null | undefined,
): boolean {
  const next = nextSceneId || null
  const previous = previousSceneId || null
  return next !== null && next !== previous
}

/**
 * Scene 视图切换时应采用的排序；返回 null 表示不动当前排序。
 *
 * 三种情形：
 * - 进入或切换到另一个 Scene → 用该 Scene 原型的默认排序；
 * - **离开** Scene 视图（回到全部书签）→ 回到默认排序，
 *   否则会停留在上个 Scene 带过来的排序上（例如从「长期资料」返回后仍是按标题）；
 * - 停留在同一 Scene（含用户手动改排序）→ 不动。
 */
export function nextSortOnSceneChange(
  nextSceneId: string | null | undefined,
  previousSceneId: string | null | undefined,
  presentation: ScenePresentation,
): SceneSort | null {
  const next = nextSceneId || null
  const previous = previousSceneId || null
  if (next === previous) return null
  if (next !== null) return presentation.defaultSort
  // previous 非空而 next 为空：离开 Scene 视图
  return previous !== null ? DEFAULT_PRESENTATION.defaultSort : null
}
