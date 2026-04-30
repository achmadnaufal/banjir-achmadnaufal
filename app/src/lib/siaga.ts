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

const META: Record<SiagaLevel, SiagaMeta> = {
  siaga1: { label: 'SIAGA 1', tone: 'red', rank: 3 },
  siaga2: { label: 'SIAGA 2', tone: 'orange', rank: 2 },
  siaga3: { label: 'SIAGA 3', tone: 'yellow', rank: 1 },
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
