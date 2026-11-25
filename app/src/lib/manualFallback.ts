import type { HistoryPoint, HistoryResponse, SnapshotRow } from '../types/upstream'
import { dropAnomalies, freshestSnapshot, type EtaResult } from './analytics'

/**
 * Choosing between DSDA's sensor and BPBD's hourly manual readings.
 *
 * The sensor refreshes every ~10 minutes and the manual table only hourly, so
 * the sensor stays primary: the manual reading is used only when it is
 * strictly newer than everything the sensor has, which in practice means the
 * sensor feed has gone quiet. While the sensor is live it always wins, so the
 * page never flips between the two gauges.
 */

export type ReadingSource = 'sensor' | 'manual'

export type Reading = {
  snapshot: SnapshotRow
  source: ReadingSource
}

/** What the page knows about the gate before any fetch succeeds. */
export type StationDefaults = Pick<
  SnapshotRow,
  'id' | 'name' | 'location' | 'lat' | 'lng' | 'thresholdsCm'
>

/** Long enough that the 24h stats survive midnight, when BPBD's table resets. */
export const MANUAL_RETAIN_MS = 48 * 60 * 60 * 1000

/** Restates an ETA computed from `anchor` as time remaining from `now`. */
export function etaFromNow(eta: EtaResult | null, anchor: Date, now: Date): EtaResult | null {
  if (eta === null || anchor === now) return eta
  const elapsedMs = now.getTime() - anchor.getTime()
  return { ...eta, etaMs: Math.max(0, eta.etaMs - elapsedMs) }
}

function lastValid(history: HistoryResponse | null): {
  last: HistoryPoint
  prev: HistoryPoint | null
} | null {
  if (history === null) return null
  const valid = dropAnomalies(history.points)
  if (valid.length === 0) return null
  return { last: valid[valid.length - 1], prev: valid.length >= 2 ? valid[valid.length - 2] : null }
}

/**
 * The sensor's best reading: the XML row or its time-series, whichever is
 * newer. When the XML has no row for the gate the time-series alone still
 * counts — it can be live while the XML lags.
 */
export function sensorReading(
  latest: SnapshotRow | null,
  history: HistoryResponse | null,
  defaults: StationDefaults,
): SnapshotRow | null {
  if (latest !== null) return freshestSnapshot(latest, history)
  const tail = lastValid(history)
  if (tail === null) return null
  return {
    ...defaults,
    thresholdsCm: history?.thresholdsCm ?? defaults.thresholdsCm,
    observedAt: tail.last.at,
    levelCm: tail.last.cm,
    prevLevelCm: tail.prev?.cm ?? null,
    statusText: '',
  }
}

export function pickReading(
  sensor: SnapshotRow | null,
  manual: HistoryResponse | null,
  defaults: StationDefaults,
): Reading | null {
  const latest = lastValid(manual)
  const sensorIsFresher =
    sensor !== null && (latest === null || latest.last.at.getTime() <= sensor.observedAt.getTime())
  if (sensorIsFresher) return { snapshot: sensor, source: 'sensor' }
  if (latest === null) return null

  const identity = sensor ?? defaults
  return {
    source: 'manual',
    snapshot: {
      id: identity.id,
      name: identity.name,
      location: identity.location,
      lat: identity.lat,
      lng: identity.lng,
      thresholdsCm: manual?.thresholdsCm ?? sensor?.thresholdsCm ?? defaults.thresholdsCm,
      observedAt: latest.last.at,
      levelCm: latest.last.cm,
      // Compare hour to hour on the same gauge; the sensor's last level may be
      // days old and on a different datum.
      prevLevelCm: latest.prev?.cm ?? null,
      statusText: '',
    },
  }
}

/**
 * Extends a sensor history with the manual readings that come after its last
 * valid point, so the chart keeps moving while the sensor is silent. Only
 * while the manual reading is the one on show: once the sensor is back, its
 * own series stands alone rather than being spliced with another gauge.
 * Returns the sensor history itself (same reference) when nothing is added.
 */
export function withManualPoints(
  sensor: HistoryResponse | null,
  manual: HistoryResponse | null,
  windowStart: Date,
  source: ReadingSource,
): HistoryResponse | null {
  if (manual === null || source !== 'manual') return sensor
  const sensorPoints = sensor?.points ?? []
  const lastSensorMs = lastValid(sensor)?.last.at.getTime() ?? -Infinity
  const fromMs = windowStart.getTime()

  const extra = manual.points.filter((p) => {
    const ms = p.at.getTime()
    return ms > lastSensorMs && ms >= fromMs
  })
  if (extra.length === 0) return sensor

  return {
    points: [...sensorPoints, ...extra].sort((a, b) => a.at.getTime() - b.at.getTime()),
    thresholdsCm: sensor?.thresholdsCm ?? manual.thresholdsCm,
  }
}

/**
 * Folds a fresh BPBD table into what is already known. BPBD only ever serves
 * today's hours, so replacing the table would forget yesterday at midnight —
 * blanking the fallback until the 00:00 reading is posted.
 */
export function mergeManualTables(
  prev: HistoryResponse | null,
  next: HistoryResponse,
  now: Date,
): HistoryResponse {
  const byTime = new Map<number, HistoryPoint>()
  for (const p of [...(prev?.points ?? []), ...next.points]) byTime.set(p.at.getTime(), p)
  const keepFromMs = now.getTime() - MANUAL_RETAIN_MS
  const points = [...byTime.values()]
    .filter((p) => p.at.getTime() >= keepFromMs)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  return { points, thresholdsCm: next.thresholdsCm ?? prev?.thresholdsCm ?? null }
}
