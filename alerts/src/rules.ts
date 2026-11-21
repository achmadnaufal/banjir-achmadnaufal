import { RANK, type SiagaLevel } from '../../app/src/lib/siaga'
import type { RiverReading } from './river'

/**
 * When a river reading earns a push. Pure: the caller persists `next`.
 *
 * - WASPADA or higher alerts, then repeats at most once per hour of readings.
 * - A higher band than the last one announced pushes immediately.
 * - "Back to normal" only after two new readings in a row below WASPADA, so a
 *   level hovering around 150 cm doesn't alternate alert / all-clear.
 * - Only a new reading, at most 2 h old, can push — never cached or stale data.
 */

export type AlertState = {
  /** The last band pushed — not the last observed. */
  lastBandAnnounced: SiagaLevel
  lastPushAt: number | null
  lastPushedReadingAt: number | null
  lastSeenReadingAt: number | null
  belowCount: number
}

export const INITIAL_ALERT_STATE: AlertState = {
  lastBandAnnounced: 'normal',
  lastPushAt: null,
  lastPushedReadingAt: null,
  lastSeenReadingAt: null,
  belowCount: 0,
}

export type AlertKind = 'alert' | 'escalation' | 'allClear'

export type Decision = { push: AlertKind | null; next: AlertState }

export const MAX_READING_AGE_MS = 2 * 60 * 60 * 1000
/** Measured between readings, not pushes: BPBD's posting lag varies by the hour. */
export const HOURLY_GAP_MS = 60 * 60 * 1000
export const ALL_CLEAR_AFTER = 2

type Input = Pick<RiverReading, 'band' | 'observedAt'>

function pushed(kind: AlertKind, band: SiagaLevel, observedMs: number, now: Date): Decision {
  return {
    push: kind,
    next: {
      lastBandAnnounced: band,
      lastPushAt: now.getTime(),
      lastPushedReadingAt: observedMs,
      lastSeenReadingAt: observedMs,
      belowCount: 0,
    },
  }
}

function decideElevated(state: AlertState, band: SiagaLevel, observedMs: number, now: Date): Decision {
  const announced = state.lastBandAnnounced
  if (announced === 'normal') return pushed('alert', band, observedMs, now)
  if (RANK[band] > RANK[announced]) return pushed('escalation', band, observedMs, now)
  const sinceLastPushed =
    state.lastPushedReadingAt === null ? Infinity : observedMs - state.lastPushedReadingAt
  if (sinceLastPushed >= HOURLY_GAP_MS) return pushed('alert', band, observedMs, now)
  return { push: null, next: { ...state, belowCount: 0 } }
}

function decideNormal(state: AlertState, observedMs: number, now: Date): Decision {
  if (state.lastBandAnnounced === 'normal') return { push: null, next: { ...state, belowCount: 0 } }
  const belowCount = state.belowCount + 1
  if (belowCount >= ALL_CLEAR_AFTER) return pushed('allClear', 'normal', observedMs, now)
  return { push: null, next: { ...state, belowCount } }
}

export function decideAlert(reading: Input | null, state: AlertState, now: Date): Decision {
  const quiet: Decision = { push: null, next: state }
  if (reading === null) return quiet
  const observedMs = reading.observedAt.getTime()
  if (now.getTime() - observedMs > MAX_READING_AGE_MS) return quiet
  if (state.lastSeenReadingAt !== null && observedMs <= state.lastSeenReadingAt) return quiet

  const seen: AlertState = { ...state, lastSeenReadingAt: observedMs }
  return reading.band === 'normal'
    ? decideNormal(seen, observedMs, now)
    : decideElevated(seen, reading.band, observedMs, now)
}
