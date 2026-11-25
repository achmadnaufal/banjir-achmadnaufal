import { allClearSpanMs, hourlyUpdateGapMs, type Cadence } from '../../app/src/lib/cadence'
import { RANK, type SiagaLevel } from '../../app/src/lib/siaga'
import type { RiverReading } from './river'

/**
 * When a river reading earns a push. Pure: the caller persists `next`.
 *
 * - WASPADA or higher alerts, then repeats at most once per hour of readings
 *   (hourly data arrives 48–69 min apart, so its "next hour" starts at 45 min).
 * - A higher band than the last one announced pushes immediately.
 * - "Back to normal" only after new readings below WASPADA that span about an
 *   hour (two hourly readings, or a run of 10-minute ones), so a
 *   level hovering around 150 cm doesn't alternate alert / all-clear.
 * - Only a new reading, at most 2 h old and not from the future, can push —
 *   never cached, stale or mis-stamped data.
 */

export type AlertState = {
  /** The last band pushed — not the last observed. */
  lastBandAnnounced: SiagaLevel
  lastPushAt: number | null
  lastPushedReadingAt: number | null
  lastSeenReadingAt: number | null
  belowCount: number
  /** When the current run of readings below WASPADA began. */
  belowSince: number | null
}

export const INITIAL_ALERT_STATE: AlertState = {
  lastBandAnnounced: 'normal',
  lastPushAt: null,
  lastPushedReadingAt: null,
  lastSeenReadingAt: null,
  belowCount: 0,
  belowSince: null,
}

export type AlertKind = 'alert' | 'escalation' | 'allClear'

export type Decision = { push: AlertKind | null; next: AlertState }

export const MAX_READING_AGE_MS = 2 * 60 * 60 * 1000
/** A reading further ahead than this is mis-stamped; trusting it would hide real ones. */
export const MAX_READING_LEAD_MS = 10 * 60 * 1000
export const ALL_CLEAR_AFTER = 2

/** Spacing (hourly updates, all-clear) follows how often readings arrive. */
type Input = Pick<RiverReading, 'band' | 'observedAt' | 'cadence'>

function pushed(kind: AlertKind, band: SiagaLevel, observedMs: number, now: Date): Decision {
  return {
    push: kind,
    next: {
      lastBandAnnounced: band,
      lastPushAt: now.getTime(),
      lastPushedReadingAt: observedMs,
      lastSeenReadingAt: observedMs,
      belowCount: 0,
      belowSince: null,
    },
  }
}

function decideElevated(
  state: AlertState,
  band: SiagaLevel,
  observedMs: number,
  now: Date,
  cadence: Cadence,
): Decision {
  const announced = state.lastBandAnnounced
  if (announced === 'normal') return pushed('alert', band, observedMs, now)
  if (RANK[band] > RANK[announced]) return pushed('escalation', band, observedMs, now)
  const sinceLastPushed =
    state.lastPushedReadingAt === null ? Infinity : observedMs - state.lastPushedReadingAt
  if (sinceLastPushed >= hourlyUpdateGapMs(cadence)) return pushed('alert', band, observedMs, now)
  return { push: null, next: { ...state, belowCount: 0, belowSince: null } }
}

function decideNormal(state: AlertState, observedMs: number, now: Date, cadence: Cadence): Decision {
  if (state.lastBandAnnounced === 'normal') {
    return { push: null, next: { ...state, belowCount: 0, belowSince: null } }
  }
  const belowCount = state.belowCount + 1
  const belowSince = state.belowSince ?? observedMs
  if (belowCount >= ALL_CLEAR_AFTER && observedMs - belowSince >= allClearSpanMs(cadence)) {
    return pushed('allClear', 'normal', observedMs, now)
  }
  return { push: null, next: { ...state, belowCount, belowSince } }
}

export function decideAlert(reading: Input | null, state: AlertState, now: Date): Decision {
  const quiet: Decision = { push: null, next: state }
  if (reading === null) return quiet
  const observedMs = reading.observedAt.getTime()
  const ageMs = now.getTime() - observedMs
  if (ageMs > MAX_READING_AGE_MS || ageMs < -MAX_READING_LEAD_MS) return quiet
  if (state.lastSeenReadingAt !== null && observedMs <= state.lastSeenReadingAt) return quiet

  const seen: AlertState = { ...state, lastSeenReadingAt: observedMs }
  return reading.band === 'normal'
    ? decideNormal(seen, observedMs, now, reading.cadence)
    : decideElevated(seen, reading.band, observedMs, now, reading.cadence)
}
