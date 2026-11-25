/**
 * Prompt Vault storage and operations.
 *
 * 提示词库的存储核心。
 *
 * 整体设计：整个库就是 DSH home 下的一个 JSON 文件，所以页面、agent 工具、
 * 未来的命令行都读写同一份数据。写入做了三层保护：
 *   1. 串行队列 —— 所有 mutation 进同一个 Promise 链，防止并发写丢数据
 *   2. 原子写入 —— 先写临时文件，再 rename 覆盖目标文件
 *   3. 损坏恢复 —— JSON parse 失败时把旧文件改名为 .corrupt-<ts>，不静默覆盖
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

/** 存储文档的版本号，未来迁移用。 */
export const VAULT_VERSION = 1

/**
 * 硬上限 —— 目的不是"限制用户"，而是保证 JSON 文件足够小，
 * 每次 HTTP 请求都能一次性加载完，不会因为库变大拖慢整个插件。
 */
export const LIMITS = {
  prompts: 1000,   // 最多 1000 条提示词
  title: 120,       // 标题最多 120 字符
  content: 20000,   // 正文最多 2 万字符
  note: 4000,       // 备注最多 4000 字符
  tags: 16,         // 每条最多 16 个标签
  tag: 32,          // 每个标签最多 32 字符
}

/**
 * 计算 vault.json 的绝对路径。
 * 优先读环境变量 DSH_HOME（开发时可指到临时目录做隔离），
 * 没有就退回到 ~/.dsh。
 */
export function vaultFilePath() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, 'storages', 'prompt-vault', 'vault.json')
}

/** 返回一个空库文档（首次启动或损坏恢复时用）。 */
function emptyDocument() {
  return { version: VAULT_VERSION, prompts: [] }
}

/**
 * 把任意值裁成干净的字符串：
 *   - 非字符串 → 空串
 *   - 字符串 → trim + 截断到 max
 * 所有写入字段都过这一关，防止脏数据进库。
 */
function text(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/**
 * 把一条原始记录规范化成合格的 Prompt 对象。
 * 做的事情：字段清洗、默认值填充、去重标签、生成 id。
 * 如果 title 或 content 为空（必填字段缺失），返回 null 表示这条应该丢弃。
 */
function normalizePrompt(raw, fallbackNow) {
  if (raw === null || typeof raw !== 'object') return null
  const title = text(raw.title, LIMITS.title)
  const content = text(raw.content, LIMITS.content)
  if (title === '' || content === '') return null
  // 时间戳兜底：无效值用 fallbackNow，且 updatedAt 不能早于 createdAt
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : fallbackNow
  const updatedAt = Number.isFinite(raw.updatedAt) ? Math.max(raw.updatedAt, createdAt) : createdAt
  const lastUsedAt = Number.isFinite(raw.lastUsedAt) ? raw.lastUsedAt : undefined
  // 标签去重 + 清洗 + 截断数量
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map((tag) => text(tag, LIMITS.tag)).filter((tag) => tag !== ''))].slice(0, LIMITS.tags)
    : []
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : `pv_${randomUUID()}`,
    title,
    content,
    tags,
    note: text(raw.note, LIMITS.note),
    source: text(raw.source, 40) || 'manual',
    favorite: raw.favorite === true,
    uses: Number.isFinite(raw.uses) ? Math.max(0, Math.trunc(raw.uses)) : 0,
    createdAt,
    updatedAt,
    ...(lastUsedAt === undefined ? {} : { lastUsedAt }),
  }
}

/**
 * 规范化整个文档：
 *   - 不是合法对象 / prompts 不是数组 → 空库
 *   - 逐条 normalizePrompt，丢弃 null
 *   - 按 id 去重（保留第一条）
 *   - 截断到 LIMITS.prompts 上限
 */
function normalizeDocument(raw) {
  if (raw === null || typeof raw !== 'object' || !Array.isArray(raw.prompts)) return emptyDocument()
  const now = Date.now()
  const seen = new Set()
  const prompts = []
  for (const row of raw.prompts.slice(0, LIMITS.prompts)) {
    const prompt = normalizePrompt(row, now)
    if (prompt === null || seen.has(prompt.id)) continue
    seen.add(prompt.id)
    prompts.push(prompt)
  }
  return { version: VAULT_VERSION, prompts }
}

/**
 * 构造一条记录的"全文检索棉垛"——把标题、正文、备注、标签拼在一起转小写，
 * search 时用 includes 做简单的包含匹配。
 */
function haystack(prompt) {
  return `${prompt.title}\n${prompt.content}\n${prompt.note}\n${prompt.tags.join(' ')}`.toLocaleLowerCase()
}

