import { buildAlertPayload, buildOwnerPayload } from './payload'
import { readRiver, type RiverReading } from './river'
import { decideAlert, type AlertKind } from './rules'
import { broadcast, type PushSender } from './sender'
import type { ServiceState, Store, Subscription } from './store'

/**
 * One watcher run: read the river, decide, push, remember. Never throws —
 * a failure is recorded in the state, and if the watcher stays blind the
 * owner's phone is told, so the service cannot die silently.
 */

export type WatcherDeps = {
  store: Store
  fetchFn: typeof fetch
  send: PushSender
  log: (msg: string) => void
}

export const WATCH_INTERVAL_MS = 5 * 60 * 1000
export const OWNER_FAILING_MS = 60 * 60 * 1000
export const OWNER_STALE_READING_MS = 3 * 60 * 60 * 1000
export const OWNER_REPEAT_MS = 6 * 60 * 60 * 1000
/** No completed run for this long means the loop is stuck: exit so Docker restarts us. */
export const WATCHDOG_MS = 15 * 60 * 1000

export function watchdogDue(lastRunAt: number | null, startedAt: number, now: number): boolean {
  return now - (lastRunAt ?? startedAt) > WATCHDOG_MS
}

export function ownerAlertDue(s: ServiceState, now: Date): boolean {
  const t = now.getTime()
  const failing = s.failingSince !== null && t - s.failingSince > OWNER_FAILING_MS
  const stale = s.lastReadingAt !== null && t - s.lastReadingAt > OWNER_STALE_READING_MS
  const quiet = s.lastOwnerAlertAt === null || t - s.lastOwnerAlertAt >= OWNER_REPEAT_MS
  return (failing || stale) && quiet
}

async function deliver(
  deps: WatcherDeps,
  subs: Subscription[],
  payloadFor: Parameters<typeof broadcast>[1],
  now: Date,
): Promise<void> {
  const result = await broadcast(subs, payloadFor, deps.send)
  for (const endpoint of result.gone) deps.store.deleteSubscription(endpoint)
  for (const endpoint of result.delivered) deps.store.markDelivered(endpoint, now)
  deps.log(`sent ${result.delivered.length}, gone ${result.gone.length}, failed ${result.failed.length}`)
}

function notifyAll(deps: WatcherDeps, kind: AlertKind, reading: RiverReading, now: Date): Promise<void> {
  return deliver(deps, deps.store.listSubscriptions(), (s) => buildAlertPayload(kind, reading, s.locale), now)
}

function notifyOwners(deps: WatcherDeps, s: ServiceState, now: Date): Promise<void> {
  const owners = deps.store.listSubscriptions().filter((sub) => sub.isOwner)
  const last = s.lastReadingAt === null ? null : new Date(s.lastReadingAt)
  return deliver(deps, owners, (sub) => buildOwnerPayload(last, sub.locale), now)
}

async function readAndAlert(deps: WatcherDeps, prev: ServiceState, now: Date): Promise<ServiceState> {
  const river = await readRiver(deps.fetchFn, now, prev.bpbdTable)
  for (const problem of river.problems) deps.log(problem)
  const decision = decideAlert(river.reading, prev.alert, now)
  if (decision.push !== null && river.reading !== null) {
    await notifyAll(deps, decision.push, river.reading, now)
  }
  return {
    ...prev,
    alert: decision.next,
    bpbdTable: river.bpbdTable,
    lastRunAt: now.getTime(),
    lastRunOk: river.ok,
    lastError: river.ok ? null : river.problems.join('; ') || 'no source returned a reading',
    failingSince: river.ok ? null : (prev.failingSince ?? now.getTime()),
    lastReadingAt: river.reading?.observedAt.getTime() ?? prev.lastReadingAt,
    lastReadingSource: river.reading?.source ?? prev.lastReadingSource,
  }
}

export async function runOnce(deps: WatcherDeps, now: Date): Promise<ServiceState> {
  const prev = deps.store.getState()
  let next: ServiceState
  try {
    next = await readAndAlert(deps, prev, now)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    deps.log(`run failed: ${message}`)
    next = {
      ...prev,
      lastRunAt: now.getTime(),
      lastRunOk: false,
      lastError: message,
      failingSince: prev.failingSince ?? now.getTime(),
    }
  }
  if (ownerAlertDue(next, now)) {
    try {
      await notifyOwners(deps, next, now)
    } catch (err) {
      deps.log(`owner alert failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    next = { ...next, lastOwnerAlertAt: now.getTime() }
  }
  deps.store.saveState(next)
  return next
}

/** Runs now and then every interval; a tick is skipped while a run is in flight. */
export function startWatcher(deps: WatcherDeps, intervalMs: number = WATCH_INTERVAL_MS): { stop(): void } {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await runOnce(deps, new Date())
    } finally {
      running = false
    }
  }
  void tick()
  const id = setInterval(() => void tick(), intervalMs)
  return { stop: () => clearInterval(id) }
}
