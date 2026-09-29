import { describe, expect, it } from 'vitest'
import {
  buildForecastUrl,
  buildGrid,
  parseForecast,
  upstreamMask,
  upstreamSummary,
  type RainFrame,
} from './rainForecast'
import { UpstreamError } from '../types/upstream'

const BOUNDS = { south: -6.6, west: 106.6, north: -6.2, east: 107.0 }
const HOUR = 3600

describe('buildGrid', () => {
  it('places cell centres row-major from north-west', () => {
    const grid = buildGrid(BOUNDS, 2, 2)
    expect(grid.rows).toBe(2)
    expect(grid.cols).toBe(2)
    expect(grid.points).toHaveLength(4)
    expect(grid.points[0].lat).toBeCloseTo(-6.3)
    expect(grid.points[0].lng).toBeCloseTo(106.7)
    expect(grid.points[1].lng).toBeCloseTo(106.9)
    expect(grid.points[2].lat).toBeCloseTo(-6.5)
  })

  it('returns a frozen grid so callers cannot mutate shared state', () => {
    const grid = buildGrid(BOUNDS, 2, 2)
    expect(Object.isFrozen(grid)).toBe(true)
    expect(Object.isFrozen(grid.points)).toBe(true)
  })

  it('rejects empty or inverted grids', () => {
    expect(() => buildGrid(BOUNDS, 0, 2)).toThrow()
    expect(() => buildGrid({ ...BOUNDS, north: -6.7 }, 2, 2)).toThrow()
  })
})

describe('buildForecastUrl', () => {
  it('lists every point and asks for hourly precipitation in unix time', () => {
    const url = new URL(buildForecastUrl(buildGrid(BOUNDS, 1, 2), 12))
    expect(url.searchParams.get('latitude')).toBe('-6.4,-6.4')
    expect(url.searchParams.get('longitude')).toBe('106.7,106.9')
    expect(url.searchParams.get('hourly')).toBe('precipitation')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    // One extra hour: the first hourly value covers the hour already running.
    expect(url.searchParams.get('forecast_hours')).toBe('13')
  })
})

function location(times: number[], mm: (number | null)[]) {
  return { hourly: { time: times, precipitation: mm } }
}

describe('parseForecast', () => {
  const grid = buildGrid(BOUNDS, 1, 2)
  const t0 = 1_790_000_000 - (1_790_000_000 % HOUR)
  const times = [t0, t0 + HOUR, t0 + 2 * HOUR, t0 + 3 * HOUR]
  const now = new Date((t0 + 30 * 60) * 1000) // half past the first hour mark

  it('builds one frame per future hour with a value per cell', () => {
    const body = [location(times, [9, 1, 2, 3]), location(times, [9, 4, 5, 6])]
    const frames = parseForecast(body, grid, now, 12)
    // The hour ending at t0 is over; the hour ending at t0+1h is in progress.
    expect(frames).toHaveLength(3)
    expect(frames[0].startsAt.getTime()).toBe(t0 * 1000)
    expect(frames[0].endsAt.getTime()).toBe((t0 + HOUR) * 1000)
    expect(frames[0].mm).toEqual([1, 4])
    expect(frames[2].mm).toEqual([3, 6])
  })

  it('caps the number of frames', () => {
    const body = [location(times, [0, 1, 2, 3]), location(times, [0, 4, 5, 6])]
    expect(parseForecast(body, grid, now, 2)).toHaveLength(2)
  })

  it('keeps missing values as NaN instead of inventing dry weather', () => {
    const body = [location(times, [0, null, 2, 3]), location(times, [0, 4, 5, 6])]
    expect(parseForecast(body, grid, now, 12)[0].mm[0]).toBeNaN()
  })

  it('accepts a single-location object response', () => {
    const single = buildGrid(BOUNDS, 1, 1)
    const frames = parseForecast(location(times, [0, 1, 2, 3]), single, now, 12)
    expect(frames[0].mm).toEqual([1])
  })

  it('rejects a response with the wrong number of locations', () => {
    expect(() => parseForecast([location(times, [0, 1, 2, 3])], grid, now, 12)).toThrow(UpstreamError)
  })

  it('rejects malformed bodies', () => {
    expect(() => parseForecast(null, grid, now, 12)).toThrow(UpstreamError)
    expect(() => parseForecast([{ hourly: {} }, { hourly: {} }], grid, now, 12)).toThrow(UpstreamError)
    expect(() =>
      parseForecast([location(times, [0, 1]), location(times, [0, 1, 2, 3])], grid, now, 12),
    ).toThrow(UpstreamError)
    expect(() =>
      parseForecast([location(times, ['x' as never, 1, 2, 3]), location(times, [0, 1, 2, 3])], grid, now, 12),
    ).toThrow(UpstreamError)
  })

  it('rejects locations whose time axes disagree', () => {
    const shifted = times.map((t) => t + HOUR)
    const body = [location(times, [0, 1, 2, 3]), location(shifted, [0, 1, 2, 3])]
    expect(() => parseForecast(body, grid, now, 12)).toThrow(UpstreamError)
  })
})

describe('upstreamMask', () => {
  it('marks cells south of the gate', () => {
    const grid = buildGrid(BOUNDS, 2, 1) // centres at -6.3 and -6.5
    expect(upstreamMask(grid, -6.4)).toEqual([false, true])
  })
})

describe('upstreamSummary', () => {
  const frame = (hour: number, mm: number[]): RainFrame => ({
    startsAt: new Date(hour * HOUR * 1000),
    endsAt: new Date((hour + 1) * HOUR * 1000),
    mm,
  })
  const mask = [false, true, true]

  it('sums the upstream-average rain and finds the wettest hour', () => {
    const summary = upstreamSummary([frame(0, [50, 1, 3]), frame(1, [0, 4, 6])], mask)
    expect(summary.totalMm).toBeCloseTo(7)
    expect(summary.peak).toEqual({ frameIndex: 1, mm: 5 })
  })

  it('ignores missing cells when averaging', () => {
    const summary = upstreamSummary([frame(0, [0, Number.NaN, 4])], mask)
    expect(summary.totalMm).toBeCloseTo(4)
  })

  it('reports no peak when nothing falls', () => {
    const summary = upstreamSummary([frame(0, [5, 0, 0])], mask)
    expect(summary.totalMm).toBe(0)
    expect(summary.peak).toBeNull()
  })

  it('handles an empty mask or no frames', () => {
    expect(upstreamSummary([frame(0, [1, 1, 1])], [false, false, false]).totalMm).toBe(0)
    expect(upstreamSummary([], mask)).toEqual({ totalMm: 0, peak: null })
  })
})
