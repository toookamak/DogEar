interface ContentHeadProps {
  title: string
  count: number
  description?: string
  actions?: React.ReactNode
}

/** 工作台内容头：标题 + 条数 + 该视图说明 + 视图级操作 */
export function ContentHead({ title, count, description, actions }: ContentHeadProps) {
  return (
    <section className="content-head">
      <div className="content-head-text">
        <h1 className="content-head-title">
          {title} <span className="content-head-count">{count}</span>
        </h1>
        {description && <p className="content-head-desc">{description}</p>}
      </div>
      {actions && <div className="content-head-actions">{actions}</div>}
    </section>
  )
}
