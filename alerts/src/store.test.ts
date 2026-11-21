import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { INITIAL_SERVICE_STATE, openStore, type ServiceState, type Subscription } from './store'

const SUB: Subscription = {
  endpoint: 'https://web.push.apple.com/QWERTY',
  p256dh: 'p'.repeat(87),
  auth: 'a'.repeat(22),
  locale: 'id',
  isOwner: false,
}
const NOW = new Date('2026-11-21T19:55:00+07:00')

const STATE: ServiceState = {
  alert: {
    lastBandAnnounced: 'siaga3',
    lastPushAt: 1,
    lastPushedReadingAt: 2,
    lastSeenReadingAt: 3,
    belowCount: 1,
  },
  bpbdTable: {
    points: [{ at: new Date('2026-11-21T19:00:00+07:00'), cm: 200 }],
    thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
  },
  lastRunAt: 10,
  lastRunOk: true,
  lastError: null,
  failingSince: null,
  lastOwnerAlertAt: 20,
  lastReadingAt: 30,
  lastReadingSource: 'manual',
}

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('openStore', () => {
  it('starts from the initial state on an empty database', () => {
    expect(openStore(':memory:').getState()).toEqual(INITIAL_SERVICE_STATE)
  })

  it('round-trips the state, BPBD table dates included', () => {
    const store = openStore(':memory:')
    store.saveState(STATE)
    expect(store.getState()).toEqual(STATE)
  })

  it('keeps one row per endpoint and updates locale and owner on re-subscribe', () => {
    const store = openStore(':memory:')
    store.upsertSubscription(SUB, NOW)
    store.upsertSubscription({ ...SUB, locale: 'en', isOwner: true }, NOW)
    expect(store.countSubscriptions()).toBe(1)
    expect(store.listSubscriptions()).toEqual([{ ...SUB, locale: 'en', isOwner: true }])
  })

  it('lists subscriptions without timestamps or anything else', () => {
    const store = openStore(':memory:')
    store.upsertSubscription(SUB, NOW)
    store.markDelivered(SUB.endpoint, NOW)
    expect(Object.keys(store.listSubscriptions()[0]).sort()).toEqual(
      ['auth', 'endpoint', 'isOwner', 'locale', 'p256dh'],
    )
  })

  it('deletes by endpoint and says whether it existed', () => {
    const store = openStore(':memory:')
    store.upsertSubscription(SUB, NOW)
    expect(store.hasSubscription(SUB.endpoint)).toBe(true)
    expect(store.deleteSubscription(SUB.endpoint)).toBe(true)
    expect(store.deleteSubscription(SUB.endpoint)).toBe(false)
    expect(store.hasSubscription(SUB.endpoint)).toBe(false)
  })

  it('finds the newest subscription and can mark it as the owner', () => {
    const store = openStore(':memory:')
    expect(store.newestSubscription()).toBeNull()
    store.upsertSubscription(SUB, new Date('2026-11-21T20:00:00+07:00'))
    const phone = { ...SUB, endpoint: 'https://web.push.apple.com/NEWEST' }
    store.upsertSubscription(phone, new Date('2026-11-21T20:05:00+07:00'))
    expect(store.newestSubscription()).toEqual({
      endpoint: phone.endpoint,
      createdAt: new Date('2026-11-21T20:05:00+07:00').getTime(),
    })
    expect(store.setOwner(phone.endpoint, true)).toBe(true)
    expect(store.listSubscriptions().find((s) => s.endpoint === phone.endpoint)?.isOwner).toBe(true)
    expect(store.listSubscriptions().find((s) => s.endpoint === SUB.endpoint)?.isOwner).toBe(false)
    expect(store.setOwner('https://web.push.apple.com/unknown', true)).toBe(false)
  })

  it('ignores markDelivered for an unknown endpoint', () => {
    const store = openStore(':memory:')
    store.markDelivered('https://web.push.apple.com/gone', NOW)
    expect(store.countSubscriptions()).toBe(0)
  })

  it('survives a restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'banjir-alerts-'))
    dirs.push(dir)
    const path = join(dir, 'alerts.sqlite3')
    const first = openStore(path)
    first.saveState(STATE)
    first.upsertSubscription(SUB, NOW)
    first.close()

    const second = openStore(path)
    expect(second.getState()).toEqual(STATE)
    expect(second.listSubscriptions()).toEqual([SUB])
    second.close()
  })

  it('falls back to the initial state when the stored state is unreadable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'banjir-alerts-'))
    dirs.push(dir)
    const path = join(dir, 'alerts.sqlite3')
    const store = openStore(path)
    store.saveState(STATE)
    store.close()
    const raw = new DatabaseSync(path)
    raw.prepare("UPDATE kv SET value = '{not json' WHERE key = 'state'").run()
    raw.close()

    expect(openStore(path).getState()).toEqual(INITIAL_SERVICE_STATE)
  })
})
