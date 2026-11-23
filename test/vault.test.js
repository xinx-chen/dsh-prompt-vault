import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PromptVault, LIMITS } from '../host-vault.js'
import { withTempDir } from './helpers.js'

function fixedClock(start = 1_700_000_000_000) {
  let value = start
  return () => value++
}

test('empty vault, add, deduplicate, search, update, use, remove', async () => {
  await withTempDir(async (dir) => {
    const vault = new PromptVault({ file: join(dir, 'vault.json'), now: fixedClock() })
    assert.equal((await vault.state()).prompts.length, 0)

    const first = await vault.add({ title: 'Review', content: 'Lead with the conclusion.', tags: ['review', 'writing'] })
    assert.equal(first.created, true)
    assert.equal(first.prompt.source, 'manual')
    assert.equal((await vault.state()).prompts.length, 1)

    const duplicate = await vault.add({ content: 'Lead with the conclusion.' })
    assert.equal(duplicate.created, false)
    assert.equal(duplicate.prompt.id, first.prompt.id)

    const found = await vault.search({ query: 'conclusion', tag: 'review' })
    assert.equal(found.total, 1)
    assert.equal(found.matched, 1)

    const updated = await vault.update(first.prompt.id, { tags: ['decision'], favorite: true })
    assert.deepEqual(updated.prompt.tags, ['decision'])
    assert.equal(updated.prompt.favorite, true)

    await vault.use(first.prompt.id)
    assert.equal((await vault.get(first.prompt.id)).uses, 1)

    const favorite = await vault.search({ favorite: true })
    assert.equal(favorite.matched, 1)

    const removed = await vault.remove(first.prompt.id)
    assert.equal(removed.removed.id, first.prompt.id)
    assert.equal((await vault.state()).prompts.length, 0)
  })
})

test('rejects empty content, missing ids, and invalid tags', async () => {
  await withTempDir(async (dir) => {
    const vault = new PromptVault({ file: join(dir, 'vault.json'), now: fixedClock() })
    await assert.rejects(vault.add({ content: '   ' }), /required/)
    assert.equal(await vault.get('missing'), null)
    await assert.rejects(vault.update('missing', { title: 'x' }), /not found/)
    await assert.rejects(vault.remove('missing'), /not found/)
    const added = await vault.add({ content: 'x' })
    await assert.rejects(vault.update(added.prompt.id, { tags: 'not-an-array' }), /array/)
  })
})

test('caps title and body and accepts at most LIMITS.tags unique tags', async () => {
  await withTempDir(async (dir) => {
    const vault = new PromptVault({ file: join(dir, 'vault.json'), now: fixedClock() })
    const tags = Array.from({ length: LIMITS.tags + 5 }, (_, index) => `t${index}`)
    const added = await vault.add({
      title: 'x'.repeat(LIMITS.title + 20),
      content: 'y'.repeat(LIMITS.content + 20),
      tags: [...tags, tags[0]],
    })
    assert.equal(added.prompt.title.length, LIMITS.title)
    assert.equal(added.prompt.content.length, LIMITS.content)
    assert.equal(added.prompt.tags.length, LIMITS.tags)
  })
})

test('recovers from a corrupt document and keeps the bytes aside', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'vault.json')
    await writeFile(file, '{ not json', 'utf8')
    const vault = new PromptVault({ file, now: fixedClock() })
    assert.equal((await vault.state()).prompts.length, 0)
    const names = await readdir(dir)
    assert.equal(names.some((name) => name.startsWith('vault.json.corrupt-')), true)
  })
})

test('deduplicates ids when normalizing an existing document', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'vault.json')
    await writeFile(file, JSON.stringify({
      version: 1,
      prompts: [
        { id: 'same', title: 'A', content: 'one', tags: [] },
        { id: 'same', title: 'B', content: 'two', tags: [] },
      ],
    }), 'utf8')
    const vault = new PromptVault({ file, now: fixedClock() })
    const state = await vault.state()
    assert.equal(state.prompts.length, 1)
    assert.equal(state.prompts[0].title, 'A')
  })
})
