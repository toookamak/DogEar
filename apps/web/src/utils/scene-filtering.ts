/**
 * Scene 的「停用」在选择面上的取用规则。
 *
 * 出处：`docs/modules/20260904_数据库设计.md`
 * - `enabled = 0` → 停用，**挑选器隐藏**
 * - **停用不删历史挂载**：挑选器里不再出现，但已经挂上的书签仍能按这个场景筛到
 *
 * 由此推出两种取用面（此前这条规则散落在多处、写法还不一致，故收敛到这里）：
 *
 * | 场景 | 停用项 | 理由 |
 * | --- | --- | --- |
 * | 挑选器（给书签挂场景） | 隐藏；**但保留该书签已挂的** | 停用项不应再被新挂；已挂的必须可见可摘，否则无法取消 |
 * | 筛选 / 浏览（侧栏、筛选下拉） | 保留，界面自行弱化 | 否则「按已停用场景筛出旧书签」无法到达 |
 */

import type { SceneResponse } from '../types/api.js'

export interface PickScene {
  id: string
  name: string
  icon?: string
  enabled?: boolean
  /** 该书签当前是否已挂此场景（用于保留已停用的挂载） */
  attached?: boolean
}

function toPickScene(scene: SceneResponse, attachedIds?: Iterable<string>): PickScene {
  const attached = attachedIds ? new Set(attachedIds).has(scene.id) : false
  return {
    id: scene.id,
    name: scene.name,
    icon: scene.icon,
    enabled: scene.enabled,
    attached,
  }
}

/**
 * 挑选器用：隐藏停用场景，但保留「该书签当前已挂」的停用场景。
 *
 * 为何保留已挂的停用场景：详情里若不显示，用户既看不到自己挂过它，
 * 也无法把它摘下来——那等于把停用变成了「无法解除的挂载」。
 */
export function scenesForPicker(scenes: SceneResponse[], attachedIds?: Iterable<string>): PickScene[] {
  return scenes
    .map((scene) => toPickScene(scene, attachedIds))
    .filter((scene) => scene.enabled !== false || scene.attached)
}

/** 该场景是否已停用（供界面决定是否弱化） */
export function isDisabled(scene: Pick<PickScene, 'enabled'>): boolean {
  return scene.enabled === false
}
