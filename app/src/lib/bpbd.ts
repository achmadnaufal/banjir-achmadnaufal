import { BPBD_POST, BPBD_READINGS_URL } from '../config/station'
import {
  type HistoryPoint,
  type HistoryResponse,
  type ThresholdsCm,
  UpstreamError,
} from '../types/upstream'
import { fetchText, type FetchOptions } from './http'
import { jakartaDateParts } from './upstream'

/**
 * BPBD DKI's hourly manual gauge table, read from the endpoint its own
 * water-level page charts from. The reply is one JSON object of parallel
 * comma-separated strings for *today only* (it ignores any date parameter):
 *
 *   { "time": "00:00,01:00,…", "ketinggian": "95,90,…",
 *     "siaga1": "350,350,…", "siaga2": …, "siaga3": … }
 *
 * Levels and thresholds are already in cm. The times carry no date, so each
 * one is stamped with the Jakarta calendar date of `now`.
 */

/**
 * Room for a phone clock that runs behind the observer's. Generous on purpose:
 * the only thing it has to tell apart is yesterday's table, whose latest hour
 * sits most of a day ahead when stamped with today's date.
 */
const CLOCK_SKEW_MS = 2 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_LABEL = /^(\d{1,2}):(\d{2})$/

type BpbdPost = { readonly id: number; readonly name: string }

export function buildBpbdBody(post: BpbdPost): URLSearchParams {
  return new URLSearchParams({ pintuair_id: String(post.id), pintuair: post.name })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function splitList(v: unknown): string[] | null {
  return typeof v === 'string' ? v.split(',').map((s) => s.trim()) : null
}

/** A reading only counts when the cell holds a real number, not a placeholder. */
function toCm(raw: string): number | null {
  if (raw === '' || !/^-?\d+(\.\d+)?$/.test(raw)) return null
  return Number(raw)
}

/** The band in force for the latest hour, i.e. the last value in the list. */
function lastThreshold(v: unknown): number | null {
  const values = splitList(v)
  if (values === null) return null
  return toCm(values[values.length - 1] ?? '')
}

function parseThresholds(body: Record<string, unknown>): ThresholdsCm | null {
  const siaga1 = lastThreshold(body.siaga1)
  const siaga2 = lastThreshold(body.siaga2)
  const siaga3 = lastThreshold(body.siaga3)
  if (siaga1 === null || siaga2 === null || siaga3 === null) return null
  return { siaga1, siaga2, siaga3 }
}

function stampHour(label: string, day: Date): Date | null {
  const m = HOUR_LABEL.exec(label)
  if (!m) return null
  const { year, month, day: dd } = jakartaDateParts(day)
  const at = new Date(`${year}-${month}-${dd}T${m[1].padStart(2, '0')}:${m[2]}:00+07:00`)
  return Number.isNaN(at.getTime()) ? null : at
}

function stampTable(times: string[], levels: string[], day: Date): HistoryPoint[] {
  return times
    .map((label, i): HistoryPoint | null => {
      const at = stampHour(label, day)
      const cm = toCm(levels[i])
      return at === null || cm === null ? null : { at, cm }
    })
    .filter((p): p is HistoryPoint => p !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
}

function allBefore(points: HistoryPoint[], limitMs: number): boolean {
  return points.every((p) => p.at.getTime() <= limitMs)
}

function parseBody(raw: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new UpstreamError('parse', 'BPBD readings are not JSON')
  }
  if (!isRecord(parsed)) throw new UpstreamError('parse', 'BPBD readings are not an object')
  return parsed
}

export function parseBpbdReadings(raw: string, now: Date): HistoryResponse {
  const body = parseBody(raw)
  const times = splitList(body.time)
  const levels = splitList(body.ketinggian)
  if (times === null || levels === null) {
    throw new UpstreamError('parse', 'BPBD readings are missing time or ketinggian')
  }
  if (times.length !== levels.length) {
    throw new UpstreamError(
      'parse',
      `BPBD readings cannot be paired: ${times.length} times, ${levels.length} levels`,
    )
  }

  // A reading that lands in the future means the table is not today's: it is
  // yesterday's, still being served just after midnight. Date it as such.
  // Anything that still won't fit is undatable and dropped whole.
  const latestAllowed = now.getTime() + CLOCK_SKEW_MS
  const today = stampTable(times, levels, now)
  const yesterday = () => stampTable(times, levels, new Date(now.getTime() - DAY_MS))
  const points = allBefore(today, latestAllowed)
    ? today
    : allBefore(yesterday(), latestAllowed)
      ? yesterday()
      : []

  return { points, thresholdsCm: parseThresholds(body) }
}

export async function fetchBpbdReadings(
  now: Date,
  opts: Pick<FetchOptions, 'signal'> = {},
): Promise<HistoryResponse> {
  const raw = await fetchText(BPBD_READINGS_URL, {
    ...opts,
    method: 'POST',
    body: buildBpbdBody(BPBD_POST),
  })
  return parseBpbdReadings(raw, now)
}
