interface PageHeaderProps {
  title: string
  actions?: React.ReactNode
}

/**
 * 页面级页头：标题 + 本页操作。
 * 应用级顶栏见 TopBar；未同步条数与队列等全局状态由 StatusBar 承担，此处不重复展示。
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <h2 className="page-header-title">{title}</h2>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
