# Design System: DogEar · 折耳书签（Notion 风 × Cloudflare 橙 · 默认主题）

> **主题口径（2026-09-27 用户确认，替代 2026-09-12 暖纸风口径）**：默认主题已由「暖纸书桌」更换为「**Notion 风 × Cloudflare 橙**」，浅色与深色两套色板同步更新；历史色板（暖纸书桌 / 深夜书房）见 git 历史。默认设置仍是**非写死的形态**——未来新增主题时，色板、阴影乃至部分组件约束以该主题自己的定义为准，脱离本文相应约束；本文的结构、布局与交互语义仍全局适用。
> **尺寸与状态口径（2026-09-27 视觉收口，本轮新增）**：新增字号 7 档、控件高度 4 档、圆角按档位归位、四种视图交互态统一、图标规范（§3.1 / §4.1 / §5.2 / §7.1 / §10）。完整验收口径见 `docs/modules/20260927_UI精细化设计.md`。
> **`docs/theme-sample-notion-cf-orange.html` 的地位（本轮裁决）**：该文件只是**色板演示**，不是组件规格来源。它与本文在「当前项选中样式、分组标签字号字重、状态胶囊圆角、侧栏与顶栏尺寸、卡片封面高与水印透明度」共 5 处不一致；**一律以本文为准**，范例不再承担组件规格（后续如需修订范例，须保持与本文一致）。
> Token 单一来源：`apps/web/src/styles/tokens.css`（`--canvas/--panel/--amber/--fs-*/--control-h/--radius-*`）。改主题或改刻度先改 tokens，再谈组件。
> 注：`--amber` 等为历史命名，语义上是「主强调色 accent」，当前值为 Cloudflare 橙 `#f6821f`；`--font-serif` 为历史命名，现指向与 `--font-sans` 相同的无衬线栈。

## 1. 视觉主题与气质

DogEar 的默认主题是「**Notion 风 × Cloudflare 橙**」：纯白纸面（`#ffffff`）配 Notion 暖黑文字（`#37352f`），标志性的浅灰侧栏（`#f7f7f5`），极淡的暖黑细线（`rgba(55,53,47,0.09)`），Cloudflare 橙（`#f6821f`）作为唯一强调色。整体气质是**安静的文档工作台**：层级靠细线与留白，hover 是「浅灰一档」的克制反馈，装饰只用「卡片预览渐变 + 水印大字」一处。

字体是「一种声音为主」：**系统无衬线栈**（`system-ui, "PingFang SC", "Microsoft YaHei"`）承担界面、正文与标题——Notion 风无衬线标题；**系统等宽栈**（`ui-monospace, "Cascadia Mono", Consolas`）只留给元信息（域名、日期、状态栏、kbd）——「索引卡片」的声音。不再使用衬线字体。

**关键特征：**
- 白纸页面 + 浅灰侧栏（`--sidebar-bg`）+ 纯白卡片，分隔几乎全靠细线与留白；阴影只给浮层与 hover 浮起（卡片平时无投影）
- Cloudflare 橙是品牌、主按钮、选中态与待处理状态的统一强调色，且用量克制（Notion 式：强调色只出现在少数关键位置，不做大面积橙底）
- hover 分两类：面板 / 列表行 / 导航 = 加深一档（`--panel-hover` `#efefee`）；**卡片族 = 保持白底 + `--shadow-card` 轻投影 + 上移 1px**（灰底在纯白页面上读作「压下」，见 §4）；主按钮 hover = 橙加深（`#e26f0a`）
- 书签卡封面主导：大封面区 148px（有封面图显示封面，否则来源色渐变 + 斜纹 + 水印字）+ 顶部信息层（选择键 / 域名 chip / 状态徽标）；卡片平时带细边无阴影，hover 才浮起
- 尺寸全部走刻度：字号 7 档（§3.1）、控件高度 4 档（§4.1）、圆角 5 档（§5.2）。**不写裸像素值**——这是「看起来像成品」与「看起来像原型」的分界
- 语义功能色走 Notion 标签色系（薄荷绿 `#448361` / 黛蓝 `#337ea9` / 灰 `#787774` / 红 `#d44c47` / 赭石 `#9f6b53`），只在状态与来源着色时出现

## 2. 色板与角色

