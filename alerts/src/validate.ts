import type { Locale } from './payload'

/**
 * Only real browser push services may be stored as endpoints — the server
 * POSTs to every stored endpoint, so anything else would make it an open relay.
 */
const PUSH_HOSTS = new Set(['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'])
const WINDOWS_SUFFIX = '.notify.windows.com'
const MAX_ENDPOINT_LENGTH = 2048
const MAX_OWNER_TOKEN_LENGTH = 128
const P256DH_BYTES = 65
const AUTH_BYTES = 16
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

export type SubscribeRequest = {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  locale: Locale
  ownerToken: string | null
}

type Invalid = { error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isAllowedPushEndpoint(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.username !== '' || u.password !== '' || u.port !== '') return false
  const host = u.hostname.toLowerCase()
  return PUSH_HOSTS.has(host) || (host.endsWith(WINDOWS_SUFFIX) && host.length > WINDOWS_SUFFIX.length)
}

function isKey(v: unknown, bytes: number): v is string {
  return typeof v === 'string' && BASE64URL.test(v) && Buffer.from(v, 'base64url').length === bytes
}

function parseEndpoint(v: unknown): string | null {
  return typeof v === 'string' && v.length <= MAX_ENDPOINT_LENGTH && isAllowedPushEndpoint(v) ? v : null
}

export function parseSubscribeBody(raw: unknown): SubscribeRequest | Invalid {
  if (!isRecord(raw) || !isRecord(raw.subscription)) return { error: 'subscription missing' }
  const endpoint = parseEndpoint(raw.subscription.endpoint)
  if (endpoint === null) return { error: 'endpoint is not a known push service' }
  const keys = raw.subscription.keys
  if (!isRecord(keys) || !isKey(keys.p256dh, P256DH_BYTES) || !isKey(keys.auth, AUTH_BYTES)) {
    return { error: 'subscription keys are invalid' }
  }
  const token = raw.ownerToken
  if (token !== undefined && token !== null && (typeof token !== 'string' || token.length > MAX_OWNER_TOKEN_LENGTH)) {
    return { error: 'owner token is invalid' }
  }
  return {
    subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    locale: raw.locale === 'en' ? 'en' : 'id',
    ownerToken: typeof token === 'string' ? token : null,
  }
}

export function parseEndpointBody(raw: unknown): { endpoint: string } | Invalid {
  const endpoint = isRecord(raw) ? parseEndpoint(raw.endpoint) : null
  return endpoint === null ? { error: 'endpoint is not a known push service' } : { endpoint }
}
