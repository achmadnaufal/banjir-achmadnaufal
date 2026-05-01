import { describe, expect, it } from 'vitest'
import {
  bandTenure,
  dropAnomalies,
  etaToNextBand,
  freshestSnapshot,
  peakInWindow,
  troughInWindow,
  velocityCmPerHour,
} from './analytics'
import type { HistoryPoint, HistoryResponse, SnapshotRow, ThresholdsCm } from '../types/upstream'

const T: ThresholdsCm = { siaga1: 350, siaga2: 250, siaga3: 150 }

function pt(iso: string, cm: number): HistoryPoint {
  return { at: new Date(iso), cm }
}

describe('dropAnomalies', () => {
  it('removes points below the anomaly floor', () => {
    const points = [pt('2026-04-30T10:00:00Z', -515), pt('2026-04-30T10:10:00Z', 280), pt('2026-04-30T10:20:00Z', -10)]
    const r = dropAnomalies(points)
    expect(r.map((p) => p.cm)).toEqual([280, -10])
  })
  it('returns same reference shape on empty', () => {
    expect(dropAnomalies([])).toEqual([])
  })
})

describe('peakInWindow', () => {
  it('returns null for empty', () => {
    expect(peakInWindow([])).toBeNull()
  })
  it('returns the maximum point', () => {
    const r = peakInWindow([pt('2026-04-30T10:00:00Z', 200), pt('2026-04-30T10:10:00Z', 290), pt('2026-04-30T10:20:00Z', 280)])
    expect(r?.cm).toBe(290)
    expect(r?.at.toISOString()).toBe('2026-04-30T10:10:00.000Z')
  })
  it('returns the earliest point on ties', () => {
    const r = peakInWindow([pt('2026-04-30T10:00:00Z', 280), pt('2026-04-30T10:10:00Z', 280)])
    expect(r?.at.toISOString()).toBe('2026-04-30T10:00:00.000Z')
  })
})

describe('troughInWindow', () => {
  it('returns the minimum point', () => {
    const r = troughInWindow([pt('2026-04-30T10:00:00Z', 200), pt('2026-04-30T10:10:00Z', 90), pt('2026-04-30T10:20:00Z', 110)])
    expect(r?.cm).toBe(90)
  })
  it('returns null for empty', () => {
    expect(troughInWindow([])).toBeNull()
  })
})

describe('velocityCmPerHour', () => {
  const now = new Date('2026-04-30T11:00:00Z')

  it('returns ~+10 cm/h for +1 cm per 10 min over 60 min', () => {
    const points: HistoryPoint[] = []
    for (let i = 0; i <= 6; i++) {
      points.push(pt(`2026-04-30T${10}:${(i * 10).toString().padStart(2, '0')}:00Z`, 100 + i))
    }
    const v = velocityCmPerHour(points, now, 60 * 60_000)
    expect(v).not.toBeNull()
    expect(Math.abs((v as number) - 6)).toBeLessThan(0.5)
  })

  it('returns negative slope for declining series', () => {
    const points: HistoryPoint[] = []
    for (let i = 0; i <= 6; i++) {
      points.push(pt(`2026-04-30T${10}:${(i * 10).toString().padStart(2, '0')}:00Z`, 200 - i * 2))
    }
    const v = velocityCmPerHour(points, now, 60 * 60_000)
    expect(v).not.toBeNull()
    expect(v as number).toBeLessThan(0)
  })

  it('returns null when fewer than 2 in-window points', () => {
    const v = velocityCmPerHour([pt('2026-04-30T10:55:00Z', 100)], now, 60 * 60_000)
    expect(v).toBeNull()
  })

  it('returns null when span shorter than minSpanMs', () => {
    const points = [pt('2026-04-30T10:50:00Z', 100), pt('2026-04-30T10:55:00Z', 105)]
    const v = velocityCmPerHour(points, now, 60 * 60_000, 20 * 60_000)
    expect(v).toBeNull()
  })

  it('only uses in-window points', () => {
    const points = [
      pt('2026-04-30T08:00:00Z', 50), // outside window
      pt('2026-04-30T10:10:00Z', 100),
      pt('2026-04-30T10:30:00Z', 110),
      pt('2026-04-30T10:50:00Z', 120),
    ]
    const v = velocityCmPerHour(points, now, 60 * 60_000)
    expect(v).not.toBeNull()
    expect((v as number) > 0).toBe(true)
  })
})

describe('bandTenure', () => {
  it('reports window-floor for an all-normal window', () => {
    const points = [pt('2026-04-30T08:00:00Z', 100), pt('2026-04-30T11:00:00Z', 120)]
    const r = bandTenure(points, T, 120)
    expect(r.level).toBe('normal')
    expect(r.isWindowFloor).toBe(true)
    expect(r.sinceMs).toBeGreaterThanOrEqual(3 * 60 * 60_000 - 1)
  })

  it('measures tenure from the most recent transition', () => {
    // siaga3 at 09:00 → siaga2 at 10:00 (cm cross 250)
    const points = [
      pt('2026-04-30T09:00:00Z', 200),
      pt('2026-04-30T09:30:00Z', 240),
      pt('2026-04-30T10:00:00Z', 260),
      pt('2026-04-30T10:30:00Z', 270),
      pt('2026-04-30T11:00:00Z', 280),
    ]
    const r = bandTenure(points, T, 280)
    expect(r.level).toBe('siaga2')
    // tenure ≈ 1h (since 10:00 crossing into siaga2)
    expect(r.sinceMs).toBeGreaterThanOrEqual(55 * 60_000)
    expect(r.sinceMs).toBeLessThanOrEqual(70 * 60_000)
    expect(r.isWindowFloor).toBe(false)
  })

  it('returns floor flag when the only transition is at the window start', () => {
    const points = [pt('2026-04-30T09:00:00Z', 240), pt('2026-04-30T11:00:00Z', 280)]
    const r = bandTenure(points, T, 280)
    expect(r.level).toBe('siaga2')
    expect(r.isWindowFloor).toBe(true)
  })

  it('falls back to currentCm-only classification when points is empty', () => {
    const r = bandTenure([], T, 280)
    expect(r.level).toBe('siaga2')
    expect(r.sinceMs).toBe(0)
    expect(r.isWindowFloor).toBe(true)
  })
})

