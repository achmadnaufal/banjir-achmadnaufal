import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALERTS_API_BASE, OWNER_TOKEN_KEY, SERVICE_STATUS_POLL_MS } from '../config/alerts'
import type { Locale } from '../i18n/locale'
import {
  createAlertsApi,
  detectPushSupport,
  readPushEnv,
  urlBase64ToUint8Array,
  type AlertsApi,
  type PushEnv,
  type ServiceStatus,
} from '../lib/pushClient'

/**
 * Closed-page alerts for this phone: whether it can have them, turning them
 * on and off, a test push, and how the alert service is doing.
 */

export type PushAlertsView = 'needs-install' | 'unsupported' | 'off' | 'on' | 'denied' | 'working'

export type PushAlertsDeps = {
  api?: AlertsApi
  env?: PushEnv
  registration?: () => Promise<ServiceWorkerRegistration>
}

export type PushAlertsState = {
  view: PushAlertsView
  error: string | null
  service: ServiceStatus | null
  enable(): Promise<void>
  disable(): Promise<void>
  /** Resolves true once the server has sent the test push. */
  sendTest(): Promise<boolean>
}

const defaultRegistration = () => navigator.serviceWorker.ready

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function notificationPermission(): NotificationPermission {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission
}

function readOwnerToken(): string | null {
  try {
    return localStorage.getItem(OWNER_TOKEN_KEY)
  } catch {
    return null
  }
}

/** ?owner=<token> marks this phone as the owner's; keep it, then drop it from the address bar. */
function captureOwnerToken(): void {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('owner')
  if (!token) return
  try {
    localStorage.setItem(OWNER_TOKEN_KEY, token)
  } catch {
    // Blocked storage: the phone just isn't marked as the owner's.
  }
  url.searchParams.delete('owner')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function usePushAlerts(locale: Locale, deps: PushAlertsDeps = {}): PushAlertsState {
  const api = useMemo(() => deps.api ?? createAlertsApi(ALERTS_API_BASE), [deps.api])
  const support = useMemo(() => detectPushSupport(deps.env ?? readPushEnv()), [deps.env])
  const registration = deps.registration ?? defaultRegistration
  const [view, setView] = useState<PushAlertsView>(support === 'supported' ? 'working' : support)
  const [error, setError] = useState<string | null>(null)
  const [service, setService] = useState<ServiceStatus | null>(null)

  useEffect(captureOwnerToken, [])

  // Re-register an existing subscription on every load: the server may have
  // lost it (rebuilt VPS) while the phone still believes alerts are on.
  useEffect(() => {
    if (support !== 'supported') return
    let cancelled = false
    void (async () => {
      try {
        const sub = await (await registration()).pushManager.getSubscription()
        if (cancelled) return
        if (sub === null) {
          setView(notificationPermission() === 'denied' ? 'denied' : 'off')
          return
        }
        setView('on')
        await api.subscribe(sub.toJSON(), locale, readOwnerToken())
      } catch (err) {
        if (cancelled) return
        setError(messageOf(err))
        setView((v) => (v === 'working' ? 'off' : v))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [support, locale, api, registration])

  // Status failures leave the last known status in place; the panel turns
  // its "checked N min ago" line into a warning once that goes stale.
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      api.status().then(
        (s) => !cancelled && setService(s),
        () => undefined,
      )
    }
    refresh()
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') refresh()
    }, SERVICE_STATUS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [api])

  const enable = useCallback(async () => {
    setError(null)
    setView('working')
    try {
      // First await: iOS only shows the prompt straight from the user's tap.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setView(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const { pushManager } = await registration()
      const key = await api.key()
      const sub =
        (await pushManager.getSubscription()) ??
        (await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
      await api.subscribe(sub.toJSON(), locale, readOwnerToken())
      setView('on')
    } catch (err) {
      setError(messageOf(err))
      setView('off')
    }
  }, [api, locale, registration])

  const disable = useCallback(async () => {
    setError(null)
    setView('working')
    try {
      const sub = await (await registration()).pushManager.getSubscription()
      if (sub !== null) {
        // If the server can't be told, its next push gets a 410 and drops the phone.
        await api.unsubscribe(sub.endpoint).catch(() => undefined)
        await sub.unsubscribe()
      }
      setView('off')
    } catch (err) {
      setError(messageOf(err))
      setView('on')
    }
  }, [api, registration])

  const sendTest = useCallback(async () => {
    setError(null)
    try {
      const sub = await (await registration()).pushManager.getSubscription()
      if (sub === null) throw new Error('This phone is not subscribed')
      await api.test(sub.endpoint)
      return true
    } catch (err) {
      setError(messageOf(err))
      return false
    }
  }, [api, registration])

  return { view, error, service, enable, disable, sendTest }
}
