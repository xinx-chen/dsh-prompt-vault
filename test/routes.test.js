import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { join } from 'node:path'
import { PromptVault } from '../src/host-vault.js'
import { createHandler, PREFIX } from '../src/host-routes.js'
import { withTempDir } from './helpers.js'

async function withServer(fn) {
  await withTempDir(async (dir) => {
    const vault = new PromptVault({ file: join(dir, 'vault.json') })
    const server = http.createServer(createHandler(vault))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    const base = `http://127.0.0.1:${port}`
    try {
      await fn(base, vault)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
}

test('GET state and POST add return the full state', async () => {
  await withServer(async (base) => {
    const empty = await fetch(`${base}${PREFIX}/state`)
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), { version: 1, prompts: [], tags: [] })

    const added = await fetch(`${base}${PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ action: 'add', title: 'Review', content: 'Lead with the conclusion.', tags: ['review'] }),
    })
    assert.equal(added.status, 200)
    const state = await added.json()
    assert.equal(state.prompts.length, 1)
    assert.equal(state.prompts[0].source, 'manual')

    const updated = await fetch(`${base}${PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ action: 'favorite', id: state.prompts[0].id, favorite: true }),
    })
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).prompts[0].favorite, true)
  })
})

test('rejects cross-origin writes', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}${PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ action: 'add', content: 'x' }),
    })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'untrusted origin')
  })
})

test('rejects invalid JSON, unknown actions, and oversized bodies', async () => {
  await withServer(async (base) => {
    const invalid = await fetch(`${base}${PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ nope',
    })
    assert.equal(invalid.status, 400)

    const unknown = await fetch(`${base}${PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'explode' }),
    })
    assert.equal(unknown.status, 400)
    assert.match((await unknown.json()).error, /Unknown action/)

    const oversized = await fetch(`${base}${PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add', content: 'x'.repeat(513 * 1024) }),
    })
    assert.equal(oversized.status, 400)
    assert.match((await oversized.json()).error, /too large/)
  })
})

test('returns 404 for unknown routes', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}${PREFIX}/nope`)
    assert.equal(response.status, 404)
  })
})
