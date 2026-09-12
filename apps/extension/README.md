# DogEar Chrome 扩展（MV3）

一键把当前标签页保存到 DogEar。填入 DogEar 地址与 Skill Token 即可连通使用，无需构建步骤。

## 安装（开发者模式加载）

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 右上角打开「开发者模式」。
3. 点「加载已解压的扩展程序」，选择本目录（`apps/extension`）。
4. 工具栏出现 DogEar 图标；首次点击按提示进入「设置」。

## 配置

| 项 | 说明 |
| --- | --- |
| DogEar 地址 | 服务地址，如 `https://your-dogear.workers.dev`（本地联调 `http://127.0.0.1:8787`） |
| Skill Token | 服务端配置的 `DOGEAR_SKILL_TOKEN`（Workers：`wrangler secret put DOGEAR_SKILL_TOKEN`；Docker 自托管：环境变量） |

「测试连通」会请求 `GET /.well-known/capabilities` 验证地址可达。配置保存在 `chrome.storage.sync`（随 Chrome 账号同步）。

## 保存行为

- 调用 `POST /api/skill/save_bookmark`，`Authorization: Bearer <Token>`，`source: "extension"`——工作台来源条显示「插件」。
- 每次保存带 `Idempotency-Key`（UUID），服务端 24 小时内同 key 重放不重复入库。
- 备注为可选字段；快照（snapshot）暂未提供入口，需在工作台手动触发。
- 常见错误：`401/403` = Token 无效或服务端 `write_new` 能力被关闭（设置页 → Agent 接入里可查看开关）；连接失败 = 地址不可达。

## 权限说明

- `activeTab`：读取当前标签页的标题与 URL（仅在你点击保存时使用）。
- `storage`：保存地址与 Token。
- `host_permissions`（http/https）：允许扩展直接请求你自填的 DogEar 地址。扩展不发任何数据到第三方。
