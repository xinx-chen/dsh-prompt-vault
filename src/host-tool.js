/**
 * The `prompt_vault` agent tool.
 *
 * 向 AI agent 暴露的工具定义。
 *
 * 工具本身不实现存储逻辑，全部委托给 vault 实例 —— 所以 agent 在对话里
 * 存的提示词，前端页面刷新后立刻可见；反之亦然。
 */

/**
 * 生成一行预览文本：把多行内容压成单行（空白合并），截断到 max 字符。
 * 用于 list 结果里让 agent 快速看每条是干嘛的。
 */
function preview(content, max = 140) {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** 时间戳 → 稳定格式日期（YYYY-MM-DD），用 en-CA locale 避免时区差异。 */
function day(timestamp) {
  if (!Number.isFinite(timestamp)) return ''
  return new Date(timestamp).toLocaleDateString('en-CA')
}

/**
 * 把一条 Prompt 格式化成 list 结果中的一行（3 行文本）：
 *   1. 序号 + id + 标题（常用加 ★）
 *   2. 标签 + 常用/使用次数/更新日期等标记
 *   3. 正文预览
 */
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

/** get 动作用：返回完整的提示词正文（含元信息头）。 */
function full(prompt) {
  const meta = [`${prompt.title} (${prompt.id})`]
  if (prompt.tags.length > 0) meta.push(`Tags: ${prompt.tags.join(', ')}`)
  if (prompt.note !== '') meta.push(`Note: ${prompt.note}`)
  if (prompt.source !== '') meta.push(`Source: ${prompt.source}`)
  meta.push('', prompt.content)
  return meta.join('\n')
}

/**
 * 创建 prompt_vault 工具定义。
 *
 * DSH 工具格式说明：
 *   name        —— 工具名，agent 通过这个名字调用
 *   description —— 一句话告诉 agent 什么时候该用这个工具
 *   parameters  —— JSON Schema，agent 靠这个理解能传什么参数、类型是什么
 *   output      —— render 函数把 execute 返回值转成 agent 易读的文本块
 *   execute     —— 真正的执行逻辑，接收 args 对象，返回字符串
 *
 * 所有工具输出都是纯文本 —— agent 读的就是这些文字，不走结构化 JSON。
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
      required: [],  // 没有必填字段 —— 默认 action=list 就够跑
      additionalProperties: false,  // 不让 agent 瞎传未知字段
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],  // 直接当文本块渲染
    },
    execute: async (args = {}) => {
      // 没传 action 默认为 list（最常用的操作）
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
        // 告诉 agent 总数 / 匹配数 / 当前展示数，方便它决定要不要翻页
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
        // vault.add 内部做了内容去重，created: false 表示同内容已存在
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

// 导出辅助函数（测试用）
export { preview, full }
