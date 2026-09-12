import { useLocation } from 'wouter'

export const WIZARD_STORAGE_KEY = 'dogear.wizard.done'

/**
 * 首次运行向导。
 * 明确告知「保存不依赖任何外部通道」——这是 PRD 的边界（Raindrop 等不是登录门槛），
 * 避免新用户以为必须先配置通道才能用。没有遮罩点击关闭：必须显式选择跳过或去设置。
 */
export function FirstRunWizard({ onDone }: { onDone: () => void }) {
  const [, setLocation] = useLocation()

  const finish = (goToSettings: boolean) => {
    try {
      window.localStorage.setItem(WIZARD_STORAGE_KEY, '1')
    } catch { /* 隐私模式下写不进去，本次仍然关掉向导 */ }
    onDone()
    if (goToSettings) setLocation('/settings')
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="开始使用 DogEar">
      <div className="modal">
        <h2 className="modal-title">开始使用 DogEar</h2>

        <div className="wizard-body">
          <p className="modal-message modal-message--flush">
            保存链接<strong>不依赖</strong> Raindrop、S3 或 WebDAV。登录本应用即可开始收藏。
          </p>
          <p className="modal-message modal-message--flush">
            数据通道是可选的数据出入口，可以以后在设置里再配，也可以一直不配。
          </p>
          <ul className="wizard-list">
            <li>保存：只存链接，标题与摘要由服务端异步抓取</li>
            <li>整理：Scene / 状态 / 文件夹 / 标签，四个维度互不干扰</li>
            <li>找回：搜索、Inbox、最近访问与导航页</li>
          </ul>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={() => finish(false)}>跳过</button>
          <button type="button" className="btn btn--primary" onClick={() => finish(true)}>去设置（可选）</button>
        </div>
      </div>
    </div>
  )
}
