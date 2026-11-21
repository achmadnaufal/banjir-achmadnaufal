import { describe, expect, it } from 'vitest'
import { STALE_AFTER_MS } from '../config/station'
import type { HistoryResponse, SnapshotRow } from '../types/upstream'
import { VELOCITY_WINDOW_MS } from './analytics'
import {
  analysisAnchor,
  etaFromNow,
  MANUAL_RATE_WINDOW_MS,
  MANUAL_RETAIN_MS,
  MANUAL_STALE_AFTER_MS,
  mergeManualTables,
  pickReading,
  rateWindowMs,
  sensorReading,
  staleAfterMs,
  withManualPoints,
  type StationDefaults,
} from './manualFallback'

const T = { siaga1: 350, siaga2: 250, siaga3: 150 }
const DEFAULTS: StationDefaults = {
  id: 160,
  name: 'P.S. Pesanggrahan 1',
  location: 'Pesanggrahan',
  lat: -6.397147,
  lng: 106.771833,
  thresholdsCm: T,
}

function sensorRow(at: string, cm: number): SnapshotRow {
  return {
    ...DEFAULTS,
    location: 'Pesanggrahan (DSDA)',
    thresholdsCm: { siaga1: 351, siaga2: 251, siaga3: 151 },
    observedAt: new Date(at),
    levelCm: cm,
    prevLevelCm: cm - 1,
    statusText: 'Status : Normal',
  }
}

function history(points: [string, number][], thresholdsCm: HistoryResponse['thresholdsCm'] = T): HistoryResponse {
  return { points: points.map(([at, cm]) => ({ at: new Date(at), cm })), thresholdsCm }
}

const MANUAL_TONIGHT = history([
  ['2026-11-21T18:00:00+07:00', 190],
  ['2026-11-21T19:00:00+07:00', 200],
])

describe('sensorReading', () => {
  it('prefers the newer of the XML row and the time-series', () => {
    const latest = sensorRow('2026-11-21T19:40:00+07:00', 210)
    const series = history([['2026-11-21T19:50:00+07:00', 215]])
    expect(sensorReading(latest, series, DEFAULTS)?.levelCm).toBe(215)
  })

  it('builds the reading from the time-series when the XML has no row for the gate', () => {
    const series = history([
      ['2026-11-21T19:40:00+07:00', 225],
      ['2026-11-21T19:50:00+07:00', 230],
    ])
    expect(sensorReading(null, series, DEFAULTS)).toEqual({
      ...DEFAULTS,
      observedAt: new Date('2026-11-21T19:50:00+07:00'),
      levelCm: 230,
      prevLevelCm: 225,
      statusText: '',
    })
  })

  it('skips junk values when building from the time-series', () => {
    const series = history([
      ['2026-11-21T19:40:00+07:00', 225],
      ['2026-11-21T19:50:00+07:00', -999],
    ])
    expect(sensorReading(null, series, DEFAULTS)?.levelCm).toBe(225)
    expect(sensorReading(null, history([['2026-11-21T19:50:00+07:00', -999]]), DEFAULTS)).toBeNull()
  })

  it('returns null with neither', () => {
    expect(sensorReading(null, null, DEFAULTS)).toBeNull()
  })
})

