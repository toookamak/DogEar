/**
 * 骨架屏：数据未到时占位，避免「加载中…」文字造成的布局跳动。
 * 形状与真实内容一致（网格卡片 / 表格行），视觉上连续。
 */

interface SkeletonProps {
  /** 与内容视图对应的骨架形态 */
  variant?: 'grid' | 'table' | 'tiles' | 'board'
  count?: number
}

export function Skeleton({ variant = 'grid', count = 8 }: SkeletonProps) {
  if (variant === 'table') {
    return (
      <div className="bm-table" aria-hidden="true">
        <div className="bm-table-head">
          <span className="bm-col-check" />
          <span className="bm-col-main" />
          <span className="bm-col-status" />
          <span className="bm-col-source" />
          <span className="bm-col-date" />
          <span className="bm-col-actions" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div className="bm-table-row" key={i}>
            <span className="bm-col-check" />
            <span className="bm-col-main">
              <span className="skel-line w70" />
              <span className="skel-line w40" />
            </span>
            <span className="bm-col-status"><span className="skel-line" /></span>
            <span className="bm-col-source"><span className="skel-line" /></span>
            <span className="bm-col-date"><span className="skel-line" /></span>
            <span className="bm-col-actions" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'tiles') {
    return (
      <div className="bm-tiles" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <div className="bm-tile" key={i}>
            {/* 与方案 B 索引卡同构：图标域名行 / 标题行 / 底栏 */}
            <div className="bm-tile-head">
              <span className="skel-cover skel-cover--icon" />
              <span className="skel-line w40" />
            </div>
            <span className="bm-tile-title"><span className="skel-line w70" /></span>
            <span className="bm-tile-foot"><span className="skel-line w40" /></span>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'board') {
    return (
      <div className="bm-board" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, col) => (
          <div className="bm-board-col" key={col}>
            <span className="skel-line w40" />
            <div className="bm-board-cards">
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="bm-board-card" key={i}>
                  <span className="skel-line w70" />
                  <span className="skel-line w40" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bm-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="bm-card" key={i}>
          {/* 与方案 A 封面主导卡同构：封面区 / 标题行 / 脚注行 */}
          <div className="bm-card-cover" />
          <div className="bm-card-body">
            <span className="skel-line w70" />
            <span className="skel-line w40" />
          </div>
        </div>
      ))}
    </div>
  )
}
