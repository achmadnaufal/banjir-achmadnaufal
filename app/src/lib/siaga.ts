import type { ThresholdsCm } from '../types/upstream'

export type SiagaLevel = 'siaga1' | 'siaga2' | 'siaga3' | 'normal'

export const RANK: Record<SiagaLevel, 0 | 1 | 2 | 3> = {
  normal: 0,
  siaga3: 1,
  siaga2: 2,
  siaga1: 3,
}

export type SiagaTone = 'red' | 'orange' | 'yellow' | 'green'

export type SiagaMeta = {
  label: string
  tone: SiagaTone
  rank: 0 | 1 | 2 | 3
}

// Labels follow the official DSDA DKI "KETERANGAN" legend, which names the
// bands BAHAYA / SIAGA / WASPADA / Normal. The keys stay siaga1..3 because
// that is what the upstream XML calls the threshold fields.
const META: Record<SiagaLevel, SiagaMeta> = {
  siaga1: { label: 'BAHAYA', tone: 'red', rank: 3 },
  siaga2: { label: 'SIAGA', tone: 'orange', rank: 2 },
  siaga3: { label: 'WASPADA', tone: 'yellow', rank: 1 },
  normal: { label: 'NORMAL', tone: 'green', rank: 0 },
}

export function classify(cm: number, t: ThresholdsCm): SiagaLevel {
  if (cm > t.siaga1) return 'siaga1'
  if (cm > t.siaga2) return 'siaga2'
  if (cm > t.siaga3) return 'siaga3'
  return 'normal'
}

export function siagaMeta(level: SiagaLevel): SiagaMeta {
  return META[level]
}

export type Band = SiagaMeta & {
  level: SiagaLevel
  rangeText: string
}

/**
 * The legend rows for a given set of thresholds, ordered highest band first
 * to match the official KETERANGAN box. Thresholds arrive as mm/10 and can
 * be fractional, so each bound is rounded for display only.
 */
export function bands(t: ThresholdsCm): Band[] {
  const s1 = Math.round(t.siaga1)
  const s2 = Math.round(t.siaga2)
  const s3 = Math.round(t.siaga3)
  const rows: Array<[SiagaLevel, string]> = [
    ['siaga1', `> ${s1} cm`],
    ['siaga2', `${s2} - ${s1} cm`],
    ['siaga3', `${s3} - ${s2} cm`],
    ['normal', `< ${s3} cm`],
  ]
  return rows.map(([level, rangeText]) => ({ ...META[level], level, rangeText }))
}

export type TransitionDirection = 'rising' | 'falling' | 'none'

export type Transition = {
  changed: boolean
  direction: TransitionDirection
}

export function detectTransition(prev: SiagaLevel | null, next: SiagaLevel): Transition {
  if (prev === null || prev === next) return { changed: false, direction: 'none' }
  return {
    changed: true,
    direction: RANK[next] > RANK[prev] ? 'rising' : 'falling',
  }
}

export type Trend = 'up' | 'down' | 'flat'

export function trend(prev: number | null, next: number): Trend {
  if (prev === null) return 'flat'
  if (next > prev) return 'up'
  if (next < prev) return 'down'
  return 'flat'
}