### 纸面
| Token | 值 | 角色 |
| --- | --- | --- |
| `--canvas` | `#ffffff` | 页面底、外壳底（内容区） |
| `--panel` | `#ffffff` | 卡片、面板、顶栏/状态栏底 |
| `--sidebar-bg` | `#f7f7f5` | 侧栏专用底（Notion 标志性浅灰） |
| `--panel-raised` | `#f7f7f5` | 浮起内衬：主区按钮底、列头、批量条、toast |
| `--panel-hover` | `#efefee` | hover 加深一档 |
| `--panel-overlay` | `rgba(255,255,255,0.94)` | 覆盖在预览上的小元素底 |

### 线与文字
| Token | 值 | 角色 |
| --- | --- | --- |
| `--line` | `rgba(55,53,47,0.09)` | 标准边框（极淡） |
| `--line-strong` | `#e3e2de` | 强调边框（ghost 按钮边、视图切换器外框） |
| `--line-soft` | `rgba(55,53,47,0.06)` | 行分隔 |
| `--text` | `#37352f` | 主文字（Notion 暖黑，不用纯黑） |
| `--muted` | `#787774` | 次级文字 |
| `--faint` | `#8a8985` | 弱化文字（元信息、占位）——由 `#9f9e9b` 抬升，原值对白底仅约 2.7:1 |
| `--on-accent` | `#ffffff` | 橙底上的文字 |

### 强调与语义
| Token | 值 | 角色 |
| --- | --- | --- |
| `--amber` / `--amber-strong` | `#f6821f` / `#e26f0a` | 品牌（Cloudflare 橙）、主按钮、选中态、计数；strong 为主按钮 hover 与橙文字 |
| `--amber-soft` | `rgba(246,130,31,0.13)` | 选中底、focus ring |
| `--mint` / `--mint-soft` | `#448361` / 0.14 | 成功、已确认、agent 来源 |
| `--red` / `--red-soft` | `#d44c47` / 0.12 | 错误、危险按钮 |
| `--blue` / `--blue-soft` | `#337ea9` / 0.14 | 信息、待推送 |
| `--indigo` / `--rust` / `--slate` | `#6940a5` / `#9f6b53` / `#787774` | 预留与来源着色（插件=赭石、搁置=灰） |

### 书签来源三色（工作台视觉签名）
`page`（工作台保存）= 橙 · `agent` = 薄荷 · `extension`（插件）= 赭石。用于卡片的来源条底、预览渐变与域名按钮首字母圆标。

## 3. 字体规则

| 角色 | 字族 | 尺寸/字重 | 备注 |
| --- | --- | --- | --- |
| 界面正文与**全部按钮** | 系统无衬线栈 | `--fs-body` 13px / 400–600 | `system-ui, "PingFang SC", "Microsoft YaHei"`；按钮族字号唯一 |
| 次级说明 | 系统无衬线栈 | `--fs-small` 12px / 400 | 空状态文案、次要行 |
| 元信息 | 等宽栈 | `--fs-micro` 11px | 域名、日期、列头（大写 + 0.08em）、状态栏 |
| 分组标签 | 系统无衬线栈 | `--fs-micro` 11px / 700 | 大写 + 0.12em 字距，`--faint` 色 |
| 计数徽标 | 等宽栈 | `--fs-micro` 11px / 400 | 橙色，跟在标题后 |
| 强调正文 | 系统无衬线栈 | `--fs-lead` 14px / 400–500 | |
| 区块标题 | 系统无衬线栈 | `--fs-title-sm` 17px / 600 | `-0.01em` 微收字距 |
| 页面 / 详情 / 模态标题 | 系统无衬线栈 | `--fs-title` 21px / 600 | `-0.01em~-0.02em` 微收字距 |
| 大数字 | 系统无衬线栈 | `--fs-display` 24px / 600 | `.stat-value` |
| 品牌字标 | 系统无衬线栈 | 13px / 700 | 橙渐变方块内的「D」 |

`--font-serif` 为历史 token 名，现指向与 `--font-sans` 相同的无衬线栈——**新代码不要再用它**，直接写 `--font-sans`。字体全部走系统栈，不外链 Google Fonts，离线不阻塞渲染。

### 3.1 字号刻度（2026-09-27 新增，硬约束）

字号**只能**取 `tokens.css` 里的这 7 档，不得写裸像素值：

