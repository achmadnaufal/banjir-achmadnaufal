import type { HistoryPoint, HistoryResponse, SnapshotRow, ThresholdsCm } from '../types/upstream'
import { classify, RANK, type SiagaLevel } from './siaga'

export const ANOMALY_FLOOR_CM = -10
export const VELOCITY_WINDOW_MS = 60 * 60_000
export const VELOCITY_MIN_SPAN_MS = 20 * 60_000
export const MIN_VELOCITY_FOR_ETA = 1
export const DEFAULT_ETA_HORIZON_MS = 12 * 3600_000

export type WindowExtreme = { cm: number; at: Date }

export function dropAnomalies(points: readonly HistoryPoint[]): HistoryPoint[] {
  return points.filter((p) => p.cm >= ANOMALY_FLOOR_CM)
}

/**
 * Returns the snapshot enriched with the freshest reading available across
 * both upstream sources. The XML snapshot and the history endpoint update
 * independently, and either may lag the other by a poll cycle. If history
 * has a non-anomaly point newer than the snapshot's observedAt, swap in
 * that level / timestamp and derive prevLevelCm from the second-to-last
 * valid history point (falling back to the snapshot's own level).
 */
export function freshestSnapshot(
  snapshot: SnapshotRow,
  history: HistoryResponse | null,
): SnapshotRow {
  if (!history) return snapshot
  const valid = dropAnomalies(history.points)
  if (valid.length === 0) return snapshot

  const last = valid[valid.length - 1]
  if (last.at.getTime() <= snapshot.observedAt.getTime()) return snapshot

  const prevPoint = valid.length >= 2 ? valid[valid.length - 2] : null
  return {
    ...snapshot,
    observedAt: last.at,
    levelCm: last.cm,
    prevLevelCm: prevPoint?.cm ?? snapshot.levelCm,
  }
}

export function peakInWindow(points: readonly HistoryPoint[]): WindowExtreme | null {
  if (points.length === 0) return null
  let best = points[0]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.cm > best.cm) best = p
  }
  return { cm: best.cm, at: best.at }
}

export function troughInWindow(points: readonly HistoryPoint[]): WindowExtreme | null {
  if (points.length === 0) return null
  let best = points[0]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.cm < best.cm) best = p
  }
  return { cm: best.cm, at: best.at }
}

export function velocityCmPerHour(
  points: readonly HistoryPoint[],
  now: Date,
  windowMs: number,
  minSpanMs: number = VELOCITY_MIN_SPAN_MS,
): number | null {
  const cutoff = now.getTime() - windowMs
  const inWindow = points.filter((p) => p.at.getTime() >= cutoff)
  if (inWindow.length < 2) return null

  const span = inWindow[inWindow.length - 1].at.getTime() - inWindow[0].at.getTime()
  if (span < minSpanMs) return null

  // Linear regression: cm = a + b * t (t in hours since first point)
  const tBase = inWindow[0].at.getTime()
  const xs = inWindow.map((p) => (p.at.getTime() - tBase) / 3600_000)
  const ys = inWindow.map((p) => p.cm)
  const n = inWindow.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  let sumXY = 0
  let sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumXY += xs[i] * ys[i]
    sumX2 += xs[i] * xs[i]
  }
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

export type BandTenure = {
  level: SiagaLevel
  sinceMs: number
  isWindowFloor: boolean
}

export function bandTenure(
  points: readonly HistoryPoint[],
  thresholds: ThresholdsCm,
  currentCm: number,
): BandTenure {
  const currentLevel = classify(currentCm, thresholds)
  if (points.length === 0) {
    return { level: currentLevel, sinceMs: 0, isWindowFloor: true }
  }

  const last = points[points.length - 1]
  // Walk backward until classification differs from currentLevel.
  for (let i = points.length - 1; i >= 0; i--) {
    const lvl = classify(points[i].cm, thresholds)
    if (lvl !== currentLevel) {
      // Tenure starts at the next point (i+1); use its timestamp.
      const startAt = points[i + 1]?.at ?? last.at
      return {
        level: currentLevel,
        sinceMs: Math.max(0, last.at.getTime() - startAt.getTime()),
        // Transition at the window's earliest sample means we can't see how
        // long the level was actually in the prior band — tenure is a floor.
        isWindowFloor: i === 0,
      }
    }
  }
  // Entire window is in currentLevel — tenure is at least the window span.
  return {
    level: currentLevel,
    sinceMs: last.at.getTime() - points[0].at.getTime(),
    isWindowFloor: true,
  }
}

export type EtaResult = {
  targetLevel: SiagaLevel
  etaMs: number
  direction: 'rising' | 'falling'
}

type Crossing = { target: SiagaLevel; crossingCm: number }

function risingCrossing(level: SiagaLevel, t: ThresholdsCm): Crossing | null {
  if (level === 'siaga1') return null
  if (level === 'siaga2') return { target: 'siaga1', crossingCm: t.siaga1 }
  if (level === 'siaga3') return { target: 'siaga2', crossingCm: t.siaga2 }
  return { target: 'siaga3', crossingCm: t.siaga3 }
}

function fallingCrossing(level: SiagaLevel, t: ThresholdsCm): Crossing | null {
  if (level === 'normal') return null
  if (level === 'siaga3') return { target: 'normal', crossingCm: t.siaga3 }
  if (level === 'siaga2') return { target: 'siaga3', crossingCm: t.siaga2 }
  return { target: 'siaga2', crossingCm: t.siaga1 }
}

export function etaToNextBand(
  currentCm: number,
  ratePerHour: number,
  thresholds: ThresholdsCm,
  horizonMs: number = DEFAULT_ETA_HORIZON_MS,
): EtaResult | null {
  if (Math.abs(ratePerHour) < MIN_VELOCITY_FOR_ETA) return null

  const direction: 'rising' | 'falling' = ratePerHour > 0 ? 'rising' : 'falling'
  const currentLevel = classify(currentCm, thresholds)
  const pick =
    direction === 'rising'
      ? risingCrossing(currentLevel, thresholds)
      : fallingCrossing(currentLevel, thresholds)
  if (!pick) return null

  const { target, crossingCm } = pick
  const distance = direction === 'rising' ? crossingCm - currentCm : currentCm - crossingCm
  if (distance <= 0) return null

  const etaHours = distance / Math.abs(ratePerHour)
  const etaMs = etaHours * 3600_000
  if (etaMs > horizonMs) return null

  // Sanity: ensure RANK ordering is respected.
  if (direction === 'rising' && RANK[target] <= RANK[currentLevel]) return null
  if (direction === 'falling' && RANK[target] >= RANK[currentLevel]) return null

  return { targetLevel: target, etaMs, direction }
}
