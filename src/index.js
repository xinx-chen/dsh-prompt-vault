/**
 * Host half of the Prompt Vault bundle.
 *
 * 提示词库插件的 Host 侧入口。
 * 负责：数据存储、HTTP 路由、agent 工具、提炼 skill、系统提示段。
 * Client 侧（client.js）渲染侧栏页面，通过同源路由读写同一份数据。
 */

import { PromptVault } from './host-vault.js'
import { createHandler, PREFIX } from './host-routes.js'
import { createPromptVaultTool } from './host-tool.js'
import { PROMPT_VAULT_SECTION, PROMPT_VAULT_SKILL } from './host-skill.js'

// 插件唯一标识，用于 DSH 内部引用
export const name = 'prompt-vault'

// 声明 Host 启动时需要的服务：webServer（HTTP）和 tools（agent 工具）
export const inject = ['webServer', 'tools']

/**
 * 插件入口函数，DSH 在加载 bundle 时调用。
 * 所有注册都包在 ctx.effect 里 —— 返回 disposer，插件卸载时自动清理。
 *
 * 关键设计：route / tool / skill / systemPrompt 共用同一个 vault 实例，
 * 所以 agent 在对话里存的提示词，侧栏页面刷新后立刻可见，反之亦然。
 */
export function apply(ctx) {
  const vault = new PromptVault()

  // 注册同源 HTTP 路由，供前端页面 fetch 调用
  // bundle Client 不能用动态插件的 host.call，所以自建路由
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: createHandler(vault) }),
    'prompt-vault: http route',
  )

  // 注册 agent 工具 prompt_vault，让 AI 可以 list/get/add/update/remove/use
  ctx.effect(
    () => ctx.tools.register(createPromptVaultTool(vault)),
    'prompt-vault: prompt_vault tool',
  )

  // —— 以下两个是可选服务，宿主没提供也不能让插件挂掉 ——

  // 注册提炼 skill：当用户明确说"收藏/存一下提示词"时加载，教 agent 怎么提炼
  const skills = ctx.get('skills')
  if (skills !== null && skills !== undefined && typeof skills.register === 'function') {
    ctx.effect(() => skills.register(PROMPT_VAULT_SKILL), 'prompt-vault: skill')
  }

  // 注册系统提示段：每轮对话都注入一小段话，让 agent 随时记得有这个工具
  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt !== null && systemPrompt !== undefined && typeof systemPrompt.section === 'function') {
    ctx.effect(() => systemPrompt.section(PROMPT_VAULT_SECTION), 'prompt-vault: prompt section')
  }
}
