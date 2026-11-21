import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PushPayload } from './payload'
import { broadcast, createWebPushSender, type PushSender, type SendResult } from './sender'
import type { Subscription } from './store'

const sendNotification = vi.hoisted(() => vi.fn())
vi.mock('web-push', () => ({ default: { sendNotification }, sendNotification }))

const sub = (n: number, over: Partial<Subscription> = {}): Subscription => ({
  endpoint: `https://web.push.apple.com/device-${n}`,
  p256dh: `p256dh-secret-${n}`,
  auth: `auth-secret-${n}`,
  locale: 'id',
  isOwner: false,
  ...over,
})
const payload = (title: string): PushPayload => ({ title, body: 'b', tag: 't', url: '/?source=push' })
const VAPID = { publicKey: 'pub', privateKey: 'priv', subject: 'https://banjir.achmadnaufal.com' }

describe('broadcast', () => {
  it('delivers to every subscriber with its own locale', async () => {
    const seen: string[] = []
    const send: PushSender = async (s, p) => {
      seen.push(`${s.endpoint}:${p.title}`)
      return 'ok'
    }
    const subs = [sub(1), sub(2, { locale: 'en' })]
    const r = await broadcast(subs, (s) => payload(s.locale), send)
    expect(r.delivered).toEqual([subs[0].endpoint, subs[1].endpoint])
    expect(seen.sort()).toEqual([`${subs[0].endpoint}:id`, `${subs[1].endpoint}:en`])
  })

  it("one throwing and one 410 endpoint don't stop the rest", async () => {
    const results: Record<number, () => Promise<SendResult>> = {
      2: async () => 'gone',
      3: async () => {
        throw new Error('socket hang up')
      },
    }
    const send: PushSender = (s) => (results[Number(s.endpoint.split('-').pop())] ?? (async () => 'ok'))()
    const subs = [1, 2, 3, 4].map((n) => sub(n))
    const r = await broadcast(subs, () => payload('x'), send)
    expect(r.delivered).toEqual([subs[0].endpoint, subs[3].endpoint])
    expect(r.gone).toEqual([subs[1].endpoint])
    expect(r.failed).toEqual([subs[2].endpoint])
  })

  it('never runs more than the concurrency limit at once', async () => {
    let inFlight = 0
    let peak = 0
    const send: PushSender = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
      return 'ok'
    }
    const subs = Array.from({ length: 25 }, (_, i) => sub(i))
    const r = await broadcast(subs, () => payload('x'), send, 4)
    expect(r.delivered).toHaveLength(25)
    expect(peak).toBe(4)
  })
})

describe('createWebPushSender', () => {
  // Braces matter: a function returned from beforeEach runs as a teardown,
  // which would call the rejecting mock once more after each test.
  beforeEach(() => {
    sendNotification.mockReset()
  })

  it('sends the payload as JSON with VAPID, a 2 h TTL and high urgency', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 })
    const s = sub(1)
    expect(await createWebPushSender(VAPID, () => undefined)(s, payload('hi'))).toBe('ok')
    const [subscription, body, options] = sendNotification.mock.calls[0]
    expect(subscription).toEqual({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
    expect(JSON.parse(body)).toEqual(payload('hi'))
    expect(options).toMatchObject({ TTL: 7200, urgency: 'high', vapidDetails: VAPID })
    // A push service that never answers must not hang the watcher run forever.
    expect(options.timeout).toBe(10_000)
  })

  it.each([404, 410])('maps a %i from the push service to gone', async (statusCode) => {
    sendNotification.mockRejectedValue(Object.assign(new Error('expired'), { statusCode }))
    expect(await createWebPushSender(VAPID, () => undefined)(sub(1), payload('x'))).toBe('gone')
  })

  it('maps any other error to failed and logs it without the keys', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('Received unexpected response code'), { statusCode: 500 }))
    const log = vi.fn()
    expect(await createWebPushSender(VAPID, log)(sub(7), payload('x'))).toBe('failed')
    const line = String(log.mock.calls[0]?.[0])
    expect(line).toContain('web.push.apple.com')
    expect(line).toContain('500')
    expect(line).not.toContain('secret')
  })
})
