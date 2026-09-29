import { describe, expect, it } from 'vitest'
import { gaussianBlur, lerpFrames, renderRainPixels, upsample } from './rainImage'
import { RAIN_STOPS } from './rainColor'

describe('lerpFrames', () => {
  it('blends two hours cell by cell', () => {
    expect(lerpFrames([0, 10], [10, 20], 0.25)).toEqual([2.5, 12.5])
  })

  it('falls back to whichever side has a value', () => {
    const out = lerpFrames([Number.NaN, 4], [6, Number.NaN], 0.5)
    expect(out).toEqual([6, 4])
    expect(lerpFrames([Number.NaN], [Number.NaN], 0.5)[0]).toBeNaN()
  })

  it('rejects frames of different sizes', () => {
    expect(() => lerpFrames([1], [1, 2], 0.5)).toThrow(RangeError)
  })
})

describe('upsample', () => {
  it('interpolates values between cell centres', () => {
    // 1 row × 2 cols → 1 × 4: outer pixels clamp to the cells, inner ones blend.
    expect(upsample([0, 8], 1, 2, 4, 1)).toEqual([0, 2, 6, 8])
  })

  it('reproduces a uniform field exactly', () => {
    upsample([3, 3, 3, 3], 2, 2, 5, 5).forEach((v) => expect(v).toBeCloseTo(3))
  })

  it('ignores missing corners instead of spreading NaN', () => {
    const out = upsample([Number.NaN, 8], 1, 2, 4, 1)
    expect(out).toEqual([8, 8, 8, 8])
  })

  it('rejects a frame that does not match the grid', () => {
    expect(() => upsample([1, 2, 3], 2, 2, 4, 4)).toThrow(RangeError)
  })
})

describe('renderRainPixels', () => {
  it('colours in value space and leaves dry pixels transparent', () => {
    const px = renderRainPixels([0, 40], 1, 2, 4, 1)
    expect(px).toHaveLength(16)
    expect(Array.from(px.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(px.slice(12, 16))).toEqual([...RAIN_STOPS[RAIN_STOPS.length - 1].rgba])
  })
})

describe('gaussianBlur', () => {
  it('leaves a uniform field unchanged', () => {
    gaussianBlur(new Array(25).fill(4), 5, 5, 1.5).forEach((v) => expect(v).toBeCloseTo(4))
  })

  it('spreads a spike symmetrically and keeps its mass away from the edges', () => {
    const field = new Array(81).fill(0)
    field[40] = 81 // centre of 9×9
    const out = gaussianBlur(field, 9, 9, 1)
    expect(out[40]).toBeLessThan(81)
    expect(out[39]).toBeCloseTo(out[41])
    expect(out[31]).toBeCloseTo(out[49])
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(81, 0)
  })

  it('ignores missing pixels instead of spreading NaN', () => {
    const out = gaussianBlur([Number.NaN, 2, 2], 3, 1, 1)
    expect(out[0]).toBeCloseTo(2)
    expect(out[1]).toBeCloseTo(2)
    expect(gaussianBlur([Number.NaN], 1, 1, 1)[0]).toBeNaN()
  })

  it('is a no-op for a zero radius', () => {
    expect(gaussianBlur([1, 5, 9], 3, 1, 0)).toEqual([1, 5, 9])
  })
})
