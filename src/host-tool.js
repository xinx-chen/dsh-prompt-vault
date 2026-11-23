/**
 * The `prompt_vault` agent tool.
 *
 * Every operation goes through the same PromptVault instance as the page, so a
 * prompt saved in conversation appears in the sidebar immediately (after the
 * page refreshes its state) and vice versa.
 */

/** One-line preview that survives multi-line prompts. */
function preview(content, max = 140) {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** Stable local date for a timestamp. */
function day(timestamp) {
  if (!Number.isFinite(timestamp)) return ''
  return new Date(timestamp).toLocaleDateString('en-CA')
}

/** Render one prompt for the model. */
function line(prompt, index) {
  const marks = [
    prompt.favorite ? 'favorite' : '',
    prompt.uses > 0 ? `used ${prompt.uses}×` : '',
    prompt.updatedAt ? `updated ${day(prompt.updatedAt)}` : '',
  ].filter((mark) => mark !== '')
  return [
    `${index + 1}. ${prompt.id} · ${prompt.title}${prompt.favorite ? ' ★' : ''}`,
    `   tags: ${prompt.tags.length > 0 ? prompt.tags.join(', ') : 'none'}${marks.length > 0 ? ` · ${marks.join(' · ')}` : ''}`,
    `   ${preview(prompt.content)}`,
  ].join('\n')
}

/** Full prompt body for `get`. */
function full(prompt) {
  const meta = [`${prompt.title} (${prompt.id})`]
  if (prompt.tags.length > 0) meta.push(`Tags: ${prompt.tags.join(', ')}`)
  if (prompt.note !== '') meta.push(`Note: ${prompt.note}`)
  if (prompt.source !== '') meta.push(`Source: ${prompt.source}`)
  meta.push('', prompt.content)
  return meta.join('\n')
}

/**
 * Build the tool definition for one vault.
 * @param {import('./host-vault.js').PromptVault} vault
 */
export function createPromptVaultTool(vault) {
  return {
    name: 'prompt_vault',
    description: 'Save and manage reusable prompts. Actions: list (default), get, add, update, remove, use. Use when the user asks to save or distill a prompt, asks for "my prompts", or a reusable prompt pattern recurs in conversation. Always list before adding; merge synonyms with update instead of creating duplicates.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'add', 'update', 'remove', 'use'],
          description: 'list to search (default); get one full prompt; add a new one; update an existing one; remove one; use records one use.',
        },
        id: { type: 'string', description: 'Prompt id. Required for get, update, remove, and use.' },
        title: { type: 'string', description: 'A capability name, for example "Requirements clarification: six questions". Defaults to the first line of content.' },
        content: { type: 'string', description: 'The prompt body. Keep 【】 placeholders. Required for add.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Two to four short tags. On update, this replaces the whole set.' },
        note: { type: 'string', description: 'One line describing when to use it.' },
        source: { type: 'string', description: 'Where it came from, for example "distilled from conversation" or "manual". Defaults to "manual".' },
        favorite: { type: 'boolean', description: 'Mark as favorite. On list, true returns only favorites.' },
        query: { type: 'string', description: 'Search text for list; matches title, body, note, and tags.' },
        tag: { type: 'string', description: 'On list, return only prompts carrying this tag.' },
        limit: { type: 'integer', description: 'Maximum rows for list. Default 20, maximum 100.' },
      },
      required: [],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute: async (args = {}) => {
      const action = typeof args.action === 'string' && args.action !== '' ? args.action : 'list'
      if (action === 'list') {
        const result = await vault.search({
          query: args.query,
          tag: args.tag,
          favorite: args.favorite === true,
          limit: args.limit,
        })
        if (result.total === 0) {
          return 'The prompt vault is empty. Use action:"add" to save the first prompt, or ask the user which prompt to save.'
        }
        const head = `Prompt vault: ${result.total} total, ${result.matched} matched, showing ${result.prompts.length}.`
        const body = result.prompts.map((prompt, index) => line(prompt, index)).join('\n')
        const tail = result.matched > result.prompts.length ? `\n(${result.matched - result.prompts.length} more not shown; narrow with query/tag or raise limit.)` : ''
        return `${head}\n${body}${tail}`
      }
      if (action === 'get') {
        const prompt = await vault.get(String(args.id ?? ''))
        if (prompt === null) return `Prompt not found: ${args.id ?? ''}. Use action:"list" to find its id.`
        return full(prompt)
      }
      if (action === 'add') {
        const result = await vault.add({
          title: args.title,
          content: args.content,
          tags: args.tags,
          note: args.note,
          source: args.source,
          favorite: args.favorite,
        })
        if (!result.created) return `Content already exists; not duplicated: ${result.prompt.id} · ${result.prompt.title}`
        return `Saved: ${result.prompt.id} · ${result.prompt.title}${result.prompt.tags.length > 0 ? ` (${result.prompt.tags.join(', ')})` : ''}. The vault now has ${result.state.prompts.length} prompts.`
      }
      if (action === 'update') {
        const result = await vault.update(String(args.id ?? ''), {
          ...(args.title === undefined ? {} : { title: args.title }),
          ...(args.content === undefined ? {} : { content: args.content }),
          ...(args.tags === undefined ? {} : { tags: args.tags }),
          ...(args.note === undefined ? {} : { note: args.note }),
          ...(args.favorite === undefined ? {} : { favorite: args.favorite }),
        })
        return `Updated: ${result.prompt.id} · ${result.prompt.title}.`
      }
      if (action === 'remove') {
        const result = await vault.remove(String(args.id ?? ''))
        return `Removed: ${result.removed.title} (${result.removed.id}). The vault now has ${result.state.prompts.length} prompts.`
      }
      if (action === 'use') {
        const result = await vault.use(String(args.id ?? ''))
        return `Recorded one use: ${result.prompt.title} (${result.prompt.uses} total).`
      }
      return `Unknown action: ${action}. Use list/get/add/update/remove/use.`
    },
  }
}

/** Exported for tests. */
export { preview, full }
