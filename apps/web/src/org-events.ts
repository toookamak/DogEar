/**
 * 组织数据（Scene / 文件夹 / 标签）变更通知。
 *
 * 侧栏与组织管理页各自持有一份组织数据副本：组织页改动后，侧栏需要重新拉取才能显示，
 * 否则新建的场景要刷新页面才出现。这里沿用 undo.ts 的 CustomEvent 约定做跨组件通知，
 * 避免为此引入全局状态库。
 */
const EVENT = 'dogear:org-changed'

/** 组织数据发生变更（新增/改名/删除）后广播 */
export function notifyOrgChanged() {
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function onOrgChanged(handler: () => void) {
  const listener = () => handler()
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