describe('pickReading', () => {
  it('keeps the sensor reading while it is fresher than the manual one', () => {
    const sensor = sensorRow('2026-11-21T19:40:00+07:00', 210)
    expect(pickReading(sensor, MANUAL_TONIGHT, DEFAULTS)).toEqual({ snapshot: sensor, source: 'sensor' })
  })

  it('keeps the sensor reading on a tie', () => {
    const sensor = sensorRow('2026-11-21T19:00:00+07:00', 205)
    expect(pickReading(sensor, MANUAL_TONIGHT, DEFAULTS)?.source).toBe('sensor')
  })

  it('switches to the manual reading once the sensor has gone quiet', () => {
    const sensor = sensorRow('2026-11-18T10:30:00+07:00', 60)
    const r = pickReading(sensor, MANUAL_TONIGHT, DEFAULTS)
    expect(r?.source).toBe('manual')
    expect(r?.snapshot).toEqual({
      id: 160,
      name: 'P.S. Pesanggrahan 1',
      location: 'Pesanggrahan (DSDA)',
      lat: -6.397147,
      lng: 106.771833,
      thresholdsCm: T,
      observedAt: new Date('2026-11-21T19:00:00+07:00'),
      levelCm: 200,
      // The previous manual hour, never the sensor's 3-day-old level.
      prevLevelCm: 190,
      statusText: '',
    })
  })

  it('uses the manual reading when there is no sensor reading at all', () => {
    const r = pickReading(null, MANUAL_TONIGHT, DEFAULTS)
    expect(r?.source).toBe('manual')
    expect(r?.snapshot.name).toBe('P.S. Pesanggrahan 1')
    expect(r?.snapshot.location).toBe('Pesanggrahan')
    expect(r?.snapshot.levelCm).toBe(200)
  })

  it('has no previous level when the manual table holds one reading', () => {
    const r = pickReading(null, history([['2026-11-21T00:00:00+07:00', 95]]), DEFAULTS)
    expect(r?.snapshot.prevLevelCm).toBeNull()
  })

  it('falls back to the sensor thresholds, then the defaults, when BPBD sends none', () => {
    const noThresholds: HistoryResponse = { ...MANUAL_TONIGHT, thresholdsCm: null }
    const sensor = sensorRow('2026-11-18T10:30:00+07:00', 60)
    expect(pickReading(sensor, noThresholds, DEFAULTS)?.snapshot.thresholdsCm).toEqual(sensor.thresholdsCm)
    expect(pickReading(null, noThresholds, DEFAULTS)?.snapshot.thresholdsCm).toEqual(T)
  })

  it('ignores an empty manual table', () => {
    const sensor = sensorRow('2026-11-18T10:30:00+07:00', 60)
    expect(pickReading(sensor, history([]), DEFAULTS)).toEqual({ snapshot: sensor, source: 'sensor' })
  })

  it('returns null when neither source has a reading', () => {
    expect(pickReading(null, null, DEFAULTS)).toBeNull()
    expect(pickReading(null, history([]), DEFAULTS)).toBeNull()
  })
})

describe('withManualPoints', () => {
  const windowStart = new Date('2026-11-21T00:00:00+07:00')

  it('appends only manual points newer than the last sensor point', () => {
    const sensor = history([['2026-11-21T18:30:00+07:00', 185]], { siaga1: 351, siaga2: 251, siaga3: 151 })
    const merged = withManualPoints(sensor, MANUAL_TONIGHT, windowStart, 'manual')
    expect(merged?.points.map((p) => p.cm)).toEqual([185, 200])
    expect(merged?.thresholdsCm).toEqual(sensor.thresholdsCm)
  })

  it('leaves the sensor history alone while the sensor is the source', () => {
    // DSDA back online: a BPBD hour newer than the last series point must not
    // be spliced in, or it skews the 60-minute rate and the forecast.
    const sensor = history([['2026-11-21T13:50:00+07:00', 170]])
    const manual = history([['2026-11-21T14:00:00+07:00', 185]])
    expect(withManualPoints(sensor, manual, windowStart, 'sensor')).toBe(sensor)
  })

  it('finds where the sensor stopped by its last valid value, not a junk one', () => {
    const sensor = history([
      ['2026-11-21T13:00:00+07:00', 150],
      ['2026-11-21T19:50:00+07:00', -999],
    ])
    const merged = withManualPoints(sensor, MANUAL_TONIGHT, windowStart, 'manual')
    expect(merged?.points.map((p) => p.cm)).toEqual([150, 190, 200, -999])
  })

  it('drops manual points before the window start', () => {
    const merged = withManualPoints(null, MANUAL_TONIGHT, new Date('2026-11-21T18:30:00+07:00'), 'manual')
    expect(merged?.points.map((p) => p.cm)).toEqual([200])
  })

  it('returns the sensor history untouched when no manual point is newer', () => {
    const sensor = history([['2026-11-21T19:30:00+07:00', 205]])
    expect(withManualPoints(sensor, MANUAL_TONIGHT, windowStart, 'manual')).toBe(sensor)
  })

  it('builds the history from manual points alone when there is no sensor history', () => {
    expect(withManualPoints(null, MANUAL_TONIGHT, windowStart, 'manual')).toEqual(MANUAL_TONIGHT)
  })

  it('fills in thresholds from BPBD when the sensor history has none', () => {
    const sensor: HistoryResponse = { points: [], thresholdsCm: null }
    expect(withManualPoints(sensor, MANUAL_TONIGHT, windowStart, 'manual')?.thresholdsCm).toEqual(T)
  })

  it('returns null when both are missing', () => {
    expect(withManualPoints(null, null, windowStart, 'manual')).toBeNull()
  })
})

