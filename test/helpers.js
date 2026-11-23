import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Create a scratch vault directory and clean it up after the callback. */
export async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'prompt-vault-test-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
