import { describe, expect, it, vi } from 'vitest'
import { UpstreamError } from '../types/upstream'
import { createAlertsApi, detectPushSupport, urlBase64ToUint8Array, type PushEnv } from './pushClient'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const env = (over: Partial<PushEnv>): PushEnv => ({
  userAgent: CHROME,
  maxTouchPoints: 0,
  standalone: false,
  hasPushManager: true,
  hasServiceWorker: true,
  ...over,
})

describe('detectPushSupport', () => {
  it('asks an iPhone in a Safari tab to add the page to the Home Screen first', () => {
    expect(detectPushSupport(env({ userAgent: IPHONE, hasPushManager: false }))).toBe('needs-install')
  })

  it('supports an iPhone home-screen app with push', () => {
    expect(detectPushSupport(env({ userAgent: IPHONE, standalone: true }))).toBe('supported')
  })

  it('treats iPadOS (which says Macintosh) with touch as iOS', () => {
    expect(detectPushSupport(env({ userAgent: IPADOS, maxTouchPoints: 5 }))).toBe('needs-install')
  })

  it('supports a desktop or Android browser with push', () => {
    expect(detectPushSupport(env({}))).toBe('supported')
  })

  it('is unsupported on a home-screen app without PushManager (iOS before 16.4)', () => {
    expect(detectPushSupport(env({ userAgent: IPHONE, standalone: true, hasPushManager: false }))).toBe('unsupported')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key to its 65 bytes', () => {
    const bytes = new Uint8Array(65).map((_, i) => (i * 37) % 256)
    const b64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(Array.from(urlBase64ToUint8Array(b64url))).toEqual(Array.from(bytes))
  })
})

describe('createAlertsApi', () => {
  const BASE = 'https://banjir-api.achmadnaufal.com'
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

  it('reads the public key and status', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith('/key')
        ? reply(200, { ok: true, data: { publicKey: 'BKEY' } })
        : reply(200, { ok: true, data: { lastRunAt: 1, lastRunOk: true, lastReadingAt: 2, lastReadingSource: 'manual', subscribers: 3 } }),
    )
    const api = createAlertsApi(BASE, fetchFn as unknown as typeof fetch)
    expect(await api.key()).toBe('BKEY')
    expect(await api.status()).toEqual({ lastRunAt: 1, lastRunOk: true, lastReadingAt: 2, lastReadingSource: 'manual', subscribers: 3 })
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual([`${BASE}/api/push/key`, `${BASE}/api/push/status`])
  })

  it('posts the subscription with locale and owner token as JSON', async () => {
    const fetchFn = vi.fn(async () => reply(201, { ok: true }))
    const api = createAlertsApi(BASE, fetchFn as unknown as typeof fetch)
    const sub = { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'p', auth: 'a' } }
    await api.subscribe(sub, 'id', 'tok')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/push/subscribe`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ subscription: sub, locale: 'id', ownerToken: 'tok' })
  })

  it('surfaces the server error as an UpstreamError', async () => {
    const api = createAlertsApi(BASE, (async () => reply(429, { ok: false, error: 'one test a minute' })) as unknown as typeof fetch)
    await expect(api.test('https://web.push.apple.com/x')).rejects.toMatchObject({
      kind: 'http',
      status: 429,
      message: 'one test a minute',
    })
  })

  it('treats turning off an unknown phone as done', async () => {
    const api = createAlertsApi(BASE, (async () => reply(404, { ok: false, error: 'not subscribed' })) as unknown as typeof fetch)
    await expect(api.unsubscribe('https://web.push.apple.com/x')).resolves.toBeUndefined()
  })

  it('reports a network failure as an UpstreamError', async () => {
    const api = createAlertsApi(BASE, (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch)
    await expect(api.key()).rejects.toBeInstanceOf(UpstreamError)
  })
})
