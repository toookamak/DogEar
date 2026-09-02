// 导航页占位（PRD M6 / §4.3，核心需求「访问记录落库」在正式工程实现）。
// 本页仅示意网页形态与固定区域，不做功能，不排期。
const ZONES: { title: string; desc: string }[] = [
  { title: "时间搜索", desc: "按时间段回溯访问过的页面（依赖访问记录）" },
  { title: "页面标签", desc: "常访问页面快捷进入" },
  { title: "小组件区", desc: "可含 Rediscover 卡片（近期需求，不排期）" },
  { title: "文件夹入口", desc: "常用文件夹直达" },
  { title: "书签图标", desc: "高频书签网格（图标 + 名称）" },
  { title: "Docker 栏", desc: "自托管服务快捷入口" },
];

export default function NavPlaceholder() {
  return (
    <section className="navpage-placeholder" aria-label="导航页占位">
      <header className="navpage-head">
        <span className="eyebrow">M6 · 待排期</span>
        <h1 className="page-title">导航页</h1>
        <p className="navpage-desc">
          网页形态（与插件表现一致，插件不挡过关）。展示范围由规则圈定：全部 /
          规则（或语义）/ 搜索勾选 / 隐藏；Inbox 与私密书签默认不出现。访问记录先落库。
        </p>
      </header>

      <div className="navpage-grid">
        {ZONES.map((z) => (
          <article key={z.title} className="navpage-zone">
            <h3>{z.title}</h3>
            <p>{z.desc}</p>
          </article>
        ))}
      </div>

      <p className="navpage-footnote">
        行列数、小组件细节暂未定稿（PRD §4.3.3 待定），本页仅占位，不承载交互。
      </p>
    </section>
  );
}
