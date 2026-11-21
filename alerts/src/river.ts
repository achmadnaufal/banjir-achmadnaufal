import { BPBD_POST, BPBD_READINGS_URL, PESANGGRAHAN } from '../../app/src/config/station'
import { dropAnomalies, velocityCmPerHour } from '../../app/src/lib/analytics'
import { buildBpbdBody, parseBpbdReadings } from '../../app/src/lib/bpbd'
import {
  analysisAnchor,
  mergeManualTables,
  pickReading,
  rateWindowMs,
  sensorReading,
  type ReadingSource,
} from '../../app/src/lib/manualFallback'
import { classify, type SiagaLevel } from '../../app/src/lib/siaga'
import { STATION_DEFAULTS } from '../../app/src/lib/stationDefaults'
import { buildHistoryUrl, parseHistoryBody } from '../../app/src/lib/upstream'
import type { HistoryResponse, ThresholdsCm } from '../../app/src/types/upstream'

/**
 * One look at the river, using exactly the rules the page uses: the DSDA
 * sensor series first, BPBD's hourly manual table only when it is newer.
 * Never throws — a failed source becomes a line in `problems`.
 */

const FETCH_TIMEOUT_MS = 8_000
const DSDA_WINDOW_MS = 24 * 60 * 60 * 1000

export type RiverReading = {
  levelCm: number
  band: SiagaLevel
  observedAt: Date
  prevLevelCm: number | null
  ratePerHour: number | null
  source: ReadingSource
  thresholdsCm: ThresholdsCm
}

export type RiverRead = {
  reading: RiverReading | null
  bpbdTable: HistoryResponse | null
  /** The river was read: BPBD returned its table, or DSDA returned points. */
  ok: boolean
  problems: string[]
}

type Fetched<T> = { value: T; problem: null } | { value: null; problem: string }

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function fetchText(fetchFn: typeof fetch, url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function readDsda(fetchFn: typeof fetch, now: Date): Promise<Fetched<HistoryResponse>> {
  try {
    const url = buildHistoryUrl(PESANGGRAHAN.id, new Date(now.getTime() - DSDA_WINDOW_MS), now)
    return { value: parseHistoryBody(await fetchText(fetchFn, url)), problem: null }
  } catch (err) {
    return { value: null, problem: `dsda: ${describe(err)}` }
  }
}

async function readBpbdOnce(fetchFn: typeof fetch, now: Date): Promise<HistoryResponse> {
  const raw = await fetchText(fetchFn, BPBD_READINGS_URL, {
    method: 'POST',
    body: buildBpbdBody(BPBD_POST),
  })
  return parseBpbdReadings(raw, now)
}

/** BPBD answers 503 now and then, so one retry before calling it failed. */
async function readBpbd(fetchFn: typeof fetch, now: Date): Promise<Fetched<HistoryResponse>> {
  try {
    return { value: await readBpbdOnce(fetchFn, now), problem: null }
  } catch {
    try {
      return { value: await readBpbdOnce(fetchFn, now), problem: null }
    } catch (err) {
      return { value: null, problem: `bpbd: ${describe(err)}` }
    }
  }
}

function toRiverReading(
  history: HistoryResponse | null,
  table: HistoryResponse | null,
  now: Date,
): RiverReading | null {
  const picked = pickReading(sensorReading(null, history, STATION_DEFAULTS), table, STATION_DEFAULTS)
  if (picked === null) return null
  const { snapshot, source } = picked
  const points = dropAnomalies((source === 'manual' ? table : history)?.points ?? [])
  const anchor = analysisAnchor(source, snapshot.observedAt, now)
  return {
    levelCm: snapshot.levelCm,
    band: classify(snapshot.levelCm, snapshot.thresholdsCm),
    observedAt: snapshot.observedAt,
    prevLevelCm: snapshot.prevLevelCm,
    ratePerHour: velocityCmPerHour(points, anchor, rateWindowMs(source)),
    source,
    thresholdsCm: snapshot.thresholdsCm,
  }
}

export async function readRiver(
  fetchFn: typeof fetch,
  now: Date,
  storedTable: HistoryResponse | null,
): Promise<RiverRead> {
  const [dsda, bpbd] = await Promise.all([readDsda(fetchFn, now), readBpbd(fetchFn, now)])
  const bpbdTable = bpbd.value === null ? storedTable : mergeManualTables(storedTable, bpbd.value, now)
  const problems = [dsda.problem, bpbd.problem].filter((p): p is string => p !== null)
  return {
    reading: toRiverReading(dsda.value, bpbdTable, now),
    bpbdTable,
    // BPBD answering with its table proves it is up, even empty after midnight.
    // DSDA answers 200 with an empty series for a dead gate, so only points count.
    ok: bpbd.value !== null || (dsda.value?.points.length ?? 0) > 0,
    problems,
  }
}
