/**
 * Host half of the Prompt Vault bundle.
 *
 * Owns the vault document, its same-origin HTTP route, the `prompt_vault` tool,
 * the extraction skill, and a short system-prompt hint. The Client half renders
 * the sidebar page and reads the same route.
 */

import { PromptVault } from './host-vault.js'
import { createHandler, PREFIX } from './host-routes.js'
import { createPromptVaultTool } from './host-tool.js'
import { PROMPT_VAULT_SECTION, PROMPT_VAULT_SKILL } from './host-skill.js'

export const name = 'prompt-vault'

export const inject = ['webServer', 'tools']

/** Route, tool, skill, and prompt section all share one vault instance. */
export function apply(ctx) {
  const vault = new PromptVault()

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: createHandler(vault) }),
    'prompt-vault: http route',
  )

  ctx.effect(
    () => ctx.tools.register(createPromptVaultTool(vault)),
    'prompt-vault: prompt_vault tool',
  )

  // Both are optional services: a composition without them must still load.
  const skills = ctx.get('skills')
  if (skills !== null && skills !== undefined && typeof skills.register === 'function') {
    ctx.effect(() => skills.register(PROMPT_VAULT_SKILL), 'prompt-vault: skill')
  }

  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt !== null && systemPrompt !== undefined && typeof systemPrompt.section === 'function') {
    ctx.effect(() => systemPrompt.section(PROMPT_VAULT_SECTION), 'prompt-vault: prompt section')
  }
}
