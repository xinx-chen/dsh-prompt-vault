/**
 * Agent-facing guidance for the Prompt Vault.
 *
 * 给 AI agent 的"使用说明书"，分两层：
 *
 *   PROMPT_VAULT_SKILL —— 完整 skill，当用户明确说"收藏提示词"时加载。
 *     详细教 agent 判断什么该存、什么不该存、怎么提炼。
 *
 *   PROMPT_VAULT_SECTION —— 短提示段，每轮对话都注入。
 *     让 agent 随时记得有这个工具的存在，不会遗漏用户的收藏意图。
 *
 * 两层配合：平时靠 system prompt 触发，真到要干活时 skill 提供完整规则。
 */

/**
 * 完整 skill 定义。
 *
 * DSH skill 格式：
 *   name         —— 唯一标识
 *   description  —— 一句话告诉 agent 这个 skill 是干嘛的
 *   whenToUse    —— 触发表述（中英文都写了，支持中文用户）
 *   source       —— 'runtime' 表示这是插件自带的 skill
 *   content      —— Markdown 格式的完整指导，agent 加载后会读这段
 *
 * content 里的核心规则：只存可迁移的骨架，不存项目细节；先查重再新增；
 * 一轮对话最多存一条。这些是"提炼质量"的护城河。
 */
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

/**
 * 系统提示段 —— 每轮对话都注入。
 *
 * order: 900 —— 确保在 DSH 内置段之后、用户输入之前的位置。
 * interpolate: false —— 这段是静态文本，不需要变量插值。
 *
 * 为什么要两层？因为 skill 是"按需加载"的 —— 如果 agent 判断不需要就不会读。
 * 但用户可能只是随口说"帮我存一下"，skill 可能没被正确触发。
 * 系统提示段像一个"常驻提醒"，确保 agent 不会忘记这个工具的存在。
 */
export const PROMPT_VAULT_SECTION = {
  name: 'prompt-vault',
  order: 900,
  interpolate: false,
  text: 'Prompt Vault: when the user asks to save or distill a prompt, or a transferable prompt pattern recurs, use prompt_vault. List first to deduplicate, merge synonyms with update, save at most one entry per turn, keep only the skeleton (no project details), and end the reply with one line giving the title and id. When the user asks for "my prompts", list first.',
}
