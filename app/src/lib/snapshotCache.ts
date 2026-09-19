import type { SnapshotRow, ThresholdsCm } from '../types/upstream'

/**
 * The shape persisted to localStorage. Only the fields that actually vary
 * are stored; station identity is re-attached from config on read, so a
 * config change can't be contradicted by a stale entry.
 */
export type StoredSnapshot = {
  observedAtIso: string
  levelCm: number
  prevLevelCm: number | null
  thresholdsCm: ThresholdsCm
  statusText: string
}

export type CachedSnapshot = Omit<SnapshotRow, 'id' | 'name' | 'location' | 'lat' | 'lng'>

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function parseThresholds(v: unknown): ThresholdsCm | null {
  if (!isRecord(v)) return null
  const siaga1 = finiteNumber(v.siaga1)
  const siaga2 = finiteNumber(v.siaga2)
  const siaga3 = finiteNumber(v.siaga3)
  if (siaga1 === null || siaga2 === null || siaga3 === null) return null
  return { siaga1, siaga2, siaga3 }
}

export function serializeSnapshot(row: SnapshotRow): string {
  const stored: StoredSnapshot = {
    observedAtIso: row.observedAt.toISOString(),
    levelCm: row.levelCm,
    prevLevelCm: row.prevLevelCm,
    thresholdsCm: row.thresholdsCm,
    statusText: row.statusText,
  }
  return JSON.stringify(stored)
}

/**
 * Validates an entry read back from localStorage. Anything we did not write
 * ourselves — a truncated write, an entry from an older build with a
 * different shape, or a hand-edited value — yields null so the caller falls
 * back to fetching. Returning a partially-formed row here used to crash the
 * app on first paint, and because the bad value is re-read every load, the
 * crash persisted until site data was cleared.
 */
export function parseStoredSnapshot(raw: string | null): CachedSnapshot | null {
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const thresholdsCm = parseThresholds(parsed.thresholdsCm)
  if (thresholdsCm === null) return null

  const levelCm = finiteNumber(parsed.levelCm)
  if (levelCm === null) return null

  if (typeof parsed.observedAtIso !== 'string') return null
  const observedAt = new Date(parsed.observedAtIso)
  if (Number.isNaN(observedAt.getTime())) return null

  const prevRaw = parsed.prevLevelCm
  const prevLevelCm = prevRaw === null || prevRaw === undefined ? null : finiteNumber(prevRaw)
  // Present but unusable (a string, NaN) means the entry is not ours.
  if (prevRaw !== null && prevRaw !== undefined && prevLevelCm === null) return null

  return {
    thresholdsCm,
    observedAt,
    levelCm,
    prevLevelCm,
    statusText: typeof parsed.statusText === 'string' ? parsed.statusText : '',
  }
}