| Token | 值 | 角色 |
| --- | --- | --- |
| `--fs-micro` | 11px | 元信息、mono、大写分组标签、脚注日期 |
| `--fs-small` | 12px | 次级说明、空状态文案 |
| `--fs-body` | 13px | 界面正文与全部按钮 |
| `--fs-lead` | 14px | 强调正文 |
| `--fs-title-sm` | 17px | 区块标题 |
| `--fs-title` | 21px | 页面 / 详情 / 模态标题 |
| `--fs-display` | 24px | 大数字 |

唯一例外是**装饰性字号**：404 的 `72px`、卡片水印的 `126px`、`html` 根字号 `16px`。除此之外 `app.css` 中不允许出现字面像素字号。

修订说明：本轮把原先 19 个散值（含 `9 / 10.5 / 11.5 / 12.5 / 13.5 / 15 / 18 / 20 / 22px` 等）收敛到 7 档，故「元信息」由 10px 起改为 11px 起、「计数徽标」由 14px 改为 11px（原 14px 从未被实现）。

## 4. 组件样式

### 4.1 按钮与控件规格（2026-09-27 统一，硬约束）

`.btn` 全族 = **高度 `--control-h`(32px) + 圆角 `--radius-lg`(6px) + 字号 `--fs-body`(13px)**，差异只在底色与边框色。不允许再用 padding 撑高——此前各变体高度 29 / 31 / 33px 混排，确认弹窗里「取消」与「确认」并排就错位 4.6px。

| 控件 | 高度 | 圆角 | 字号 | token |
| --- | --- | --- | --- | --- |
| 全部按钮（`.btn--primary` / `--ghost` / `--pill` / `--danger`） | `--control-h` 32px | `--radius-lg` 6px | `--fs-body` 13px | — |
| 图标按钮 `.icon-btn` | `--icon-btn-size` 30px | `--radius-lg` 6px | — | 仅顶栏，与 32px 族不同屏 |
| 筛选胶囊 `.chip` | `--control-h-sm` 28px | `--radius` 4px | `--fs-body` 13px | 独立于按钮族 |
| 行内小按钮 `.mini-btn` | `--control-h-xs` 24px | `--radius` 4px | `--fs-small` 12px | — |
| 单行输入 / 下拉 / 搜索框 | `--control-h` 32px | `--radius` 4px | `--fs-body` 13px | `.input`、`select.input` |
| 视图切换器 `.view-switcher` | `--control-h` 32px | `--radius-lg` 6px | — | 内衬 `0 3px`，`.view-btn` 26px |

**规则**：同一容器内出现多个控件时取同一档高度。

### 4.2 按钮

- **主按钮 `.btn--primary`**：Cloudflare 橙实底 + `--on-accent` 文字、`--fs-body`、700；hover 加深为 `--amber-strong`。用于「保存」「创建」等唯一主动作
- **Ghost `.btn--ghost`**：无底 + `--line-strong` 边 + `--muted` 文字；hover 浅灰底且边框变橙。用于次级动作
- **Pill `.btn--pill`**：无底 + `--line` 细边 + `--muted` 文字；轻量次级动作。命名沿用历史，**语义已属按钮族**（与 ghost 仅差边框深浅），后续如需减负可与 ghost 合并
- **筛选胶囊 `.chip`**：独立类、28px、4px 圆角；选中态 = 橙柔底 + 橙文字 + 橙 0.35 边
- **危险 `.btn--danger`**：任意变体叠加，文字变 `--red`，hover 红柔底
- **mini 按钮 `.mini-btn`**：无底 12px 文字，24px 高，hover 浅灰底

