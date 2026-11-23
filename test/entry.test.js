import test from 'node:test'
import assert from 'node:assert/strict'

// DSH's bundle loader imports the package-root index.js directly. This guards
// the compatibility shim that keeps the src/ layout installable.
test('package root entry re-exports the host entry', async () => {
  const entry = await import('../index.js')
  assert.equal(typeof entry.apply, 'function')
  assert.deepEqual(entry.inject, ['webServer', 'tools'])
  assert.equal(entry.name, 'prompt-vault')
})
