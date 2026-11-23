# Prompt Vault

![Prompt Vault icon](assets/icon.svg)

A local-first prompt library for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH). Save the prompts you actually reuse, and let the agent distill new ones from your conversations — deduplicated, tagged, and searchable in one sidebar page.

[中文说明](#中文说明) · [Install](#install) · [Usage](#usage) · [Data and privacy](#data-and-privacy) · [Compatibility](#compatibility) · [Why / How](docs/项目复盘_从自用到开源_2026-11-23.md)

## What it does

- **A real library, not chat history.** Title, body, tags, note, favorite, usage count, last-used time.
- **Search and filter.** Full-text search over title, body, note, and tags; filter by tag or favorites.
- **One-click copy.** Copies the prompt to the clipboard; the page stays open.
- **Agent-native.** A `prompt_vault` tool (`list` / `get` / `add` / `update` / `remove` / `use`) and a `prompt-vault` skill teach the agent what is worth saving: transferable structure, never project details.
- **Local and quiet.** One JSON document on your machine. No account, no telemetry, no network calls.

## Install

Prompt Vault is a DSH bundle. It has no runtime dependencies and no build step.

1. Clone this repository somewhere stable:

   ```bash
   git clone https://github.com/xinx-chen/dsh-prompt-vault.git
   ```

2. In a DSH session, install the bundle from that directory:

   ```text
   plugin_manager install_bundle target=/absolute/path/to/dsh-prompt-vault
   ```

   The plugin manager links the directory into the active profile. Future edits are picked up after the plugin reloads.

3. If the sidebar icon does not appear, reload the DSH window once.

> The plugin manager's UI may also offer "add plugin from a directory". The exact label depends on your DSH version; the `install_bundle` command above is the stable path.

## Usage

Open **Prompt Vault** from the sidebar (bookmark icon). From there:

- **New prompt** — title as a capability name, body with `【】` placeholders, 2–4 tags, a one-line note.
- **Cards** — star for favorite, click the title to expand, copy, edit, delete.
- **Search** — searches title, body, note, and tags; combine with tag chips or favorites.

Or just ask the agent:

- "Save that last prompt to my vault."
- "Distill one reusable prompt from this conversation."
- "What prompts do I have about review?"

The agent calls `prompt_vault`, checks for duplicates first, and tells you the title and id of what it saved. It keeps at most one new entry per turn.

## Data and privacy

The vault is one file:

```text
$DSH_HOME/storages/prompt-vault/vault.json
# default: ~/.dsh/storages/prompt-vault/vault.json
```

- Writes are atomic (temp file + rename) and serialized.
- A corrupt file is moved aside as `vault.json.corrupt-<timestamp>` instead of being overwritten; the vault then starts empty.
- Nothing is uploaded. Uninstalling the plugin does not delete the file; back it up by copying it.
- Limits: 1,000 prompts, 20,000 characters per body, 4,000 per note, 16 tags per prompt.

To point development at a scratch vault, set `DSH_HOME` to a temporary directory before starting DSH.

## Compatibility

- Built for DSH **0.2.3-alpha.2** and newer (`dsh.engines.dsh`).
- DSH plugin APIs are still moving. This plugin uses public bundle hooks (`webServer`, `tools`, `skills`, `systemPrompt`) and the Client slot API (`sidebar.panellist`, `main`). A DSH change to those contracts can break it.
- Node.js 22+.
- No cross-device sync. The Client cannot insert text into the composer; copy is clipboard-only.

## Development

```bash
npm test           # node:test: storage, routes, tool
npm run check      # syntax-check every entry file
npm pack --dry-run # inspect what would be published
```

Source layout:

| File | Responsibility |
|---|---|
| `src/index.js` | Host entry: route, tool, skill, prompt section |
| `src/host-vault.js` | JSON storage, validation, atomic writes, corrupt recovery |
| `src/host-routes.js` | Same-origin `/prompt-vault` route |
| `src/host-tool.js` | `prompt_vault` tool |
| `src/host-skill.js` | extraction skill and per-turn hint |
| `src/client.js` | sidebar icon and full page (React, no JSX) |
| `locale/*.json` | plugin metadata (title, description, detail page) |
| `docs/` | user detail pages + the WHY/HOW/knowledge retrospective |

Design notes:

- A bundle Client cannot use the dynamic-plugin `host.call` bridge, so the page talks to its own same-origin HTTP route.
- Every mutation returns the complete state; the page never merges partial updates.
- The UI registers only `sidebar.panellist` and `main`; it does not read another plugin's DOM.

## License

[MIT](LICENSE). Issues and pull requests are welcome.

---

## 中文说明

**一句话：把真正会复用的提示词存成可搜索的卡片，并让 agent 在对话里替你提炼、去重、打标签。数据只在本机。**

- **存**：侧边栏整页，标题、正文、标签、备注、常用、使用次数。
- **找**：全文搜索标题/正文/备注/标签，按标签或常用筛选。
- **用**：一键复制到剪贴板；页面不会关闭。
- **提炼**：`prompt_vault` 工具 + `prompt-vault` skill，只收可迁移的提问骨架（固定格式、步骤、禁止项、纠正规则），不收项目细节；一次最多一条，先查重，同义合并。
- **本地**：`$DSH_HOME/storages/prompt-vault/vault.json`，不联网、不上传；写入原子化，损坏文件自动备份。

安装：

```bash
git clone https://github.com/xinx-chen/dsh-prompt-vault.git
```

然后在 DSH 会话里执行：

```text
plugin_manager install_bundle target=/绝对路径/dsh-prompt-vault
```

装好后侧边栏出现书签图标；没出现就刷新一次窗口。兼容 DSH `0.2.3-alpha.2` 及以上。

边界：复制只写剪贴板，不能直接插入输入框；没有多设备同步；删除不可撤销；单库上限 1000 条。

深度复盘（WHY / HOW / 知识沉淀）：[从自用到开源](docs/项目复盘_从自用到开源_2026-11-23.md)。
