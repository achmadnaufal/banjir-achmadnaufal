import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiHandler, type ApiDeps } from './api'
import type { PushSender, SendResult } from './sender'
import { INITIAL_SERVICE_STATE, openStore, type Store } from './store'

const ORIGIN = 'https://banjir.achmadnaufal.com'
const APPLE = 'https://web.push.apple.com/QGZ0bWFpbF9hZGRyZXNz'
const P256DH = Buffer.alloc(65, 4).toString('base64url')
const AUTH = Buffer.alloc(16, 9).toString('base64url')
const T0 = new Date('2026-11-21T20:00:00+07:00').getTime()

const subscribeBody = (endpoint = APPLE, extra: Record<string, unknown> = {}) => ({
  subscription: { endpoint, keys: { p256dh: P256DH, auth: AUTH } },
  locale: 'en',
  ...extra,
})

let server: Server | null = null
afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()))
  server = null
})

async function start(over: Partial<ApiDeps> = {}) {
  const store = over.store ?? openStore(':memory:')
  const clock = { now: T0 }
  const send = vi.fn<PushSender>(async () => 'ok' as SendResult)
  const deps: ApiDeps = {
    store,
    send,
    vapidPublicKey: 'BPUBLICKEY',
    ownerToken: 'owner-secret',
    allowedOrigins: [ORIGIN],
    startedAt: T0,
    now: () => clock.now,
    log: () => undefined,
    ...over,
  }
  server = createServer(createApiHandler(deps))
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`
  const call = (path: string, init: RequestInit & { ip?: string } = {}) =>
    fetch(base + path, {
      ...init,
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': init.ip ?? '1.1.1.1', ...init.headers },
    })
  const post = (path: string, body: unknown, ip?: string) =>
    call(path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), ip })
  return { store, send, clock, call, post }
}

describe('API', () => {
  it('serves the VAPID public key', async () => {
    const { call } = await start()
    expect(await (await call('/api/push/key')).json()).toEqual({ ok: true, data: { publicKey: 'BPUBLICKEY' } })
  })

  it('subscribes, updating on a repeat, and only flags the owner with the right token', async () => {
    const { post, store } = await start()
    expect((await post('/api/push/subscribe', subscribeBody())).status).toBe(201)
    expect(store.listSubscriptions()).toEqual([
      { endpoint: APPLE, p256dh: P256DH, auth: AUTH, locale: 'en', isOwner: false },
    ])
    await post('/api/push/subscribe', subscribeBody(APPLE, { ownerToken: 'wrong-secret' }))
    expect(store.listSubscriptions()[0].isOwner).toBe(false)
    await post('/api/push/subscribe', subscribeBody(APPLE, { ownerToken: 'owner-secret' }))
    expect(store.listSubscriptions()[0].isOwner).toBe(true)
    expect(store.countSubscriptions()).toBe(1)
  })

  it('keeps a phone marked as the owner when the page re-registers it without a token', async () => {
    const { post, store } = await start()
    await post('/api/push/subscribe', subscribeBody())
    store.setOwner(APPLE, true) // what `main.cjs owner-newest` does
    await post('/api/push/subscribe', subscribeBody()) // next app launch, no token
    expect(store.listSubscriptions()[0].isOwner).toBe(true)
  })

  it('rejects a subscription to a non-push host', async () => {
    const { post, store } = await start()
    const res = await post('/api/push/subscribe', subscribeBody('https://evil.example/x'))
    expect(res.status).toBe(400)
    expect((await res.json()).ok).toBe(false)
    expect(store.countSubscriptions()).toBe(0)
  })

  it('refuses new subscriptions at 2 000 but still updates existing ones', async () => {
    const store = openStore(':memory:')
    const real = store.countSubscriptions.bind(store)
    const full: Store = { ...store, countSubscriptions: () => 2000 }
    const { post } = await start({ store: full })
    expect((await post('/api/push/subscribe', subscribeBody())).status).toBe(503)
    store.upsertSubscription({ endpoint: APPLE, p256dh: P256DH, auth: AUTH, locale: 'id', isOwner: false }, new Date())
    expect((await post('/api/push/subscribe', subscribeBody())).status).toBe(201)
    expect(real()).toBe(1)
  })

  it('unsubscribes, and says when the endpoint was unknown', async () => {
    const { post, store } = await start()
    await post('/api/push/subscribe', subscribeBody())
    expect((await post('/api/push/unsubscribe', { endpoint: APPLE })).status).toBe(200)
    expect(store.countSubscriptions()).toBe(0)
    expect((await post('/api/push/unsubscribe', { endpoint: APPLE })).status).toBe(404)
  })

  it('sends a test push to that one phone, at most once a minute', async () => {
    const { post, send, clock } = await start()
    await post('/api/push/subscribe', subscribeBody())
    expect((await post('/api/push/test', { endpoint: APPLE })).status).toBe(202)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toMatchObject({ title: 'Flood alert test', tag: 'banjir-test' })
    expect((await post('/api/push/test', { endpoint: APPLE })).status).toBe(429)
    clock.now += 60_000
    expect((await post('/api/push/test', { endpoint: APPLE })).status).toBe(202)
  })

  it('answers a test for an unknown phone with 404', async () => {
    const { post } = await start()
    expect((await post('/api/push/test', { endpoint: APPLE })).status).toBe(404)
  })

  it('removes a phone whose test push comes back gone', async () => {
    const { post, send, store } = await start()
    await post('/api/push/subscribe', subscribeBody())
    send.mockResolvedValueOnce('gone')
    expect((await post('/api/push/test', { endpoint: APPLE })).status).toBe(410)
    expect(store.countSubscriptions()).toBe(0)
  })

  it('reports status without the last error', async () => {
    const store = openStore(':memory:')
    store.saveState({
      ...INITIAL_SERVICE_STATE,
      lastRunAt: T0,
      lastRunOk: false,
      lastError: 'bpbd: HTTP 503 from https://bpbd.jakarta.go.id',
      lastReadingAt: T0 - 3_600_000,
      lastReadingSource: 'manual',
    })
    const { call } = await start({ store })
    expect(await (await call('/api/push/status')).json()).toEqual({
      ok: true,
      data: { lastRunAt: T0, lastRunOk: false, lastReadingAt: T0 - 3_600_000, lastReadingSource: 'manual', subscribers: 0 },
    })
  })

  it('is healthy while starting up or running, and not once the watcher stalls', async () => {
    const { call, clock, store } = await start()
    expect((await call('/healthz')).status).toBe(200) // fresh start, no run yet
    clock.now += 16 * 60_000
    expect((await call('/healthz')).status).toBe(503)
    store.saveState({ ...INITIAL_SERVICE_STATE, lastRunAt: clock.now - 60_000 })
    expect(await (await call('/healthz')).json()).toEqual({ ok: true })
  })

  it('answers CORS preflight for the page only', async () => {
    const { call } = await start()
    const allowed = await call('/api/push/subscribe', { method: 'OPTIONS', headers: { origin: ORIGIN } })
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(allowed.headers.get('access-control-allow-methods')).toContain('POST')
    const evil = await call('/api/push/subscribe', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuses bodies over 4 KB and bad JSON', async () => {
    const { post } = await start()
    expect((await post('/api/push/subscribe', 'x'.repeat(5000))).status).toBe(413)
    expect((await post('/api/push/subscribe', '{oops')).status).toBe(400)
  })

  it('rate-limits new phones per caller per minute', async () => {
    const { post } = await start()
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await post('/api/push/subscribe', subscribeBody(`${APPLE}${i}`), '9.9.9.9')).status)
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true)
    expect(statuses[10]).toBe(429)
    expect((await post('/api/push/subscribe', subscribeBody(`${APPLE}x`), '8.8.8.8')).status).toBe(201)
  })

  it('caps new phones per caller at 50 a day, so one address cannot fill the list', async () => {
    const { post, clock } = await start()
    const statuses: number[] = []
    for (let i = 0; i < 51; i++) {
      clock.now += 7_000 // under the per-minute limit
      statuses.push((await post('/api/push/subscribe', subscribeBody(`${APPLE}d${i}`), '6.6.6.6')).status)
    }
    expect(statuses.slice(0, 50).every((s) => s === 201)).toBe(true)
    expect(statuses[50]).toBe(429)
  })

  it('never rate-limits re-registering a phone it already has', async () => {
    // Every app launch re-registers; many residents can share one carrier IP.
    const { post } = await start()
    await post('/api/push/subscribe', subscribeBody(), '7.7.7.7')
    const statuses: number[] = []
    for (let i = 0; i < 15; i++) statuses.push((await post('/api/push/subscribe', subscribeBody(), '7.7.7.7')).status)
    expect(statuses.every((s) => s === 201)).toBe(true)
  })

  it('makes room when full by dropping phones that never received a push in 2 days', async () => {
    const store = openStore(':memory:')
    const old = new Date(T0 - 3 * 24 * 3_600_000)
    for (let i = 0; i < 2000; i++) {
      store.upsertSubscription({ endpoint: `${APPLE}junk${i}`, p256dh: P256DH, auth: AUTH, locale: 'id', isOwner: false }, old)
    }
    const { post } = await start({ store })
    expect((await post('/api/push/subscribe', subscribeBody())).status).toBe(201)
    expect(store.hasSubscription(APPLE)).toBe(true)
  })

  it('keeps phones that have received pushes, and refuses when those fill the list', async () => {
    const store = openStore(':memory:')
    const old = new Date(T0 - 3 * 24 * 3_600_000)
    for (let i = 0; i < 2000; i++) {
      const endpoint = `${APPLE}real${i}`
      store.upsertSubscription({ endpoint, p256dh: P256DH, auth: AUTH, locale: 'id', isOwner: false }, old)
      store.markDelivered(endpoint, old)
    }
    const { post } = await start({ store })
    expect((await post('/api/push/subscribe', subscribeBody())).status).toBe(503)
    expect(store.countSubscriptions()).toBe(2000)
  })

  it('answers unknown paths with 404', async () => {
    const { call } = await start()
    expect((await call('/nope')).status).toBe(404)
  })
})