### 卡片
- **书签卡 `.bm-card`（封面主导）**：大封面区 148px（有封面图显示封面，否则来源色渐变 0.16→0.36 + 45° 白斜纹 + 水印大字、透明度 0.08）+ 顶部信息层（选择键 / 域名 chip 兼任打开原文 / 状态徽标）+ 左下来源点；正文标题 13.5px/500 两行截断 + 摘要 12px 两行；脚注（AI 建议/重要/私密/待推送 + `#` 标签 pill + MM-DD 日期）
- **标签视图索引卡 `.bm-tile`**：头部 18px 站点图标（favicon 两级降级）+ mono 域名（点击开原文）+ 状态点；标题两行 + 简介一行；浮起底栏放标签/来源/日期
- **面板卡 `.card` / `.settings-section`**：白底 + 细线；`.card` 用 `--radius` 4px，`.settings-section` 用 `--radius-lg` 6px；平时不加阴影
- **hover（2026-09-27 裁决）**：卡片族（`.bm-card` / `.bm-tile`）**保持白底** + `--shadow-card` 轻投影 + `translateY(-1px)`，边框转 `--line-strong`；看板内小卡 `.bm-board-card` 底已是 `--panel-raised`，hover 只加深到 `--panel-hover` 加轻投影、不做位移（避免与拖拽抢戏）；列表行 hover = 浅灰一档。**不用灰底表示卡片浮起**——在纯白页面上灰底读作「压下」，与 Notion 语义相反

### 导航与选中态（2026-09-27 统一，四视图共用一套）
- **当前项 active**：橙柔底 `--amber-soft` + `inset 2px 0 var(--amber)` 左条 + 主文字色（无加粗）。侧栏 `.nav-item`、表格行、看板卡、标签瓦片、网格卡一律同一规则
- **批量勾选 selected**：`inset 2px 0 var(--amber)` 左条 + `inset 0 0 0 1px color-mix(--amber 45%)` 内描边橙环。用内描边而非改底色，避免洗掉封面图
- **同时命中 active 与 selected**：保住左条 + 橙环（由声明顺序保证），底色沿用 active
- **焦点 focus-visible**：容器类元素（卡片 / 行 / 瓦片）用 `outline: 2px solid var(--amber); outline-offset: -2px`；控件类元素（按钮 / 输入）用 `box-shadow: var(--shadow-focus)` 橙 ring。分两轨的原因：outline 不与 active / selected 的 `box-shadow` 抢同一属性，可叠加
- 分组标签：按 §3，不做折叠

### 徽标与 pill
- 状态 pill 带圆点（`::before` 5px 圆点 + 柔和底）：待处理=橙、已确认=薄荷、搁置=灰、待推送=黛蓝、重要=赭石
- 标签 pill 带 `#` 前缀（橙、0.75 透明度）；空标签「未整理」用斜体弱化

### 输入
- 白底 + `--line` 边 + `--radius` 4px；focus = 橙 0.45 边 + `0 0 0 2px var(--amber-soft)` ring；placeholder 用 `--faint`
- 单行控件统一 `--control-h` 32px 高（见 §4.1）；textarea 不设固定高，由 `.textarea` 的 `min-height` 控制
- **`select` 必须接管外观**（2026-09-27 新增）：`appearance: none` + `padding-right: 30px` + 自绘 chevron（`background-image` 内联 SVG）；深色主题单独覆写一次箭头色。**不允许直接用系统原生下拉外观**——各平台差异大，是「像原型页」的主要来源
- 复选框 / 单选：`accent-color: var(--amber)`，不另行自绘

### 滚动条与文本选中（2026-09-27 新增）
- 所有 `overflow: auto` 区域（侧栏、内容区、详情浮层、命令面板结果）滚动条统一：`scrollbar-width: thin` + `scrollbar-color: var(--line-strong) transparent`；Chromium 走 8px 圆角滑块、`border: 2px solid transparent` + `background-clip: content-box`。**不允许出现系统默认粗滚动条**
- `::selection` = `background: var(--amber-soft)`、`color: var(--text)`，不用浏览器默认蓝

### 浮层（允许投影处）
- 模态/命令面板：`--modal-shadow`（`0 12px 40px rgba(15,15,15,0.18)`）+ 8px 圆角
- 详情抽屉：右缘滑入，纯黑系大模糊投影
- Toast：`--panel-raised` 底 + 左缘 2px 实色（成功=薄荷/失败=红/信息=橙），带撤销按钮时文字用橙

## 5. 布局原则

### 5.1 外壳、间距与网格

- 外壳：顶栏 48px + 侧栏 228px（`--sidebar-bg` 浅灰底）+ 内容区 + 状态栏 28px；窄屏（<768px）侧栏转为覆盖式抽屉（含遮罩）
- 内容区主留白：水平 30px（`--space-6`）起步；间距体系 4/8/12/16/22/30（`--space-1..6`）
- 网格：书签卡 `minmax(228px,1fr)`；紧凑密度（reference 类场景）收窄为 200px 并隐藏摘要
- 空状态：虚线框 + 白底 + 居中文案 + 下一步动作按钮

