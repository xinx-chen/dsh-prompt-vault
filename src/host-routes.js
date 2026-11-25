/**
 * HTTP surface for the Prompt Vault page.
 *
 * 前端与后端的通信层。
 *
 * 背景：bundle 形态的 Client 不能用动态插件的 host.call 桥接，
 * 所以自建了一个同源 HTTP 路由 —— 前端页面通过 fetch('/prompt-vault/...') 调用。
 * 这个范式参考了 DSH 生态里 meeting-room 插件的做法。
 *
 * 安全上只做了同源校验（本地单用户足够），每个 action 返回完整 state，
 * 前端直接整体覆盖，不需要做增量合并。
 */

/** 本插件拥有的路由前缀，注册为 prefix 路由后自动匹配所有子路径。 */
export const PREFIX = '/prompt-vault'

/** 请求体大小上限 —— 防止有人塞个 10MB 的 body 把进程拖死。 */
const MAX_BODY_BYTES = 512 * 1024  // 512KB

/**
 * 同源检查：没有 Origin 头（比如 curl）或 Origin 等于当前 Host → 同源放行。
 * DSH 自己的页面 fetch 都会带 Origin，外部网站的 fetch 会被 403 拒绝。
 */
export function sameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true  // 无 Origin 视为本地请求
  const host = req.headers.host
  if (host === undefined) return false
  return origin === `http://${host}` || origin === `https://${host}`
}

/** 统一的 JSON 响应封装：设置 content-type / content-length / no-store，一次性写完。 */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',  // 状态每次都可能变，不让浏览器缓存
  })
  res.end(body)
}

/**
 * 读取并解析 JSON 请求体。
 * 关键细节：
 *   - 超限后用 req.resume() 排空流而不是 destroy，这样 400 响应才能正常发出去
 *   - 用 settled 标志防止 data/end/error 回调在 reject 后继续执行
 */
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
        req.resume()  // 排空剩余数据，不然 socket 会挂住
        reject(new Error('Request body is too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      if (chunks.length === 0) {
        resolve({})  // 空 body 视为 {}
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

/**
 * 把前端传来的 action 转成 vault 方法调用。
 * 每个 action 执行后都返回新的完整 state —— 前端直接替换整份状态，
 * 避免前端自己合并增量（容易出 bug）。
 */
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
      // 单独的"切换常用"快捷 action，内部就是 update 一个 favorite 字段
      return (await vault.update(String(body.id ?? ''), { favorite: body.favorite === true })).state
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

/**
 * 创建路由 handler。
 * 路由很简单，只有两个端点：
 *   GET  /prompt-vault/state   —— 拉整个库的快照
 *   POST /prompt-vault/action  —— 执行一个变更（add/update/delete/use/favorite）
 * 所有异常统一走 catch → 400 + 错误消息。
 */
export function createHandler(vault) {
  return async function handler(req, res) {
    try {
      // 第一步：同源检查，挡住跨站请求
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
