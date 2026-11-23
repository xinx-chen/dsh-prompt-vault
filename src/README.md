# src · 代码地图

> 结论先行：Host 侧四层（存储 / 路由 / 工具 / skill），Client 只有一个入口；改任何一层，先跑 `test/`，再看 UI。

## 模块边界

| 文件 | 层 | 职责 | 不该放什么 |
|---|---|---|---|
| `index.js` | Host 入口 | 组装 vault、注册路由/工具/skill/系统提示 | 业务校验、HTML |
| `host-vault.js` | Host 数据 | JSON 读写、字段校验、去重、搜索、原子写、损坏恢复 | HTTP、React、DSH 服务 |
| `host-routes.js` | Host 传输 | `/prompt-vault` 同源路由、body 上限、action 映射 | 存储细节、UI 文案 |
| `host-tool.js` | Host agent 面 | `prompt_vault` 工具定义与文本输出 | 直接读写文件 |
| `host-skill.js` | Host agent 面 | 提炼 skill 与每轮系统提示 | 运行时状态 |
| `client.js` | Client | 侧栏图标 + 整页 React，fetch 自家路由 | Node API、别的插件 DOM |

## 依赖方向

```text
index.js
  ├─ host-vault.js        （无外部依赖）
  ├─ host-routes.js  ──→  host-vault.js（仅类型/实例）
  ├─ host-tool.js    ──→  host-vault.js
  └─ host-skill.js        （纯常量）

client.js  ──HTTP──→  /prompt-vault  ──→  host-routes.js
```

- Host 不 import Client，Client 不 import Host。
- `host-vault.js` 不依赖 DSH 服务，所以能用 `node:test` 直接测。
- 路由与工具都调用同一个 `PromptVault` 实例，避免两套写入逻辑。

## 改动流程

1. 改数据/校验 → 跑 `npm test`（storage 用例）。
2. 改路由 → 补 `test/routes.test.js`（同源/跨源/坏 JSON/超大 body）。
3. 改工具输出 → 补 `test/tool.test.js`，确认 agent 读到的文本仍可解析。
4. 改 Client → `node --check src/client.js`，再做模块冒烟（注册 `sidebar.panellist` 与 `main`）。
5. 发布前：`npm run check`、`npm test`、`npm pack --dry-run`。

## 硬约束

- 无运行时依赖、无构建步骤；Node 22+。
- 包根 `index.js` 是 DSH 加载器的固定入口（它不读 `main`/`exports`），只做 `export * from './src/index.js'`，不要删。
- 数据只写 `$DSH_HOME/storages/prompt-vault/vault.json`，不写项目目录。
- 每次 mutation 返回完整 state；Client 不做局部合并。
- 不读其他插件的 DOM，不 require 客户端 primitives。
