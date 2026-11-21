import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const SCRIPT = readFileSync(resolve(__dirname, '../../public/push-sw.js'), 'utf8')

type Listener = (event: unknown) => void

/** Loads public/push-sw.js into a fake service-worker global. */
function loadSw(openWindows: Array<{ focus: () => Promise<unknown> }> = []) {
  const listeners: Record<string, Listener> = {}
  const showNotification = vi.fn<(title: string, options: Record<string, unknown>) => Promise<undefined>>(
    async () => undefined,
  )
  const clients = {
    matchAll: vi.fn(async () => openWindows),
    openWindow: vi.fn<(url: string) => Promise<null>>(async () => null),
  }
  const self = {
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn
    },
    registration: { showNotification },
    clients,
  }
  runInNewContext(SCRIPT, { self })
  return { listeners, showNotification, clients }
}

function pushEvent(raw: string | null) {
  const waits: Promise<unknown>[] = []
  return {
    event: {
      data: raw === null ? null : { json: () => JSON.parse(raw), text: () => raw },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    },
    done: () => Promise.all(waits),
  }
}

describe('push-sw.js', () => {
  it("shows the payload's title, body and tag with the PNG icon and the click URL", async () => {
    const { listeners, showNotification } = loadSw()
    const { event, done } = pushEvent(
      JSON.stringify({ title: 'WASPADA · 200 cm ▲ naik', body: 'Pos Pesanggrahan, 19:00', tag: 'banjir-siaga3', url: '/?source=push' }),
    )
    listeners.push(event)
    await done()
    expect(showNotification).toHaveBeenCalledWith('WASPADA · 200 cm ▲ naik', {
      body: 'Pos Pesanggrahan, 19:00',
      tag: 'banjir-siaga3',
      renotify: true,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: '/?source=push' },
    })
  })

  it.each([
    ['no data', null],
    ['data that is not JSON', 'not json'],
    ['JSON without a title', '{"body":"x"}'],
  ])('still shows a notification for %s (iOS revokes silent pushes)', async (_label, raw) => {
    const { listeners, showNotification } = loadSw()
    const { event, done } = pushEvent(raw)
    listeners.push(event)
    await done()
    expect(showNotification).toHaveBeenCalledTimes(1)
    expect(showNotification.mock.calls[0][0]).toBe('Monitor Banjir')
  })

  it('focuses an open window when the notification is tapped', async () => {
    const win = { focus: vi.fn(async () => win) }
    const { listeners, clients } = loadSw([win])
    const close = vi.fn()
    const waits: Promise<unknown>[] = []
    listeners.notificationclick({
      notification: { close, data: { url: '/?source=push' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(close).toHaveBeenCalled()
    expect(win.focus).toHaveBeenCalled()
    expect(clients.openWindow).not.toHaveBeenCalled()
  })

  it('opens the page when no window is open', async () => {
    const { listeners, clients } = loadSw([])
    const waits: Promise<unknown>[] = []
    listeners.notificationclick({
      notification: { close: () => undefined, data: { url: '/?source=push' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(clients.openWindow).toHaveBeenCalledWith('/?source=push')
  })
})