### 5.2 圆角与控件高度（2026-09-27 归位，硬约束）

圆角**只允许**取这 5 个 token 值，且按语义归属；不允许出现体系外的 5px、7px 等值。

| Token | 值 | 归属 |
| --- | --- | --- |
| `--radius-sm` | 3px | 微件：`.topbar-kbd`、`.palette-kbd`、色点容器、骨架条 |
| `--radius` | 4px | 输入与卡片：`.input` / `select` / `.textarea`、`.topbar-search`、`.toolbar-search`、`.card`、`.bm-card`、`.bm-tile`、`.bm-board-col`、`.bm-table`、`.stat-item`、`.empty-state`、`.chip`、`.btn--pill`、`.tag-pill`、`.tag-chip`、`.bm-card-chip`、`.bm-tile-icon`、`.view-btn` |
| `--radius-lg` | 6px | 按钮与面板：`.btn--primary`、`.btn--ghost`、`.icon-btn`、`.nav-item`、`.settings-tab`、`.tab-btn`、`.settings-section`、`.filter-pop`、`.sync-card`、`.view-switcher`、`.toast`、`.selection-bar` |
| `--radius-featured` | 8px | 弹层：`.modal`、`.palette`、`.auth-card` |
| `--radius-full-pill` | 9999px | 仅计数徽标与状态 pill |

例外（不算违规）：品牌字标方块的 `6px`、圆形元素（勾选键、状态点、favicon 圆标）的 `50%`、骨架屏齐边元素的 `0`。

控件高度刻度：

| Token | 值 | 归属 |
| --- | --- | --- |
| `--control-h` | 32px | `.btn` 全族、`.toolbar-search`、`.filter-toggle`、`.toolbar-sort`、`.view-switcher`、单行 `.input` |
| `--control-h-sm` | 28px | `.chip` |
| `--control-h-xs` | 24px | `.mini-btn` |
| `--icon-btn-size` | 30px | `.icon-btn`（仅顶栏） |

修订说明：本轮修正了 7 处偏离——按钮族原停在 3px（应 6px）、输入原 3px（应 4px）、`.settings-section` 原 4px（应 6px）、模态与命令面板原 6px（应 8px）、`.bm-card-chip` / `.tag-pill` / `.tag-chip` 原硬编码 5px（应 4px）、`.filter-pop` 原引用从未定义的 `--radius-md`（吃 fallback 8px，应 6px）。

## 6. 深度与阴影

| 层级 | 处理 | 用途 |
| --- | --- | --- |
| 平面 | 无阴影，仅 `--line` 边 | 卡片、面板、列表（Notion 式：平时无投影） |
| 内衬 | `--panel-raised` 底色差 | 列头、批量条、视图切换器 |
| `--shadow-sm` | `0 1px 2px rgba(15,15,15,0.06)` | 小件微浮 |
| `--shadow-card` | `0 1px 2px rgba(15,15,15,0.06), 0 2px 6px rgba(15,15,15,0.06)` | **卡片 hover 浮起专用**（双层、位移 2px 内，够轻） |
| `--shadow-lg` | `0 4px 14px rgba(15,15,15,0.1)` | toast、抽屉、拖拽 ghost、浮层 |
| `--modal-shadow` | `0 12px 40px rgba(15,15,15,0.18)` | 模态、命令面板、登录卡 |

阴影全部是中性黑系小模糊低透明度；新主题可定义自己的深度体系。

修订说明：`--shadow-card` 原为 `var(--shadow-lg)` 的别名——用 14px 模糊的重投影做卡片 hover 过重，本轮拆为独立定义（`0 1px 2px + 0 2px 6px` 双层）。深色主题同步定义为 `0 1px 2px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.35)`。

## 7. 交互与动效

- 过渡**只有两档**：颜色 / 边框 / 背景 `150ms ease`（`--transition-color`）、阴影 / 位移 `200ms ease`（`--transition-shadow`）；两者都要的场景用 `--transition-state`。不写别的时长
- hover：按钮 / 导航 / 列表行 = 「浅灰一档加深」；卡片族 = 白底 + 轻投影 + 上移 1px（见 §4）；主按钮 hover = 橙加深
- 焦点：container 类用 outline、控件类用橙 ring，见 §4「导航与选中态」
- 骨架屏：面板底色呼吸闪烁（1.2s），尊重 `prefers-reduced-motion` 时停用
- 拖拽：ghost 跟随 + 目标列橙描边

