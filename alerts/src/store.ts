import { DatabaseSync } from 'node:sqlite'
import { parseStoredManual, serializeManual } from '../../app/src/lib/manualCache'
import type { ReadingSource } from '../../app/src/lib/manualFallback'
import type { HistoryResponse } from '../../app/src/types/upstream'
import type { Locale } from './payload'
import { INITIAL_ALERT_STATE, type AlertState } from './rules'

/**
 * Subscriptions and watcher state in one SQLite file. A subscription is only
 * the anonymous push address, its keys, a language and an owner flag — no
 * names, numbers or IP addresses.
 */

export type Subscription = {
  endpoint: string
  p256dh: string
  auth: string
  locale: Locale
  isOwner: boolean
}

export type ServiceState = {
  alert: AlertState
  bpbdTable: HistoryResponse | null
  lastRunAt: number | null
  lastRunOk: boolean
  lastError: string | null
  failingSince: number | null
  lastOwnerAlertAt: number | null
  lastReadingAt: number | null
  lastReadingSource: ReadingSource | null
}

export const INITIAL_SERVICE_STATE: ServiceState = {
  alert: INITIAL_ALERT_STATE,
  bpbdTable: null,
  lastRunAt: null,
  lastRunOk: false,
  lastError: null,
  failingSince: null,
  lastOwnerAlertAt: null,
  lastReadingAt: null,
  lastReadingSource: null,
}

export interface Store {
  getState(): ServiceState
  saveState(s: ServiceState): void
  upsertSubscription(s: Subscription, now: Date): void
  deleteSubscription(endpoint: string): boolean
  listSubscriptions(): Subscription[]
  countSubscriptions(): number
  hasSubscription(endpoint: string): boolean
  markDelivered(endpoint: string, now: Date): void
  /** The most recently created subscription, for marking the owner's phone. */
  newestSubscription(): { endpoint: string; createdAt: number } | null
  setOwner(endpoint: string, isOwner: boolean): boolean
  close(): void
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    locale TEXT NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_ok_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`

type StoredState = Omit<ServiceState, 'bpbdTable'> & { bpbdTable: string | null }

function encodeState(s: ServiceState): string {
  const stored: StoredState = { ...s, bpbdTable: s.bpbdTable === null ? null : serializeManual(s.bpbdTable) }
  return JSON.stringify(stored)
}

function decodeState(raw: string): ServiceState {
  try {
    const parsed = JSON.parse(raw) as StoredState
    return {
      ...INITIAL_SERVICE_STATE,
      ...parsed,
      alert: { ...INITIAL_ALERT_STATE, ...parsed.alert },
      bpbdTable: parsed.bpbdTable === null ? null : parseStoredManual(parsed.bpbdTable),
    }
  } catch {
    return INITIAL_SERVICE_STATE
  }
}

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string; locale: string; is_owner: number }

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    locale: row.locale === 'en' ? 'en' : 'id',
    isOwner: row.is_owner === 1,
  }
}

export function openStore(path: string): Store {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  const q = {
    getState: db.prepare("SELECT value FROM kv WHERE key = 'state'"),
    saveState: db.prepare(
      "INSERT INTO kv (key, value) VALUES ('state', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ),
    upsert: db.prepare(`
      INSERT INTO subscriptions (endpoint, p256dh, auth, locale, is_owner, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        p256dh = excluded.p256dh, auth = excluded.auth,
        locale = excluded.locale, is_owner = excluded.is_owner`),
    delete: db.prepare('DELETE FROM subscriptions WHERE endpoint = ?'),
    list: db.prepare('SELECT endpoint, p256dh, auth, locale, is_owner FROM subscriptions ORDER BY created_at'),
    count: db.prepare('SELECT COUNT(*) AS n FROM subscriptions'),
    has: db.prepare('SELECT 1 AS hit FROM subscriptions WHERE endpoint = ?'),
    delivered: db.prepare('UPDATE subscriptions SET last_ok_at = ? WHERE endpoint = ?'),
    newest: db.prepare('SELECT endpoint, created_at FROM subscriptions ORDER BY created_at DESC LIMIT 1'),
    setOwner: db.prepare('UPDATE subscriptions SET is_owner = ? WHERE endpoint = ?'),
  }

  return {
    getState() {
      const row = q.getState.get() as { value: string } | undefined
      return row === undefined ? INITIAL_SERVICE_STATE : decodeState(row.value)
    },
    saveState(s) {
      q.saveState.run(encodeState(s))
    },
    upsertSubscription(s, now) {
      q.upsert.run(s.endpoint, s.p256dh, s.auth, s.locale, s.isOwner ? 1 : 0, now.getTime())
    },
    deleteSubscription(endpoint) {
      return Number(q.delete.run(endpoint).changes) > 0
    },
    listSubscriptions() {
      return (q.list.all() as SubscriptionRow[]).map(toSubscription)
    },
    countSubscriptions() {
      return Number((q.count.get() as { n: number }).n)
    },
    hasSubscription(endpoint) {
      return q.has.get(endpoint) !== undefined
    },
    markDelivered(endpoint, now) {
      q.delivered.run(now.getTime(), endpoint)
    },
    newestSubscription() {
      const row = q.newest.get() as { endpoint: string; created_at: number } | undefined
      return row === undefined ? null : { endpoint: row.endpoint, createdAt: Number(row.created_at) }
    },
    setOwner(endpoint, isOwner) {
      return Number(q.setOwner.run(isOwner ? 1 : 0, endpoint).changes) > 0
    },
    close() {
      db.close()
    },
  }
}
