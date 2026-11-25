import { STALE_AFTER_MS } from '../config/station'
import type { HistoryPoint } from '../types/upstream'
import { VELOCITY_WINDOW_MS } from './analytics'

/**
 * How often readings arrive, read from the data itself rather than assumed
 * from the source. DSDA's gate 160 sent every 10 minutes until 2026-11-18,
 * came back on 2026-11-25 roughly hourly (48–69 min apart, some points
 * duplicated), and may go back to 10 minutes; BPBD's table is hourly.
 * Everything time-based — staleness, the rate window, the hourly push
 * spacing, the all-clear — follows the cadence.
 */
export type Cadence = 'frequent' | 'hourly'

/** Typical gap at or above this means hourly data. */
export const HOURLY_CADENCE_MIN_GAP_MS = 30 * 60_000
/** How many recent readings decide the cadence, so a change shows quickly. */
const RECENT_READINGS = 7

const HOUR_MS = 60 * 60_000
const HOURLY_STALE_AFTER_MS = 2 * HOUR_MS
const HOURLY_RATE_WINDOW_MS = 2 * HOUR_MS
/** Hourly readings land 48–69 min apart, so "the next hour's reading" starts at 45 min. */
const HOURLY_GAP_MS = 45 * 60_000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Too few readings to tell → hourly: its wider windows are the safer guess. */
export function inferCadence(points: readonly HistoryPoint[]): Cadence {
  const times = [...new Set(points.map((p) => p.at.getTime()))].sort((a, b) => a - b).slice(-RECENT_READINGS)
  if (times.length < 2) return 'hourly'
  const gaps = times.slice(1).map((t, i) => t - times[i])
  return median(gaps) >= HOURLY_CADENCE_MIN_GAP_MS ? 'hourly' : 'frequent'
}

export function staleAfterMs(c: Cadence): number {
  return c === 'hourly' ? HOURLY_STALE_AFTER_MS : STALE_AFTER_MS
}

/** A 60-minute window holds at most one hourly reading — too few for a rate. */
export function rateWindowMs(c: Cadence): number {
  return c === 'hourly' ? HOURLY_RATE_WINDOW_MS : VELOCITY_WINDOW_MS
}

/**
 * The instant rate and forecast are measured from. A frequent reading is at
 * most minutes old, so "now" works; an hourly one can be two hours old, and
 * measuring from now would slide the window off it and push every ETA later.
 */
export function analysisAnchor(c: Cadence, observedAt: Date, now: Date): Date {
  return c === 'hourly' ? observedAt : now
}

/** How much newer a reading must be than the last pushed one for the hourly update. */
export function hourlyUpdateGapMs(c: Cadence): number {
  return c === 'hourly' ? HOURLY_GAP_MS : HOUR_MS
}

/** How long readings must stay below WASPADA before "back to normal". */
export function allClearSpanMs(c: Cadence): number {
  return c === 'hourly' ? HOURLY_GAP_MS : HOUR_MS
}
