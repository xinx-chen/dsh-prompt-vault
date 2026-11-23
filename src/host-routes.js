/**
 * HTTP surface for the Prompt Vault page.
 *
 * The page is a bundle Client module, so it cannot use the dynamic-plugin
 * `host.call` bridge. It talks to this prefix route with same-origin fetch,
 * the pattern the meeting-room plugin uses. Requests are same-origin only and
 * bodies are bounded; every action returns the full vault state so the page
 * never has to merge incremental responses.
 */

/** Route prefix owned by this plugin. */
export const PREFIX = '/prompt-vault'

/** Largest accepted request body. */
const MAX_BODY_BYTES = 512 * 1024

/** True when the request has no cross-site Origin (or one matching Host). */
export function sameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true
  const host = req.headers.host
  if (host === undefined) return false
  return origin === `http://${host}` || origin === `https://${host}`
}

/** Send one JSON response. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** Read and parse a bounded JSON body. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        settled = true
        // Drain instead of destroying the socket so the 400 response survives.
        req.resume()
        reject(new Error('Request body is too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
    req.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

/** Apply one page action and return the resulting state. */
async function applyAction(vault, body) {
  const action = typeof body.action === 'string' ? body.action : ''
  switch (action) {
    case 'add':
      return (await vault.add({
        title: body.title,
        content: body.content,
        tags: body.tags,
        note: body.note,
        source: body.source ?? 'manual',
        favorite: body.favorite,
      })).state
    case 'update':
      return (await vault.update(String(body.id ?? ''), {
        ...(body.title === undefined ? {} : { title: body.title }),
        ...(body.content === undefined ? {} : { content: body.content }),
        ...(body.tags === undefined ? {} : { tags: body.tags }),
        ...(body.note === undefined ? {} : { note: body.note }),
        ...(body.favorite === undefined ? {} : { favorite: body.favorite }),
      })).state
    case 'delete':
      return (await vault.remove(String(body.id ?? ''))).state
    case 'use':
      return (await vault.use(String(body.id ?? ''))).state
    case 'favorite':
      return (await vault.update(String(body.id ?? ''), { favorite: body.favorite === true })).state
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

/**
 * Build the route handler for one vault.
 * @param {import('./host-vault.js').PromptVault} vault
 */
export function createHandler(vault) {
  return async function handler(req, res) {
    try {
      if (!sameOrigin(req)) {
        sendJson(res, 403, { error: 'untrusted origin' })
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = url.pathname.slice(PREFIX.length)
      const method = req.method ?? 'GET'

      if (method === 'GET' && (route === '' || route === '/' || route === '/state')) {
        sendJson(res, 200, await vault.state())
        return
      }
      if (method === 'POST' && route === '/action') {
        const body = await readJson(req)
        sendJson(res, 200, await applyAction(vault, body))
        return
      }
      sendJson(res, 404, { error: 'not found' })
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}
