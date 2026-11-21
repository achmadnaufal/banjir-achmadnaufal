import { BPBD_POST } from '../config/station'
import type { HistoryPoint, HistoryResponse, ThresholdsCm } from '../types/upstream'

/**
 * The BPBD hourly table, persisted so a reload shows the last known manual
 * reading at once. Without it, every page open first painted the sensor's
 * cached (days-old) level and then the BPBD one, and the alert hook took that
 * jump for a rise.
 */
export const MANUAL_STORAGE_KEY = `banjir:manualReadings:${BPBD_POST.id}`

type StoredPoint = { atIso: string; cm: number }
type StoredManual = { points: StoredPoint[]; thresholdsCm: ThresholdsCm | null }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function serializeManual(table: HistoryResponse): string {
  const stored: StoredManual = {
    points: table.points.map((p) => ({ atIso: p.at.toISOString(), cm: p.cm })),
    thresholdsCm: table.thresholdsCm,
  }
  return JSON.stringify(stored)
}

function parsePoint(v: unknown): HistoryPoint | null {
  if (!isRecord(v) || typeof v.atIso !== 'string') return null
  const at = new Date(v.atIso)
  const cm = finite(v.cm)
  return Number.isNaN(at.getTime()) || cm === null ? null : { at, cm }
}

function parseThresholds(v: unknown): ThresholdsCm | null | undefined {
  if (v === null) return null
  if (!isRecord(v)) return undefined
  const siaga1 = finite(v.siaga1)
  const siaga2 = finite(v.siaga2)
  const siaga3 = finite(v.siaga3)
  if (siaga1 === null || siaga2 === null || siaga3 === null) return undefined
  return { siaga1, siaga2, siaga3 }
}

/** Anything not written by `serializeManual` reads back as null. */
export function parseStoredManual(raw: string | null): HistoryResponse | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.points)) return null

  const points = parsed.points.map(parsePoint)
  if (points.some((p) => p === null)) return null
  const thresholdsCm = parseThresholds(parsed.thresholdsCm)
  if (thresholdsCm === undefined) return null

  return { points: points as HistoryPoint[], thresholdsCm }
}

export function readStoredManual(): HistoryResponse | null {
  try {
    return parseStoredManual(localStorage.getItem(MANUAL_STORAGE_KEY))
  } catch {
    // Storage can throw outright when site data is blocked.
    return null
  }
}

export function writeStoredManual(table: HistoryResponse): void {
  try {
    localStorage.setItem(MANUAL_STORAGE_KEY, serializeManual(table))
  } catch {
    // quota or privacy mode — the in-memory table still works
  }
}
