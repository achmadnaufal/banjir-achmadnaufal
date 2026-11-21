import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './ratelimit'
import { isAllowedPushEndpoint, parseEndpointBody, parseSubscribeBody } from './validate'

const P256DH = Buffer.alloc(65, 4).toString('base64url') // 87 chars, like a real key
const AUTH = Buffer.alloc(16, 9).toString('base64url') // 22 chars
const APPLE = 'https://web.push.apple.com/QGZ0bWFpbF9hZGRyZXNz'

const body = (over: Record<string, unknown> = {}, keys: Record<string, unknown> = {}) => ({
  subscription: { endpoint: APPLE, keys: { p256dh: P256DH, auth: AUTH, ...keys } },
  locale: 'en',
  ...over,
})

describe('isAllowedPushEndpoint', () => {
  it.each([
    APPLE,
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=AQE',
  ])('allows %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true)
  })

  it.each([
    'http://web.push.apple.com/abc',
    'https://web.push.apple.com.evil.com/abc',
    'https://evil.com/web.push.apple.com',
    'https://169.254.169.254/latest/meta-data',
    'https://notify.windows.com.evil.io/x',
    'https://notify.windows.com/x',
    'https://user:pass@web.push.apple.com/abc',
    'https://web.push.apple.com:8443/abc',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false)
  })
})

describe('parseSubscribeBody', () => {
  it('accepts a real-shaped subscription', () => {
    expect(parseSubscribeBody(body({ ownerToken: 'tok' }))).toEqual({
      subscription: { endpoint: APPLE, keys: { p256dh: P256DH, auth: AUTH } },
      locale: 'en',
      ownerToken: 'tok',
    })
  })

  it('defaults a missing or unknown locale to Indonesian and the owner token to null', () => {
    expect(parseSubscribeBody(body({ locale: 'fr' }))).toMatchObject({ locale: 'id', ownerToken: null })
    expect(parseSubscribeBody(body({ locale: undefined }))).toMatchObject({ locale: 'id' })
  })

  it.each([
    ['a foreign endpoint', body({ subscription: { endpoint: 'https://evil.com/x', keys: { p256dh: P256DH, auth: AUTH } } })],
    ['a short p256dh key', body({}, { p256dh: Buffer.alloc(64).toString('base64url') })],
    ['a short auth key', body({}, { auth: Buffer.alloc(8).toString('base64url') })],
    ['a non-base64url key', body({}, { auth: '!!!!!!!!!!!!!!!!!!!!!!' })],
    ['missing keys', { subscription: { endpoint: APPLE }, locale: 'id' }],
    ['no subscription', { locale: 'id' }],
    ['a non-object', 'hello'],
    ['an over-long owner token', body({ ownerToken: 'x'.repeat(200) })],
  ])('rejects %s', (_label, raw) => {
    expect(parseSubscribeBody(raw)).toHaveProperty('error')
  })
})

describe('parseEndpointBody', () => {
  it('accepts an allowed endpoint and rejects anything else', () => {
    expect(parseEndpointBody({ endpoint: APPLE })).toEqual({ endpoint: APPLE })
    expect(parseEndpointBody({ endpoint: 'https://evil.com/x' })).toHaveProperty('error')
    expect(parseEndpointBody({})).toHaveProperty('error')
  })
})

describe('createRateLimiter', () => {
  it('allows the capacity, refuses the next, and refills over the period', () => {
    const limiter = createRateLimiter({ capacity: 10, refillEveryMs: 60_000 })
    const takes = Array.from({ length: 11 }, () => limiter.take('1.2.3.4', 0))
    expect(takes.filter(Boolean)).toHaveLength(10)
    expect(takes[10]).toBe(false)
    expect(limiter.take('5.6.7.8', 0)).toBe(true) // other callers are unaffected
    expect(limiter.take('1.2.3.4', 6_000)).toBe(true) // one token back after a tenth of the period
    expect(limiter.take('1.2.3.4', 6_000)).toBe(false)
    expect(Array.from({ length: 10 }, () => limiter.take('1.2.3.4', 200_000)).every(Boolean)).toBe(true)
  })

  it('allows one per period at capacity 1', () => {
    const limiter = createRateLimiter({ capacity: 1, refillEveryMs: 60_000 })
    expect([limiter.take('e', 0), limiter.take('e', 59_000), limiter.take('e', 60_000)]).toEqual([true, false, true])
  })
})