## 8. 响应式

| 宽度 | 变化 |
| --- | --- |
| <768px | 侧栏转抽屉、内容留白降到 16px、网格单列、看板 78vw 横滚、顶栏搜索只留图标 |
| ≥768px | 完整外壳 |

## 9. Agent 指南（写界面时的快查）

1. 颜色一律取 `tokens.css` 变量，不写新色值；新组件先问「在哪个面（canvas/panel/raised/hover/sidebar）上」
2. 主按钮每屏最多一个；次级用 ghost，筛选用 chip；强调色克制使用（Notion 式），不做大面积橙底
3. **字号只能取 §3.1 的 7 档 token，不写裸 px；尺寸换算一律走 `--fs-*` / `--control-h*` / `--radius-*` / `--space-*`**
4. 标题与正文用无衬线栈，元信息用 mono；不要用字重和颜色同时强调；新代码不用 `--font-serif`
5. 控件高度按 §4.1：按钮族与单行输入 32px、chip 28px、mini-btn 24px；同一容器内必须同档
6. 圆角只允许 §5.2 的 5 个值，且按语义归属
7. 状态四件套（§4「导航与选中态」）：active = 橙柔底 + 左 2px 橙条；selected = 左条 + 内描边橙环；hover = 按元素类（卡片浮起 / 其余浅灰一档）；focus = 容器 outline、控件 ring。**四种视图必须一致**
8. 图标只用 `components/ui/Icon.tsx` 的内联 SVG（§10），不用 Unicode 字形、不用 emoji、不引图标库
9. AERR 四词（action/explore/read/reference）**永不出现**在界面上，用「用途」行为文案（见 SceneManager 的 `PURPOSE_OPTIONS`）
10. 新增主题时：复制 tokens.css 的 `:root` 块按主题重定义值；本文 §2/§6 的具体色值与阴影对该主题不再适用，但 §3.1/§4/§5/§7 的结构语义不变
11. 改完先跑 `pnpm --filter @dogear/web typecheck && pnpm --filter @dogear/web build`；无法目视验证时要在交付说明里写明

## 10. 图标规范（2026-09-27 新增）

**唯一来源**：`apps/web/src/components/ui/Icon.tsx`。手写内联 SVG，零新增依赖（受「先确认再动」的依赖边界约束）。

**规格（全组统一）**
- `viewBox="0 0 16 16"`、`stroke="currentColor"`、`stroke-width="1.5"`、`stroke-linecap/linejoin="round"`、`fill="none"`
- 尺寸默认 `1em`，随外层 `font-size` 缩放；颜色随 `color` 继承。**故图标槽位容器需给 `font-size` 定边长，并 `display: inline-flex` 居中**
- 一律 `aria-hidden="true"` + `focusable="false"`：图标不承载语义，语义由按钮的 `aria-label` 或可见文字承担
- 签名：`<Icon name="search" />` / `<Icon name="close" size={12} />`

**现有清单**：`search`、`filter`、`grid`、`tags`、`list`、`board`、`edit`、`swap`、`close`、`external`。

**禁止**
- 禁止用 Unicode 符号充当图标（`⌕ ⚙ ▦ ◈ ☷ ▤ ✎ ⇄ ×` 等）——来自不同字体，字宽、粗细、基线各不相同
- 禁止 emoji 充当界面图标
- 例外：**键盘符号保留字符渲染**——`⌘`、`K` 等键帽（`.topbar-kbd` / `.toolbar-kbd` / `.palette-kbd`）与正文里的箭头（`→`、`↗` 出现在文案句中时）不替换

修订说明：本轮把 10 处 Unicode 字形槽位（4 处搜索、1 处筛选、4 个视图切换、1 处改名 / 合并 / 关闭 / 清除）换成组件，并为 `.toolbar-search-icon` / `.palette-icon` / `.toolbar-search-clear` / `.toast-close` / `.tag-chip-remove` 补了 `inline-flex` 居中与 Icon 尺寸。
