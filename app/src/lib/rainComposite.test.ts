import { describe, expect, it } from 'vitest'
import { alignFrames, composeField, detailWeight } from './rainComposite'
import { buildGrid, sampleField, type RainFrame } from './rainForecast'

// Region: 1°×1° as 2×2 cells. Detail: the middle 0.4°×0.4° as 2×2 cells.
const REGION = buildGrid({ south: -7, west: 106, north: -6, east: 107 }, 2, 2)
const DETAIL = buildGrid({ south: -6.7, west: 106.3, north: -6.3, east: 106.7 }, 2, 2)
const FADE = 0.1

describe('detailWeight', () => {
  const b = DETAIL.bounds
  it('is 1 deep inside, 0 outside, and eases across the fade band', () => {
    expect(detailWeight(b, -6.5, 106.5, FADE)).toBe(1)
    expect(detailWeight(b, -6.2, 106.5, FADE)).toBe(0)
    const mid = detailWeight(b, -6.35, 106.5, FADE) // 0.05° in from the north edge
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(mid).toBeCloseTo(0.5)
  })
})

describe('composeField', () => {
  const regionMm = [1, 1, 1, 1]
  const detailMm = [9, 9, 9, 9]

  it('uses the region alone when there is no detail', () => {
    const field = composeField({ grid: REGION, mm: [0, 4, 8, 12] }, null, 4, 4, FADE)
    expect(field).toHaveLength(16)
    // Pixel (1,1) centre → lat -6.375, lng 106.375.
    expect(field[5]).toBeCloseTo(sampleField(REGION, [0, 4, 8, 12], -6.375, 106.375))
  })

  it('takes the detail value inside and the region value outside', () => {
    // 10×10 px over the region: pixel centres every 0.1°, from 0.05° in.
    const field = composeField({ grid: REGION, mm: regionMm }, { grid: DETAIL, mm: detailMm }, 10, 10, FADE)
    expect(field[5 * 10 + 5]).toBeCloseTo(9) // (-6.55, 106.55): deep inside
    expect(field[0]).toBeCloseTo(1) // (-6.05, 106.05): outside
    const edge = field[3 * 10 + 5] // (-6.35, 106.55): in the fade band
    expect(edge).toBeGreaterThan(1)
    expect(edge).toBeLessThan(9)
  })

  it('falls back to the region where detail is missing, and vice versa', () => {
    const nanDetail = [Number.NaN, Number.NaN, Number.NaN, Number.NaN]
    const field = composeField({ grid: REGION, mm: regionMm }, { grid: DETAIL, mm: nanDetail }, 10, 10, FADE)
    expect(field[55]).toBeCloseTo(1)
    const nanRegion = [Number.NaN, Number.NaN, Number.NaN, Number.NaN]
    const field2 = composeField({ grid: REGION, mm: nanRegion }, { grid: DETAIL, mm: detailMm }, 10, 10, FADE)
    expect(field2[55]).toBeCloseTo(9)
    expect(field2[0]).toBeNaN()
  })
})

describe('alignFrames', () => {
  const HOUR = 3_600_000
  const frame = (h: number, mm: number[]): RainFrame => ({
    startsAt: new Date(h * HOUR),
    endsAt: new Date((h + 1) * HOUR),
    mm,
  })

  it('pairs detail frames with region frames by time', () => {
    const out = alignFrames([frame(0, [1]), frame(1, [2])], [frame(1, [20]), frame(2, [30])])
    expect(out).toHaveLength(2)
    expect(out[0].detail).toBeNull()
    expect(out[1].detail).toEqual([20])
    expect(out[1].region).toEqual([2])
  })

  it('handles a missing side', () => {
    expect(alignFrames(null, [frame(0, [5])])).toEqual([
      { startsAt: new Date(0), endsAt: new Date(HOUR), region: null, detail: [5] },
    ])
    expect(alignFrames([frame(0, [5])], null)[0].detail).toBeNull()
    expect(alignFrames(null, null)).toEqual([])
  })
})
