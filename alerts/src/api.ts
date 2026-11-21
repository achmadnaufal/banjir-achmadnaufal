import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildTestPayload } from './payload'
import { createRateLimiter } from './ratelimit'
import type { PushSender } from './sender'
import type { Store } from './store'
import { parseEndpointBody, parseSubscribeBody } from './validate'

/**
 * The page's API. Every reply is `{ ok, data?, error? }`. Public on purpose
 * (anyone at the residence can subscribe), so it validates everything,
 * rate-limits callers and never echoes internal errors.
 */

export type ApiDeps = {
  store: Store
  send: PushSender
  vapidPublicKey: string
  ownerToken: string
  allowedOrigins: string[]
  startedAt: number
  now: () => number
  log: (msg: string) => void
}

const MAX_BODY_BYTES = 4096
const MAX_SUBSCRIPTIONS = 2000
/** New phones one caller may add a day — high enough for a carrier IP shared by neighbours. */
const MAX_NEW_PER_IP_PER_DAY = 50
/** When full, a phone that never received a push within this long makes room. */
const EVICT_UNDELIVERED_AFTER_MS = 2 * 24 * 60 * 60 * 1000
const HEALTHY_RUN_AGE_MS = 15 * 60 * 1000

type Reply = { status: number; body: unknown }

const ok = (status: number, data?: unknown): Reply => ({
  status,
  body: data === undefined ? { ok: true } : { ok: true, data },
})
const fail = (status: number, error: string): Reply => ({ status, body: { ok: false, error } })

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'body too large')
    chunks.push(chunk as Buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'body is not JSON')
  }
}

function sameSecret(given: string | null, expected: string): boolean {
  if (given === null || expected === '') return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function clientIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip']
  return (Array.isArray(cf) ? cf[0] : cf) ?? req.socket.remoteAddress ?? 'unknown'
}

export function createApiHandler(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => void {
  const perIp = createRateLimiter({ capacity: 10, refillEveryMs: 60_000 })
  const perTestEndpoint = createRateLimiter({ capacity: 1, refillEveryMs: 60_000 })
  const newPerIpDaily = createRateLimiter({ capacity: MAX_NEW_PER_IP_PER_DAY, refillEveryMs: 24 * 60 * 60 * 1000 })

  const hasRoom = (): boolean => {
    if (deps.store.countSubscriptions() < MAX_SUBSCRIPTIONS) return true
    deps.store.evictUndelivered(new Date(deps.now() - EVICT_UNDELIVERED_AFTER_MS))
    return deps.store.countSubscriptions() < MAX_SUBSCRIPTIONS
  }

  const healthz = (): Reply => {
    const { lastRunAt } = deps.store.getState()
    const now = deps.now()
    const running = lastRunAt !== null && now - lastRunAt <= HEALTHY_RUN_AGE_MS
    const starting = now - deps.startedAt < HEALTHY_RUN_AGE_MS
    return running || starting ? ok(200) : fail(503, 'watcher stalled')
  }

  const status = (): Reply => {
    const s = deps.store.getState()
    return ok(200, {
      lastRunAt: s.lastRunAt,
      lastRunOk: s.lastRunOk,
      lastReadingAt: s.lastReadingAt,
      lastReadingSource: s.lastReadingSource,
      subscribers: deps.store.countSubscriptions(),
    })
  }

  const subscribe = async (req: IncomingMessage): Promise<Reply> => {
    const parsed = parseSubscribeBody(await readJson(req))
    if ('error' in parsed) return fail(400, parsed.error)
    const { endpoint, keys } = parsed.subscription
    // Re-registering a phone we already have (every app launch) is never
    // limited; only new phones count against the caller and the list size.
    if (!deps.store.hasSubscription(endpoint)) {
      const ip = clientIp(req)
      const now = deps.now()
      if (!perIp.take(ip, now) || !newPerIpDaily.take(ip, now)) return fail(429, 'too many requests')
      if (!hasRoom()) return fail(503, 'subscriptions full')
    }
    const isOwner = sameSecret(parsed.ownerToken, deps.ownerToken)
    deps.store.upsertSubscription({ endpoint, ...keys, locale: parsed.locale, isOwner }, new Date(deps.now()))
    return ok(201)
  }

  const unsubscribe = async (req: IncomingMessage): Promise<Reply> => {
    if (!perIp.take(clientIp(req), deps.now())) return fail(429, 'too many requests')
    const parsed = parseEndpointBody(await readJson(req))
    if ('error' in parsed) return fail(400, parsed.error)
    return deps.store.deleteSubscription(parsed.endpoint) ? ok(200) : fail(404, 'not subscribed')
  }

  const test = async (req: IncomingMessage): Promise<Reply> => {
    const parsed = parseEndpointBody(await readJson(req))
    if ('error' in parsed) return fail(400, parsed.error)
    const sub = deps.store.listSubscriptions().find((s) => s.endpoint === parsed.endpoint)
    if (sub === undefined) return fail(404, 'not subscribed')
    if (!perTestEndpoint.take(sub.endpoint, deps.now())) return fail(429, 'one test a minute')
    const result = await deps.send(sub, buildTestPayload(sub.locale))
    if (result === 'gone') {
      deps.store.deleteSubscription(sub.endpoint)
      return fail(410, 'this phone is no longer subscribed')
    }
    return result === 'ok' ? ok(202) : fail(502, 'the push service did not accept the test')
  }

  const route = async (req: IncomingMessage): Promise<Reply> => {
    const path = new URL(req.url ?? '/', 'http://local').pathname
    const key = `${req.method} ${path}`
    switch (key) {
      case 'GET /healthz':
        return healthz()
      case 'GET /api/push/key':
        return ok(200, { publicKey: deps.vapidPublicKey })
      case 'GET /api/push/status':
        return status()
      case 'POST /api/push/subscribe':
        return subscribe(req)
      case 'POST /api/push/unsubscribe':
        return unsubscribe(req)
      case 'POST /api/push/test':
        return test(req)
      default:
        return fail(404, 'not found')
    }
  }

  const cors = (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin
    if (origin === undefined || !deps.allowedOrigins.includes(origin)) return
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  return (req, res) => {
    cors(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
    route(req)
      .catch((err: unknown): Reply => {
        if (err instanceof HttpError) return fail(err.status, err.message)
        deps.log(`api error on ${req.method} ${req.url}: ${err instanceof Error ? err.message : String(err)}`)
        return fail(500, 'internal error')
      })
      .then(({ status: code, body }) => {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify(body))
      })
  }
}
