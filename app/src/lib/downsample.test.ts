import { describe, expect, it } from 'vitest'
import { downsample } from './downsample'
import type { HistoryPoint } from '../types/upstream'

const t0 = new Date('2026-09-01T00:00:00.000Z').getTime()
const MIN = 60_000

function series(n: number, f: (i: number) => number): HistoryPoint[] {
  return Array.from({ length: n }, (_, i) => ({ at: new Date(t0 + i * 3 * MIN), cm: f(i) }))
}

describe('downsample', () => {
  it('returns the input untouched when it is already small enough', () => {
    const pts = series(50, (i) => i)
    expect(downsample(pts, 1000)).toBe(pts)
  })

  it('never exceeds the requested budget', () => {
    for (const n of [1001, 5000, 28581]) {
      expect(downsample(series(n, (i) => i % 97), 1000).length).toBeLessThanOrEqual(1000)
    }
  })

  // The whole point of this chart is the flood peak; a downsampler that
  // averages it away is worse than useless.
  it('preserves the global maximum exactly', () => {
    const pts = series(20000, (i) => (i === 12345 ? 999 : 50))
    const out = downsample(pts, 800)
    expect(Math.max(...out.map((p) => p.cm))).toBe(999)
    expect(out.find((p) => p.cm === 999)!.at.getTime()).toBe(pts[12345].at.getTime())
  })

  it('preserves the global minimum exactly', () => {
    const pts = series(20000, (i) => (i === 777 ? -5 : 50))
    expect(Math.min(...downsample(pts, 800).map((p) => p.cm))).toBe(-5)
  })

  it('keeps the first and last samples so the axis range is unchanged', () => {
    const pts = series(9000, (i) => Math.sin(i / 100) * 100 + 150)
    const out = downsample(pts, 600)
    expect(out[0].at.getTime()).toBe(pts[0].at.getTime())
    expect(out[out.length - 1].at.getTime()).toBe(pts[pts.length - 1].at.getTime())
  })

  it('returns points in chronological order', () => {
    const out = downsample(series(15000, (i) => Math.sin(i / 50) * 80 + 100), 700)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].at.getTime()).toBeGreaterThanOrEqual(out[i - 1].at.getTime())
    }
  })

  it('does not mutate or re-use point objects from the input', () => {
    const pts = series(5000, (i) => i % 50)
    const before = pts.map((p) => ({ t: p.at.getTime(), cm: p.cm }))
    downsample(pts, 400)
    expect(pts.map((p) => ({ t: p.at.getTime(), cm: p.cm }))).toEqual(before)
  })

  it('handles empty and single-point input', () => {
    expect(downsample([], 100)).toEqual([])
    const one = series(1, () => 42)
    expect(downsample(one, 100)).toBe(one)
  })

  it('treats a non-positive budget as no downsampling', () => {
    const pts = series(5000, (i) => i)
    expect(downsample(pts, 0)).toBe(pts)
  })
})