describe('mergeManualTables', () => {
  const now = new Date('2026-11-22T00:05:00+07:00')

  it("keeps yesterday's readings when today's table arrives empty after midnight", () => {
    const merged = mergeManualTables(MANUAL_TONIGHT, history([], null), now)
    expect(merged).toEqual(MANUAL_TONIGHT)
  })

  it('unions both tables in time order, the newer fetch winning on a clash', () => {
    const next = history([
      ['2026-11-21T19:00:00+07:00', 205],
      ['2026-11-22T00:00:00+07:00', 210],
    ])
    expect(mergeManualTables(MANUAL_TONIGHT, next, now)?.points.map((p) => p.cm)).toEqual([190, 205, 210])
  })

  it(`forgets readings older than ${MANUAL_RETAIN_MS / 3_600_000} hours`, () => {
    const old = history([['2026-11-19T12:00:00+07:00', 80]])
    expect(mergeManualTables(old, MANUAL_TONIGHT, now)?.points.map((p) => p.cm)).toEqual([190, 200])
  })

  it('takes the newer thresholds, falling back to the stored ones', () => {
    const next = history([['2026-11-22T00:00:00+07:00', 210]], null)
    expect(mergeManualTables(MANUAL_TONIGHT, next, now)?.thresholdsCm).toEqual(T)
  })

  it('starts from the new table when nothing is stored', () => {
    expect(mergeManualTables(null, MANUAL_TONIGHT, now)).toEqual(MANUAL_TONIGHT)
  })
})

describe('analysis anchor and ETA', () => {
  const observedAt = new Date('2026-11-21T19:00:00+07:00')
  const now = new Date('2026-11-21T19:55:00+07:00')

  it('measures hourly readings from the reading itself and sensor readings from now', () => {
    expect(analysisAnchor('manual', observedAt, now)).toBe(observedAt)
    expect(analysisAnchor('sensor', observedAt, now)).toBe(now)
  })

  it('takes the time already elapsed off an ETA measured from the reading', () => {
    const eta = { etaMs: 200 * 60_000, direction: 'rising' as const, targetLevel: 'siaga2' as const }
    expect(etaFromNow(eta, observedAt, now)?.etaMs).toBe(145 * 60_000)
    expect(etaFromNow(eta, now, now)).toBe(eta)
  })

  it('never reports a negative ETA', () => {
    const eta = { etaMs: 30 * 60_000, direction: 'rising' as const, targetLevel: 'siaga2' as const }
    expect(etaFromNow(eta, observedAt, now)?.etaMs).toBe(0)
    expect(etaFromNow(null, observedAt, now)).toBeNull()
  })
})

describe('rateWindowMs', () => {
  it('keeps the sensor on 60 minutes and spans three hourly readings otherwise', () => {
    expect(rateWindowMs('sensor')).toBe(VELOCITY_WINDOW_MS)
    expect(rateWindowMs('manual')).toBe(MANUAL_RATE_WINDOW_MS)
    expect(MANUAL_RATE_WINDOW_MS).toBe(2 * 60 * 60 * 1000)
  })
})

describe('staleAfterMs', () => {
  it('gives the hourly manual table more slack than the 10-minute sensor', () => {
    expect(staleAfterMs('sensor')).toBe(STALE_AFTER_MS)
    expect(staleAfterMs('manual')).toBe(MANUAL_STALE_AFTER_MS)
    expect(MANUAL_STALE_AFTER_MS).toBeGreaterThan(60 * 60 * 1000)
  })
})
