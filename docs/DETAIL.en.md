# Prompt Vault

> A searchable library for prompts you actually reuse, plus an agent that distills new ones from your conversations. Everything stays on this machine.

## What it is for

Prompts get buried in chat history; the same structure gets retyped every week. Prompt Vault does two things:

1. **Keep** — a full page in the sidebar: create, edit, tag, favorite, search, copy.
2. **Distill** — through the `prompt_vault` tool, the agent extracts a reusable prompt skeleton from a conversation, checks for duplicates, and saves it. At most one entry per turn; no project details.

## How to use

- Click the bookmark icon in the sidebar to open Prompt Vault.
- **New prompt**: name it after the capability (e.g. "Requirements clarification: six questions"), keep `【】` placeholders, add 2–4 tags and a one-line note.
- On a card: ★ marks a favorite, click the title to expand, then copy, edit, or delete.
- Or ask:
  - "Save that last prompt to my vault."
  - "Distill one reusable prompt from our recent conversation."
  - "What do I have about review?"

## Where the data lives

`$DSH_HOME/storages/prompt-vault/vault.json` (default `~/.dsh/storages/prompt-vault/vault.json`).

- Writes are atomic (temp file + rename).
- A corrupt file is renamed to `vault.json.corrupt-<timestamp>` and the vault starts empty.
- No network, no upload. Uninstalling the plugin does not delete the file.

## Agent surface

- Tool `prompt_vault`: `list` / `get` / `add` / `update` / `remove` / `use`.
- Skill `prompt-vault`: what to save, what to skip, how to name and tag.
- A one-line system-prompt hint keeps it discoverable without waiting for the word "plugin".

## Limits

- Copy writes to the clipboard only; this version cannot insert into the composer (the Client has no composer injection service).
- Local only; no multi-device sync.
- 1,000 prompts per vault; 20,000 characters per body.
- Deletion is irreversible; the page asks for confirmation, and the agent must not delete on its own.
