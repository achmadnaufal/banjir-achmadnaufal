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

// Linear ETA — kept as a fallback when there isn't enough data to fit a
// quadratic. Treats current level + constant rate.
export function etaLinear(
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

  if (direction === 'rising' && RANK[target] <= RANK[currentLevel]) return null
  if (direction === 'falling' && RANK[target] >= RANK[currentLevel]) return null

  return { targetLevel: target, etaMs, direction }
}

// Quadratic least squares: fit y = a + b·t + c·t² (t in hours from origin)
// using the normal equations. Returns null if the matrix is singular or
// inputs are insufficient.
export function quadraticFit(
  ts: readonly number[],
  ys: readonly number[],
): { a: number; b: number; c: number } | null {
  const n = ts.length
  if (n < 3 || ys.length !== n) return null
  const s0 = n
  let s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0,
    sy = 0,
    sty = 0,
    st2y = 0
  for (let i = 0; i < n; i++) {
    const t = ts[i]
    const y = ys[i]
    const t2 = t * t
    s1 += t
    s2 += t2
    s3 += t2 * t
    s4 += t2 * t2
    sy += y
    sty += t * y
    st2y += t2 * y
  }
  // Solve via Cramer's rule on the 3x3 system.
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const M: number[][] = [
    [s0, s1, s2],
    [s1, s2, s3],
    [s2, s3, s4],
  ]
  const D = det(M)
  if (Math.abs(D) < 1e-12) return null
  const Ma = [
    [sy, s1, s2],
    [sty, s2, s3],
    [st2y, s3, s4],
  ]
  const Mb = [
    [s0, sy, s2],
    [s1, sty, s3],
    [s2, st2y, s4],
  ]
  const Mc = [
    [s0, s1, sy],
    [s1, s2, sty],
    [s2, s3, st2y],
  ]
  return { a: det(Ma) / D, b: det(Mb) / D, c: det(Mc) / D }
}

const QUADRATIC_WINDOW_MS = 60 * 60_000
const QUADRATIC_MIN_POINTS = 4
const SIMULATION_STEP_MIN = 1

/**
 * Acceleration-aware ETA. Fits a quadratic to the most recent
 * `QUADRATIC_WINDOW_MS` of valid history points, anchors the trajectory at
 * the actual current observation, and steps forward minute-by-minute until
 * the projected level crosses a band threshold or exceeds the horizon.
 *
 * This naturally handles three scenarios that linear projection mishandles:
 *  - **Cresting** (rising but decelerating): if the parabola peaks below the
 *    next threshold, no spurious "ETA Siaga 2 in 30m" — returns null.
 *  - **Accelerating surge**: tighter ETA than constant-rate.
 *  - **Reverse direction within horizon**: if dy/dt flips sign before
 *    crossing, we stop and report no crossing.
 *
 * Falls back to `etaLinear` when fewer than `QUADRATIC_MIN_POINTS` valid
 * samples are in the window.
 */
export function etaToNextBand(
  currentCm: number,
  history: readonly HistoryPoint[],
  now: Date,
  thresholds: ThresholdsCm,
  options: { horizonMs?: number; windowMs?: number } = {},
): EtaResult | null {
  const horizonMs = options.horizonMs ?? DEFAULT_ETA_HORIZON_MS
  const windowMs = options.windowMs ?? QUADRATIC_WINDOW_MS
  const cutoff = now.getTime() - windowMs

  const window = dropAnomalies(history).filter((p) => p.at.getTime() >= cutoff)
  if (window.length < QUADRATIC_MIN_POINTS) {
    // Not enough samples for a stable quadratic; degrade to linear.
    const v = velocityCmPerHour(history, now, windowMs)
    return v === null ? null : etaLinear(currentCm, v, thresholds, horizonMs)
  }

  const tBaseMs = window[0].at.getTime()
  const ts = window.map((p) => (p.at.getTime() - tBaseMs) / 3600_000)
  const ys = window.map((p) => p.cm)
  const fit = quadraticFit(ts, ys)
  if (!fit) {
    const v = velocityCmPerHour(history, now, windowMs)
    return v === null ? null : etaLinear(currentCm, v, thresholds, horizonMs)
  }
  const { a, b, c } = fit

  // Instantaneous rate at "now": d/dt (a + b·t + c·t²) = b + 2c·t
  const tNow = (now.getTime() - tBaseMs) / 3600_000
  const instantRate = b + 2 * c * tNow
  if (Math.abs(instantRate) < MIN_VELOCITY_FOR_ETA) return null

  const startLevel = classify(currentCm, thresholds)
  // Anchor the trajectory at the actual observation so noise in the fit
  // doesn't shift our starting point.
  const fitAtNow = a + b * tNow + c * tNow * tNow
  const offset = currentCm - fitAtNow

  const stepHours = SIMULATION_STEP_MIN / 60
  const horizonHours = horizonMs / 3600_000

  let dt = stepHours
  while (dt <= horizonHours) {
    const t = tNow + dt
    const cm = a + b * t + c * t * t + offset
    const level = classify(cm, thresholds)
    if (level !== startLevel) {
      const direction: 'rising' | 'falling' = RANK[level] > RANK[startLevel] ? 'rising' : 'falling'
      return {
        targetLevel: level,
        etaMs: dt * 3600_000,
        direction,
      }
    }
    dt += stepHours
  }
  return null
}
