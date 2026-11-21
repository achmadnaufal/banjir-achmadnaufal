import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_TOKEN_KEY, SERVICE_STATUS_POLL_MS, SW_READY_TIMEOUT_MS } from '../config/alerts'
import type { AlertsApi, PushEnv, ServiceStatus } from '../lib/pushClient'
import { usePushAlerts } from './usePushAlerts'

const KEY = btoa(String.fromCharCode(...new Uint8Array(65).fill(4))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const STATUS: ServiceStatus = { lastRunAt: 1, lastRunOk: true, lastReadingAt: 2, lastReadingSource: 'manual', subscribers: 1 }
const SUPPORTED: PushEnv = { userAgent: 'Chrome', maxTouchPoints: 0, standalone: true, hasPushManager: true, hasServiceWorker: true }
const IPHONE_TAB: PushEnv = { userAgent: 'iPhone', maxTouchPoints: 5, standalone: false, hasPushManager: false, hasServiceWorker: true }

function fakeSub(endpoint = 'https://web.push.apple.com/me') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  }
}

function fakeRegistration(existing: ReturnType<typeof fakeSub> | null) {
  let current = existing
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn<(opts: PushSubscriptionOptionsInit) => Promise<ReturnType<typeof fakeSub>>>(async () => {
      current = fakeSub()
      return current
    }),
  }
  return { registration: async () => ({ pushManager }) as unknown as ServiceWorkerRegistration, pushManager }
}

function fakeApi() {
  return {
    key: vi.fn(async () => KEY),
    subscribe: vi.fn(async () => undefined),
    unsubscribe: vi.fn(async () => undefined),
    test: vi.fn(async () => undefined),
    status: vi.fn(async () => STATUS),
  } satisfies AlertsApi
}

/** Like the browser: answering the prompt updates Notification.permission. */
function stubNotification(permission: NotificationPermission, answer: NotificationPermission = 'granted') {
  const stub = {
    permission,
    requestPermission: vi.fn(async () => {
      stub.permission = answer
      return answer
    }),
  }
  vi.stubGlobal('Notification', stub)
  return stub.requestPermission
}

const stableApi = fakeApi()

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

describe('usePushAlerts', () => {
  it('asks permission, subscribes with the server key and registers with the server', async () => {
    const requestPermission = stubNotification('default')
    const api = fakeApi()
    const { registration, pushManager } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('off'))

    await act(() => result.current.enable())

    expect(requestPermission).toHaveBeenCalled()
    const opts = pushManager.subscribe.mock.calls[0][0]
    expect(opts.userVisibleOnly).toBe(true)
    expect((opts.applicationServerKey as Uint8Array).length).toBe(65)
    expect(api.subscribe).toHaveBeenCalledWith(fakeSub().toJSON(), 'id', null)
    expect(result.current.view).toBe('on')
  })

  it('re-registers an existing browser subscription on load', async () => {
    stubNotification('granted')
    const api = fakeApi()
    const { registration } = fakeRegistration(fakeSub())
    const { result } = renderHook(() => usePushAlerts('en', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('on'))
    expect(api.subscribe).toHaveBeenCalledWith(fakeSub().toJSON(), 'en', null)
  })

  it('shows denied when permission is refused', async () => {
    stubNotification('default', 'denied')
    const api = fakeApi()
    const { registration } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('off'))
    await act(() => result.current.enable())
    expect(result.current.view).toBe('denied')
  })

  it('shows denied on load when notifications were blocked earlier', async () => {
    stubNotification('denied')
    const api = fakeApi()
    const { registration } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('denied'))
  })

  it('turns off in the browser and on the server', async () => {
    stubNotification('granted')
    const api = fakeApi()
    const sub = fakeSub()
    const { registration } = fakeRegistration(sub)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('on'))
    await act(() => result.current.disable())
    expect(api.unsubscribe).toHaveBeenCalledWith(sub.endpoint)
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(result.current.view).toBe('off')
  })

  it('sends a test to this phone', async () => {
    stubNotification('granted')
    const api = fakeApi()
    const { registration } = fakeRegistration(fakeSub())
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('on'))
    await act(() => result.current.sendTest())
    expect(api.test).toHaveBeenCalledWith('https://web.push.apple.com/me')
  })

  it('keeps alerts off and reports the error when the server refuses', async () => {
    stubNotification('default')
    const api = { ...fakeApi(), subscribe: vi.fn(async () => Promise.reject(new Error('subscriptions full'))) }
    const { registration } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('off'))
    await act(() => result.current.enable())
    expect(result.current.view).toBe('off')
    expect(result.current.error).toBe('subscriptions full')
  })

  it('reads ?owner=<token> once, stores it, and removes it from the address bar', async () => {
    stubNotification('default')
    window.history.replaceState(null, '', '/?owner=tok123&source=pwa')
    const api = fakeApi()
    const { registration } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.view).toBe('off'))
    expect(localStorage.getItem(OWNER_TOKEN_KEY)).toBe('tok123')
    expect(window.location.search).toBe('?source=pwa')
    await act(() => result.current.enable())
    expect(api.subscribe).toHaveBeenCalledWith(expect.anything(), 'id', 'tok123')
  })

  it('asks an iPhone Safari tab to install first, without touching push', async () => {
    const api = fakeApi()
    const { registration, pushManager } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: IPHONE_TAB, registration }))
    expect(result.current.view).toBe('needs-install')
    await act(async () => undefined)
    expect(pushManager.getSubscription).not.toHaveBeenCalled()
  })

  it('stops waiting for a service worker that never starts, and says so', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    stubNotification('default')
    const never = () => new Promise<ServiceWorkerRegistration>(() => undefined)
    const { result } = renderHook(() => usePushAlerts('id', { api: stableApi, env: SUPPORTED, registration: never }))
    expect(result.current.view).toBe('working')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SW_READY_TIMEOUT_MS)
    })
    expect(result.current.view).toBe('off')
    expect(result.current.error).toMatch(/setting up/)
  })

  it('reports the service as unreachable when its status cannot be read', async () => {
    stubNotification('default')
    const api = { ...fakeApi(), status: vi.fn(async () => Promise.reject(new Error('offline'))) }
    const { registration } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    await waitFor(() => expect(result.current.serviceUnreachable).toBe(true))
    expect(result.current.service).toBeNull()
  })

  it('reads the service status now and every 5 minutes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    stubNotification('default')
    const api = fakeApi()
    const { registration } = fakeRegistration(null)
    const { result } = renderHook(() => usePushAlerts('id', { api, env: SUPPORTED, registration }))
    // waitFor polls with setInterval, which is faked here; flush with act instead.
    await act(async () => undefined)
    expect(result.current.service).toEqual(STATUS)
    expect(api.status).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(SERVICE_STATUS_POLL_MS)
    })
    expect(api.status).toHaveBeenCalledTimes(2)
  })
})
