import { describe, expect, it } from 'vitest'
import { STALE_AFTER_MS } from '../config/station'
import type { HistoryPoint } from '../types/upstream'
import { VELOCITY_WINDOW_MS } from './analytics'
import {
  allClearSpanMs,
  analysisAnchor,
  hourlyUpdateGapMs,
  inferCadence,
  rateWindowMs,
  staleAfterMs,
} from './cadence'

const pts = (...hm: string[]): HistoryPoint[] =>
  hm.map((t, i) => ({ at: new Date(`2026-11-25T${t}:00+07:00`), cm: 100 + i }))

describe('inferCadence', () => {
  it('reads a 10-minute series as frequent', () => {
    expect(inferCadence(pts('18:00', '18:10', '18:20', '18:30', '18:40'))).toBe('frequent')
  })

  it("reads DSDA's irregular hourly series (with duplicate points) as hourly", () => {
    // What gate 160 sent on 2026-11-25 after coming back.
    expect(inferCadence(pts('15:00', '16:00', '16:00', '17:13', '18:19', '18:19', '19:09'))).toBe('hourly')
  })

  it('reads a BPBD hourly table as hourly', () => {
    expect(inferCadence(pts('17:00', '18:00', '19:00'))).toBe('hourly')
  })

  it('judges by the recent readings, so a switch from hourly to 10-minute shows quickly', () => {
    expect(inferCadence(pts('14:00', '15:00', '16:00', '16:10', '16:20', '16:30', '16:40', '16:50'))).toBe(
      'frequent',
    )
  })

  it('assumes hourly when there are too few readings to tell', () => {
    expect(inferCadence(pts('19:00'))).toBe('hourly')
    expect(inferCadence(pts('19:00', '19:00'))).toBe('hourly')
    expect(inferCadence([])).toBe('hourly')
  })
})

describe('settings per cadence', () => {
  const observedAt = new Date('2026-11-25T19:09:00+07:00')
  const now = new Date('2026-11-25T19:40:00+07:00')

  it('keeps the 10-minute settings for frequent data', () => {
    expect(staleAfterMs('frequent')).toBe(STALE_AFTER_MS)
    expect(rateWindowMs('frequent')).toBe(VELOCITY_WINDOW_MS)
    expect(analysisAnchor('frequent', observedAt, now)).toBe(now)
    expect(hourlyUpdateGapMs('frequent')).toBe(60 * 60_000)
    expect(allClearSpanMs('frequent')).toBe(60 * 60_000)
  })

  it('gives hourly data room for readings 48–69 minutes apart', () => {
    expect(staleAfterMs('hourly')).toBe(2 * 60 * 60_000)
    expect(rateWindowMs('hourly')).toBe(2 * 60 * 60_000)
    expect(analysisAnchor('hourly', observedAt, now)).toBe(observedAt)
    expect(hourlyUpdateGapMs('hourly')).toBe(45 * 60_000)
    expect(allClearSpanMs('hourly')).toBe(45 * 60_000)
  })
})
