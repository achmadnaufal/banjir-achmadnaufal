import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PushPayload } from './payload'
import type { PushSender, SendResult } from './sender'
import { INITIAL_SERVICE_STATE, openStore, type Store, type Subscription } from './store'
import { OWNER_REPEAT_MS, ownerAlertDue, runOnce, startWatcher, watchdogDue, WATCHDOG_MS, type WatcherDeps } from './watcher'

const BPBD = readFileSync(resolve(__dirname, '../../app/src/test/fixtures/bpbd-charttma.json'), 'utf8')
const at = (iso: string) => new Date(iso)
const NOW = at('2026-11-21T19:55:00+07:00')

const sub = (n: number, over: Partial<Subscription> = {}): Subscription => ({
  endpoint: `https://web.push.apple.com/device-${n}`,
  p256dh: 'p'.repeat(87),
  auth: 'a'.repeat(22),
  locale: 'id',
  isOwner: false,
  ...over,
})

function upstream(bpbd: () => Response) {
  return vi.fn(async (input: string | URL | Request) =>
    String(input).includes('charttma') ? bpbd() : new Response('', { status: 200 }),
  ) as unknown as typeof fetch
}
const live = () => upstream(() => new Response(BPBD, { status: 200 }))
const down = () => upstream(() => new Response('down', { status: 503 }))

function recordingSender(results: Record<string, SendResult> = {}) {
  const sent: Array<{ endpoint: string; payload: PushPayload }> = []
  const send: PushSender = async (s, payload) => {
    sent.push({ endpoint: s.endpoint, payload })
    return results[s.endpoint] ?? 'ok'
  }
  return { send, sent }
}

function deps(store: Store, fetchFn: typeof fetch, send: PushSender): WatcherDeps {
  return { store, fetchFn, send, log: () => undefined }
}

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  vi.useRealTimers()
})

describe('runOnce', () => {
  it('pushes to all subscribers on the first WASPADA reading and drops dead ones', async () => {
    const store = openStore(':memory:')
    for (const n of [1, 2, 3]) store.upsertSubscription(sub(n), NOW)
    const { send, sent } = recordingSender({ [sub(2).endpoint]: 'gone' })

    const state = await runOnce(deps(store, live(), send), NOW)

    expect(sent.map((s) => s.payload.title)).toEqual(Array(3).fill('WASPADA · 200 cm ▲ naik'))
    expect(store.hasSubscription(sub(2).endpoint)).toBe(false)
    expect(store.countSubscriptions()).toBe(2)
    expect(state).toMatchObject({ lastRunOk: true, lastReadingSource: 'manual', failingSince: null })
    expect(state.alert.lastBandAnnounced).toBe('siaga3')
  })

  it('does not push the same reading twice across a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'banjir-watcher-'))
    dirs.push(dir)
    const path = join(dir, 'alerts.sqlite3')
    const { send, sent } = recordingSender()

    const first = openStore(path)
    first.upsertSubscription(sub(1), NOW)
    await runOnce(deps(first, live(), send), NOW)
    first.close()

    const second = openStore(path)
    await runOnce(deps(second, live(), send), new Date(NOW.getTime() + 5 * 60_000))
    second.close()

    expect(sent).toHaveLength(1)
  })

  it('records a failing run, and a later good run clears it', async () => {
    const store = openStore(':memory:')
    const { send } = recordingSender()
    const failed = await runOnce(deps(store, down(), send), NOW)
    expect(failed.lastRunOk).toBe(false)
    expect(failed.failingSince).toBe(NOW.getTime())
    expect(failed.lastError).toContain('bpbd')

    const later = new Date(NOW.getTime() + 10 * 60_000)
    const stillFailing = await runOnce(deps(store, down(), send), later)
    expect(stillFailing.failingSince).toBe(NOW.getTime())

    const ok = await runOnce(deps(store, live(), send), new Date(later.getTime() + 5 * 60_000))
    expect(ok).toMatchObject({ lastRunOk: true, failingSince: null, lastError: null })
  })

  it('alerts only the owner after 61 min of failures, then not again for 6 h', async () => {
    const store = openStore(':memory:')
    store.upsertSubscription(sub(1), NOW)
    store.upsertSubscription(sub(9, { isOwner: true, locale: 'en' }), NOW)
    const { send, sent } = recordingSender()
    const d = deps(store, down(), send)

    await runOnce(d, NOW)
    await runOnce(d, new Date(NOW.getTime() + 60 * 60_000))
    expect(sent).toHaveLength(0)

    await runOnce(d, new Date(NOW.getTime() + 61 * 60_000))
    expect(sent).toEqual([
      { endpoint: sub(9).endpoint, payload: expect.objectContaining({ title: "Flood alerts can't read the river" }) },
    ])

    await runOnce(d, new Date(NOW.getTime() + (61 + 60) * 60_000))
    expect(sent).toHaveLength(1)
  })

  it('alerts the owner when the newest reading is over 3 h old even though fetches succeed', async () => {
    const store = openStore(':memory:')
    store.upsertSubscription(sub(9, { isOwner: true }), NOW)
    const { send, sent } = recordingSender()
    // BPBD answers, but its newest hour is 19:00 and it is now 22:05.
    await runOnce(deps(store, live(), send), at('2026-11-21T22:05:00+07:00'))
    expect(sent.map((s) => s.payload.tag)).toEqual(['banjir-owner'])
  })

  it('records an unexpected throw instead of raising it', async () => {
    const store = openStore(':memory:')
    const broken: Store = {
      ...store,
      listSubscriptions: () => {
        throw new Error('disk I/O error')
      },
    }
    const { send } = recordingSender()
    const state = await runOnce(deps(broken, live(), send), NOW)
    expect(state).toMatchObject({ lastRunOk: false, lastError: 'disk I/O error' })
    expect(store.getState().lastError).toBe('disk I/O error')
  })
})