/**
 * 统计所有标签出现的次数，返回按频次降序的数组。
 * 前端侧栏的标签筛选栏就用这个数据渲染。
 */
function tagCounts(prompts) {
  const counts = new Map()
  for (const prompt of prompts) {
    for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * 提示词库核心类。
 *
 * 设计要点：
 *   - 整个类共享同一个 vault.json 文件
 *   - 所有异步操作都通过 enqueue() 串行化，避免并发写竞争
 *   - 首次访问时懒加载文件（load() 有缓存）
 *   - save() 用"临时文件 + rename"实现原子写入
 */
export class PromptVault {
  /**
   * @param {object} [options]
   * @param {string} [options.file] 自定义文件路径（测试时指定临时目录）
   * @param {() => number} [options.now] 自定义时钟（测试时固定时间戳）
   */
  constructor(options = {}) {
    this.file = options.file ?? vaultFilePath()
    this.now = options.now ?? (() => Date.now())
    this.document = null  // 加载后的文档对象，null 表示未加载
    this.loading = null   // 正在进行的 load Promise，用于合并并发加载
    this.queue = Promise.resolve()  // 串行队列的"尾指针"
  }

  /**
   * 懒加载文档，只在第一次读/写时触发。
   * 文件不存在 → 空库；文件损坏 → 改名备份 + 空库。
   * 多次并发调用只会触发一次真实读取（loading Promise 合并）。
   */
  async load() {
    if (this.document !== null) return this.document       // 已加载，直接返回
    if (this.loading !== null) return this.loading          // 别人在加载，等它
    this.loading = (async () => {
      await mkdir(dirname(this.file), { recursive: true })  // 确保目录存在
      let raw
      try {
        raw = await readFile(this.file, 'utf8')
      } catch (error) {
        if (error?.code === 'ENOENT') {
          // 文件不存在 → 全新空库，正常情况
          this.document = emptyDocument()
          return this.document
        }
        throw error
      }
      try {
        this.document = normalizeDocument(JSON.parse(raw))
      } catch {
        // JSON 解析失败 → 文件损坏
        // 处理：把损坏文件改名为 .corrupt-<时间戳> 留底，然后从空库开始
        // 注意：备份失败不能阻止新库启动，否则用户永远打不开
        try {
          await rename(this.file, `${this.file}.corrupt-${this.now()}`)
        } catch {
          // 静默忽略备份失败
        }
        this.document = emptyDocument()
      }
      return this.document
    })()
    return this.loading
  }

  /**
   * 串行化所有操作 —— 这是防止并发写竞争的关键。
   * 把新 work 接到当前队列尾部，队列变成 work 的结果（无论成功失败）。
   * 这样下一个 enqueue 会等上一个完全结束后才开始。
   */
  enqueue(work) {
    const run = this.queue.then(work, work)
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  /**
   * 原子写入 —— 先写到 .tmp 文件，再 rename 覆盖目标文件。
   * rename 在同一文件系统上是原子的，不会出现"写了一半"的中间状态。
   * 临时文件名带 pid + 时间戳，避免多进程冲突。
   */
  async save() {
    const body = `${JSON.stringify(this.document, null, 2)}\n`
    const temp = `${this.file}.${process.pid}.${this.now()}.tmp`
    await writeFile(temp, body, 'utf8')
    await rename(temp, this.file)
  }

  /**
   * 生成只读快照 —— 按 updatedAt 降序排列，附带标签统计。
   * 前端页面和 agent 工具的 list 都用这个格式。
   */
  snapshot() {
    const prompts = [...this.document.prompts].sort((a, b) => b.updatedAt - a.updatedAt)
    return { version: this.document.version, prompts, tags: tagCounts(prompts) }
  }

  /** 读取整个库的当前状态。 */
  state() {
    return this.enqueue(async () => {
      await this.load()
      return this.snapshot()
    })
  }

  /** 按 id 读取单条提示词，找不到返回 null。 */
  get(id) {
    return this.enqueue(async () => {
      await this.load()
      return this.document.prompts.find((prompt) => prompt.id === id) ?? null
    })
  }

  /**
   * 新增一条提示词。
   * 关键行为：
   *   - 同 content 不重复添加（返回 created: false 和已有条目）
   *   - 超过 LIMITS.prompts 上限时拒绝
   *   - title 没填时，用正文第一行的前 24 字符兜底
   * 返回 { created, prompt, state } —— 包含新快照，调用方不用再拉一次。
   */
  add(input) {
    return this.enqueue(async () => {
      await this.load()
      const content = text(input?.content, LIMITS.content)
      if (content === '') throw new Error('Prompt content is required')
      // 内容去重：同一正文不存两份
      const existing = this.document.prompts.find((prompt) => prompt.content === content)
      if (existing !== undefined) return { created: false, prompt: existing, state: this.snapshot() }
      if (this.document.prompts.length >= LIMITS.prompts) {
        throw new Error(`Prompt vault is full (max ${LIMITS.prompts}); delete some entries first`)
      }
      const now = this.now()
      const title = text(input?.title, LIMITS.title) || content.split('\n')[0].slice(0, 24)
      const prompt = normalizePrompt({ ...input, title, content, createdAt: now, updatedAt: now }, now)
      this.document.prompts.push(prompt)
      await this.save()
      return { created: true, prompt, state: this.snapshot() }
    })
  }

  /**
   * 更新单条提示词。只 patch 传入的字段，没传的保持不变。
   * tags 是整体替换，不是增量合并。
   * 每次更新都会刷新 updatedAt 时间戳。
   */
  update(id, patch = {}) {
    return this.enqueue(async () => {
      await this.load()
      const prompt = this.document.prompts.find((row) => row.id === id)
      if (prompt === undefined) throw new Error(`Prompt not found: ${id}`)
      if (patch.title !== undefined) {
        const title = text(patch.title, LIMITS.title)
        if (title === '') throw new Error('Title is required')
        prompt.title = title
      }
      if (patch.content !== undefined) {
        const content = text(patch.content, LIMITS.content)
        if (content === '') throw new Error('Prompt content is required')
        prompt.content = content
      }
      if (patch.tags !== undefined) {
        if (!Array.isArray(patch.tags)) throw new Error('tags must be an array')
        prompt.tags = [...new Set(patch.tags.map((tag) => text(tag, LIMITS.tag)).filter((tag) => tag !== ''))].slice(0, LIMITS.tags)
      }
      if (patch.note !== undefined) prompt.note = text(patch.note, LIMITS.note)
      if (patch.source !== undefined) prompt.source = text(patch.source, 40) || 'manual'
      if (patch.favorite !== undefined) prompt.favorite = patch.favorite === true
      prompt.updatedAt = this.now()
      await this.save()
      return { prompt, state: this.snapshot() }
    })
  }

  /** 删除单条提示词（按 id）。 */
  remove(id) {
    return this.enqueue(async () => {
      await this.load()
      const index = this.document.prompts.findIndex((prompt) => prompt.id === id)
      if (index === -1) throw new Error(`Prompt not found: ${id}`)
      const [removed] = this.document.prompts.splice(index, 1)
      await this.save()
      return { removed, state: this.snapshot() }
    })
  }

  /**
   * 记录一次使用（比如用户点了"复制"）。
   * ⚠️ 这里故意不改 updatedAt —— 否则"用过一次"会把排序打乱，
   * updatedAt 应该只反映"内容被修改过"，use/lastUsedAt 才反映"最近被用过"。
   */
  use(id) {
    return this.enqueue(async () => {
      await this.load()
      const prompt = this.document.prompts.find((row) => row.id === id)
      if (prompt === undefined) throw new Error(`Prompt not found: ${id}`)
      prompt.uses += 1
      prompt.lastUsedAt = this.now()
      await this.save()
      return { prompt, state: this.snapshot() }
    })
  }

  /**
   * 搜索/筛选提示词。
   * 支持三种过滤条件组合：
   *   - query: 全文检索（标题+正文+备注+标签的小写包含匹配）
   *   - tag:   精确标签匹配
   *   - favorite: 只看常用
   * limit 默认 20，上限 100 —— agent 工具不需要返回几千条。
   * 返回 total（未过滤总数）和 matched（过滤后数量），方便上层告知用户。
   */
  search(options = {}) {
    return this.enqueue(async () => {
      await this.load()
      const query = text(options.query, 200).toLocaleLowerCase()
      const tag = text(options.tag, LIMITS.tag)
      const limit = Number.isFinite(options.limit)
        ? Math.min(100, Math.max(1, Math.trunc(options.limit)))
        : 20
      const all = this.snapshot()
      const matched = all.prompts.filter((prompt) => {
        if (options.favorite === true && !prompt.favorite) return false
        if (tag !== '' && !prompt.tags.includes(tag)) return false
        if (query !== '' && !haystack(prompt).includes(query)) return false
        return true
      })
      return { total: all.prompts.length, matched: matched.length, prompts: matched.slice(0, limit), all }
    })
  }
}

// 导出辅助函数（测试用）
export { emptyDocument, normalizeDocument, tagCounts }
