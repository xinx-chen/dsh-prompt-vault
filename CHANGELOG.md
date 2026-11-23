# Changelog

## 0.2.1 — 2026-11-23

Structure-only release; no runtime behavior change.

- Moved runtime code to `src/` and the icon to `assets/`; updated `exports`, `main`, `files`, test imports, and the check script.
- Added `src/README.md` (module map) and `docs/README.md` (documentation index).
- Added the project retrospective: `docs/项目复盘_从自用到开源_2026-11-23.md`.

## 0.2.0 — 2026-11-23

First public release.

- Prompt library page: create, edit, delete, tags, favorites, search, copy, usage count.
- `prompt_vault` agent tool: `list`, `get`, `add`, `update`, `remove`, `use`.
- `prompt-vault` skill for distilling transferable prompt patterns from conversation.
- Local JSON storage with atomic writes, corrupt-file recovery, and hard caps.
- English UI plus 中文 UI; English agent surface.
- Node test suite for storage, HTTP routes, and the tool surface.

## 0.1.0 — 2026-11-20

Internal working version used during development.
