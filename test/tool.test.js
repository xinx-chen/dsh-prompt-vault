import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { PromptVault } from '../src/host-vault.js'
import { createPromptVaultTool } from '../src/host-tool.js'
import { withTempDir } from './helpers.js'

test('tool covers the full lifecycle', async () => {
  await withTempDir(async (dir) => {
    const tool = createPromptVaultTool(new PromptVault({ file: join(dir, 'vault.json') }))

    assert.match(await tool.execute({ action: 'list' }), /empty/)

    const added = await tool.execute({ action: 'add', title: 'Review', content: 'Lead with the conclusion.', tags: ['review'] })
    const id = added.match(/pv_[0-9a-f-]+/)?.[0]
    assert.ok(id)
    assert.match(added, /Saved:/)

    const duplicate = await tool.execute({ action: 'add', content: 'Lead with the conclusion.' })
    assert.match(duplicate, /already exists/)
    assert.match(duplicate, new RegExp(id))

    const full = await tool.execute({ action: 'get', id })
    assert.match(full, /Review/)
    assert.match(full, /Lead with the conclusion\./)
    assert.match(full, /Tags: review/)

    const listed = await tool.execute({ action: 'list', query: 'conclusion' })
    assert.match(listed, /1 total, 1 matched/)

    const used = await tool.execute({ action: 'use', id })
    assert.match(used, /1 total/)

    const updated = await tool.execute({ action: 'update', id, title: 'Conclusion first' })
    assert.match(updated, /Conclusion first/)

    const missed = await tool.execute({ action: 'get', id: 'missing' })
    assert.match(missed, /not found/)

    const removed = await tool.execute({ action: 'remove', id })
    assert.match(removed, /Removed:/)
    assert.match(await tool.execute({ action: 'list' }), /empty/)
  })
})

test('tool rejects an unknown action explicitly', async () => {
  await withTempDir(async (dir) => {
    const tool = createPromptVaultTool(new PromptVault({ file: join(dir, 'vault.json') }))
    assert.match(await tool.execute({ action: 'explode' }), /Unknown action/)
  })
})

test('tool schema declares every action and no required field', () => {
  const tool = createPromptVaultTool({})
  assert.equal(tool.name, 'prompt_vault')
  assert.deepEqual(tool.parameters.properties.action.enum, ['list', 'get', 'add', 'update', 'remove', 'use'])
  assert.deepEqual(tool.parameters.required, [])
  assert.equal(tool.output.schema.type, 'string')
})
