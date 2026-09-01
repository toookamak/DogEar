# DogEar · 折耳书签

> 基于 Raindrop.io 的个人书签增强工具：Skill API + 工作台 + 导航页（Chrome 扩展），本地优先 + 异步同步，600 条基线。

## 快速开始
- 需求与方向：见 [需求说明书](DogEar%20·%20折耳书签%20—%20需求说明书.md)（PRD v0.3.5）
- 文档索引：见 [docs/README.md](docs/README.md)
- 项目规范：见 [AGENTS.md](AGENTS.md)（必读）

## 文档
| 文档 | 说明 |
|---|---|
| [PRD](DogEar%20·%20折耳书签%20—%20需求说明书.md) | 功能与方向源 |
| [MVP验收清单](docs/MVP验收清单.md) | P0 三优先验收 |
| [技术方案路线](docs/技术方案路线.md) | 推荐组合 + 存储详述 |
| [落地拆解](docs/落地拆解.md) | M1-M6 队列与依赖 |
| [API](docs/API.md) | 接口清单 |
| [DATA_MODEL](docs/DATA_MODEL.md) | 数据库设计 |

## 文件结构
```
apps/web         # 工作台
apps/extension   # 导航页插件
apps/server      # 本地服务 + 同步
packages/shared  # 共享类型
packages/db      # 存储抽象
docs/            # 设计文档
```

## 容量与性能
- 默认 600 条基线，超量可调（需确认）
- 同步速率（条数/秒、时延、成功率）可监测，导航页可开关降开销

## 状态
方向与功能设想阶段，技术待定，文档先行。
