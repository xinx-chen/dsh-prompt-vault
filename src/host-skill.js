/**
 * Agent-facing guidance for the Prompt Vault.
 *
 * The skill teaches the extraction rules; the one-paragraph prompt section keeps
 * the tool discoverable in ordinary conversation without loading the full skill.
 */

/** Loaded when the user asks to save, distill, or browse prompts. */
export const PROMPT_VAULT_SKILL = {
  name: 'prompt-vault',
  description: 'Maintain the user\'s prompt vault: save a reusable prompt, or distill recurring, transferable prompt patterns from the conversation into prompt_vault after deduplication. 维护用户的提示词库：收藏提示词，或从对话中提炼可迁移的提问结构。',
  whenToUse: 'The user says "save / remember / store this prompt", "write down the prompt we just used", "organize my prompt library", "my prompts" (Chinese: 「收藏/记住/存一下这段提示词」「把刚才的提示词记下来」「整理我的提示词库」「我的提示词」), or a reusable pattern recurs: a fixed output format, an ask-before-answer order, explicit constraints, or a role setup.',
  source: 'runtime',
  content: `# Prompt Vault maintenance

## 1. When to save

Save a **transferable prompt pattern**, not the literal words of this one conversation.

- The user explicitly asks: save, remember, store this, write down that prompt, organize my prompt library.
- The user states a fixed format or order: "ask me three questions before answering", "lead with the conclusion, then evidence", "use a table from now on".
- The user corrects you and states a rule that will apply again: "no prose", "cite a source for every claim".
- The user repeatedly uses the same opening or the same constraints for different tasks.

## 2. When not to save

- Details that only hold for the current project: company names, job titles, data, today's conclusion.
- One-off Q&A, or a template you invented on the spot (unless the user explicitly asks to keep it).
- Preferences the user never stated. "They did not object this time" is not "they like it".
- Anything an existing entry already covers. Check duplicates first; merge synonyms instead of adding a second entry.

## 3. How to distill

1. **Keep only the skeleton**: role/goal, 【】 input placeholders, steps, output structure, prohibitions. Remove the concrete material from this conversation.
2. **Name it after the capability**: for example "Requirements clarification: six questions", "Conclusion-first review", "Paired-concept breakdown". Never "User prompt 1".
3. **Two to four short tags**: review, decision, writing, learning, agent, job search.
4. **Note the trigger**: one line describing when to use it.
5. **At most one entry per turn.** Fewer is better. If no transferable structure exists, save nothing rather than inventing one.

## 4. Order of operations

1. \`prompt_vault { action: "list", query: "keyword" }\` to check for duplicates.
2. Existing equivalent → \`action: "update"\`, keep the id, merge the new constraint.
3. New entry → \`action: "add"\` with title / content / tags / note / source: "distilled from conversation".
4. After saving, tell the user in one line at the end of the reply: title + id, and which conversation it came from. Do not paste the full text again.

## 5. Answering "my prompts"

Call \`action: "list"\` first. Show 5–10 entries ordered by favorite and recency, each with its id and a one-line purpose. Only call \`action: "get"\` when the user asks for the full text. Never invent entries from memory.

## 6. Boundaries

- The vault lives on this machine at \`$DSH_HOME/storages/prompt-vault/vault.json\`; nothing is uploaded.
- The page is in the sidebar under "Prompt Vault". Copy writes to the clipboard only; it does not insert into the composer.
- Deletion is irreversible. Never call remove unless the user explicitly asks to delete.`,
}

/** Short section that keeps the tool discoverable every turn. */
export const PROMPT_VAULT_SECTION = {
  name: 'prompt-vault',
  order: 900,
  interpolate: false,
  text: 'Prompt Vault: when the user asks to save or distill a prompt, or a transferable prompt pattern recurs, use prompt_vault. List first to deduplicate, merge synonyms with update, save at most one entry per turn, keep only the skeleton (no project details), and end the reply with one line giving the title and id. When the user asks for "my prompts", list first.',
}