describe('ownerAlertDue', () => {
  const base = { ...INITIAL_SERVICE_STATE, lastReadingAt: NOW.getTime() }
  it('is not due while healthy', () => {
    expect(ownerAlertDue(base, NOW)).toBe(false)
  })
  it('repeats only after 6 h', () => {
    const failing = { ...base, failingSince: NOW.getTime() - 2 * 3_600_000, lastOwnerAlertAt: NOW.getTime() }
    expect(ownerAlertDue(failing, new Date(NOW.getTime() + OWNER_REPEAT_MS - 1))).toBe(false)
    expect(ownerAlertDue(failing, new Date(NOW.getTime() + OWNER_REPEAT_MS))).toBe(true)
  })
})

describe('startWatcher', () => {
  it('runs at once, then every interval, and skips a tick while a run is still going', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const store = openStore(':memory:')
    let release: () => void = () => undefined
    const hanging = vi.fn(
      () => new Promise<Response>((r) => (release = () => r(new Response('', { status: 200 })))),
    ) as unknown as typeof fetch
    const watcher = startWatcher(deps(store, hanging, recordingSender().send), 60_000)

    await vi.advanceTimersByTimeAsync(0)
    expect(hanging).toHaveBeenCalledTimes(2) // DSDA + BPBD of the first run
    await vi.advanceTimersByTimeAsync(60_000)
    expect(hanging).toHaveBeenCalledTimes(2) // first run still in flight: tick skipped

    release()
    await vi.advanceTimersByTimeAsync(60_000)
    expect((hanging as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(2)
    watcher.stop()
  })
})

describe('watchdogDue', () => {
  const started = NOW.getTime()
  it('gives a fresh process 15 minutes for its first run', () => {
    expect(watchdogDue(null, started, started + WATCHDOG_MS - 1)).toBe(false)
    expect(watchdogDue(null, started, started + WATCHDOG_MS + 1)).toBe(true)
  })
  it('fires once the last completed run is over 15 minutes old', () => {
    const last = started + 60_000
    expect(watchdogDue(last, started, last + WATCHDOG_MS - 1)).toBe(false)
    expect(watchdogDue(last, started, last + WATCHDOG_MS + 1)).toBe(true)
  })
})
