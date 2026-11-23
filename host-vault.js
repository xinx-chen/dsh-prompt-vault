/**
 * Prompt Vault storage and operations.
 *
 * The vault is one JSON document under the DSH home, so the page, the agent
 * tool, and a future command all read and write the same data. Writes are
 * serialized, atomic (temp file + rename), and a corrupt document is moved
 * aside instead of overwritten.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

/** Version of the stored document shape. */
export const VAULT_VERSION = 1

/** Hard caps keep the document small enough to load on every request. */
export const LIMITS = {
  prompts: 1000,
  title: 120,
  content: 20000,
  note: 4000,
  tags: 16,
  tag: 32,
}

/** Absolute path of the vault document for the current DSH home. */
export function vaultFilePath() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, 'storages', 'prompt-vault', 'vault.json')
}

/** @returns an empty document. */
function emptyDocument() {
  return { version: VAULT_VERSION, prompts: [] }
}

/** Trim and cap one text field. */
function text(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/** Normalize one stored prompt; returns null when the required fields are gone. */
function normalizePrompt(raw, fallbackNow) {
  if (raw === null || typeof raw !== 'object') return null
  const title = text(raw.title, LIMITS.title)
  const content = text(raw.content, LIMITS.content)
  if (title === '' || content === '') return null
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : fallbackNow
  const updatedAt = Number.isFinite(raw.updatedAt) ? Math.max(raw.updatedAt, createdAt) : createdAt
  const lastUsedAt = Number.isFinite(raw.lastUsedAt) ? raw.lastUsedAt : undefined
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

/** Normalize a whole document, dropping duplicate ids and invalid rows. */
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

/** Case-insensitive haystack for one prompt. */
function haystack(prompt) {
  return `${prompt.title}\n${prompt.content}\n${prompt.note}\n${prompt.tags.join(' ')}`.toLocaleLowerCase()
}

/** Tag counts for the filter row. */
function tagCounts(prompts) {
  const counts = new Map()
  for (const prompt of prompts) {
    for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** The vault document plus its derived tag list. */
export class PromptVault {
  /**
   * @param {object} [options]
   * @param {string} [options.file] absolute document path.
   * @param {() => number} [options.now] clock, injectable for tests.
   */
  constructor(options = {}) {
    this.file = options.file ?? vaultFilePath()
    this.now = options.now ?? (() => Date.now())
    this.document = null
    this.loading = null
    this.queue = Promise.resolve()
  }

  /** Load the document once, tolerating a missing or corrupt file. */
  async load() {
    if (this.document !== null) return this.document
    if (this.loading !== null) return this.loading
    this.loading = (async () => {
      await mkdir(dirname(this.file), { recursive: true })
      let raw
      try {
        raw = await readFile(this.file, 'utf8')
      } catch (error) {
        if (error?.code === 'ENOENT') {
          this.document = emptyDocument()
          return this.document
        }
        throw error
      }
      try {
        this.document = normalizeDocument(JSON.parse(raw))
      } catch {
        // Keep the unreadable bytes for the user, then start clean rather than
        // leaving the vault permanently unopenable.
        try {
          await rename(this.file, `${this.file}.corrupt-${this.now()}`)
        } catch {
          // A failed backup must not block the fresh document.
        }
        this.document = emptyDocument()
      }
      return this.document
    })()
    return this.loading
  }

  /** Serialize every operation so concurrent requests cannot interleave writes. */
  enqueue(work) {
    const run = this.queue.then(work, work)
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  /** Write the document atomically. */
  async save() {
    const body = `${JSON.stringify(this.document, null, 2)}\n`
    const temp = `${this.file}.${process.pid}.${this.now()}.tmp`
    await writeFile(temp, body, 'utf8')
    await rename(temp, this.file)
  }

  /** @returns {{version:number, prompts:object[], tags:{tag:string,count:number}[]}} */
  snapshot() {
    const prompts = [...this.document.prompts].sort((a, b) => b.updatedAt - a.updatedAt)
    return { version: this.document.version, prompts, tags: tagCounts(prompts) }
  }

  /** Read the whole vault. */
  state() {
    return this.enqueue(async () => {
      await this.load()
      return this.snapshot()
    })
  }

  /**
   * Read one prompt.
   * @param {string} id exact id.
   */
  get(id) {
    return this.enqueue(async () => {
      await this.load()
      return this.document.prompts.find((prompt) => prompt.id === id) ?? null
    })
  }

  /**
   * Add one prompt. Identical content is not duplicated.
   * @param {{title?:string, content:string, tags?:string[], note?:string, source?:string, favorite?:boolean}} input
   */
  add(input) {
    return this.enqueue(async () => {
      await this.load()
      const content = text(input?.content, LIMITS.content)
      if (content === '') throw new Error('Prompt content is required')
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
   * Update one prompt; omitted fields stay unchanged.
   * @param {string} id exact id.
   * @param {object} patch
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

  /**
   * Delete one prompt.
   * @param {string} id exact id.
   */
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
   * Record one copy/use without reordering the list.
   * @param {string} id exact id.
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
   * Filter for the tool. Returns prompts and the unfiltered total.
   * @param {{query?:string, tag?:string, favorite?:boolean, limit?:number}} options
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

export { emptyDocument, normalizeDocument, tagCounts }
