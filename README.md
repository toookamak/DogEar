# DogEar · 折耳书签

> 基于 Raindrop.io 的个人书签增强工具：Skill API + 工作台 + 导航页（Chrome 扩展），本地优先 + 异步同步，600 条基线。

## 快速开始
- 需求与方向：见 [Wiki](wiki/参考借鉴项目.md)
- 项目规范：见 [AGENTS.md](AGENTS.md)（必读）

## 文档
- 设计文档与需求说明见仓库 **Wiki**（[wiki/](wiki/) 目录），其余文档路径以仓库实际文件为准，不在 README 中逐一指引，避免文档变动反复修改本文件。

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
