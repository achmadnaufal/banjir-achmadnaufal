import type { Locale } from '../i18n/locale'
import { UpstreamError } from '../types/upstream'

/**
 * Talking to the closed-page alerts service, and working out whether this
 * browser can receive Web Push at all. On iPhone that needs the page added
 * to the Home Screen (iOS 16.4+); a Safari tab or bookmark cannot.
 */

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

export type PushEnv = {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
  hasPushManager: boolean
  hasServiceWorker: boolean
}

export function readPushEnv(): PushEnv {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true,
    hasPushManager: 'PushManager' in window,
    hasServiceWorker: 'serviceWorker' in nav,
  }
}

function isIos(env: PushEnv): boolean {
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
}

export function detectPushSupport(env: PushEnv): PushSupport {
  if (isIos(env) && !env.standalone) return 'needs-install'
  return env.hasServiceWorker && env.hasPushManager ? 'supported' : 'unsupported'
}

export function urlBase64ToUint8Array(s: string): Uint8Array<ArrayBuffer> {
  const padded = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export type ServiceStatus = {
  lastRunAt: number | null
  lastRunOk: boolean
  lastReadingAt: number | null
  lastReadingSource: 'sensor' | 'manual' | null
  subscribers: number
}

export type AlertsApi = {
  key(): Promise<string>
  subscribe(sub: PushSubscriptionJSON, locale: Locale, ownerToken: string | null): Promise<void>
  unsubscribe(endpoint: string): Promise<void>
  test(endpoint: string): Promise<void>
  status(): Promise<ServiceStatus>
}

type Envelope<T> = { ok: boolean; data?: T; error?: string }

export function createAlertsApi(base: string, fetchFn: typeof fetch = fetch): AlertsApi {
  const call = async <T>(path: string, body?: unknown): Promise<{ status: number; env: Envelope<T> }> => {
    let res: Response
    try {
      res = await fetchFn(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (err) {
      throw new UpstreamError('network', `Can't reach the alerts service: ${err instanceof Error ? err.message : String(err)}`)
    }
    const env = (await res.json().catch(() => ({ ok: false }))) as Envelope<T>
    return { status: res.status, env }
  }
  const expectOk = async <T>(path: string, body?: unknown): Promise<T> => {
    const { status, env } = await call<T>(path, body)
    if (status >= 300 || !env.ok) throw new UpstreamError('http', env.error ?? `HTTP ${status}`, status)
    return env.data as T
  }

  return {
    key: async () => (await expectOk<{ publicKey: string }>('/api/push/key')).publicKey,
    subscribe: async (subscription, locale, ownerToken) => {
      await expectOk('/api/push/subscribe', { subscription, locale, ownerToken })
    },
    unsubscribe: async (endpoint) => {
      const { status, env } = await call('/api/push/unsubscribe', { endpoint })
      // Already gone on the server is what turning off wants.
      if (status === 404) return
      if (status >= 300 || !env.ok) throw new UpstreamError('http', env.error ?? `HTTP ${status}`, status)
    },
    test: async (endpoint) => {
      await expectOk('/api/push/test', { endpoint })
    },
    status: () => expectOk<ServiceStatus>('/api/push/status'),
  }
}