describe('freshestSnapshot', () => {
  const baseSnapshot: SnapshotRow = {
    id: 160,
    name: 'P.S. Pesanggrahan 1',
    location: 'Pesanggrahan',
    lat: -6.397147,
    lng: 106.771833,
    thresholdsCm: T,
    observedAt: new Date('2026-04-30T10:00:00Z'),
    levelCm: 200,
    prevLevelCm: 195,
    statusText: 'Status : Siaga 3',
  }

  const history = (points: HistoryPoint[]): HistoryResponse => ({ points, thresholdsCm: T })

  it('returns the snapshot unchanged when history is null', () => {
    expect(freshestSnapshot(baseSnapshot, null)).toBe(baseSnapshot)
  })

  it('returns the snapshot unchanged when history is empty', () => {
    expect(freshestSnapshot(baseSnapshot, history([]))).toBe(baseSnapshot)
  })

  it('returns the snapshot unchanged when history is older', () => {
    const r = freshestSnapshot(baseSnapshot, history([pt('2026-04-30T09:30:00Z', 198)]))
    expect(r).toBe(baseSnapshot)
  })

  it('uses history when its last point is newer', () => {
    const r = freshestSnapshot(
      baseSnapshot,
      history([pt('2026-04-30T10:00:00Z', 200), pt('2026-04-30T10:10:00Z', 210)]),
    )
    expect(r.levelCm).toBe(210)
    expect(r.observedAt.toISOString()).toBe('2026-04-30T10:10:00.000Z')
    expect(r.prevLevelCm).toBe(200)
  })

  it('falls back to the snapshot level for prev when history has only one fresh point', () => {
    const r = freshestSnapshot(baseSnapshot, history([pt('2026-04-30T10:10:00Z', 210)]))
    expect(r.levelCm).toBe(210)
    expect(r.prevLevelCm).toBe(200) // snapshot.levelCm
  })

  it('skips trailing anomalies when picking the freshest point', () => {
    const r = freshestSnapshot(
      baseSnapshot,
      history([
        pt('2026-04-30T10:00:00Z', 200),
        pt('2026-04-30T10:10:00Z', 210),
        pt('2026-04-30T10:20:00Z', -515),
      ]),
    )
    expect(r.levelCm).toBe(210)
    expect(r.observedAt.toISOString()).toBe('2026-04-30T10:10:00.000Z')
  })

  it('returns the snapshot when all history points are anomalies', () => {
    const r = freshestSnapshot(
      baseSnapshot,
      history([pt('2026-04-30T11:00:00Z', -515)]),
    )
    expect(r).toBe(baseSnapshot)
  })

  it('keeps the original thresholds and identifying fields', () => {
    const r = freshestSnapshot(baseSnapshot, history([pt('2026-04-30T10:10:00Z', 210)]))
    expect(r.thresholdsCm).toBe(baseSnapshot.thresholdsCm)
    expect(r.id).toBe(baseSnapshot.id)
    expect(r.statusText).toBe(baseSnapshot.statusText)
    expect(r.lat).toBe(baseSnapshot.lat)
  })
})

describe('etaToNextBand', () => {
  it('rising into siaga2 from siaga3', () => {
    const r = etaToNextBand(240, 60, T)
    expect(r).not.toBeNull()
    expect(r?.targetLevel).toBe('siaga2')
    expect(r?.direction).toBe('rising')
    // (250 - 240) / 60 cm/h = 1/6 h = 10 min
    expect(r?.etaMs).toBeCloseTo(10 * 60_000, -3)
  })

  it('falling into siaga3 from siaga2', () => {
    const r = etaToNextBand(280, -12, T)
    expect(r).not.toBeNull()
    expect(r?.targetLevel).toBe('siaga3')
    expect(r?.direction).toBe('falling')
    // (280 - 250) / 12 cm/h = 2.5 h
    expect(r?.etaMs).toBeCloseTo(2.5 * 3600_000, -4)
  })

  it('returns null when velocity is below MIN_VELOCITY_FOR_ETA', () => {
    expect(etaToNextBand(240, 0.4, T)).toBeNull()
    expect(etaToNextBand(240, -0.2, T)).toBeNull()
  })

  it('returns null when already at the top band rising', () => {
    expect(etaToNextBand(400, 5, T)).toBeNull()
  })

  it('returns null when already at normal falling', () => {
    expect(etaToNextBand(50, -5, T)).toBeNull()
  })

  it('returns null when crossing is beyond the horizon', () => {
    // 240 cm rising at 0.5 cm/h ≈ 20 h to reach siaga2
    expect(etaToNextBand(240, 0.5, T, 12 * 3600_000)).toBeNull()
  })
})
